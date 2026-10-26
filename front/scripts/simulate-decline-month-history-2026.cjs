const fs = require('fs')
const os = require('os')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const APPLY = process.argv.includes('--apply')
const CATEGORY = '\u964d\u62c6'
const TAB = 'active'
const CITY_ID = '999'
const COUNTY_ID = '999'
const MONTH_FACTORS = [1, 0.992, 1.004, 1, 1.002, 0.998, 1.001, 0.996, 1.001]
const ONLINE_DISPATCH_RATES = [22, 21.4, 22.2, 22.8, 22, 21.2, 22.5, 23.4, 22.6]
const CHANNELS = {
  'ACH0003': '\u8425\u670d',
  'ACH0004': '\u6574\u4f53',
  'ACH0005': '\u5728\u7ebf',
  'ACH0006': '\u9762\u5ba2',
  'ACH0007': '\u5230\u5385',
}
const SUMMARY_TABLE = 't_sr_channel_summary_ap_special'
const CAPACITY_TABLE = 't_sr_channel_monthly_capacity_ap_special'
const BACKUP_DIR = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'StrategyReview', 'decline-history-2026')

function fail(message) {
  throw new Error(message)
}

function round(value, scale = 0) {
  const factor = 10 ** scale
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

function ratioPercent(numerator, denominator) {
  return denominator ? round((numerator / denominator) * 100, 2) : null
}

function qoqPercent(current, previous) {
  if (current == null || previous == null || previous === 0) return null
  return round(((current - previous) / previous) * 100, 2)
}

function qoqPoint(currentRate, previousRate) {
  if (currentRate == null || previousRate == null) return null
  return round(currentRate - previousRate, 2)
}

function monthText(month) {
  return `2026-${String(month).padStart(2, '0')}-01`
}

function allocate(total, rows) {
  const weightTotal = rows.reduce((sum, row) => sum + Number(row.capacity), 0)
  if (!weightTotal) fail('October category source total is zero')
  const shares = rows.map((row, index) => {
    const exact = (total * Number(row.capacity)) / weightTotal
    const floor = Math.floor(exact)
    return { index, floor, fraction: exact - floor }
  })
  let remainder = total - shares.reduce((sum, part) => sum + part.floor, 0)
  shares.sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < remainder; i += 1) shares[i].floor += 1
  shares.sort((a, b) => a.index - b.index)
  return shares.map((part) => part.floor)
}

