// Simulate current-month key-audience business QoQ values so each filter scope
// reconciles to its manually maintained monthly capacity-trend QoQ.
// Writes are restricted to the local strategy_review_active_class_local DB.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const TABLE = 't_sr_strategy_biz_capacity_qoq_manual'
const ALL = '全部'
const VARIATION = 0.03

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n') + '\r\n'
}

function norm(value) {
  return value === null || value === undefined || String(value).trim() === '' ? ALL : String(value).trim()
}

function scopeKey(scope) {
  return JSON.stringify([
    norm(scope.customer_group), norm(scope.channel), norm(scope.big_category), norm(scope.small_category),
    norm(scope.city_id), norm(scope.county_id),
  ])
}

function locationKey(row) {
  return JSON.stringify([String(row.strategy_id), String(row.city_id ?? ''), String(row.county_id ?? '')])
}

function hashUnit(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}

function round(value, places = 4) {
  const scale = 10 ** places
  return Math.round((value + Number.EPSILON) * scale) / scale
}

function matchesScope(fact, groups, scope) {
  const group = norm(scope.customer_group)
  return (group === ALL || groups.has(group))
    && (norm(scope.channel) === ALL || String(fact.channel) === norm(scope.channel))
    && (norm(scope.big_category) === ALL || String(fact.big_category) === norm(scope.big_category))
    && (norm(scope.small_category) === ALL || String(fact.small_category) === norm(scope.small_category))
    && (norm(scope.city_id) === ALL || String(fact.city_id) === norm(scope.city_id))
    && (norm(scope.county_id) === ALL || String(fact.county_id) === norm(scope.county_id))
}

