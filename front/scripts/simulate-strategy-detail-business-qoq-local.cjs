// Simulate strategy-detail business QoQ values so the reconstructed business
// total reconciles to the selected strategy's current-month capacity trend.
// Writes are restricted to the local strategy_review_active_class_local DB.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const ALL = '全部'
const CITY_ID = process.env.SR_QOQ_CITY_ID || '999'
const VARIATION = 0.03
const CLASSES = ['升接', '稳', '重点客群']
const BUSINESS_TABLES = {
  升接: 'v_sr_strategy_biz_capacity_read',
  稳: 'v_sr_strategy_biz_capacity_read',
  重点客群: 't_sr_strategy_biz_capacity_key_audience',
}
const TREND_TABLE = 't_sr_strategy_detail_biz_capacity_qoq_manual'

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

function round(value, places = 4) {
  const scale = 10 ** places
  return Math.round((value + Number.EPSILON) * scale) / scale
}

function hashUnit(text) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}

function strategyKey(strategyClass, strategyId) {
  return JSON.stringify([strategyClass, String(strategyId)])
}

function businessKey(row) {
  return JSON.stringify([String(row.biz_code ?? ''), String(row.biz_name)])
}

function manualKey(strategyClass, row) {
  return JSON.stringify([
    strategyClass,
    String(row.strategy_id),
    String(row.biz_code ?? ''),
    String(row.biz_name),
    norm(row.city_id),
    norm(row.county_id),
  ])
}

function displayKey(row) {
  return JSON.stringify([
    row.biz_code === null || row.biz_code === undefined ? null : String(row.biz_code),
    String(row.biz_name),
    row.capacity === null || row.capacity === undefined ? null : String(row.capacity),
    row.yoy_ratio === null || row.yoy_ratio === undefined ? null : String(row.yoy_ratio),
  ])
}

function reconcileRates(targetQoq, lines, scopeLabel) {
  const targetMultiplier = 1 + Number(targetQoq) / 100
  if (!Number.isFinite(targetMultiplier) || targetMultiplier <= 0) {
    throw new Error(`Invalid target trend QoQ for ${scopeLabel}: ${targetQoq}`)
  }
  const positive = lines
    .filter(line => Number(line.capacity) > 0)
    .sort((left, right) => businessKey(left).localeCompare(businessKey(right)))
  if (!positive.length) return null

  const capacities = positive.map(line => Number(line.capacity))
  const basePrevious = capacities.map(value => value / targetMultiplier)
  const factors = positive.map(line => 1 + (hashUnit(`${scopeLabel}|${businessKey(line)}`) * 2 - 1) * VARIATION)
  const baseTotal = basePrevious.reduce((sum, value) => sum + value, 0)
  const weightedFactor = basePrevious.reduce((sum, value, index) => sum + value * factors[index], 0) / baseTotal
  const previous = basePrevious.map((value, index) => value * factors[index] / weightedFactor)
  const rates = capacities.map((current, index) => round((current / previous[index] - 1) * 100))

  if (rates.length > 1) {
    const targetPreviousTotal = capacities.reduce((sum, value) => sum + value, 0) / targetMultiplier
    const previousOther = capacities.slice(0, -1).reduce((sum, current, index) => {
      return sum + current / (1 + rates[index] / 100)
    }, 0)
    const lastPrevious = targetPreviousTotal - previousOther
    if (!(lastPrevious > 0)) throw new Error(`Could not calibrate positive prior capacity for ${scopeLabel}`)
    rates[rates.length - 1] = round((capacities[capacities.length - 1] / lastPrevious - 1) * 100)
  }

  const currentTotal = capacities.reduce((sum, value) => sum + value, 0)
  const previousTotal = capacities.reduce((sum, current, index) => sum + current / (1 + rates[index] / 100), 0)
  const aggregateQoq = (currentTotal / previousTotal - 1) * 100
  if (Math.abs(aggregateQoq - Number(targetQoq)) > 0.005) {
    throw new Error(`Calibration mismatch for ${scopeLabel}: target=${targetQoq}, aggregate=${aggregateQoq}`)
  }

  return new Map(positive.map((line, index) => [businessKey(line), {
    manual_qoq: rates[index],
    capacity: Number(line.capacity),
    trend_qoq: Number(targetQoq),
    simulated_aggregate_qoq: aggregateQoq,
  }]))
}

