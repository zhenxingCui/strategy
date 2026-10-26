/* Align the local key-product fact tables with the active/passive fact schema.
 * The original tables are kept as dated backups before the replacement is swapped in.
 */
const mysql = require('mysql2/promise')

const database = 'strategy_review_active_class_local'
const suffix = '20261025'
const periodTable = 't_sr_strategy_period_summary_ctrl'
const dailyTable = 't_sr_strategy_daily_ctrl'
const periodStage = `${periodTable}_align_${suffix}`
const dailyStage = `${dailyTable}_align_${suffix}`
const periodBackup = `${periodTable}_legacy_${suffix}`
const dailyBackup = `${dailyTable}_legacy_${suffix}`

async function columns(conn, table) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',
    [database, table],
  )
  return rows.map(row => row.COLUMN_NAME)
}

async function count(conn, table) {
  const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``)
  return Number(row.n)
}

async function main() {
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('迁移仅允许连接本机 MySQL。')
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root',
    password: process.env.SR_DB_PASSWORD || '123456',
    database,
    multipleStatements: true,
  })

  try {
    const [existing] = await conn.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN (?)',
      [database, [periodTable, dailyTable, 't_sr_strategy_period_summary_ap', 't_sr_strategy_daily_ap', periodStage, dailyStage, periodBackup, dailyBackup]],
    )
    const names = new Set(existing.map(row => row.TABLE_NAME))
    for (const table of [periodTable, dailyTable, 't_sr_strategy_period_summary_ap', 't_sr_strategy_daily_ap']) {
      if (!names.has(table)) throw new Error(`缺少必要表 ${table}，未执行迁移`)
    }

    const oldPeriodColumns = await columns(conn, periodTable)
    const oldDailyColumns = await columns(conn, dailyTable)
    if (oldPeriodColumns.includes('push_count') && !oldPeriodColumns.includes('consult_count')
      && oldDailyColumns.includes('stat_month') && !oldDailyColumns.includes('stat_date')) {
      console.log('重点产品表已是标准字段，无需迁移。')
      return
    }
    for (const table of [periodStage, dailyStage, periodBackup, dailyBackup]) {
      if (names.has(table)) throw new Error(`迁移目标表已存在：${table}；为保护数据，未覆盖。`)
    }
    for (const field of ['strategy_id', 'strategy_code', 'strategy_name', 'stat_month', 'strategy_count', 'consult_count', 'retain_count', 'retain_rate', 'dispatch_count', 'success_count', 'success_rate', 'income', 'city_id', 'county_id', 'is_deleted']) {
      if (!oldPeriodColumns.includes(field)) throw new Error(`旧月表缺少预期字段 ${field}，未执行迁移。`)
    }
    for (const field of ['strategy_id', 'stat_date', 'channel', 'big_category', 'small_category', 'strategy_name', 'consult_count', 'retain_count', 'retain_rate', 'dispatch_count', 'success_count', 'success_rate', 'city_id', 'county_id', 'is_deleted']) {
      if (!oldDailyColumns.includes(field)) throw new Error(`旧日表缺少预期字段 ${field}，未执行迁移。`)
    }

    const sourcePeriodRows = await count(conn, periodTable)
    const sourceDailyRows = await count(conn, dailyTable)
    await conn.query(`CREATE TABLE \`${periodStage}\` LIKE t_sr_strategy_period_summary_ap`)
    await conn.query(`CREATE TABLE \`${dailyStage}\` LIKE t_sr_strategy_daily_ap`)

    const dailyStageColumns = await columns(conn, dailyStage)
    if (dailyStageColumns.includes('stat_date') && !dailyStageColumns.includes('stat_month')) {
      await conn.query(`ALTER TABLE \`${dailyStage}\` RENAME COLUMN stat_date TO stat_month`)
    }
    const alignedDailyColumns = await columns(conn, dailyStage)
    if (!alignedDailyColumns.includes('stat_month') || alignedDailyColumns.includes('stat_date')) {
      throw new Error('日表模板不能提供 stat_month 日期字段，未切换原表。')
    }

    await conn.query(`
      INSERT INTO \`${periodStage}\` (
        id, tab_type, strategy_class, strategy_id, strategy_code, strategy_name, channel,
        big_category, small_category, stat_month, strategy_count,
        original_cust, original_cust_qoq, push_count, push_count_qoq,
        usage_count, usage_count_qoq, usage_rate, usage_rate_qoq,
        reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq,
        target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq,
        product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq,
        actual_income, actual_income_qoq, reject_rate, reject_rate_qoq, reject_count,
        original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy,
        target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy,
        expected_income_yoy, actual_income_yoy, reject_rate_yoy,
        city_id, county_id, create_time, update_time, is_deleted
      )
      SELECT id, 'control', '全部', strategy_id, strategy_code, strategy_name, channel,
        big_category, small_category, stat_month, strategy_count,
        NULL, NULL, consult_count, consult_count_qoq,
        retain_count, retain_count_qoq, retain_rate, retain_rate_qoq,
        dispatch_count, dispatch_count_qoq, NULL, NULL,
        NULL, NULL, success_count, success_count_qoq,
        success_rate, success_rate_qoq, NULL, NULL,
        income, income_qoq, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        city_id, county_id, NULL, NULL, is_deleted
      FROM \`${periodTable}\`
    `)

    await conn.query(`
      INSERT INTO \`${dailyStage}\` (
        id, tab_type, strategy_class, strategy_id, stat_month, channel, big_category,
        small_category, strategy_name, original_cust, push_count, usage_count, usage_rate,
        reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate,
        expected_income, actual_income, reject_count, reject_rate, strategy_code,
        city_id, county_id, create_time, update_time, is_deleted
      )
      SELECT id, 'control', '全部', strategy_id, stat_date, channel, big_category,
        small_category, strategy_name, NULL, consult_count, retain_count, retain_rate,
        dispatch_count, NULL, NULL, success_count, success_rate,
        NULL, NULL, NULL, NULL, strategy_id, city_id, county_id, NULL, NULL, is_deleted
      FROM \`${dailyTable}\`
    `)

    const [periodStageRows, dailyStageRows] = await Promise.all([
      count(conn, periodStage), count(conn, dailyStage),
    ])
    if (periodStageRows !== sourcePeriodRows || dailyStageRows !== sourceDailyRows) {
      throw new Error(`行数校验失败（月表 ${sourcePeriodRows}->${periodStageRows}，日表 ${sourceDailyRows}->${dailyStageRows}），原表未切换。`)
    }
    const [[sourceSums]] = await conn.query(`SELECT SUM(consult_count) push_count, SUM(retain_count) usage_count, SUM(dispatch_count) reach_count, SUM(success_count) product_conv_num, SUM(income) actual_income FROM \`${periodTable}\``)
    const [[stageSums]] = await conn.query(`SELECT SUM(push_count) push_count, SUM(usage_count) usage_count, SUM(reach_count) reach_count, SUM(product_conv_num) product_conv_num, SUM(actual_income) actual_income FROM \`${periodStage}\``)
    for (const key of ['push_count', 'usage_count', 'reach_count', 'product_conv_num', 'actual_income']) {
      if (Number(sourceSums[key] || 0) !== Number(stageSums[key] || 0)) throw new Error(`月表指标校验失败：${key}，原表未切换。`)
    }

    await conn.query(`RENAME TABLE \`${periodTable}\` TO \`${periodBackup}\`, \`${periodStage}\` TO \`${periodTable}\`, \`${dailyTable}\` TO \`${dailyBackup}\`, \`${dailyStage}\` TO \`${dailyTable}\``)
    console.log(JSON.stringify({
      database,
      periodRows: sourcePeriodRows,
      dailyRows: sourceDailyRows,
      metricMap: {
        consult_count: 'push_count', retain_count: 'usage_count', retain_rate: 'usage_rate',
        dispatch_count: 'reach_count', success_count: 'product_conv_num',
        success_rate: 'product_conv_rate', income: 'actual_income', stat_date: 'stat_month',
      },
      backupTables: [periodBackup, dailyBackup],
    }, null, 2))
  } finally {
    await conn.end()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
