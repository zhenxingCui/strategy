const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const TABLE = 't_sr_key_audience_monthly_trend_manual'
const ALL = '全部'
const SUM_FIELDS = [
  'original_cust', 'push_count', 'usage_count', 'reach_count', 'product_conv_num', 'actual_income',
]
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
  const integer = absolute / factor
  const fraction = String(absolute % factor).padStart(Number(scale), '0')
  return `${negative ? '-' : ''}${integer}.${fraction}`
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

function ratioPercent(numerator, denominator, resultScale = 2n) {
  if (numerator === null || denominator === null || denominator === 0n) return null
  const scaled = roundedDivide(numerator * 100n * 10n ** resultScale, denominator)
  return formatScaled(scaled, resultScale)
}

function normalizeScopeValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return ALL
  return String(value).trim()
}

function distinctRows(values) {
  const seen = new Set()
  return values.filter((value) => {
    const key = JSON.stringify(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function scopeHash(scope) {
  return crypto.createHash('sha256').update(JSON.stringify([
    scope.customer_group, scope.channel, scope.big_category, scope.small_category, scope.city_id, scope.county_id,
  ])).digest('hex')
}

function scopesFor(row) {
  const group = normalizeScopeValue(row.customer_group)
  const channel = normalizeScopeValue(row.channel)
  const big = normalizeScopeValue(row.big_category)
  const small = normalizeScopeValue(row.small_category)
  const city = normalizeScopeValue(row.city_id)
  const county = normalizeScopeValue(row.county_id)

  const groups = distinctRows([...(group !== ALL ? [group] : []), ALL])
  const channels = distinctRows([...(channel !== ALL ? [channel] : []), ALL])
  const categories = distinctRows([
    ...(big !== ALL && small !== ALL ? [[big, small]] : []),
    ...(big !== ALL ? [[big, ALL]] : []),
    [ALL, ALL],
  ])
  const regions = distinctRows([
    ...(city !== ALL && county !== ALL ? [[city, county]] : []),
    ...(city !== ALL ? [[city, ALL]] : []),
    [ALL, ALL],
  ])

  const result = []
  for (const customerGroup of groups) {
    for (const channelValue of channels) {
      for (const [bigCategory, smallCategory] of categories) {
        for (const [cityId, countyId] of regions) {
          result.push({
            customer_group: customerGroup,
            channel: channelValue,
            big_category: bigCategory,
            small_category: smallCategory,
            city_id: cityId,
            county_id: countyId,
          })
        }
      }
    }
  }
  return result
}

function metricValues(aggregate) {
  const result = {
    strategy_count: formatScaled(BigInt(aggregate.rowCount) * 10n ** SCALE),
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
  return result
}

function buildRows(facts) {
  const aggregates = new Map()
  for (const fact of facts) {
    const statMonth = String(fact.stat_month).slice(0, 10).slice(0, 7) + '-01'
    for (const scope of scopesFor(fact)) {
      const key = JSON.stringify([statMonth, scope.customer_group, scope.channel, scope.big_category,
        scope.small_category, scope.city_id, scope.county_id])
      let aggregate = aggregates.get(key)
      if (!aggregate) {
        aggregate = { stat_month: statMonth, scope, rowCount: 0, sums: Object.fromEntries(SUM_FIELDS.map((field) => [field, null])) }
        aggregates.set(key, aggregate)
      }
      aggregate.rowCount += 1
      for (const field of SUM_FIELDS) {
        const value = asScaled(fact[field])
        if (value !== null) aggregate.sums[field] = (aggregate.sums[field] || 0n) + value
      }
    }
  }

  const byScope = new Map()
  for (const aggregate of aggregates.values()) {
    const values = metricValues(aggregate)
    const hash = scopeHash(aggregate.scope)
    const scopeKey = hash
    let months = byScope.get(scopeKey)
    if (!months) {
      months = { scope: aggregate.scope, valuesByMonth: new Map() }
      byScope.set(scopeKey, months)
    }
    months.valuesByMonth.set(aggregate.stat_month, values)
  }

  const rows = []
  for (const { scope, valuesByMonth } of byScope.values()) {
    const months = [...valuesByMonth.keys()].sort()
    for (let index = 0; index < months.length; index += 1) {
      const statMonth = months[index]
      const values = valuesByMonth.get(statMonth)
      for (const metricCode of TREND_METRICS) {
        rows.push({
          stat_month: statMonth,
          ...scope,
          metric_code: metricCode,
          metric_value: values[metricCode],
          // No manual QoQ source was supplied. Keep it empty so the API never substitutes a calculated value.
          manual_qoq: null,
          qoq_unit: RATE_CODES.has(metricCode) ? 'pp' : 'percent',
          scope_hash: scopeHash(scope),
          status: 1,
          source_batch: 'current-data-backfill',
          remark: null,
        })
      }
    }
  }
  return rows
}

async function seed(connection) {
  const [facts] = await connection.query(`
    SELECT DATE_FORMAT(s.stat_month, '%Y-%m-%d') AS stat_month,
           s.channel, s.big_category, s.small_category, s.city_id, s.county_id,
           s.original_cust, s.push_count, s.usage_count, s.reach_count,
           s.product_conv_num, s.actual_income,
           g.customer_group
    FROM t_sr_strategy_period_summary_ap_key_audience s
    LEFT JOIN (
        SELECT strategy_code, MAX(NULLIF(TRIM(customer_group), '')) AS customer_group
        FROM t_sr_strategy_key_audience
        WHERE tab_type = 'active' AND strategy_class = '重点客群' AND is_deleted = 0
        GROUP BY strategy_code
    ) g ON g.strategy_code = s.strategy_id
    WHERE s.tab_type = 'active' AND s.strategy_class = '重点客群' AND s.is_deleted = 0
      AND s.strategy_id IS NOT NULL AND s.strategy_id != '999'
      AND s.channel IS NOT NULL AND s.channel != '' AND s.channel != '全部'
      AND s.big_category IS NOT NULL AND s.big_category != '全部'
      AND COALESCE(s.small_category, '') != '全部'
    ORDER BY s.stat_month, s.strategy_id, s.channel, s.big_category, s.small_category
  `)
  const rows = buildRows(facts)
  const columns = [
    'stat_month', 'customer_group', 'channel', 'big_category', 'small_category', 'city_id', 'county_id',
    'metric_code', 'metric_value', 'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark',
  ]
  const update = columns.filter((column) => !['stat_month', 'metric_code', 'scope_hash', 'manual_qoq', 'status', 'remark'].includes(column))
    .map((column) => `${column}=VALUES(${column})`).join(', ')
  for (let index = 0; index < rows.length; index += 300) {
    await connection.query(`INSERT INTO ${TABLE} (${columns.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${update}`,
      [rows.slice(index, index + 300).map((row) => columns.map((column) => row[column]))])
  }

  const [summary] = await connection.query(`
    SELECT COUNT(*) AS row_count,
           COUNT(DISTINCT stat_month) AS month_count,
           COUNT(DISTINCT customer_group) AS customer_group_count,
           SUM(manual_qoq IS NOT NULL) AS qoq_count
    FROM ${TABLE}
    WHERE source_batch = 'current-data-backfill' AND status = 1
  `)
  return { sourceFacts: facts.length, generatedRows: rows.length, ...summary[0] }
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local') {
    throw new Error(`Refusing to seed non-local database: ${DATABASE}`)
  }
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
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_key_audience_monthly_trend_manual.sql'), 'utf8'))
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

module.exports = { seed }
