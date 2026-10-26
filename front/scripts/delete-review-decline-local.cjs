// Soft-delete only active-class 降拆 records from the local strategy review database.
// Safe by default: inspect and back up the target scope first; pass --apply to commit.
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const DATABASE = 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const CITY_ID = '999'
const APPLY = process.argv.includes('--apply')

const TABLES = {
  master: 't_sr_strategy_special',
  period: 't_sr_strategy_period_summary_ap_special',
  daily: 't_sr_strategy_daily_ap_special',
  business: 't_sr_strategy_biz_capacity_special',
  reject: 't_sr_strategy_reject_reason_special',
  kpi: 't_sr_kpi_summary_special',
  channel: 't_sr_channel_summary_ap_special',
  channelCapacity: 't_sr_channel_monthly_capacity_ap_special',
  channelBusiness: 't_sr_channel_biz_capacity_ap_special',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function isLoopback(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host)
}

async function queryRows(conn, sql, values = []) {
  const [rows] = await conn.query(sql, values)
  return rows
}

async function tableColumns(conn, table) {
  const rows = await queryRows(conn, 'SHOW COLUMNS FROM ??', [table])
  return new Set(rows.map((row) => row.Field))
}

async function count(conn, sql, values = []) {
  const [row] = await queryRows(conn, sql, values)
  return Number(row.n)
}

async function classCounts(conn, strategyClass) {
  const values = [strategyClass, CITY_ID]
  const result = {
    master: await count(conn, 'SELECT COUNT(*) n FROM ?? WHERE tab_type=\'active\' AND strategy_class=? AND is_deleted=0', [TABLES.master, strategyClass]),
    period: await count(conn, 'SELECT COUNT(*) n FROM ?? WHERE tab_type=\'active\' AND strategy_class=? AND city_id=? AND is_deleted=0', [TABLES.period, ...values]),
    daily: await count(conn, 'SELECT COUNT(*) n FROM ?? WHERE tab_type=\'active\' AND strategy_class=? AND city_id=? AND is_deleted=0', [TABLES.daily, ...values]),
  }
  for (const kind of ['business', 'reject']) {
    const table = TABLES[kind]
    result[kind] = await count(conn,
      'SELECT COUNT(*) n FROM ?? f JOIN ?? s ON s.strategy_code=f.strategy_id AND s.tab_type=\'active\' WHERE s.strategy_class=? AND f.city_id=? AND f.is_deleted=0',
      [table, TABLES.master, ...values],
    )
  }
  for (const kind of ['period', 'kpi', 'channel', 'channelCapacity', 'channelBusiness']) {
    const table = TABLES[kind === 'period' ? 'period' : kind]
    const hasAggregateId = kind === 'period'
    result[`rollup_${kind}`] = await count(conn,
      `SELECT COUNT(*) n FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0${hasAggregateId ? " AND strategy_id='999'" : ''}`,
      [table, ...values],
    )
  }
  return result
}

