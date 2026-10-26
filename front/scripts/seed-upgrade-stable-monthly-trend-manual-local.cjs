const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const TABLE = 't_sr_upgrade_stable_monthly_trend_manual'
const DDL = 'strategy_review_add_upgrade_stable_monthly_trend_manual.sql'
const ALL = '全部'
const CLASSES = ['升接', '稳']
const SUM_FIELDS = ['strategy_count', 'original_cust', 'push_count', 'usage_count', 'reach_count', 'product_conv_num', 'actual_income']
const RATE_CODES = new Set(['usage_rate', 'reach_rate', 'product_conv_rate'])
const TREND_METRICS = [
  'strategy_count', 'original_cust', 'push_count', 'usage_count', 'reach_count',
  'product_conv_num', 'actual_income', 'usage_rate', 'reach_rate', 'product_conv_rate',
]
const SCALE = 4n

function asScaled(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) throw new Error(`Unsupported decimal value from source facts: ${text}`)
  const fraction = (match[3] || '').padEnd(Number(SCALE), '0').slice(0, Number(SCALE))
  const scaled = BigInt(match[2]) * 10n ** SCALE + BigInt(fraction || '0')
  return match[1] ? -scaled : scaled
}

function formatScaled(value, scale = SCALE) {
  if (value === null || value === undefined) return null
  const negative = value < 0n
  const absolute = negative ? -value : value
  const factor = 10n ** scale
  return `${negative ? '-' : ''}${absolute / factor}.${String(absolute % factor).padStart(Number(scale), '0')}`
}

function roundedDivide(numerator, denominator) {
  if (denominator === 0n) return null
  const negative = (numerator < 0n) !== (denominator < 0n)
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const quotient = n / d
  const remainder = n % d
  const rounded = quotient + (remainder * 2n >= d ? 1n : 0n)
  return negative ? -rounded : rounded
}

function ratioPercent(numerator, denominator) {
  if (numerator === null || denominator === null || denominator === 0n) return null
  return formatScaled(roundedDivide(numerator * 100n * 100n, denominator), 2n)
}

function normalize(value) {
  if (value === null || value === undefined || String(value).trim() === '') return ALL
  return String(value).trim()
}

function distinct(values) {
  return [...new Map(values.map((value) => [JSON.stringify(value), value])).values()]
}

function scopeHash(scope) {
  return crypto.createHash('sha256').update(JSON.stringify([
    scope.strategy_class, scope.channel, scope.big_category, scope.small_category, scope.city_id, scope.county_id,
  ])).digest('hex')
}

function scopesFor(fact) {
  const channel = normalize(fact.channel)
  const big = normalize(fact.big_category)
  const small = normalize(fact.small_category)
  const city = normalize(fact.city_id)
  const county = normalize(fact.county_id)
  const channels = distinct([...(channel !== ALL ? [channel] : []), ALL])
  const categories = distinct([
    ...(big !== ALL && small !== ALL ? [[big, small]] : []),
    ...(big !== ALL ? [[big, ALL]] : []),
    [ALL, ALL],
  ])
  const regions = distinct([
    ...(city !== ALL && county !== ALL ? [[city, county]] : []),
    ...(city !== ALL ? [[city, ALL]] : []),
    [ALL, ALL],
  ])
  return channels.flatMap((channelValue) => categories.flatMap(([bigCategory, smallCategory]) =>
    regions.map(([cityId, countyId]) => ({
      strategy_class: fact.strategy_class,
      channel: channelValue,
      big_category: bigCategory,
      small_category: smallCategory,
      city_id: cityId,
      county_id: countyId,
    }))))
}

function metricValues(aggregate) {
  return {
    // Strategy count follows the source fact count; multiple rows with the same strategy_id still count separately.
    strategy_count: formatScaled(aggregate.sums.strategy_count),
    original_cust: formatScaled(aggregate.sums.original_cust),
    push_count: formatScaled(aggregate.sums.push_count),
    usage_count: formatScaled(aggregate.sums.usage_count),
    reach_count: formatScaled(aggregate.sums.reach_count),
    product_conv_num: formatScaled(aggregate.sums.product_conv_num),
    actual_income: formatScaled(aggregate.sums.actual_income),
    usage_rate: ratioPercent(aggregate.sums.usage_count, aggregate.sums.push_count),
    reach_rate: ratioPercent(aggregate.sums.reach_count, aggregate.sums.usage_count),
    product_conv_rate: ratioPercent(aggregate.sums.product_conv_num, aggregate.sums.reach_count),
  }
}