async function readMonth(connection, monthOverride) {
  if (monthOverride) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthOverride)) throw new Error('SR_QOQ_MONTH must be yyyy-MM')
    return monthOverride
  }
  const [[latestActive]] = await connection.query(`
    SELECT DATE_FORMAT(MAX(stat_month), '%Y-%m') AS month
    FROM t_sr_strategy_period_summary_ap
    WHERE tab_type = 'active' AND strategy_class IN ('升接', '稳') AND is_deleted = 0
  `)
  const [[latestAudience]] = await connection.query(`
    SELECT DATE_FORMAT(MAX(stat_month), '%Y-%m') AS month
    FROM t_sr_key_audience_strategy_monthly_trend_manual
    WHERE metric_code = 'product_conv_num' AND status = 1
  `)
  if (!latestActive.month || !latestAudience.month || latestActive.month !== latestAudience.month) {
    throw new Error(`Could not determine a common current month (升接/稳=${latestActive.month}, 重点客群=${latestAudience.month})`)
  }
  return latestActive.month
}

async function readTrendTargets(connection, month) {
  const statMonth = `${month}-01`
  const [activeRows] = await connection.query(`
    SELECT s.strategy_id, MIN(s.strategy_name) AS strategy_name, s.strategy_class, s.channel,
           s.big_category, s.small_category,
           CASE WHEN SUM(COALESCE(s.product_conv_num, 0)) = 0
                THEN AVG(s.product_conv_num_qoq)
                ELSE ROUND(SUM(s.product_conv_num * s.product_conv_num_qoq)
                           / NULLIF(SUM(s.product_conv_num), 0), 2)
           END AS trend_qoq,
           COUNT(*) AS source_rows,
           SUM(s.product_conv_num_qoq IS NOT NULL) AS rows_with_qoq
    FROM t_sr_strategy_period_summary_ap s
    WHERE s.tab_type = 'active' AND s.strategy_class IN ('升接', '稳')
      AND s.stat_month = ? AND s.is_deleted = 0
      AND s.strategy_id IS NOT NULL AND s.strategy_id != '999'
      AND s.channel IS NOT NULL AND s.channel != '' AND s.channel != '全部'
      AND s.big_category IS NOT NULL AND s.big_category != '全部'
      AND COALESCE(s.small_category, '') != '全部'
      AND s.city_id = ?
    GROUP BY s.strategy_id, s.strategy_class, s.channel,
             s.big_category, s.small_category
  `, [statMonth, CITY_ID])

  const [audienceRows] = await connection.query(`
    SELECT p.strategy_id, p.strategy_name, p.strategy_class, p.channel,
           p.big_category, p.small_category, t.manual_qoq AS trend_qoq,
           t.metric_value AS trend_capacity, 1 AS source_rows, 1 AS rows_with_qoq
    FROM t_sr_strategy_period_summary_ap_key_audience p
    LEFT JOIN t_sr_key_audience_strategy_monthly_trend_manual t
      ON t.strategy_id = p.strategy_id
     AND t.metric_code = 'product_conv_num'
     AND t.stat_month = p.stat_month
     AND t.status = 1
     AND t.channel = p.channel
     AND t.city_id = ?
     AND t.county_id = '全部'
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.stat_month = ? AND p.is_deleted = 0
      AND p.strategy_id IS NOT NULL AND p.strategy_id != '999'
      AND p.channel IS NOT NULL AND p.channel != '' AND p.channel != '全部'
      AND p.big_category IS NOT NULL AND p.big_category != '全部'
      AND COALESCE(p.small_category, '') != '全部'
      AND p.city_id = ?
  `, [CITY_ID, statMonth, CITY_ID])

  const targets = new Map()
  const targetDetails = []
  for (const row of [...activeRows, ...audienceRows]) {
    const cls = String(row.strategy_class)
    const id = String(row.strategy_id)
    const key = strategyKey(cls, id)
    const target = row.trend_qoq === null || row.trend_qoq === undefined ? null : Number(row.trend_qoq)
    const scope = {
      strategy_class: cls,
      strategy_id: id,
      strategy_name: row.strategy_name || '',
      channel: row.channel,
      big_category: row.big_category,
      small_category: row.small_category,
      trend_qoq: target,
      source_rows: Number(row.source_rows || 0),
      rows_with_qoq: Number(row.rows_with_qoq || 0),
    }
    const previous = targets.get(key)
    if (previous && ((previous.trend_qoq === null) !== (target === null)
      || (target !== null && Math.abs(previous.trend_qoq - target) > 0.00005))) {
      throw new Error(`One strategy has multiple current trend QoQs that the detail table cannot distinguish: ${key}`)
    }
    if (!previous) targets.set(key, scope)
    targetDetails.push(scope)
  }
  return { targets, targetDetails }
}

