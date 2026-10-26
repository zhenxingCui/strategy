const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const TABLE = 't_sr_control_monthly_trend_manual'
const ALL = '全部'
const SUM_FIELDS = ['push_count', 'usage_count', 'reach_count', 'product_conv_num', 'actual_income']
const RATE_CODES = new Set(['retain_rate', 'reach_rate', 'success_rate'])
const TREND_METRICS = [
  'strategy_count', 'consult_count', 'retain_count', 'retain_rate', 'reach_rate',
  'dispatch_count', 'success_count', 'success_rate', 'income',
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
  return formatScaled(roundedDivide(numerator * 100n * 10n ** SCALE, denominator))
}

function normalize(value) {
  if (value === null || value === undefined || String(value).trim() === '') return ALL
  return String(value).trim()
}

function distinct(values) {
  return [...new Set(values)]
}

function scopesFor(row) {
  const product = normalize(row.product_name)
  const bigCategory = normalize(row.big_category)
  const channel = normalize(row.channel)
  const city = normalize(row.city_id)
  const county = normalize(row.county_id)
  const products = distinct([product, ALL])
  const bigCategories = distinct([bigCategory, ALL])
  const channels = distinct([channel, ALL])
  const regions = distinct([
    JSON.stringify([ALL, ALL]),
    ...(city !== ALL ? [JSON.stringify([city, ALL])] : []),
    ...(county !== ALL ? [JSON.stringify([ALL, county])] : []),
    ...(city !== ALL && county !== ALL ? [JSON.stringify([city, county])] : []),
  ]).map((region) => JSON.parse(region))
  return products.flatMap((productName) =>
    bigCategories.flatMap((bigCategoryValue) =>
      channels.flatMap((channelValue) => regions.map(([cityId, countyId]) => ({
        product_name: productName,
        big_category: bigCategoryValue,
        channel: channelValue,
        city_id: cityId,
        county_id: countyId,
      }))),
    ),
  )
}

function scopeHash(scope) {
  return crypto.createHash('sha256').update(JSON.stringify([
    scope.product_name, scope.big_category, scope.channel, scope.city_id, scope.county_id,
  ])).digest('hex')
}

function metricValues(aggregate) {
  const sums = aggregate.sums
  const complete = (numerator, denominator) => (aggregate.missing[numerator] || 0) === 0
    && (aggregate.missing[denominator] || 0) === 0
  return {
    strategy_count: formatScaled(BigInt(aggregate.strategyIds.size) * 10n ** SCALE),
    consult_count: formatScaled(sums.push_count),
    retain_count: formatScaled(sums.usage_count),
    retain_rate: complete('usage_count', 'push_count') ? ratioPercent(sums.usage_count, sums.push_count) : null,
    reach_rate: complete('reach_count', 'usage_count') ? ratioPercent(sums.reach_count, sums.usage_count) : null,
    dispatch_count: formatScaled(sums.reach_count),
    success_count: formatScaled(sums.product_conv_num),
    success_rate: complete('product_conv_num', 'reach_count') ? ratioPercent(sums.product_conv_num, sums.reach_count) : null,
    income: formatScaled(sums.actual_income),
  }
}

function buildRows(facts) {
  const aggregates = new Map()
  for (const fact of facts) {
    const statMonth = `${String(fact.stat_month).slice(0, 7)}-01`
    for (const scope of scopesFor(fact)) {
      const hash = scopeHash(scope)
      const key = JSON.stringify([statMonth, hash])
      let aggregate = aggregates.get(key)
      if (!aggregate) {
        aggregate = {
          stat_month: statMonth,
          scope,
          strategyIds: new Set(),
          sums: Object.fromEntries(SUM_FIELDS.map((field) => [field, null])),
          missing: Object.fromEntries(SUM_FIELDS.map((field) => [field, 0])),
        }
        aggregates.set(key, aggregate)
      }
      aggregate.strategyIds.add(String(fact.strategy_id))
      for (const field of SUM_FIELDS) {
        const value = asScaled(fact[field])
        if (value !== null) aggregate.sums[field] = (aggregate.sums[field] || 0n) + value
        else aggregate.missing[field] += 1
      }
    }
  }

  const rows = []
  for (const aggregate of aggregates.values()) {
    const values = metricValues(aggregate)
    const hash = scopeHash(aggregate.scope)
    for (const metricCode of TREND_METRICS) {
      rows.push({
        stat_month: aggregate.stat_month,
        ...aggregate.scope,
        metric_code: metricCode,
        metric_value: values[metricCode],
        // Overall trend qoq is maintained by business users, matching the key-audience manual table.
        manual_qoq: null,
        qoq_unit: RATE_CODES.has(metricCode) ? 'pp' : 'percent',
        scope_hash: hash,
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
    SELECT DATE_FORMAT(s.stat_month, '%Y-%m-%d') AS stat_month, s.strategy_id,
           s.small_category AS product_name, s.big_category, s.channel, s.city_id, s.county_id,
           s.push_count, s.usage_count, s.reach_count, s.product_conv_num, s.actual_income
    FROM t_sr_strategy_period_summary_ctrl s
    WHERE s.is_deleted = 0 AND s.strategy_id IS NOT NULL AND s.strategy_id != '999'
      AND s.channel IS NOT NULL AND s.channel != '' AND s.channel != '全部'
      AND s.big_category IS NOT NULL AND s.big_category != '全部'
      AND s.small_category IS NOT NULL AND s.small_category != '' AND s.small_category != '全部'
      AND EXISTS (SELECT 1 FROM v_sr_strategy_read t
          WHERE t.strategy_code = s.strategy_id AND t.tab_type = 'control' AND t.is_deleted = 0)
    ORDER BY s.stat_month, s.small_category, s.strategy_id, s.channel, s.big_category
  `)
  const rows = buildRows(facts)
  const columns = [
    'stat_month', 'product_name', 'big_category', 'channel', 'city_id', 'county_id', 'metric_code', 'metric_value',
    'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark',
  ]
  const update = columns
    .filter((column) => !['stat_month', 'metric_code', 'scope_hash', 'manual_qoq', 'status', 'remark'].includes(column))
    .map((column) => `${column}=VALUES(${column})`).join(', ')
  for (let index = 0; index < rows.length; index += 300) {
    await connection.query(`INSERT INTO ${TABLE} (${columns.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${update}`,
      [rows.slice(index, index + 300).map((row) => columns.map((column) => row[column]))])
  }
  const [summary] = await connection.query(`
    SELECT COUNT(*) AS row_count,
           COUNT(DISTINCT stat_month) AS month_count,
           COUNT(DISTINCT product_name) AS product_count,
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
    const [identity] = await connection.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    if (identity[0].db !== DATABASE || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error('Connected database identity does not match the protected local target')
    }
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_control_monthly_trend_manual.sql'), 'utf8'))
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

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { buildRows, seed }