function buildRows(facts) {
  const aggregates = new Map()
  for (const fact of facts) {
    const statMonth = `${String(fact.stat_month).slice(0, 7)}-01`
    for (const scope of scopesFor(fact)) {
      const key = JSON.stringify([statMonth, scope.strategy_class, scope.channel, scope.big_category,
        scope.small_category, scope.city_id, scope.county_id])
      let aggregate = aggregates.get(key)
      if (!aggregate) {
        aggregate = {
          stat_month: statMonth,
          scope,
          sums: Object.fromEntries(SUM_FIELDS.map((field) => [field, null])),
        }
        aggregates.set(key, aggregate)
      }
      for (const field of SUM_FIELDS) {
        const value = asScaled(fact[field])
        if (value !== null) aggregate.sums[field] = (aggregate.sums[field] || 0n) + value
      }
    }
  }

  const rows = []
  for (const aggregate of aggregates.values()) {
    const values = metricValues(aggregate)
    for (const metricCode of TREND_METRICS) {
      rows.push({
        stat_month: aggregate.stat_month,
        ...aggregate.scope,
        metric_code: metricCode,
        metric_value: values[metricCode],
        // Match the audience table behavior: no calculated QoQ is substituted for a missing manual value.
        manual_qoq: null,
        qoq_unit: RATE_CODES.has(metricCode) ? 'pp' : 'percent',
        scope_hash: scopeHash(aggregate.scope),
        status: 1,
        source_batch: 'current-data-backfill',
        remark: null,
      })
    }
  }
  return rows
}

async function seed(connection) {
  const [facts] = await connection.query(`
    SELECT DATE_FORMAT(stat_month, '%Y-%m-%d') AS stat_month,
           strategy_class, strategy_id, channel, big_category, small_category, city_id, county_id,
           strategy_count, original_cust, push_count, usage_count, reach_count, product_conv_num, actual_income
    FROM t_sr_strategy_period_summary_ap
    WHERE tab_type = 'active' AND strategy_class IN ('升接', '稳') AND is_deleted = 0
      AND strategy_id IS NOT NULL AND strategy_id != '999'
      AND channel IS NOT NULL AND channel != '' AND channel != '全部'
      AND big_category IS NOT NULL AND big_category != '' AND big_category != '全部'
      AND COALESCE(small_category, '') != '全部'
    ORDER BY strategy_class, stat_month, strategy_id, channel, big_category, small_category
  `)
  const rows = buildRows(facts)
  const columns = [
    'stat_month', 'strategy_class', 'channel', 'big_category', 'small_category', 'city_id', 'county_id',
    'metric_code', 'metric_value', 'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark',
  ]
  const update = columns
    .filter((column) => !['stat_month', 'strategy_class', 'metric_code', 'scope_hash', 'manual_qoq', 'status', 'remark'].includes(column))
    .map((column) => `${column}=VALUES(${column})`).join(', ')
  for (let index = 0; index < rows.length; index += 300) {
    await connection.query(`INSERT INTO ${TABLE} (${columns.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${update}`,
      [rows.slice(index, index + 300).map((row) => columns.map((column) => row[column]))])
  }
  const [summary] = await connection.query(`
    SELECT COUNT(*) AS row_count,
           COUNT(DISTINCT stat_month) AS month_count,
           COUNT(DISTINCT strategy_class) AS strategy_class_count,
           SUM(manual_qoq IS NOT NULL) AS qoq_count
    FROM ${TABLE}
    WHERE source_batch = 'current-data-backfill' AND status = 1
  `)
  return { sourceFacts: facts.length, generatedRows: rows.length, ...summary[0] }
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local') throw new Error(`Refusing to seed non-local database: ${DATABASE}`)
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error(`Refusing non-local MySQL host: ${host}`)
  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root',
    password: process.env.SR_DB_PASSWORD || '123456',
    database: DATABASE,
    dateStrings: true,
    charset: 'utf8mb4',
  })
  try {
    const [identity] = await connection.query('SELECT DATABASE() AS db')
    if (identity[0].db !== DATABASE) throw new Error('Connected database identity does not match the protected local target')
    await connection.query(fs.readFileSync(path.resolve(__dirname, `../../back/src/main/resources/sql/${DDL}`), 'utf8'))
    await connection.beginTransaction()
    const summary = await seed(connection)
    await connection.commit()
    console.log(JSON.stringify({ database: DATABASE, ...summary }, null, 2))
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}

if (require.main === module) main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

module.exports = { buildRows, seed }