function buildSummary(month, index, previousByChannel) {
  const factor = MONTH_FACTORS[index]
  const monthDate = monthText(month)
  const serviceOrders = Math.round(202329 * factor)
  const faceOrders = Math.round(70000 * (1.03 ** index))
  const faceSuccess = Math.round(40000 * factor)

  const named = {
    'ACH0004': {
      push: Math.round(1770000 * factor),
      reach: null,
      target: null,
    },
    'ACH0005': {
      push: Math.round(1330000 * factor),
      reach: null,
      target: null,
    },
    'ACH0003': {
      push: serviceOrders,
      reach: null,
      target: null,
    },
    'ACH0006': {
      push: faceOrders,
      reach: faceSuccess,
      target: Math.round(70000 * (1.03 ** index)),
    },
    'ACH0007': {
      push: Math.round(500000 * factor),
      reach: null,
      target: null,
    },
  }

  named['ACH0004'].reach = Math.round(named['ACH0004'].push * 0.816)
  named['ACH0005'].reach = Math.round(named['ACH0005'].push * 0.71)
  named['ACH0003'].reach = Math.round(named['ACH0003'].push * 0.58)
  named['ACH0003'].target = Math.round(named['ACH0003'].push * (0.32 * (1.03 ** index)))
  named['ACH0005'].target = Math.round(named['ACH0005'].push * (ONLINE_DISPATCH_RATES[index] / 100))
  named['ACH0007'].reach = Math.round(named['ACH0007'].push * 0.48)

  const count = Object.values(named).reduce((sum, row) => sum + row.push, 0)
  const success = Object.values(named).reduce((sum, row) => sum + row.reach, 0)
  const previousAll = previousByChannel['\u5168\u90e8']
  const rows = []

  for (const [channel, values] of Object.entries(named)) {
    const previous = previousByChannel[channel]
    const reachRate = ratioPercent(values.reach, values.push)
    const targetRate = values.target == null ? null : ratioPercent(values.target, values.push)
    rows.push({
      tab_type: TAB,
      strategy_class: CATEGORY,
      stat_month: monthDate,
      channel,
      strategy_count: 47,
      strategy_count_qoq: previous ? qoqPercent(47, previous.strategy_count) : null,
      push_count: values.push,
      push_count_qoq: previous ? qoqPercent(values.push, previous.push_count) : null,
      reach_count: values.reach,
      reach_count_qoq: previous ? qoqPercent(values.reach, previous.reach_count) : null,
      reach_rate: reachRate,
      reach_rate_qoq: previous ? qoqPoint(reachRate, previous.reach_rate) : null,
      target_conv_num: values.target,
      target_conv_num_qoq: values.target == null || !previous || previous.target_conv_num == null
        ? null : qoqPercent(values.target, previous.target_conv_num),
      target_conv_rate: targetRate,
      target_conv_rate_qoq: values.target == null || !previous
        ? null : qoqPoint(targetRate, previous.target_conv_rate),
      product_conv_num: values.target,
      product_conv_num_qoq: values.target == null || !previous || previous.product_conv_num == null
        ? null : qoqPercent(values.target, previous.product_conv_num),
      product_conv_rate: targetRate,
      product_conv_rate_qoq: values.target == null || !previous
        ? null : qoqPoint(targetRate, previous.product_conv_rate),
      city_id: CITY_ID,
      county_id: COUNTY_ID,
      is_deleted: 0,
    })
  }

  const allReach = success
  const allRate = ratioPercent(allReach, count)
  rows.push({
    tab_type: TAB,
    strategy_class: CATEGORY,
    stat_month: monthDate,
    channel: '\u5168\u90e8',
    strategy_count: 235,
    strategy_count_qoq: previousAll ? qoqPercent(235, previousAll.strategy_count) : null,
    push_count: count,
    push_count_qoq: previousAll ? qoqPercent(count, previousAll.push_count) : null,
    reach_count: allReach,
    reach_count_qoq: previousAll ? qoqPercent(allReach, previousAll.reach_count) : null,
    reach_rate: allRate,
    reach_rate_qoq: previousAll ? qoqPoint(allRate, previousAll.reach_rate) : null,
    target_conv_num: null,
    target_conv_num_qoq: null,
    target_conv_rate: null,
    target_conv_rate_qoq: null,
    product_conv_num: null,
    product_conv_num_qoq: null,
    product_conv_rate: null,
    product_conv_rate_qoq: null,
    city_id: CITY_ID,
    county_id: COUNTY_ID,
    is_deleted: 0,
  })

  return { rows, byChannel: Object.fromEntries(rows.map((row) => [row.channel, row])) }
}