async function readBusinessFacts(connection, month, targetDetails) {
  const statMonth = `${month}-01`
  const rowsByClass = new Map(CLASSES.map(cls => [cls, []]))
  for (const cls of CLASSES) {
    const strategyIds = [...new Set(targetDetails.filter(row => row.strategy_class === cls).map(row => row.strategy_id))]
    if (!strategyIds.length) continue
    const placeholders = strategyIds.map(() => '?').join(',')
    const table = BUSINESS_TABLES[cls]
    const [rows] = await connection.query(`
      SELECT DISTINCT b.strategy_id, b.biz_code AS biz_code,
             b.biz_name, b.count AS capacity, b.yoy_ratio,
             COALESCE(NULLIF(b.city_id, ''), '全部') AS city_id,
             COALESCE(NULLIF(b.county_id, ''), '全部') AS county_id
      FROM ${table} b
      WHERE b.tab_type = 'active' AND b.is_deleted = 0
        AND b.stat_month >= ? AND b.stat_month < DATE_ADD(?, INTERVAL 1 MONTH)
        AND b.strategy_id IN (${placeholders})
        AND b.city_id = ?
        AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
    `, [statMonth, statMonth, ...strategyIds, CITY_ID])
    rowsByClass.set(cls, rows)
  }
  return rowsByClass
}

