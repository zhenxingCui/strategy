'use strict'

// Extend the active special-class daily details from the 2026-10-21 source
// cutoff through 2026-10-26. Existing 2026-10-01..21 rows are preserved.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const DATABASE = 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const TABLE = 't_sr_strategy_daily_ap_special'
const MONTH_TABLE = 't_sr_strategy_period_summary_ap_special'
const START = '2026-10-01'
const SOURCE_CUTOFF = '2026-10-21'
const EXTENSION_START = '2026-10-22'
const END = '2026-10-26'
const APPLY = process.argv.includes('--apply')
const DECLINE_SOURCE = path.join(ROOT, 'outputs/decline-v3-20261026/source-extract.json')
const CONFIGS = [
  {
    strategyClass: '降拆', expectedStrategies: 235,
    manifestPath: path.join(ROOT, 'front/src/views/strategyReview/active/declineSimulation.json'),
    mode: 'decline-excel-weights',
  },
  {
    strategyClass: '离', expectedStrategies: 14,
    manifestPath: path.join(ROOT, 'front/src/views/strategyReview/active/leaveSimulation.json'),
    mode: 'leave-same-weekday-average',
  },
]
const COUNT_FIELDS = ['original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'reject_count']
const MONEY_FIELDS = ['expected_income', 'actual_income']
const DATE_LIST = Array.from({ length: 5 }, (_, index) => `2026-10-${String(index + 22).padStart(2, '0')}`)
const round = (value) => Math.round(Number(value) + Number.EPSILON)
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100
const finiteOrNull = (value) => value === null || value === undefined ? null : Number(value)

function stableNoise(key, low = 0.86, high = 1.14) {
  let value = 2166136261
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0
  return low + (high - low) * value / 4294967295
}

function pct(numerator, denominator) {
  if (numerator === null || denominator === null || !denominator) return null
  return Math.round((Number(numerator) * 100 / Number(denominator) + Number.EPSILON) * 10000) / 10000
}

function sum(rows, field) {
  const values = rows.map((row) => finiteOrNull(row[field])).filter((value) => value !== null)
  return values.length ? values.reduce((total, value) => total + value, 0) : null
}

function average(rows, field) {
  const values = rows.map((row) => finiteOrNull(row[field])).filter((value) => value !== null)
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
}

function weekDay(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function fieldPresence(rows, field, label) {
  const count = rows.filter((row) => row[field] !== null && row[field] !== undefined).length
  assert(count === 0 || count === rows.length, `${label}/${field} has inconsistent NULL coverage (${count}/${rows.length})`)
  return count === rows.length
}

function loadDeclineWeights(manifest) {
  assert(fs.existsSync(DECLINE_SOURCE), `Missing matching decline source extract: ${DECLINE_SOURCE}`)
  const extracted = JSON.parse(fs.readFileSync(DECLINE_SOURCE, 'utf8'))
  assert.equal(extracted.sha256, manifest.sourceSha256, 'Decline source extract does not match the database source manifest')
  const labels = {
    push_count: '咨询量占比', usage_count: '接触量占比', reach_count: '派单量占比',
    target_conv_num: '派单量占比', product_conv_num: '成功量占比',
    original_cust: '咨询量占比', reject_count: '咨询量占比',
    expected_income: '咨询量占比', actual_income: '咨询量占比',
  }
  const sourceRows = (extracted.rawRows || []).filter((row) => row.sheetName === '分日数据')
  const weights = {}
  for (const [field, label] of Object.entries(labels)) {
    const match = sourceRows.find((row) => row.values && row.values[1] === label)
    assert(match, `Decline source is missing daily weights for ${label}`)
    const values = match.values.slice(2, 32).map(Number)
    assert.equal(values.length, 30, `Expected 30 decline daily weights for ${label}`)
    assert(values.every((value) => Number.isFinite(value) && value >= 0), `Invalid decline daily weights for ${label}`)
    const monthTotal = values.reduce((total, value) => total + value, 0)
    assert(Math.abs(monthTotal - 1) < 0.001, `${label} weights sum to ${monthTotal}, not 1`)
    const sourceWindowTotal = values.slice(0, 21).reduce((total, value) => total + value, 0)
    assert(sourceWindowTotal > 0, `Empty 1–21 daily source weights for ${label}`)
    weights[field] = { values, sourceWindowTotal }
  }
  return { sourceSha256: extracted.sha256, weights }
}

function declineDailyRows(monthlyRows, sourceWeights, sampleById) {
  const fields = [...COUNT_FIELDS, ...MONEY_FIELDS]
  const result = []
  for (const monthly of monthlyRows) {
    const sample = sampleById.get(monthly.strategy_id)
    assert(sample, `Missing prior daily row for ${monthly.strategy_id}`)
    for (const date of DATE_LIST) {
      const dayIndex = Number(date.slice(-2)) - 1
      const row = { ...sample, stat_month: date }
      for (const field of fields) {
        const total = finiteOrNull(monthly[field])
        if (total === null) {
          row[field] = null
          continue
        }
        const rule = sourceWeights.weights[field]
        const value = total * rule.values[dayIndex] / rule.sourceWindowTotal
        row[field] = MONEY_FIELDS.includes(field) ? round2(value) : round(value)
      }
      row.usage_rate = pct(row.usage_count, row.push_count)
      row.target_conv_rate = pct(row.target_conv_num, row.reach_count)
      // 降拆 Excel's product conversion rate is product conversions / consults.
      row.product_conv_rate = pct(row.product_conv_num, row.push_count)
      row.reject_rate = pct(row.reject_count, row.push_count)
      row.id = undefined
      row.create_time = new Date()
      row.update_time = new Date()
      result.push(row)
    }
  }
  return result
}

function sameWeekdayAverage(rows, field, date) {
  const day = weekDay(date)
  const matching = rows.filter((row) => weekDay(String(row.stat_month).slice(0, 10)) === day)
  return average(matching.length ? matching : rows, field)
}

function leaveDailyRows(monthlyRows, previousRows, sampleById) {
  const result = []
  for (const monthly of monthlyRows) {
    const history = previousRows.filter((row) => row.strategy_id === monthly.strategy_id)
    assert.equal(history.length, 21, `Expected 21 prior daily rows for ${monthly.strategy_id}`)
    const sample = sampleById.get(monthly.strategy_id)
    assert(sample, `Missing prior daily row for ${monthly.strategy_id}`)
    const recent = history.slice(-7)
    const pushTotal = sum(recent, 'push_count')
    const usageTotal = sum(recent, 'usage_count')
    const reachTotal = sum(recent, 'reach_count')
    const targetTotal = sum(recent, 'target_conv_num')
    const productTotal = sum(recent, 'product_conv_num')
    const pushObserved = fieldPresence(history, 'push_count', monthly.strategy_id)
    const usageObserved = fieldPresence(history, 'usage_count', monthly.strategy_id)
    const reachObserved = fieldPresence(history, 'reach_count', monthly.strategy_id)
    const targetObserved = fieldPresence(history, 'target_conv_num', monthly.strategy_id)
    const productObserved = fieldPresence(history, 'product_conv_num', monthly.strategy_id)
    const usageRatio = usageObserved && pushTotal ? usageTotal / pushTotal : null
    const reachDenominator = usageObserved ? usageTotal : pushTotal
    const reachRatio = reachObserved && reachDenominator ? reachTotal / reachDenominator : null
    const targetRatio = targetObserved && reachTotal ? targetTotal / reachTotal : null
    const productRatio = productObserved && reachTotal ? productTotal / reachTotal : null
    const productMatchesTarget = productObserved && targetObserved && history.every((row) => Number(row.product_conv_num) === Number(row.target_conv_num))

    for (const date of DATE_LIST) {
      const row = { ...sample, stat_month: date }
      const countNoise = stableNoise(`leave-daily-v1:${monthly.strategy_id}:${date}`, 0.92, 1.08)
    const pushBase = pushObserved ? sameWeekdayAverage(recent, 'push_count', date) : null
      row.push_count = pushBase === null ? null : Math.max(0, round(pushBase * countNoise))
      row.usage_count = usageObserved && usageRatio !== null
        ? Math.min(row.push_count, Math.max(0, round(row.push_count * usageRatio * stableNoise(`leave-usage:${monthly.strategy_id}:${date}`, 0.98, 1.02))))
        : null
      const reachParent = row.usage_count === null ? row.push_count : row.usage_count
      row.reach_count = reachObserved && reachRatio !== null
        ? Math.min(reachParent, Math.max(0, round(reachParent * reachRatio * stableNoise(`leave-reach:${monthly.strategy_id}:${date}`, 0.98, 1.02))))
        : null
      row.target_conv_num = targetObserved && targetRatio !== null
        ? Math.min(row.reach_count, Math.max(0, round(row.reach_count * targetRatio * stableNoise(`leave-target:${monthly.strategy_id}:${date}`, 0.98, 1.02))))
        : null
      row.product_conv_num = productMatchesTarget ? row.target_conv_num : productObserved && productRatio !== null
        ? Math.min(row.reach_count, Math.max(0, round(row.reach_count * productRatio * stableNoise(`leave-product:${monthly.strategy_id}:${date}`, 0.98, 1.02))))
        : null
      for (const field of ['original_cust', 'reject_count']) {
        const observed = fieldPresence(history, field, monthly.strategy_id)
        const base = observed ? sameWeekdayAverage(recent, field, date) : null
        row[field] = base === null ? null : Math.max(0, round(base * countNoise))
      }
      for (const field of MONEY_FIELDS) {
        const observed = fieldPresence(history, field, monthly.strategy_id)
        const base = observed ? sameWeekdayAverage(recent, field, date) : null
        row[field] = base === null ? null : Math.max(0, round2(base * countNoise))
      }
      row.usage_rate = pct(row.usage_count, row.push_count)
      row.target_conv_rate = pct(row.target_conv_num, row.reach_count)
      row.product_conv_rate = pct(row.product_conv_num, row.reach_count)
      row.reject_rate = pct(row.reject_count, row.push_count)
      row.id = undefined
      row.create_time = new Date()
      row.update_time = new Date()
      result.push(row)
    }
  }
  return result
}

function validateRows(config, rows) {
  assert.equal(rows.length, config.expectedStrategies * DATE_LIST.length, `${config.strategyClass} generated row count`)
  for (const row of rows) {
    assert(DATE_LIST.includes(String(row.stat_month).slice(0, 10)), `${config.strategyClass} has an out-of-range date`)
    for (const field of COUNT_FIELDS) {
      const value = finiteOrNull(row[field])
      assert(value === null || Number.isSafeInteger(value) && value >= 0, `${config.strategyClass}/${row.strategy_id}/${row.stat_month}: invalid ${field}`)
    }
    for (const field of MONEY_FIELDS) {
      const value = finiteOrNull(row[field])
      assert(value === null || Number.isFinite(value) && value >= 0, `${config.strategyClass}/${row.strategy_id}/${row.stat_month}: invalid ${field}`)
    }
    if (config.strategyClass === '离') {
      assert(row.usage_count <= row.push_count, `离 usage exceeds push: ${row.strategy_id}/${row.stat_month}`)
      assert(row.reach_count <= row.usage_count, `离 reach exceeds usage: ${row.strategy_id}/${row.stat_month}`)
      assert(row.target_conv_num <= row.reach_count && row.product_conv_num <= row.reach_count,
        `离 conversion exceeds reach: ${row.strategy_id}/${row.stat_month}`)
    }
  }
}

async function main() {
  assert(['127.0.0.1', 'localhost', '::1'].includes(HOST), 'This script is restricted to a loopback MySQL host')
  const outputDir = path.join(ROOT, 'outputs', `special-daily-through-20261026-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(outputDir, { recursive: true })
  const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE, dateStrings: true })
  let transaction = false
  try {
    const [[identity]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    assert.equal(identity.db, DATABASE, `Unexpected database: ${JSON.stringify(identity)}`)
    const prepared = []
    for (const config of CONFIGS) {
      const manifest = JSON.parse(fs.readFileSync(config.manifestPath, 'utf8'))
      assert.equal(manifest.strategyClass, config.strategyClass)
      assert.equal(manifest.sourceCutoff, SOURCE_CUTOFF)
      const [monthly] = await conn.query(
        `SELECT * FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND stat_month='2026-10-01' AND strategy_id<>'999' AND is_deleted=0 ORDER BY strategy_id`,
        [MONTH_TABLE, config.strategyClass],
      )
      assert.equal(monthly.length, config.expectedStrategies, `${config.strategyClass} monthly strategy count`)
      const ids = monthly.map((row) => row.strategy_id)
      assert.equal(new Set(ids).size, ids.length, `${config.strategyClass} duplicate monthly strategy IDs`)
      if (Array.isArray(manifest.dailyStrategyIds)) {
        assert.deepEqual([...ids].sort(), [...manifest.dailyStrategyIds].sort(), `${config.strategyClass} manifest strategy IDs`)
      }
      const [existing] = await conn.query(
        `SELECT * FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0 ORDER BY strategy_id,stat_month`,
        [TABLE, config.strategyClass, ids, START, SOURCE_CUTOFF],
      )
      assert.equal(existing.length, config.expectedStrategies * 21, `${config.strategyClass} source daily row count`)
      const byId = new Map()
      for (const row of existing) {
        if (!byId.has(row.strategy_id)) byId.set(row.strategy_id, [])
        byId.get(row.strategy_id).push(row)
      }
      for (const id of ids) {
        const rows = byId.get(id) || []
        assert.equal(rows.length, 21, `${config.strategyClass}/${id} existing daily count`)
        assert.equal(new Set(rows.map((row) => String(row.stat_month).slice(0, 10))).size, 21, `${config.strategyClass}/${id} duplicate source dates`)
      }
      const [existingTarget] = await conn.query(
        `SELECT * FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0 ORDER BY strategy_id,stat_month`,
        [TABLE, config.strategyClass, ids, EXTENSION_START, END],
      )
      assert.equal(existingTarget.length, 0, `${config.strategyClass} already has daily rows in the requested extension range; review before replacing`)
      const sampleById = new Map()
      for (const row of existing) if (String(row.stat_month).slice(0, 10) === SOURCE_CUTOFF) sampleById.set(row.strategy_id, row)
      const rows = config.mode === 'decline-excel-weights'
        ? declineDailyRows(monthly, loadDeclineWeights(manifest), sampleById)
        : leaveDailyRows(monthly, existing, sampleById)
      validateRows(config, rows)
      const [beforeMonth] = await conn.query(
        `SELECT COUNT(*) n,COUNT(DISTINCT strategy_id) strategies FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND stat_month='2026-10-01' AND strategy_id IN (?) AND is_deleted=0`,
        [MONTH_TABLE, config.strategyClass, ids],
      )
      prepared.push({ config, manifest, monthly, ids, existing, existingTarget, rows, beforeMonth: beforeMonth[0] })
    }

    const allRows = prepared.flatMap((item) => item.rows)
    const manifestBackup = Object.fromEntries(prepared.map((item) => [item.config.strategyClass, item.manifest]))
    const beforeBackup = {
      database: DATABASE,
      identity,
      backupScope: `${TABLE} active/999/降拆+离/October 2026 daily rows, plus source month facts and manifests`,
      dailyRows: prepared.flatMap((item) => [...item.existing, ...item.existingTarget]),
      monthlyRows: prepared.flatMap((item) => item.monthly),
      manifests: manifestBackup,
    }
    const backupPath = path.join(outputDir, 'before-extension-backup.json')
    fs.writeFileSync(backupPath, JSON.stringify(beforeBackup, null, 2), 'utf8')
    const simulationPath = path.join(outputDir, 'simulated-daily-20261022-26.json')
    fs.writeFileSync(simulationPath, JSON.stringify({
      simulated: true,
      sourceCutoff: SOURCE_CUTOFF,
      startDate: EXTENSION_START,
      endDate: END,
      method: {
        '降拆': '使用与已导入来源匹配的 Excel 全月分日权重；以 10/1–21 来源累计值为基数，按相同权重外推 10/22–26。',
        '离': '以 10/15–21 已有模拟日报为参考，按相同星期日均、近七日日漏斗比例和固定种子微扰外推 10/22–26，并保持逐日漏斗递减。',
      },
      rows: allRows,
    }, null, 2), 'utf8')
    const summary = {
      dryRun: !APPLY,
      database: DATABASE,
      sourceDailyWindow: `${START}..${SOURCE_CUTOFF}`,
      simulatedExtension: `${EXTENSION_START}..${END}`,
      strategies: Object.fromEntries(prepared.map((item) => [item.config.strategyClass, item.ids.length])),
      rowsToInsert: allRows.length,
      backupPath,
      simulationPath,
      unchangedExistingRows: prepared.reduce((count, item) => count + item.existing.length, 0),
    }
    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2))
      return
    }

    const [columns] = await conn.query(`SHOW COLUMNS FROM ??`, [TABLE])
    const autoColumns = new Set(columns.filter((column) => String(column.Extra || '').includes('auto_increment')).map((column) => column.Field))
    const generatedColumns = new Set(columns.filter((column) => /GENERATED/i.test(String(column.Extra || ''))).map((column) => column.Field))
    const insertKeys = Object.keys(allRows[0]).filter((key) => key !== 'id' && !autoColumns.has(key) && !generatedColumns.has(key))
    assert(insertKeys.includes('stat_month') && insertKeys.includes('strategy_id'))

    await conn.beginTransaction(); transaction = true
    for (const item of prepared) {
      const [locked] = await conn.query(
        `SELECT strategy_id,stat_month FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0 FOR UPDATE`,
        [TABLE, item.config.strategyClass, item.ids, EXTENSION_START, END],
      )
      assert.equal(locked.length, 0, `${item.config.strategyClass} extension range changed after preflight`)
      const rows = item.rows.map((row) => insertKeys.map((key) => row[key] === undefined ? null : row[key]))
      await conn.query('INSERT INTO ?? (??) VALUES ?', [TABLE, insertKeys, rows])
    }

    const verification = []
    for (const item of prepared) {
      const [result] = await conn.query(
        `SELECT COUNT(*) rows_n,COUNT(DISTINCT strategy_id) strategies,COUNT(DISTINCT stat_month) days,MIN(stat_month) first_day,MAX(stat_month) last_day,SUM(push_count) push_count,SUM(usage_count) usage_count,SUM(reach_count) reach_count,SUM(target_conv_num) target_conv_num,SUM(product_conv_num) product_conv_num FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0`,
        [TABLE, item.config.strategyClass, item.ids, START, END],
      )
      const current = result[0]
      assert.equal(Number(current.rows_n), item.config.expectedStrategies * 26, `${item.config.strategyClass} total daily rows`)
      assert.equal(Number(current.strategies), item.config.expectedStrategies, `${item.config.strategyClass} daily strategy count`)
      assert.equal(Number(current.days), 26, `${item.config.strategyClass} date count`)
      assert.equal(String(current.first_day).slice(0, 10), START)
      assert.equal(String(current.last_day).slice(0, 10), END)
      const [byDate] = await conn.query(
        `SELECT stat_month,COUNT(*) n FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0 GROUP BY stat_month ORDER BY stat_month`,
        [TABLE, item.config.strategyClass, item.ids, START, END],
      )
      assert.equal(byDate.length, 26, `${item.config.strategyClass} daily date groups`)
      assert(byDate.every((row) => Number(row.n) === item.config.expectedStrategies), `${item.config.strategyClass} daily rows per date`)
      const [duplicates] = await conn.query(
        `SELECT strategy_id,stat_month,COUNT(*) n FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN ? AND ? AND is_deleted=0 GROUP BY strategy_id,stat_month HAVING COUNT(*)<>1 LIMIT 1`,
        [TABLE, item.config.strategyClass, item.ids, START, END],
      )
      assert.equal(duplicates.length, 0, `${item.config.strategyClass} duplicate daily keys`)
      const [monthlyCheck] = await conn.query(
        `SELECT COUNT(*) n,COUNT(DISTINCT strategy_id) strategies FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND stat_month='2026-10-01' AND strategy_id IN (?) AND is_deleted=0`,
        [MONTH_TABLE, item.config.strategyClass, item.ids],
      )
      assert.deepEqual(monthlyCheck[0], item.beforeMonth, `${item.config.strategyClass} monthly source facts changed`)
      verification.push({ strategyClass: item.config.strategyClass, ...current })
    }
    await conn.commit(); transaction = false

    for (const item of prepared) {
      Object.assign(item.manifest, {
        dailyStartDate: START,
        dailyEndDate: END,
        dailyDays: 26,
        dailyRowCount: item.config.expectedStrategies * 26,
        dailyExtensionStartDate: EXTENSION_START,
        dailyExtensionEndDate: END,
        dailyExtensionIsSimulated: true,
        dailyExtensionMethod: item.config.mode,
      })
      if (item.config.strategyClass === '降拆') {
        item.manifest.dailyMethod = 'Excel 分日比例按截至21日重新归一化后分摊1–21日；以相同全月权重外推22–26日。为模拟分摊，不代表实际逐日业绩。'
      } else {
        item.manifest.dailyMethod = '1–21日按 Excel 分类日权重拆分；22–26日按10/15–21日同星期日均及近七日日漏斗比例外推，逐策略逐日漏斗递减。为模拟分摊，不代表实际逐日业绩。'
      }
      fs.writeFileSync(item.config.manifestPath, `${JSON.stringify(item.manifest, null, 2)}\n`, 'utf8')
    }
    const applied = { ...summary, dryRun: false, verification, appliedAt: new Date().toISOString() }
    fs.writeFileSync(path.join(outputDir, 'import-result.json'), JSON.stringify(applied, null, 2), 'utf8')
    console.log(JSON.stringify(applied, null, 2))
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