function buildCapacity(month, byChannel, octoberDetails, previousCapacity) {
  const monthDate = monthText(month)
  const namedRows = []
  const currentByCategory = new Map()

  for (const channel of Object.keys(CHANNELS)) {
    const detailRows = octoberDetails.filter((row) => row.channel === channel)
    const monthlySuccess = byChannel[channel].reach_count
    const allocated = allocate(monthlySuccess, detailRows)
    detailRows.forEach((source, index) => {
      const row = {
        tab_type: TAB,
        strategy_class: CATEGORY,
        stat_month: monthDate,
        channel,
        big_category: source.big_category,
        small_category: source.small_category,
        capacity: allocated[index],
        city_id: CITY_ID,
        county_id: COUNTY_ID,
        is_deleted: 0,
      }
      const categoryKey = `${row.big_category}\u001f${row.small_category}`
      const key = `${channel}\u001f${categoryKey}`
      row.qoq = previousCapacity.has(key) ? qoqPercent(row.capacity, previousCapacity.get(key)) : null
      currentByCategory.set(key, row.capacity)
      namedRows.push(row)
    })

    const totalKey = `${channel}\u001f\u5168\u90e8\u001f\u5168\u90e8`
    const totalRow = {
      tab_type: TAB,
      strategy_class: CATEGORY,
      stat_month: monthDate,
      channel,
      big_category: '\u5168\u90e8',
      small_category: '\u5168\u90e8',
      capacity: monthlySuccess,
      qoq: previousCapacity.has(totalKey) ? qoqPercent(monthlySuccess, previousCapacity.get(totalKey)) : null,
      city_id: CITY_ID,
      county_id: COUNTY_ID,
      is_deleted: 0,
    }
    currentByCategory.set(totalKey, monthlySuccess)
    namedRows.push(totalRow)
  }

  const categoryKeys = octoberDetails
    .filter((row) => row.channel === Object.keys(CHANNELS)[0])
    .map((row) => `${row.big_category}\u001f${row.small_category}`)
  for (const categoryKey of categoryKeys) {
    const [big_category, small_category] = categoryKey.split('\u001f')
    const capacity = Object.keys(CHANNELS).reduce((sum, channel) => {
      return sum + currentByCategory.get(`${channel}\u001f${categoryKey}`)
    }, 0)
    const key = `\u5168\u90e8\u001f${categoryKey}`
    currentByCategory.set(key, capacity)
    namedRows.push({
      tab_type: TAB,
      strategy_class: CATEGORY,
      stat_month: monthDate,
      channel: '\u5168\u90e8',
      big_category,
      small_category,
      capacity,
      qoq: previousCapacity.has(key) ? qoqPercent(capacity, previousCapacity.get(key)) : null,
      city_id: CITY_ID,
      county_id: COUNTY_ID,
      is_deleted: 0,
    })
  }

  const allCapacity = Object.keys(CHANNELS).reduce((sum, channel) => sum + byChannel[channel].reach_count, 0)
  const allTotalKey = '\u5168\u90e8\u001f\u5168\u90e8\u001f\u5168\u90e8'
  currentByCategory.set(allTotalKey, allCapacity)
  namedRows.push({
    tab_type: TAB,
    strategy_class: CATEGORY,
    stat_month: monthDate,
    channel: '\u5168\u90e8',
    big_category: '\u5168\u90e8',
    small_category: '\u5168\u90e8',
    capacity: allCapacity,
    qoq: previousCapacity.has(allTotalKey) ? qoqPercent(allCapacity, previousCapacity.get(allTotalKey)) : null,
    city_id: CITY_ID,
    county_id: COUNTY_ID,
    is_deleted: 0,
  })

  return { rows: namedRows, byCategory: currentByCategory }
}

async function getRows(connection, table, monthStart, monthEnd) {
  const [rows] = await connection.query(
    `SELECT * FROM ${table} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? ORDER BY id`,
    [TAB, CATEGORY, monthStart, monthEnd],
  )
  return rows
}

