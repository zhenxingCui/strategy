const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const TABLE = 't_sr_key_audience_strategy_monthly_trend_manual'
const ALL = '全部'
const METRICS = ['product_conv_num']
const SCALE = 10000n

function toScaled(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) throw new Error(`Unsupported decimal value from source facts: ${text}`)
  const fraction = (match[3] || '').padEnd(4, '0').slice(0, 4)
  const scaled = BigInt(match[2]) * SCALE + BigInt(fraction || '0')
  return match[1] ? -scaled : scaled
}

function formatScaled(value) {
  if (value === null || value === undefined) return null
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? '-' : ''}${absolute / SCALE}.${String(absolute % SCALE).padStart(4, '0')}`
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

function normalize(value) {
  if (value === null || value === undefined || String(value).trim() === '') return ALL
  return String(value).trim()
}

function monthKey(value) {
  return `${String(value).slice(0, 7)}-01`
}

function monthDays(month) {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function strategyScopes(fact) {
  const channel = normalize(fact.channel)
  const city = normalize(fact.city_id)
  const county = normalize(fact.county_id)
  const channels = channel === ALL ? [ALL] : [channel, ALL]
  const regions = [[ALL, ALL]]
  if (city !== ALL) regions.push([city, ALL])
  if (county !== ALL) regions.push([ALL, county])
  if (city !== ALL && county !== ALL) regions.push([city, county])
  const uniqueRegions = [...new Map(regions.map((region) => [JSON.stringify(region), region])).values()]
  return channels.flatMap((channelValue) => uniqueRegions.map(([cityId, countyId]) => ({
    channel: channelValue,
    city_id: cityId,
    county_id: countyId,
  })))
}

function scopeHash(scope) {
  return crypto.createHash('sha256').update(JSON.stringify([scope.channel, scope.city_id, scope.county_id])).digest('hex')
}

function buildRows(facts, partialMonth) {
  const aggregates = new Map()
  for (const fact of facts) {
    const statMonth = monthKey(fact.stat_month)
    const strategyId = String(fact.strategy_id)
    for (const scope of strategyScopes(fact)) {
      const key = JSON.stringify([statMonth, strategyId, scope.channel, scope.city_id, scope.county_id])
      let aggregate = aggregates.get(key)
      if (!aggregate) {
        aggregate = {
          stat_month: statMonth,
          strategy_id: strategyId,
          scope,
          sums: Object.fromEntries(METRICS.map((metric) => [metric, null])),
        }
        aggregates.set(key, aggregate)
      }
      for (const metric of METRICS) {
        const value = toScaled(fact[metric])
        if (value !== null) aggregate.sums[metric] = (aggregate.sums[metric] || 0n) + value
      }
    }
  }

  const byScope = new Map()
  for (const aggregate of aggregates.values()) {
    const hash = scopeHash(aggregate.scope)
    const key = JSON.stringify([aggregate.strategy_id, hash])
    if (!byScope.has(key)) byScope.set(key, { strategyId: aggregate.strategy_id, scope: aggregate.scope, months: new Map() })
    byScope.get(key).months.set(aggregate.stat_month, aggregate.sums)
  }

  const rows = []
  for (const { strategyId, scope, months: valuesByMonth } of byScope.values()) {
    const months = [...valuesByMonth.keys()].sort()
    for (let index = 0; index < months.length; index += 1) {
      const statMonth = months[index]
      const values = valuesByMonth.get(statMonth)
      const previousMonth = index > 0 ? months[index - 1] : null
      const previousValues = previousMonth ? valuesByMonth.get(previousMonth) : null
      for (const metricCode of METRICS) {
        const value = values[metricCode]
        const previousValue = previousValues && previousValues[metricCode]
        let qoq = null
        if (value !== null && previousValue !== null && previousValue !== undefined && previousValue !== 0n
          && previousMonth === (() => {
            const [year, month] = statMonth.slice(0, 7).split('-').map(Number)
            const date = new Date(year, month - 2, 1)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
          })()) {
          if (partialMonth && partialMonth.month === statMonth.slice(0, 7) && partialMonth.day < monthDays(statMonth)) {
            const previousDays = monthDays(previousMonth)
            const numerator = (value * BigInt(previousDays) - previousValue * BigInt(partialMonth.day)) * 100n * SCALE
            const denominator = previousValue * BigInt(partialMonth.day)
            qoq = roundedDivide(numerator, denominator)
          } else {
            qoq = roundedDivide((value - previousValue) * 100n * SCALE, previousValue)
          }
        }
        rows.push({
          stat_month: statMonth,
          strategy_id: strategyId,
          ...scope,
          metric_code: metricCode,
          metric_value: formatScaled(value),
          manual_qoq: qoq === null ? null : formatScaled(qoq),
          qoq_unit: 'percent',
          scope_hash: scopeHash(scope),
          status: 1,
          source_batch: 'current-data-backfill',
          remark: partialMonth && partialMonth.month === statMonth.slice(0, 7) && partialMonth.day < monthDays(statMonth)
            ? `当月数据截至${partialMonth.month}-${String(partialMonth.day).padStart(2, '0')}；环比按日均折算`
            : '环比根据本表相邻月指标计算',
        })
      }
    }
  }
  return rows
}

async function seed(connection) {
  // The single-strategy trend endpoint only reads product_conv_num.
  // Remove the other backfilled metrics so rerunning this seed keeps the table lean.
  await connection.query(`DELETE FROM ${TABLE} WHERE metric_code <> 'product_conv_num'`)

  const [facts] = await connection.query(`
    SELECT DATE_FORMAT(stat_month, '%Y-%m-%d') AS stat_month,
           strategy_id, channel, city_id, county_id,
           product_conv_num
    FROM t_sr_strategy_period_summary_ap_key_audience
    WHERE tab_type = 'active' AND strategy_class = '重点客群' AND is_deleted = 0
      AND strategy_id IS NOT NULL AND strategy_id != '999'
      AND channel IS NOT NULL AND channel != '' AND channel != '全部'
      AND big_category IS NOT NULL AND big_category != '全部'
      AND COALESCE(small_category, '') != '全部'
    ORDER BY stat_month, strategy_id, channel, big_category, small_category
  `)
  const [daily] = await connection.query(`
    SELECT DATE_FORMAT(MAX(stat_month), '%Y-%m-%d') AS last_date
    FROM t_sr_strategy_daily_ap_key_audience
    WHERE tab_type = 'active' AND strategy_class = '重点客群' AND is_deleted = 0
      AND stat_month IS NOT NULL
  `)
  let partialMonth = null
  if (daily[0] && daily[0].last_date) {
    const lastDate = String(daily[0].last_date).slice(0, 10)
    partialMonth = { month: lastDate.slice(0, 7), day: Number(lastDate.slice(8, 10)) }
  }
  const rows = buildRows(facts, partialMonth)
  const columns = [
    'stat_month', 'strategy_id', 'channel', 'city_id', 'county_id', 'metric_code', 'metric_value',
    'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark',
  ]
  const update = columns
    .filter((column) => !['stat_month', 'strategy_id', 'metric_code', 'scope_hash'].includes(column))
    .map((column) => column === 'manual_qoq'
      ? `${column}=IF(source_batch='current-data-backfill', VALUES(${column}), ${column})`
      : `${column}=VALUES(${column})`)
    .join(', ')
  for (let index = 0; index < rows.length; index += 300) {
    await connection.query(`INSERT INTO ${TABLE} (${columns.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${update}`,
      [rows.slice(index, index + 300).map((row) => columns.map((column) => row[column]))])
  }
  const [summary] = await connection.query(`
    SELECT COUNT(*) AS row_count,
           COUNT(DISTINCT stat_month) AS month_count,
           COUNT(DISTINCT strategy_id) AS strategy_count,
           SUM(manual_qoq IS NOT NULL) AS qoq_count
    FROM ${TABLE}
    WHERE source_batch = 'current-data-backfill' AND status = 1
  `)
  return { sourceFacts: facts.length, generatedRows: rows.length, partialMonth, ...summary[0] }
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
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_key_audience_strategy_monthly_trend_manual.sql'), 'utf8'))
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