function simulateRates(scope, trendQoq, businessRows) {
  const targetMultiplier = 1 + Number(trendQoq) / 100
  if (!Number.isFinite(targetMultiplier) || targetMultiplier <= 0) return null

  const rows = businessRows
    .filter(row => Number(row.capacity) > 0)
    .sort((left, right) => String(left.biz_name) < String(right.biz_name) ? -1 : String(left.biz_name) > String(right.biz_name) ? 1 : 0)
  if (!rows.length) return null

  const capacities = rows.map(row => Number(row.capacity))
  const basePrevious = capacities.map(value => value / targetMultiplier)
  const factors = rows.map(row => 1 + ((hashUnit(`${scopeKey(scope)}|${row.biz_name}`) * 2) - 1) * VARIATION)
  const baseTotal = basePrevious.reduce((sum, value) => sum + value, 0)
  const weightedFactor = basePrevious.reduce((sum, value, index) => sum + value * factors[index], 0) / baseTotal
  const previous = basePrevious.map((value, index) => value * factors[index] / weightedFactor)

  let rates = capacities.map((current, index) => round((current / previous[index] - 1) * 100))
  if (rates.length > 1) {
    // Calibrate the last row after rounding the others, keeping the displayed
    // aggregate within the trend's four-decimal source precision.
    const targetPreviousTotal = capacities.reduce((sum, value) => sum + value, 0) / targetMultiplier
    const previousOther = capacities.slice(0, -1).reduce((sum, current, index) => {
      return sum + current / (1 + rates[index] / 100)
    }, 0)
    const lastPrevious = targetPreviousTotal - previousOther
    if (lastPrevious > 0) rates[rates.length - 1] = round((capacities[capacities.length - 1] / lastPrevious - 1) * 100)
  }

  const totalCapacity = capacities.reduce((sum, value) => sum + value, 0)
  const reconstructedPrevious = capacities.reduce((sum, current, index) => sum + current / (1 + rates[index] / 100), 0)
  const aggregateQoq = (totalCapacity / reconstructedPrevious - 1) * 100
  return rows.map((row, index) => ({
    biz_name: row.biz_name,
    manual_qoq: rates[index],
    capacity: capacities[index],
    trend_qoq: Number(trendQoq),
    simulated_aggregate_qoq: aggregateQoq,
  }))
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local') {
    throw new Error(`Refusing to write to non-local database: ${DATABASE}`)
  }
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing non-local MySQL host: ${host}`)
  }

  const monthOverride = process.env.SR_QOQ_MONTH || ''
  if (monthOverride && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthOverride)) {
    throw new Error('SR_QOQ_MONTH must be yyyy-MM')
  }

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
    const [[identity]] = await connection.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    if (identity.db !== DATABASE || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error('Connected database identity does not match the protected local target')
    }

    let month = monthOverride
    if (!month) {
      const [[latest]] = await connection.query(`
        SELECT DATE_FORMAT(MAX(stat_month), '%Y-%m') AS month
        FROM t_sr_key_audience_monthly_trend_manual
        WHERE status = 1 AND metric_code = 'product_conv_num' AND manual_qoq IS NOT NULL
      `)
      month = latest.month
    }
    if (!month) throw new Error('No published key-audience monthly trend QoQ data was found')
    const statMonth = `${month}-01`

    const [trendRows] = await connection.query(`
      SELECT DATE_FORMAT(stat_month, '%Y-%m-01') AS stat_month,
             customer_group, channel, big_category, small_category, city_id, county_id,
             metric_value, manual_qoq
      FROM t_sr_key_audience_monthly_trend_manual
      WHERE status = 1 AND metric_code = 'product_conv_num'
        AND stat_month >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
        AND stat_month < DATE_ADD(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
        AND manual_qoq IS NOT NULL
      ORDER BY customer_group, channel, big_category, small_category, city_id, county_id
    `, [month, month])

    const [periodFacts] = await connection.query(`
      SELECT s.strategy_id, s.channel, s.big_category, s.small_category, s.city_id, s.county_id,
             DATE_FORMAT(s.stat_month, '%Y-%m-01') AS stat_month
      FROM t_sr_strategy_period_summary_ap_key_audience s
      WHERE s.tab_type = 'active' AND s.strategy_class = '重点客群' AND s.is_deleted = 0
        AND s.strategy_id IS NOT NULL AND s.strategy_id != '999'
        AND s.channel IS NOT NULL AND s.channel != '' AND s.channel != '全部'
        AND s.big_category IS NOT NULL AND s.big_category != '全部'
        AND COALESCE(s.small_category, '') != '全部'
        AND s.stat_month >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
        AND s.stat_month < DATE_ADD(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
    `, [month, month])

    const [groupRows] = await connection.query(`
      SELECT strategy_code AS strategy_id, TRIM(customer_group) AS customer_group
      FROM t_sr_strategy_key_audience
      WHERE tab_type = 'active' AND strategy_class = '重点客群' AND is_deleted = 0
        AND customer_group IS NOT NULL AND TRIM(customer_group) != ''
    `)
    const groupsByStrategy = new Map()
    for (const row of groupRows) {
      const key = String(row.strategy_id)
      if (!groupsByStrategy.has(key)) groupsByStrategy.set(key, new Set())
      groupsByStrategy.get(key).add(String(row.customer_group))
    }

    const [businessFacts] = await connection.query(`
      SELECT b.strategy_id, b.city_id, b.county_id, b.biz_name, SUM(b.count) AS capacity
      FROM t_sr_strategy_biz_capacity_key_audience b
      WHERE b.tab_type = 'active' AND b.is_deleted = 0
        AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
        AND b.stat_month >= STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d')
        AND b.stat_month < DATE_ADD(STR_TO_DATE(CONCAT(?, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH)
      GROUP BY b.strategy_id, b.city_id, b.county_id, b.biz_name
    `, [month, month])

    const businessByLocation = new Map()
    for (const row of businessFacts) {
      const key = locationKey(row)
      if (!businessByLocation.has(key)) businessByLocation.set(key, [])
      businessByLocation.get(key).push(row)
    }

    const updates = []
    const skipped = []
    const targets = new Map()
    for (const trend of trendRows) {
      const key = scopeKey(trend)
      if (targets.has(key)) throw new Error(`Duplicate monthly trend scope: ${key}`)
      targets.set(key, trend)

      const selectedLocations = new Set()
      for (const fact of periodFacts) {
        const groups = groupsByStrategy.get(String(fact.strategy_id)) || new Set()
        if (!matchesScope(fact, groups, trend)) continue
        selectedLocations.add(locationKey(fact))
      }

      const totalsByBiz = new Map()
      for (const location of selectedLocations) {
        for (const row of businessByLocation.get(location) || []) {
          totalsByBiz.set(row.biz_name, (totalsByBiz.get(row.biz_name) || 0) + Number(row.capacity || 0))
        }
      }
      const businessRows = [...totalsByBiz.entries()].map(([biz_name, capacity]) => ({ biz_name, capacity }))
      const simulated = simulateRates(trend, trend.manual_qoq, businessRows)
      if (!simulated) {
        skipped.push({ scope: key, reason: 'no positive business capacity or invalid trend QoQ' })
        continue
      }

      const target = Number(trend.manual_qoq)
      const aggregate = simulated[0].simulated_aggregate_qoq
      if (Math.abs(aggregate - target) > 0.005) {
        throw new Error(`Could not calibrate ${key}: trend=${target}, simulated=${aggregate}`)
      }

      for (const row of simulated) updates.push({
        tab_type: 'active',
        strategy_class: '重点客群',
        customer_group: norm(trend.customer_group),
        stat_month: statMonth,
        channel: norm(trend.channel),
        big_category: norm(trend.big_category),
        small_category: norm(trend.small_category),
        city_id: norm(trend.city_id),
        county_id: norm(trend.county_id),
        biz_name: row.biz_name,
        manual_qoq: row.manual_qoq,
        status: 1,
        remark: `模拟环比：合计对齐${month}重点客群产能趋势`,
        created_by: 'codex-simulation',
        updated_by: 'codex-simulation',
        capacity: row.capacity,
        trend_qoq: row.trend_qoq,
        simulated_aggregate_qoq: row.simulated_aggregate_qoq,
      })
    }
    if (!trendRows.length || !updates.length) throw new Error(`No business QoQ rows were generated for ${month}`)

    const [previousRows] = await connection.query(`
      SELECT * FROM ${TABLE}
      WHERE tab_type = 'active' AND strategy_class = '重点客群' AND stat_month = ?
      ORDER BY customer_group, channel, big_category, small_category, city_id, county_id, biz_name
    `, [statMonth])

    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    const outputDir = path.resolve(__dirname, '../../outputs', `key-audience-business-qoq-simulation-${month.replace('-', '')}-${nowStamp}`)
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, 'before.json'), JSON.stringify({ database: DATABASE, month, rows: previousRows }, null, 2), 'utf8')
    fs.writeFileSync(path.join(outputDir, 'simulated.csv'), toCsv(updates, [
      'customer_group', 'channel', 'big_category', 'small_category', 'city_id', 'county_id',
      'biz_name', 'capacity', 'manual_qoq', 'trend_qoq', 'simulated_aggregate_qoq',
    ]), 'utf8')

    await connection.beginTransaction()
    try {
      const columns = [
        'tab_type', 'strategy_class', 'customer_group', 'stat_month', 'channel', 'big_category',
        'small_category', 'city_id', 'county_id', 'biz_name', 'manual_qoq', 'status', 'remark',
        'created_by', 'updated_by',
      ]
      const values = updates.map(row => columns.map(column => row[column]))
      for (let start = 0; start < values.length; start += 300) {
        await connection.query(`
          INSERT INTO ${TABLE} (${columns.join(', ')}) VALUES ?
          ON DUPLICATE KEY UPDATE manual_qoq = VALUES(manual_qoq), status = 1,
                                  remark = VALUES(remark), updated_by = VALUES(updated_by)
        `, [values.slice(start, start + 300)])
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const [writtenRows] = await connection.query(`
      SELECT customer_group, channel, big_category, small_category, city_id, county_id, biz_name, manual_qoq
      FROM ${TABLE}
      WHERE tab_type = 'active' AND strategy_class = '重点客群' AND stat_month = ? AND status = 1
    `, [statMonth])
    const writtenByKey = new Map(writtenRows.map(row => [JSON.stringify([
      norm(row.customer_group), norm(row.channel), norm(row.big_category), norm(row.small_category),
      norm(row.city_id), norm(row.county_id), String(row.biz_name),
    ]), Number(row.manual_qoq)]))

    const verification = []
    for (const trend of trendRows) {
      const key = scopeKey(trend)
      const scopeUpdates = updates.filter(row => scopeKey(row) === key)
      if (!scopeUpdates.length) continue
      let totalCurrent = 0
      let totalPrevious = 0
      for (const row of scopeUpdates) {
        const identity = JSON.stringify([
          norm(row.customer_group), norm(row.channel), norm(row.big_category), norm(row.small_category),
          norm(row.city_id), norm(row.county_id), String(row.biz_name),
        ])
        const manualQoq = writtenByKey.get(identity)
        if (manualQoq === undefined) throw new Error(`Missing persisted QoQ row: ${identity}`)
        totalCurrent += Number(row.capacity)
        totalPrevious += Number(row.capacity) / (1 + manualQoq / 100)
      }
      const aggregate = (totalCurrent / totalPrevious - 1) * 100
      const target = Number(trend.manual_qoq)
      if (Math.abs(aggregate - target) > 0.005) throw new Error(`Persisted scope mismatch ${key}: ${aggregate} vs ${target}`)
      verification.push({ scope: key, trend_qoq: target, aggregate_qoq: aggregate, business_rows: scopeUpdates.length })
    }

    fs.writeFileSync(path.join(outputDir, 'verification.json'), JSON.stringify({
      database: DATABASE, month, trendScopes: trendRows.length, verifiedScopes: verification.length,
      generatedRows: updates.length, skippedScopes: skipped, verification,
    }, null, 2), 'utf8')
    console.log(JSON.stringify({
      database: DATABASE, host: identity.host, month, trendScopes: trendRows.length,
      verifiedScopes: verification.length, generatedRows: updates.length,
      skippedScopes: skipped.length, defaultScopeTrendQoq: trendRows.find(row =>
        norm(row.customer_group) === ALL && norm(row.channel) === ALL
        && norm(row.big_category) === ALL && norm(row.small_category) === ALL
        && norm(row.city_id) === '999' && norm(row.county_id) === ALL)?.manual_qoq ?? null,
      outputDir,
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