async function insertRows(connection, table, rows, columns) {
  const placeholders = `(${columns.map(() => '?').join(',')})`
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => placeholders).join(',')}`
  const values = rows.flatMap((row) => columns.map((column) => row[column] ?? null))
  await connection.query(sql, values)
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local' || !['127.0.0.1', 'localhost', '::1'].includes(HOST)) {
    fail(`Refusing non-local database ${DATABASE}@${HOST}`)
  }
  const connection = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    dateStrings: true,
    decimalNumbers: true,
    charset: 'utf8mb4',
  })

  try {
    const [identityRows] = await connection.query('SELECT DATABASE() AS db, @@hostname AS hostname, @@port AS port')
    const identity = identityRows[0]
    if (identity.db !== 'strategy_review_active_class_local') fail(`Unexpected DB identity: ${JSON.stringify(identity)}`)

    const [octSummary] = await connection.query(
      `SELECT * FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month='2026-10-01' AND is_deleted=0 ORDER BY id`,
      [TAB, CATEGORY],
    )
    const cityService = octSummary.find((row) => row.channel === 'ACH0003')
    if (!cityService || Number(cityService.push_count) !== 202329 || Number(cityService.reach_count) !== 131972 || Number(cityService.target_conv_num) !== 70357) {
      fail('October city-service anchor differs from the confirmed values (202329 / 131972 / 70357)')
    }
    const face = octSummary.find((row) => row.channel === 'ACH0006')
    if (!face || Number(face.push_count) !== 69857 || Number(face.reach_count) !== 31473) {
      fail('October face orders/success anchor differs from the current summary values')
    }
    const faceRate = ratioPercent(Number(face.reach_count), Number(face.push_count))

    const [octCapacity] = await connection.query(
      `SELECT * FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month='2026-10-01' AND is_deleted=0 ORDER BY id`,
      [TAB, CATEGORY],
    )
    const octoberDetails = octCapacity.filter((row) => row.channel !== '\u5168\u90e8' && !(row.big_category === '\u5168\u90e8' && row.small_category === '\u5168\u90e8'))
    const channelSet = new Set(octoberDetails.map((row) => row.channel))
    const referenceCategoryKeys = octoberDetails
      .filter((row) => row.channel === Object.keys(CHANNELS)[0])
      .map((row) => `${row.big_category}\u001f${row.small_category}`)
      .sort()
    if (octSummary.length !== 6 || octCapacity.length !== 174 || channelSet.size !== 5) {
      fail(`Unexpected October source structure: ${octSummary.length} KPI rows, ${octCapacity.length} capacity rows, ${channelSet.size} detail channels`)
    }
    for (const channel of Object.keys(CHANNELS)) {
      const detail = octoberDetails.filter((row) => row.channel === channel)
      const categoryKeys = detail.map((row) => `${row.big_category}\u001f${row.small_category}`).sort()
      const summaryRow = octSummary.find((row) => row.channel === channel)
      const totalRow = octCapacity.find((row) => row.channel === channel && row.big_category === '\u5168\u90e8' && row.small_category === '\u5168\u90e8')
      if (detail.length !== 28 || !summaryRow || !totalRow) fail(`Unexpected October category rows for ${channel}`)
      if (JSON.stringify(categoryKeys) !== JSON.stringify(referenceCategoryKeys)) fail(`October category dimensions differ for ${channel}`)
      const detailSum = detail.reduce((sum, row) => sum + Number(row.capacity), 0)
      if (detailSum !== Number(summaryRow.reach_count) || Number(totalRow.capacity) !== Number(summaryRow.reach_count)) {
        fail(`October category capacities do not match reach_count for ${channel}`)
      }
    }

    const targetStart = '2026-01-01'
    const targetEnd = '2026-10-01'
    const [existing] = await connection.query(
      `SELECT 'summary' source,stat_month,is_deleted,COUNT(*) rows_count FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? GROUP BY stat_month,is_deleted UNION ALL SELECT 'capacity',stat_month,is_deleted,COUNT(*) FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? GROUP BY stat_month,is_deleted ORDER BY source,stat_month,is_deleted`,
      [TAB, CATEGORY, targetStart, targetEnd, TAB, CATEGORY, targetStart, targetEnd],
    )
    const [activeCounts] = await connection.query(
      `SELECT 'summary' source,stat_month,COUNT(*) rows_count FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? AND is_deleted=0 GROUP BY stat_month UNION ALL SELECT 'capacity',stat_month,COUNT(*) FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? AND is_deleted=0 GROUP BY stat_month`,
      [TAB, CATEGORY, targetStart, targetEnd, TAB, CATEGORY, targetStart, targetEnd],
    )
    if (activeCounts.length > 0) fail(`Active 2026-01..09 rows already exist: ${JSON.stringify(activeCounts)}`)

    const summaryRows = []
    const capacityRows = []
    let previousByChannel = {}
    let previousCapacity = new Map()
    const monthlySummary = []
    for (let index = 0; index < 9; index += 1) {
      const month = index + 1
      const summary = buildSummary(month, index, previousByChannel)
      summaryRows.push(...summary.rows)
      const capacity = buildCapacity(month, summary.byChannel, octoberDetails, previousCapacity)
      if (capacity.rows.length !== 174) fail(`Generated capacity row count is ${capacity.rows.length} for month ${month}`)
      for (const channel of [...Object.keys(CHANNELS), '\u5168\u90e8']) {
        const categoryRows = capacity.rows.filter((row) => row.channel === channel)
        const totalRow = categoryRows.find((row) => row.big_category === '\u5168\u90e8' && row.small_category === '\u5168\u90e8')
        const details = categoryRows.filter((row) => !(row.big_category === '\u5168\u90e8' && row.small_category === '\u5168\u90e8'))
        const detailSum = details.reduce((sum, row) => sum + Number(row.capacity), 0)
        const expected = summary.byChannel[channel].reach_count
        if (!totalRow || Number(totalRow.capacity) !== expected || detailSum !== expected) {
          fail(`Generated category capacities do not match reach_count for ${monthText(month)} / ${channel}`)
        }
      }
      capacityRows.push(...capacity.rows)
      previousByChannel = summary.byChannel
      previousCapacity = capacity.byCategory
      monthlySummary.push({
        month: monthText(month).slice(0, 7),
        strategyCount: summary.byChannel['\u5168\u90e8'].strategy_count,
        allPush: summary.byChannel['\u5168\u90e8'].push_count,
        allReach: summary.byChannel['\u5168\u90e8'].reach_count,
        overallPush: summary.byChannel['ACH0004'].push_count,
        overallReach: summary.byChannel['ACH0004'].reach_count,
        cityOrders: summary.byChannel['ACH0003'].push_count,
        citySuccess: summary.byChannel['ACH0003'].reach_count,
        cityDispatch: summary.byChannel['ACH0003'].target_conv_num,
        citySuccessRate: summary.byChannel['ACH0003'].reach_rate,
        cityDispatchRate: summary.byChannel['ACH0003'].target_conv_rate,
        faceOrder: summary.byChannel['ACH0006'].push_count,
        faceSuccess: summary.byChannel['ACH0006'].reach_count,
        faceSuccessRate: summary.byChannel['ACH0006'].reach_rate,
      })
    }

    const summaryColumns = [
      'tab_type', 'strategy_class', 'stat_month', 'channel', 'strategy_count', 'strategy_count_qoq',
      'push_count', 'push_count_qoq', 'reach_count', 'reach_count_qoq', 'reach_rate', 'reach_rate_qoq',
      'target_conv_num', 'target_conv_num_qoq', 'target_conv_rate', 'target_conv_rate_qoq',
      'product_conv_num', 'product_conv_num_qoq', 'product_conv_rate', 'product_conv_rate_qoq',
      'city_id', 'county_id', 'is_deleted',
    ]
    const capacityColumns = [
      'tab_type', 'strategy_class', 'stat_month', 'channel', 'big_category', 'small_category',
      'capacity', 'qoq', 'city_id', 'county_id', 'is_deleted',
    ]

    process.stdout.write(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      database: identity.db,
      host: identity.hostname,
      range: '2026-01..09',
      octoberCityService: {
        orders: Number(cityService.push_count),
        success: Number(cityService.reach_count),
        dispatch: Number(cityService.target_conv_num),
        successRate: Number(cityService.reach_rate),
        dispatchRate: Number(cityService.target_conv_rate),
      },
      octoberFaceSuccessRateFromOrders: faceRate,
      existingTargetRows: existing,
      planned: { summaryRows: summaryRows.length, capacityRows: capacityRows.length },
      monthlySummary,
    }, null, 2) + '\n')

    if (!APPLY) return

    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const [oldSummary] = await connection.query(
      `SELECT * FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? ORDER BY id`,
      [TAB, CATEGORY, targetStart, targetEnd],
    )
    const [oldCapacity] = await connection.query(
      `SELECT * FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? ORDER BY id`,
      [TAB, CATEGORY, targetStart, targetEnd],
    )
    const backupPath = path.join(BACKUP_DIR, `backup-${stamp}.json`)
    const generatedPath = path.join(BACKUP_DIR, `generated-${stamp}.json`)
    fs.writeFileSync(backupPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      database: identity.db,
      identity,
      targetRange: '2026-01..09',
      preservedMonth: '2026-10',
      targetExistingRows: { summary: oldSummary, capacity: oldCapacity },
      octoberBaseline: { summary: octSummary, capacity: octCapacity },
    }, null, 2), 'utf8')
    fs.writeFileSync(generatedPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      database: identity.db,
      assumptions: {
        overallConsultationCenter: 1770000,
        overallSuccessRatePercent: 81.6,
        serviceOrdersCenterFromOctober: 202329,
        serviceSuccessRatePercent: 58,
        serviceDispatchRateJanuaryPercent: 32,
        serviceDispatchRelativeGrowthPercent: 3,
        faceSuccessRateDenominator: 'push_count (orders)',
        capacityCategories: 'October category proportions scaled to monthly channel reach_count',
      },
      summaryRows,
      capacityRows,
    }, null, 2), 'utf8')

    await connection.beginTransaction()
    try {
      await insertRows(connection, SUMMARY_TABLE, summaryRows, summaryColumns)
      await insertRows(connection, CAPACITY_TABLE, capacityRows, capacityColumns)

      const [verifySummary] = await connection.query(
        `SELECT stat_month,COUNT(*) rows_count FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? AND is_deleted=0 GROUP BY stat_month ORDER BY stat_month`,
        [TAB, CATEGORY, targetStart, targetEnd],
      )
      const [verifyCapacity] = await connection.query(
        `SELECT stat_month,COUNT(*) rows_count FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month>=? AND stat_month<? AND is_deleted=0 GROUP BY stat_month ORDER BY stat_month`,
        [TAB, CATEGORY, targetStart, targetEnd],
      )
      if (verifySummary.length !== 9 || verifySummary.some((row) => Number(row.rows_count) !== 6)) fail('KPI verification row counts do not match 6 per month')
      if (verifyCapacity.length !== 9 || verifyCapacity.some((row) => Number(row.rows_count) !== 174)) fail('Capacity verification row counts do not match 174 per month')

      const [octSummaryAfter] = await connection.query(
        `SELECT * FROM ${SUMMARY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month='2026-10-01' AND is_deleted=0 ORDER BY id`,
        [TAB, CATEGORY],
      )
      const [octCapacityAfter] = await connection.query(
        `SELECT * FROM ${CAPACITY_TABLE} WHERE tab_type=? AND strategy_class=? AND stat_month='2026-10-01' AND is_deleted=0 ORDER BY id`,
        [TAB, CATEGORY],
      )
      if (JSON.stringify(octSummaryAfter) !== JSON.stringify(octSummary) || JSON.stringify(octCapacityAfter) !== JSON.stringify(octCapacity)) {
        fail('October rows changed unexpectedly')
      }

      await connection.commit()
      process.stdout.write(JSON.stringify({
        applied: true,
        summaryRows: summaryRows.length,
        capacityRows: capacityRows.length,
        verifiedSummary: verifySummary,
        verifiedCapacity: verifyCapacity,
        octoberPreserved: true,
        backupPath,
        generatedPath,
      }, null, 2) + '\n')
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exit(1)
})