async function main() {
  assert(isLoopback(HOST), '只允许连接本机数据库')
  const conn = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASSWORD,
    database: DATABASE, dateStrings: true, decimalNumbers: true, charset: 'utf8mb4',
  })
  let transaction = false
  try {
    const [[identity]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    assert(identity.db === DATABASE, `数据库不匹配：${JSON.stringify(identity)}`)

    for (const table of Object.values(TABLES)) {
      const columns = await tableColumns(conn, table)
      assert(columns.has('is_deleted'), `${table} 缺少 is_deleted，停止删除`)
    }

    const masters = await queryRows(conn,
      'SELECT * FROM ?? WHERE tab_type=\'active\' AND strategy_class=\'降拆\' AND is_deleted=0', [TABLES.master])
    const periodRows = await queryRows(conn,
      'SELECT * FROM ?? WHERE tab_type=\'active\' AND strategy_class=\'降拆\' AND city_id=? AND is_deleted=0', [TABLES.period, CITY_ID])
    const dailyRows = await queryRows(conn,
      'SELECT * FROM ?? WHERE tab_type=\'active\' AND strategy_class=\'降拆\' AND city_id=? AND is_deleted=0', [TABLES.daily, CITY_ID])
    const codes = [...new Set([
      ...masters.map((row) => row.strategy_code),
      ...periodRows.map((row) => row.strategy_id),
      ...dailyRows.map((row) => row.strategy_id),
    ].filter((value) => value && value !== '999'))]

    const backup = {
      createdAt: new Date().toISOString(),
      database: DATABASE,
      scope: { tabType: 'active', strategyClass: '降拆', cityId: CITY_ID, action: 'logical delete' },
      strategyCodes: codes,
      tables: {
        [TABLES.master]: masters,
        [`${TABLES.period}#class_rows`]: periodRows,
        [TABLES.daily]: dailyRows,
      },
      beforeLeaveCounts: await classCounts(conn, '离'),
      beforeDeclineCounts: await classCounts(conn, '降拆'),
    }
    for (const kind of ['business', 'reject']) {
      backup.tables[TABLES[kind]] = codes.length
        ? await queryRows(conn, 'SELECT * FROM ?? WHERE city_id=? AND strategy_id IN (?) AND is_deleted=0', [TABLES[kind], CITY_ID, codes])
        : []
    }
    for (const kind of ['period', 'kpi', 'channel', 'channelCapacity', 'channelBusiness']) {
      const table = TABLES[kind]
      backup.tables[`${table}#rollup_rows`] = await queryRows(conn,
        `SELECT * FROM ?? WHERE tab_type='active' AND strategy_class='降拆' AND city_id=? AND is_deleted=0${kind === 'period' ? " AND strategy_id='999'" : ''}`,
        [table, CITY_ID],
      )
    }

    const outDir = path.join(ROOT, 'outputs', `review-decline-delete-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    fs.mkdirSync(outDir, { recursive: true })
    const backupPath = path.join(outDir, 'database-backup.json')
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')

    const preview = {
      dryRun: !APPLY,
      database: identity.db,
      scope: backup.scope,
      strategyCodes: codes.length,
      activeRows: Object.fromEntries(Object.entries(backup.tables).map(([table, rows]) => [table, rows.length])),
      beforeLeaveCounts: backup.beforeLeaveCounts,
      backupPath,
    }
    if (!APPLY) {
      console.log(JSON.stringify(preview, null, 2))
      return
    }

    await conn.beginTransaction()
    transaction = true
    const affected = {}
    const statements = [
      ['master', 'UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type=\'active\' AND strategy_class=\'降拆\' AND is_deleted=0', [TABLES.master]],
      ['daily', 'UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type=\'active\' AND strategy_class=\'降拆\' AND city_id=? AND is_deleted=0', [TABLES.daily, CITY_ID]],
    ]
    for (const [kind, sql, values] of statements) {
      const [result] = await conn.query(sql, values)
      affected[TABLES[kind]] = result.affectedRows
    }
    const [periodResult] = await conn.query(
      "UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id=? AND strategy_id<>'999' AND is_deleted=0",
      [TABLES.period, CITY_ID],
    )
    affected[`${TABLES.period}#class_rows`] = periodResult.affectedRows
    for (const kind of ['business', 'reject']) {
      let rows = 0
      if (codes.length) {
        const [result] = await conn.query('UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE city_id=? AND strategy_id IN (?) AND is_deleted=0', [TABLES[kind], CITY_ID, codes])
        rows = result.affectedRows
      }
      affected[TABLES[kind]] = rows
    }
    const rollupConditions = [
      ['kpi', "tab_type='active' AND strategy_class='降拆' AND city_id=? AND is_deleted=0"],
      ['channel', "tab_type='active' AND strategy_class='降拆' AND city_id=? AND is_deleted=0"],
      ['channelCapacity', "tab_type='active' AND strategy_class='降拆' AND city_id=? AND is_deleted=0"],
      ['channelBusiness', "tab_type='active' AND strategy_class='降拆' AND city_id=? AND is_deleted=0"],
    ]
    const [periodRollupResult] = await conn.query(
      "UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id=? AND strategy_id='999' AND is_deleted=0",
      [TABLES.period, CITY_ID],
    )
    affected[`${TABLES.period}#rollup_rows`] = periodRollupResult.affectedRows
    for (const [kind, where] of rollupConditions) {
      const [result] = await conn.query(`UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE ${where}`, [TABLES[kind], CITY_ID])
      affected[`${TABLES[kind]}#rollup_rows`] = result.affectedRows
    }

    const afterDeclineCounts = await classCounts(conn, '降拆')
    assert(Object.values(afterDeclineCounts).every((value) => value === 0), `降拆有效数据未清空：${JSON.stringify(afterDeclineCounts)}`)
    const afterLeaveCounts = await classCounts(conn, '离')
    assert(JSON.stringify(afterLeaveCounts) === JSON.stringify(backup.beforeLeaveCounts),
      `离类数据行数发生变化：before=${JSON.stringify(backup.beforeLeaveCounts)}, after=${JSON.stringify(afterLeaveCounts)}`)
    await conn.commit()
    transaction = false

    const result = {
      ...preview,
      dryRun: false,
      appliedAt: new Date().toISOString(),
      affectedRows: affected,
      afterDeclineCounts,
      afterLeaveCounts,
      verification: '降拆有效记录为0；离类共享表有效记录数保持不变',
    }
    const resultPath = path.join(outDir, 'delete-result.json')
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8')
    console.log(JSON.stringify({ ...result, resultPath }, null, 2))
  } catch (error) {
    if (transaction) await conn.rollback()
    throw error
  } finally {
    await conn.end()
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