function prepareUpdates(targets, targetDetails, rowsByClass, month) {
  const updates = []
  const verificationPlan = []
  const skipped = []
  for (const [strategyScopeKey, target] of targets) {
    if (target.trend_qoq === null) {
      skipped.push({ strategy_class: target.strategy_class, strategy_id: target.strategy_id, reason: '当月策略产能趋势环比为空' })
      continue
    }
    const rawRows = rowsByClass.get(target.strategy_class).filter(row => String(row.strategy_id) === target.strategy_id)
    if (!rawRows.length) {
      skipped.push({ strategy_class: target.strategy_class, strategy_id: target.strategy_id, reason: '当月没有业务产能明细' })
      continue
    }

    // The API uses SELECT DISTINCT and hides geography. Recreate the visible
    // business rows before calculating the weighted QoQ.
    const visibleByKey = new Map()
    for (const row of rawRows) visibleByKey.set(displayKey(row), row)
    const linesByBusiness = new Map()
    for (const row of visibleByKey.values()) {
      const key = businessKey(row)
      if (!linesByBusiness.has(key)) linesByBusiness.set(key, { ...row, capacity: 0 })
      const line = linesByBusiness.get(key)
      if (row.capacity !== null && row.capacity !== undefined) line.capacity += Number(row.capacity)
    }
    const lines = [...linesByBusiness.values()]
    if (lines.some(line => line.capacity < 0)) {
      skipped.push({ strategy_class: target.strategy_class, strategy_id: target.strategy_id, reason: '业务产能存在负数，未模拟' })
      continue
    }
    const rates = reconcileRates(target.trend_qoq, lines, strategyScopeKey)
    if (!rates) {
      skipped.push({ strategy_class: target.strategy_class, strategy_id: target.strategy_id, reason: '没有正业务产能' })
      continue
    }

    const manualRows = new Map()
    for (const row of rawRows) {
      const rate = rates.get(businessKey(row))
      if (!rate) continue
      const key = manualKey(target.strategy_class, row)
      if (!manualRows.has(key)) manualRows.set(key, {
        tab_type: 'active',
        strategy_class: target.strategy_class,
        strategy_id: target.strategy_id,
        strategy_name: target.strategy_name,
        channel: target.channel,
        big_category: target.big_category,
        small_category: target.small_category,
        stat_month: `${month}-01`,
        biz_code: String(row.biz_code ?? ''),
        biz_name: row.biz_name,
        city_id: norm(row.city_id),
        county_id: norm(row.county_id),
        manual_qoq: rate.manual_qoq,
        status: 1,
        remark: `模拟环比：合计对齐${month}该策略产能趋势`,
        created_by: 'codex-simulation',
        updated_by: 'codex-simulation',
        capacity: rate.capacity,
        trend_qoq: rate.trend_qoq,
        simulated_aggregate_qoq: rate.simulated_aggregate_qoq,
      })
    }
    updates.push(...manualRows.values())
    verificationPlan.push({
      strategy_class: target.strategy_class,
      strategy_id: target.strategy_id,
      strategy_name: target.strategy_name,
      channel: target.channel,
      big_category: target.big_category,
      small_category: target.small_category,
      trend_qoq: target.trend_qoq,
      business_rows: visibleByKey.size,
      business_names: lines.length,
      generated_manual_rows: manualRows.size,
      planned_aggregate_qoq: rates.values().next().value.simulated_aggregate_qoq,
    })
  }

  const seenManualKeys = new Set()
  for (const row of updates) {
    const key = manualKey(row.strategy_class, row)
    if (seenManualKeys.has(key)) throw new Error(`Duplicate planned manual row ${key}`)
    seenManualKeys.add(key)
  }
  return { updates, verificationPlan, skipped }
}

async function readExisting(connection, statMonth) {
  const [rows] = await connection.query(`
    SELECT * FROM ${TREND_TABLE}
    WHERE tab_type = 'active' AND strategy_class IN (?, ?, ?)
      AND stat_month = ?
    ORDER BY strategy_class, strategy_id, biz_name, city_id, county_id
  `, [...CLASSES, statMonth])
  return rows
}

function assertNoManualOverwrite(previousRows, updates) {
  if (!updates.length) return
  const updatedKeys = new Set(updates.map(row => manualKey(row.strategy_class, row)))
  const protectedRows = previousRows.filter(row => row.status === 1 && row.manual_qoq !== null
    && row.created_by !== 'codex-simulation' && updatedKeys.has(manualKey(row.strategy_class, row)))
  if (protectedRows.length) {
    throw new Error(`Refusing to overwrite ${protectedRows.length} manually published business QoQ rows`)
  }
}

async function writeRows(connection, updates) {
  if (!updates.length) return
  const columns = [
    'tab_type', 'strategy_class', 'strategy_id', 'strategy_name', 'stat_month', 'biz_code', 'biz_name',
    'city_id', 'county_id', 'manual_qoq', 'status', 'remark', 'created_by', 'updated_by',
  ]
  const values = updates.map(row => columns.map(column => row[column]))
  for (let start = 0; start < values.length; start += 300) {
    await connection.query(`
      INSERT INTO ${TREND_TABLE} (${columns.join(', ')}) VALUES ?
      ON DUPLICATE KEY UPDATE strategy_name = VALUES(strategy_name),
                              manual_qoq = VALUES(manual_qoq), status = 1,
                              remark = VALUES(remark), updated_by = VALUES(updated_by)
    `, [values.slice(start, start + 300)])
  }
}

async function verifyPersisted(connection, month, targetDetails, verificationPlan) {
  const planKeys = new Set(verificationPlan.map(row => strategyKey(row.strategy_class, row.strategy_id)))
  const result = []
  for (const cls of CLASSES) {
    const strategyIds = [...new Set(verificationPlan.filter(row => row.strategy_class === cls).map(row => row.strategy_id))]
    if (!strategyIds.length) continue
    const placeholders = strategyIds.map(() => '?').join(',')
    const table = BUSINESS_TABLES[cls]
    const [rows] = await connection.query(`
      SELECT DISTINCT b.strategy_id, b.biz_code AS biz_code,
             b.biz_name, b.count AS capacity,
             (
               SELECT q.manual_qoq
               FROM ${TREND_TABLE} q
               WHERE q.status = 1 AND q.manual_qoq IS NOT NULL
                 AND q.tab_type = 'active' AND q.strategy_class = ?
                 AND q.strategy_id = b.strategy_id
                 AND q.stat_month = ? AND q.biz_name = b.biz_name
                 AND (q.biz_code = COALESCE(b.biz_code, '') OR q.biz_code = '')
                 AND q.city_id IN ('全部', COALESCE(NULLIF(b.city_id, ''), '全部'))
                 AND q.county_id IN ('全部', COALESCE(NULLIF(b.county_id, ''), '全部'))
               ORDER BY (q.biz_code = COALESCE(b.biz_code, '')) DESC,
                        (q.city_id = COALESCE(NULLIF(b.city_id, ''), '全部')) DESC,
                        (q.county_id = COALESCE(NULLIF(b.county_id, ''), '全部')) DESC,
                        q.update_time DESC
               LIMIT 1
             ) AS manual_qoq,
             b.yoy_ratio
      FROM ${table} b
      WHERE b.tab_type = 'active' AND b.is_deleted = 0
        AND b.stat_month >= ? AND b.stat_month < DATE_ADD(?, INTERVAL 1 MONTH)
        AND b.strategy_id IN (${placeholders})
        AND b.city_id = ?
        AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
    `, [cls, `${month}-01`, `${month}-01`, `${month}-01`, ...strategyIds, CITY_ID])

    const grouped = new Map()
    for (const row of rows) {
      const key = strategyKey(cls, row.strategy_id)
      if (!planKeys.has(key)) continue
      if (!grouped.has(key)) grouped.set(key, { totalCapacity: 0, previousCapacity: 0, rows: 0, missing: 0 })
      const entry = grouped.get(key)
      if (row.capacity === null || row.capacity === undefined) continue
      const capacity = Number(row.capacity)
      if (row.manual_qoq === null || row.manual_qoq === undefined) {
        if (capacity > 0) entry.missing += 1
        continue
      }
      const qoq = Number(row.manual_qoq)
      if (capacity > 0 && qoq > -100) {
        entry.totalCapacity += capacity
        entry.previousCapacity += capacity / (1 + qoq / 100)
        entry.rows += 1
      }
    }
    for (const planned of verificationPlan.filter(row => row.strategy_class === cls)) {
      const entry = grouped.get(strategyKey(cls, planned.strategy_id))
      if (!entry || entry.rows === 0 || entry.missing) {
        throw new Error(`Persisted business QoQ rows are incomplete for ${cls}/${planned.strategy_id}: ${JSON.stringify(entry || null)}`)
      }
      const aggregateQoq = (entry.totalCapacity / entry.previousCapacity - 1) * 100
      const diff = Math.abs(aggregateQoq - Number(planned.trend_qoq))
      if (diff > 0.005) {
        throw new Error(`Persisted mismatch for ${cls}/${planned.strategy_id}: trend=${planned.trend_qoq}, business=${aggregateQoq}`)
      }
      result.push({
        strategy_class: cls,
        strategy_id: planned.strategy_id,
        strategy_name: planned.strategy_name,
        trend_qoq: Number(planned.trend_qoq),
        business_aggregate_qoq: aggregateQoq,
        business_rows: entry.rows,
        difference_pp: diff,
      })
    }
  }
  return result
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local') {
    throw new Error(`Refusing to write to non-local database: ${DATABASE}`)
  }
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing non-local MySQL host: ${host}`)
  }
  if (CITY_ID !== '999') throw new Error('This local simulation is scoped to the confirmed city_id=999 data')

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
    const month = await readMonth(connection, process.env.SR_QOQ_MONTH || '')
    const statMonth = `${month}-01`
    const { targets, targetDetails } = await readTrendTargets(connection, month)
    if (!targetDetails.length) throw new Error(`No clickable strategy trend scopes found for ${month}`)
    const rowsByClass = await readBusinessFacts(connection, month, targetDetails)
    const { updates, verificationPlan, skipped } = prepareUpdates(targets, targetDetails, rowsByClass, month)
    if (!updates.length) throw new Error(`No business QoQ rows with a non-empty strategy trend QoQ found for ${month}`)

    const previousRows = await readExisting(connection, statMonth)
    assertNoManualOverwrite(previousRows, updates)
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    const outputDir = path.resolve(__dirname, '../../outputs', `strategy-detail-business-qoq-simulation-${month.replace('-', '')}-${stamp}`)
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(path.join(outputDir, 'before.json'), JSON.stringify({ database: DATABASE, month, cityId: CITY_ID, rows: previousRows }, null, 2), 'utf8')
    fs.writeFileSync(path.join(outputDir, 'simulated.csv'), toCsv(updates, [
      'strategy_class', 'strategy_id', 'strategy_name', 'channel', 'big_category', 'small_category',
      'biz_code', 'biz_name', 'city_id', 'county_id', 'capacity', 'manual_qoq', 'trend_qoq', 'simulated_aggregate_qoq',
    ]), 'utf8')

    await connection.beginTransaction()
    try {
      await writeRows(connection, updates)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const verification = await verifyPersisted(connection, month, targetDetails, verificationPlan)
    const summary = CLASSES.map(cls => {
      const classTargets = [...targets.values()].filter(row => row.strategy_class === cls)
      const classVerified = verification.filter(row => row.strategy_class === cls)
      return {
        strategy_class: cls,
        clickable_strategies: new Set(classTargets.map(row => row.strategy_id)).size,
        trend_qoq_available: new Set(classTargets.filter(row => row.trend_qoq !== null).map(row => row.strategy_id)).size,
        verified_strategies: classVerified.length,
        generated_business_rows: updates.filter(row => row.strategy_class === cls).length,
      }
    })
    const report = {
      database: DATABASE,
      host: identity.host,
      month,
      cityId: CITY_ID,
      trendSource: {
        升接稳: 't_sr_strategy_period_summary_ap.product_conv_num_qoq（按页面策略/渠道/策略分类计算）',
        重点客群: 't_sr_key_audience_strategy_monthly_trend_manual.manual_qoq（按选中策略渠道读取）',
      },
      businessSource: {
        升接稳: 'v_sr_strategy_biz_capacity_read.count',
        重点客群: 't_sr_strategy_biz_capacity_key_audience.count',
      },
      manualTable: TREND_TABLE,
      summary,
      generatedRows: updates.length,
      skipped: skipped.reduce((acc, row) => {
        const key = `${row.strategy_class}: ${row.reason}`
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
      verification,
    }
    fs.writeFileSync(path.join(outputDir, 'verification.json'), JSON.stringify(report, null, 2), 'utf8')
    console.log(JSON.stringify({ ...report, verification: undefined, outputDir }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
