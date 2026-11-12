const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const SIMULATION = require('../src/views/strategyReview/active/declineSimulation.json')
const DATABASE = 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const DAILY_CUTOFF = SIMULATION.sourceCutoff
const sourceArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const SOURCE = path.resolve(sourceArg || 'D:\\工作数据\\新建文件夹\\降拆.xlsx')
const APPLY = process.argv.includes('--apply')
const CHANNEL_LABELS = {
  '整体': 'ACH0004',
  '市级-营服': 'ACH0003',
  '省级-在线': 'ACH0005',
  '网格-面客': 'ACH0006',
}
const LABELS = {
  strategy_count: '策略数', original_cust: '原始客群', push_count: '咨询量',
  usage_count: '接触量', usage_rate: '接触率', reach_count: '派单量',
  reach_rate: '派单率', target_conv_num: '目标成功量', target_conv_rate: '目标成功率',
  product_conv_num: '成功量', product_conv_rate: '成功率', expected_income: '预计收益',
  actual_income: '实际收益', reject_count: '拒绝量', reject_rate: '拒绝率',
}
const RATE_FIELDS = new Set(['usage_rate', 'reach_rate', 'target_conv_rate', 'product_conv_rate', 'reject_rate'])
const ADDITIVE_FIELDS = [
  'original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num',
  'product_conv_num', 'expected_income', 'actual_income', 'reject_count',
]

function fail(message) { throw new Error(message) }
function isLoopback(host) { return ['127.0.0.1', 'localhost', '::1'].includes(host) }
function pythonJson() {
  const script = path.join(__dirname, 'extract-decline-source-exact.py')
  const result = spawnSync(process.env.PYTHON || 'python', [script, SOURCE], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  if (result.status !== 0) fail(`Workbook extraction failed: ${(result.stderr || result.stdout || '').trim()}`)
  return JSON.parse(result.stdout)
}
function asNumber(value, label) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) fail(`Invalid count ${label}: ${value}`)
  return n
}
function sumPresent(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined && value !== '')
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null
}
function pct(numerator, denominator) {
  if (numerator === null || denominator === null || !denominator) return null
  return Number((Number(numerator) * 100 / Number(denominator)).toFixed(4))
}
function largestRemainder(total, weights) {
  if (total === null || total === undefined) return weights.map(() => null)
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  if (!weightSum || !Number.isFinite(weightSum)) fail('Daily source weights must sum to a positive value')
  const exact = weights.map((weight) => total * weight / weightSum)
  const result = exact.map(Math.floor)
  let remaining = total - result.reduce((sum, value) => sum + value, 0)
  const order = exact.map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  if (remaining < 0 || remaining > order.length) fail(`Invalid largest-remainder residual: ${remaining}`)
  for (let i = 0; i < remaining; i++) result[order[i].index] += 1
  return result
}
function dailyWeights(raw, cutoff) {
  if (!/^2026-10-\d{2}$/.test(cutoff)) fail(`Unexpected daily cutoff: ${cutoff}`)
  const days = Number(cutoff.slice(-2))
  const sourceHeader = raw.rawRows.find((row) => row.sheetName === '分日数据' && row.sourceRow === 2)
  if (!sourceHeader) fail('Workbook is missing the 分日数据 date header')
  const sourceDays = sourceHeader.values.slice(2, 32)
  if (sourceDays.length !== 30 || sourceDays.some((value, index) => String(value) !== `${index + 1}号`)) {
    fail('Expected daily split weights for October 1–30')
  }
  const sourceLabels = {
    push_count: '咨询量占比',
    usage_count: '接触量占比',
    reach_count: '派单量占比',
    product_conv_num: '成功量占比',
  }
  const selected = {}
  for (const [field, label] of Object.entries(sourceLabels)) {
    const sourceRow = raw.rawRows.find((row) => row.sheetName === '分日数据' && row.values[1] === label)
    if (!sourceRow) fail(`Workbook is missing daily weights for ${label}`)
    const fullMonth = sourceRow.values.slice(2, 32).map(Number)
    if (fullMonth.length !== 30 || fullMonth.some((weight) => !Number.isFinite(weight) || weight < 0)) {
      fail(`Invalid daily weights for ${label}`)
    }
    const fullTotal = fullMonth.reduce((sum, weight) => sum + weight, 0)
    if (Math.abs(fullTotal - 1) > 0.001) fail(`Daily weights for ${label} sum to ${fullTotal}, not 1`)
    const partial = fullMonth.slice(0, days)
    const partialTotal = partial.reduce((sum, weight) => sum + weight, 0)
    if (!partialTotal) fail(`Daily weights for ${label} are empty through ${cutoff}`)
    selected[field] = partial.map((weight) => weight / partialTotal)
  }
  return {
    dates: Array.from({ length: days }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`),
    fields: selected,
  }
}
function buildDailyRows(facts, weights) {
  const weightField = {
    original_cust: 'push_count', push_count: 'push_count', usage_count: 'usage_count',
    reach_count: 'reach_count', target_conv_num: 'reach_count', product_conv_num: 'product_conv_num',
    expected_income: 'push_count', actual_income: 'push_count', reject_count: 'push_count',
  }
  const scaleField = { expected_income: 100, actual_income: 100 }
  const rows = []
  for (const monthly of facts) {
    const distributed = {}
    for (const [field, weightKey] of Object.entries(weightField)) {
      const sourceValue = monthly[field]
      if (sourceValue === null || sourceValue === undefined) {
        distributed[field] = weights.dates.map(() => null)
        continue
      }
      const scale = scaleField[field] || 1
      const scaled = Math.round(Number(sourceValue) * scale)
      distributed[field] = largestRemainder(scaled, weights.fields[weightKey])
        .map((value) => scale === 1 ? value : value / scale)
    }
    for (let index = 0; index < weights.dates.length; index++) {
      const values = Object.fromEntries(Object.keys(weightField).map((field) => [field, distributed[field][index]]))
      rows.push({
        tab_type: 'active', strategy_class: '降拆', strategy_id: monthly.strategy_id,
        stat_month: weights.dates[index], channel: monthly.channel,
        big_category: monthly.big_category, small_category: monthly.small_category,
        strategy_name: monthly.strategy_name,
        ...values,
        usage_rate: pct(values.usage_count, values.push_count),
        target_conv_rate: pct(values.target_conv_num, values.reach_count),
        product_conv_rate: pct(values.product_conv_num, values.push_count),
        reject_rate: pct(values.reject_count, values.push_count),
        strategy_code: monthly.strategy_code, city_id: monthly.city_id,
        county_id: monthly.county_id, is_deleted: 0,
      })
    }
  }
  return rows
}
function dateOnly(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value).slice(0, 10)
}
function safeIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) fail(`Unsafe table name: ${name}`)
  return `\`${name}\``
}
function findExecutable(name, fallback) {
  const found = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true })
  const first = (found.stdout || '').split(/\r?\n/).find(Boolean)
  if (first) return first.trim()
  if (fs.existsSync(fallback)) return fallback
  fail(`Required local executable not found: ${name}`)
}
function mysqlEnv() {
  return { ...process.env, MYSQL_PWD: process.env.SR_DB_PASSWORD || process.env.MYSQL_PWD || PASSWORD }
}
function backupTables(outDir, tables) {
  const dump = findExecutable('mysqldump.exe', 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe')
  const args = [
    '--protocol=tcp', '-h', HOST, '-P', String(PORT), '-u', USER,
    '--default-character-set=utf8mb4', '--no-create-info', '--replace', '--skip-add-locks',
    '--skip-comments', '--single-transaction', '--skip-lock-tables', DATABASE, ...tables,
  ]
  const result = spawnSync(dump, args, {
    env: mysqlEnv(), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true,
  })
  if (result.status !== 0) fail(`Database backup failed: ${(result.stderr || '').trim()}`)
  const backupPath = path.join(outDir, 'pre-import-special-tables.sql')
  fs.writeFileSync(backupPath, result.stdout, 'utf8')
  return backupPath
}
function jsonSafe(value) {
  return JSON.stringify(value, (_key, item) => (item === undefined ? null : item))
}
function channelMetrics(rows) {
  const push = sumPresent(rows, 'push_count')
  const mapped = {
    strategy_count: new Set(rows.map((row) => row.strategy_id)).size,
    original_cust: sumPresent(rows, 'original_cust'),
    push_count: push,
    usage_count: sumPresent(rows, 'usage_count'),
    reach_count: sumPresent(rows, 'reach_count'),
    target_conv_num: sumPresent(rows, 'target_conv_num'),
    product_conv_num: sumPresent(rows, 'product_conv_num'),
    expected_income: sumPresent(rows, 'expected_income'),
    actual_income: sumPresent(rows, 'actual_income'),
    reject_count: sumPresent(rows, 'reject_count'),
  }
  mapped.usage_rate = pct(mapped.usage_count, mapped.push_count)
  mapped.reach_rate = pct(mapped.reach_count, mapped.push_count)
  mapped.reach_rate_qoq = null
  mapped.target_conv_rate = null
  mapped.product_conv_rate = pct(mapped.product_conv_num, mapped.push_count)
  mapped.reject_rate = pct(mapped.reject_count, mapped.push_count)
  return mapped
}
function prepare(raw) {
  if (!Array.isArray(raw.sheetNames) || !raw.sheetNames.includes('分日数据')) fail('Workbook is missing the 分日数据 sheet')
  if (raw.strategies.length !== 235) fail(`Expected 235 strategy archive rows, found ${raw.strategies.length}`)
  const codes = raw.strategies.map((row) => row.strategy_code)
  if (new Set(codes).size !== codes.length || codes.some((code) => !code)) fail('Strategy codes are missing or duplicated')
  if (raw.strategies.some((row) => row.strategy_class !== '降拆')) fail('Workbook contains a strategy outside 降拆')
  if (raw.execution.length !== 235) fail(`Expected 235 monthly fact rows, found ${raw.execution.length}`)
  if (raw.details.length !== 235) fail(`Expected 235 reject detail rows, found ${raw.details.length}`)
  const masterByCode = new Map(raw.strategies.map((row) => [row.strategy_code, row]))
  const channelNames = [...new Set(raw.execution.map((row) => row.channel))]
  if (channelNames.length !== 5) fail(`Expected 5 source channels, found ${channelNames.length}`)
  const channelCounts = Object.fromEntries(channelNames.map((name) => [name, raw.execution.filter((row) => row.channel === name).length]))
  if (Object.values(channelCounts).some((count) => count !== 47)) fail(`Expected 47 rows per channel: ${JSON.stringify(channelCounts)}`)
  const detailCodes = [...new Set(raw.details.map((row) => row.strategy_code))]
  if (detailCodes.length !== 47 || raw.details.some((row) => !masterByCode.has(row.strategy_code) || masterByCode.get(row.strategy_code).channel !== '整体')) {
    fail('Reject details must be the five source reasons for each of the 47 overall-channel strategies')
  }
  for (const row of raw.execution) {
    if (row.period_type !== '月' || dateOnly(row.stat_date) !== '2026-10-01') fail('All execution rows must be October monthly rows')
    if (!masterByCode.has(row.strategy_code)) fail(`No strategy archive row for ${row.strategy_code}`)
    if (String(row.city_id) !== '999' || String(row.county_id) !== '999') fail(`Unexpected source region on row ${row._source_row}`)
    for (const key of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'expected_income', 'actual_income', 'reject_count']) {
      asNumber(row[key], `${key} row ${row._source_row}`)
    }
  }
  for (const row of raw.details) {
    if (row.detail_type !== '拒绝原因' || !masterByCode.has(row.strategy_code)) fail(`Unexpected reject detail on row ${row._source_row}`)
    if (String(row.city_id) !== '999' || String(row.county_id) !== '999') fail(`Unexpected source detail region on row ${row._source_row}`)
    asNumber(row.item_count, `item_count row ${row._source_row}`)
  }
  const formulas = raw.rawRows.flatMap((row) => row.formulaCells.map((cell) => ({ ...cell, sheetName: row.sheetName, sourceRow: row.sourceRow })))
  const formulaProducts = formulas.filter((item) => item.sheetName === '2_执行数据' && item.cell.startsWith('N'))
  if (formulaProducts.length !== 47 || formulaProducts.some((item) => !/^=L\d+\/J\d+$/.test(item.formula))) {
    fail(`Expected 47 cached product conversion rate formulas; found ${formulaProducts.length}`)
  }
  const executionByChannel = new Map()
  for (const row of raw.execution) {
    if (!executionByChannel.has(row.channel)) executionByChannel.set(row.channel, [])
    executionByChannel.get(row.channel).push(row)
  }
  const codeNumber = (code) => {
    const match = String(code || '').match(/^jd_(\d+)$/)
    if (!match) fail(`Unexpected strategy code: ${code}`)
    return Number(match[1])
  }
  for (const rows of executionByChannel.values()) rows.sort((a, b) => codeNumber(a.strategy_code) - codeNumber(b.strategy_code))
  const overallRows = executionByChannel.get('整体') || []
  const variantsByOverallCode = new Map()
  // The workbook keeps one strategy ID per channel and gives refusal details only for 整体.
  // Match channel-specific IDs by their source order; validate category alignment before reusing the details.
  for (const channel of channelNames) {
    const rows = executionByChannel.get(channel) || []
    if (rows.length !== overallRows.length) fail(`Expected ${overallRows.length} ordered strategy rows for ${channel}`)
    for (let index = 0; index < overallRows.length; index++) {
      if (rows[index].big_category !== overallRows[index].big_category || rows[index].small_category !== overallRows[index].small_category) {
        fail(`Strategy category order differs between 整体 and ${channel} at row ${index + 1}`)
      }
      const overallCode = overallRows[index].strategy_code
      if (!variantsByOverallCode.has(overallCode)) variantsByOverallCode.set(overallCode, [])
      variantsByOverallCode.get(overallCode).push(masterByCode.get(rows[index].strategy_code))
    }
  }
  for (const detail of raw.details) {
    const variants = variantsByOverallCode.get(detail.strategy_code) || []
    if (variants.length !== channelNames.length || new Set(variants.map((row) => row.channel)).size !== channelNames.length) {
      fail(`Expected one matching channel strategy per source strategy ${detail.strategy_code}`)
    }
  }
  return { masterByCode, variantsByOverallCode, channelNames, channelCounts, formulas }
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local' || !isLoopback(HOST)) fail('This importer is restricted to the local strategy_review_active_class_local database')
  if (!fs.existsSync(SOURCE)) fail(`Workbook does not exist: ${SOURCE}`)
  const sourceBytes = fs.readFileSync(SOURCE)
  const sourceSha = crypto.createHash('sha256').update(sourceBytes).digest('hex')
  const raw = pythonJson()
  if (raw.sha256 !== sourceSha || raw.byteLength !== sourceBytes.length) fail('Workbook changed during extraction; refusing to import')
  const prepared = prepare(raw)
  const weights = dailyWeights(raw, DAILY_CUTOFF)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(ROOT, 'outputs', `decline-october-exact-${sourceSha.slice(0, 12)}-${timestamp}`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'source-preview.json'), jsonSafe({
    sourceFile: raw.sourceFile, sourcePath: raw.sourcePath, sourceSha256: sourceSha,
    byteLength: raw.byteLength, sheetNames: raw.sheetNames,
    strategyArchiveRows: raw.strategies.length, overallStrategies: 47, monthlyRows: raw.execution.length, detailRows: raw.details.length,
    rawRows: raw.rawRows.length, formulas: prepared.formulas.length,
    sourceChannels: prepared.channelCounts,
    sourceMapping: {
      push_count: 'source push_count (咨询量)',
      product_conv_num: 'source reach_count (成功量)',
      reach_count: 'source target_conv_num (派单量)',
      product_conv_num_formula: '保存于 source row JSON 中，原始公式与缓存值不转成数量',
      reject_reasons: '源表仅提供整体渠道拒绝原因；按各渠道同序且业务分类一致的策略对应到渠道编码',
      daily: `按工作簿47条策略的指标分日比例分摊月度原值，生成至${DAILY_CUTOFF}的模拟日明细`,
    },
  }), 'utf8')

  const conn = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE,
    dateStrings: true, charset: 'utf8mb4', decimalNumbers: true,
  })
  try {
    const [[identity]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    if (identity.db !== DATABASE || !isLoopback(HOST)) fail(`Unexpected database: ${JSON.stringify(identity)}`)
    const codePlaceholders = codesSql(raw.strategies)
    const [masterConflicts] = await conn.query(
      `SELECT strategy_code,tab_type,strategy_class FROM v_sr_strategy_read WHERE is_deleted=0 AND strategy_code IN (${codePlaceholders.sql}) AND (tab_type<>'active' OR strategy_class IS NOT NULL AND strategy_class<>'降拆')`,
      codePlaceholders.values,
    )
    if (masterConflicts.length) fail(`Source strategy codes already belong to another live class: ${JSON.stringify(masterConflicts.slice(0, 10))}`)

    const [dimensions] = await conn.query("SELECT key_code,key_name,tab_type,status,sort_no,is_deleted FROM t_sr_dim_channel")
    const channelMap = new Map()
    const dimInserts = []
    let maxAch = 0
    let maxSort = 0
    for (const dim of dimensions) {
      maxSort = Math.max(maxSort, Number(dim.sort_no || 0))
      const match = String(dim.key_code || '').match(/^ACH(\d+)$/)
      if (match) maxAch = Math.max(maxAch, Number(match[1]))
    }
    for (const name of prepared.channelNames) {
      const matches = dimensions.filter((dim) => dim.key_name === name && dim.status === 1 && dim.is_deleted === 0 &&
        String(dim.tab_type || '').split(',').includes('active'))
      const uniqueCodes = [...new Set(matches.map((row) => row.key_code))]
      if (uniqueCodes.length > 1) fail(`Ambiguous channel dimension for ${name}: ${uniqueCodes.join(',')}`)
      if (uniqueCodes.length === 1) {
        channelMap.set(name, uniqueCodes[0])
      } else {
        let code
        do { maxAch += 1; code = `ACH${String(maxAch).padStart(4, '0')}` }
        while (dimensions.some((dim) => dim.key_code === code) || dimInserts.some((dim) => dim.key_code === code))
        maxSort += 1
        channelMap.set(name, code)
        dimInserts.push({ key_code: code, key_name: name, tab_type: 'active', status: 1, sort_no: maxSort, is_deleted: 0 })
      }
    }

    const reasonNames = [...new Set(raw.details.map((row) => row.item_name))]
    const reasonCodes = new Map(reasonNames.map((name) => [name, `SRC_${crypto.createHash('sha1').update(name, 'utf8').digest('hex').slice(0, 12)}`]))
    const formulaAtRow = new Map()
    for (const item of prepared.formulas) {
      if (item.sheetName !== '2_执行数据') continue
      formulaAtRow.set(item.sourceRow, { formula: item.formula, cached: item.cached })
    }

    const facts = raw.execution.map((source) => {
      const strategy = prepared.masterByCode.get(source.strategy_code)
      const sourcePush = asNumber(source.push_count, `push_count ${source.strategy_code}`)
      const sourceSuccess = asNumber(source.reach_count, `reach_count ${source.strategy_code}`)
      const sourceDispatch = asNumber(source.target_conv_num, `target_conv_num ${source.strategy_code}`)
      const fact = {
        tab_type: 'active', strategy_class: '降拆', strategy_id: source.strategy_code,
        strategy_code: source.strategy_code, strategy_name: strategy.strategy_name,
        channel: channelMap.get(source.channel), big_category: source.big_category,
        small_category: source.small_category, stat_month: '2026-10-01', strategy_count: 1,
        original_cust: asNumber(source.original_cust, `original_cust ${source.strategy_code}`),
        push_count: sourcePush, usage_count: asNumber(source.usage_count, `usage_count ${source.strategy_code}`),
        reach_count: sourceDispatch, target_conv_num: null, product_conv_num: sourceSuccess,
        expected_income: source.expected_income === null ? null : Number(source.expected_income),
        actual_income: source.actual_income === null ? null : Number(source.actual_income),
        reject_count: asNumber(source.reject_count, `reject_count ${source.strategy_code}`),
        city_id: String(source.city_id), county_id: String(source.county_id), is_deleted: 0,
        product_conv_rate: pct(sourceSuccess, sourcePush),
        usage_rate: pct(source.usage_count, sourcePush), target_conv_rate: null,
        reject_rate: pct(source.reject_count, sourcePush),
      }
      for (const field of ADDITIVE_FIELDS) {
        if (fact[field] !== null && fact[field] !== undefined && !Number.isFinite(Number(fact[field]))) fail(`Invalid ${field} for ${source.strategy_code}`)
      }
      return fact
    })

    const grouped = new Map()
    for (const row of facts) {
      if (!grouped.has(row.channel)) grouped.set(row.channel, [])
      grouped.get(row.channel).push(row)
    }
    const summaries = [...grouped.entries()].map(([channel, rows]) => {
      const metrics = channelMetrics(rows)
      delete metrics.reject_count
      delete metrics.reject_rate
      return {
        tab_type: 'active', strategy_class: '降拆', stat_month: '2026-10-01', channel,
        ...metrics, city_id: '999', county_id: '999', is_deleted: 0,
      }
    })
    const overall = summaries.find((row) => row.channel === channelMap.get('整体'))
    if (!overall || overall.strategy_count !== 47) fail('The October overall channel summary is missing or incomplete')
    const kpis = Object.entries(LABELS).map(([metricCode, metricName], index) => {
      const value = metricCode === 'reach_rate'
        ? pct(overall.reach_count, overall.push_count)
        : metricCode === 'reject_count'
          ? sumPresent(facts.filter((row) => row.channel === channelMap.get('整体')), 'reject_count')
          : metricCode === 'reject_rate'
            ? pct(sumPresent(facts.filter((row) => row.channel === channelMap.get('整体')), 'reject_count'), overall.push_count)
            : overall[metricCode]
      const unit = metricCode === 'strategy_count' ? '个' : RATE_FIELDS.has(metricCode) ? '%' : /income/.test(metricCode) ? '元' : metricCode === 'original_cust' ? '人' : '次'
      return {
        tab_type: 'active', strategy_class: '降拆', stat_month: '2026-10', metric_code: metricCode,
        metric_name: metricName, value, unit, qoq: null, yoy: null, icon: null, sort_no: index + 1,
        city_id: '999', county_id: '999', is_deleted: 0,
      }
    })
    const reasons = []
    const detailsByStrategy = new Map()
    for (const source of raw.details) {
      if (!detailsByStrategy.has(source.strategy_code)) detailsByStrategy.set(source.strategy_code, [])
      detailsByStrategy.get(source.strategy_code).push(source)
    }
    for (const source of raw.details) {
      const rows = detailsByStrategy.get(source.strategy_code)
      const reasonCount = asNumber(source.item_count, `item_count ${source.strategy_code}`)
      const total = rows.reduce((sum, row) => sum + Number(row.item_count || 0), 0)
      for (const strategy of prepared.variantsByOverallCode.get(source.strategy_code)) {
        reasons.push({
          strategy_id: strategy.strategy_code, stat_month: '2026-10-01',
          reason_code: reasonCodes.get(source.item_name), reason_name: source.item_name,
          reject_count: reasonCount, reject_ratio: pct(reasonCount, total), city_id: String(source.city_id),
          county_id: String(source.county_id), is_deleted: 0,
          sort_no: rows.findIndex((row) => row._source_row === source._source_row) + 1,
          color: null,
        })
      }
    }
    const dailyFacts = buildDailyRows(facts, weights)

    const output = {
      dryRun: !APPLY, database: DATABASE, sourceFile: raw.sourceFile, sourceSha256: sourceSha,
      sourceMonth: '2026-10', strategyArchiveRows: raw.strategies.length, overallStrategies: 47, monthlyRows: facts.length,
      channelSummaryRows: summaries.length, kpiRows: kpis.length,
      sourceRejectRows: raw.details.length, rejectRows: reasons.length, dailyRows: dailyFacts.length,
      dailyStartDate: weights.dates[0], dailyEndDate: weights.dates[weights.dates.length - 1],
      rawSourceRows: raw.rawRows.length, sourceFormulaCount: prepared.formulas.length,
      dailyRows: dailyFacts.length, sourceChannels: prepared.channelCounts, channelMapping: Object.fromEntries(channelMap),
      rawDataStorage: '原始Excel字节存入 bqq_source_snapshot_file；全工作簿非空行和公式/缓存值存入 t_sr_excel_source_row_raw。',
      servingMapping: {
        push_count: '源 push_count（咨询量）', product_conv_num: '源 reach_count（成功量）',
        reach_count: '源 target_conv_num（派单量）',
        source_product_conv_num: '原公式及缓存值留在原始行快照，不作为数量导入。',
        county_id: '使用源值 999',
        reject_reasons: '原因数量来自整体渠道；按同序且业务分类一致的策略复制到各渠道编码供明细页展示。',
        daily: `非实际日业绩；使用工作簿47策略的各指标比例，将月度策略原值按最大余数法分摊到${weights.dates[0]}至${weights.dates[weights.dates.length - 1]}。`,
      },
      overallKpiValues: Object.fromEntries(kpis.map((row) => [row.metric_code, row.value])),
      previewPath: path.join(outDir, 'source-preview.json'),
    }

    if (!APPLY) {
      fs.writeFileSync(path.join(outDir, 'prepared-summary.json'), jsonSafe(output), 'utf8')
      console.log(JSON.stringify(output, null, 2))
      return
    }

    await applyImport({ conn, raw, sourceBytes, sourceSha, facts, summaries, kpis, reasons, dailyFacts, dailyDays: weights.dates.length, dimInserts,
      channelMap, reasonCodes, masterByCode: prepared.masterByCode, outDir, output })
  } finally {
    await conn.end()
  }
}

function codesSql(strategies) {
  const values = strategies.map((row) => row.strategy_code)
  return { sql: values.map(() => '?').join(','), values }
}

async function insertRows(conn, table, rows) {
  if (!rows.length) return
  const columns = Object.keys(rows[0]).filter((column) => column !== 'id')
  const colSql = columns.map(safeIdentifier).join(',')
  const batchSize = 100
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const tuple = `(${columns.map(() => '?').join(',')})`
    const sql = `INSERT INTO ${safeIdentifier(table)} (${colSql}) VALUES ${batch.map(() => tuple).join(',')}`
    await conn.query(sql, batch.flatMap((row) => columns.map((column) => row[column] === undefined ? null : row[column])))
  }
}

async function applyImport(ctx) {
  const { conn, raw, sourceBytes, sourceSha, facts, summaries, kpis, reasons, dailyFacts, dailyDays, dimInserts,
    channelMap, reasonCodes, masterByCode, outDir, output } = ctx
  const shaName = `${raw.sourceFile}#sha256=${sourceSha}`
  await conn.query(`CREATE TABLE IF NOT EXISTS bqq_source_snapshot_file (
    file_name VARBINARY(255) NOT NULL PRIMARY KEY, table_name VARCHAR(128) NOT NULL,
    sha256 CHAR(64) NOT NULL, byte_length BIGINT UNSIGNED NOT NULL, content LONGBLOB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  await conn.query(`CREATE TABLE IF NOT EXISTS t_sr_excel_source_row_raw (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, source_sha256 CHAR(64) NOT NULL,
    source_file_name VARCHAR(255) NOT NULL, sheet_name VARCHAR(128) NOT NULL,
    source_row INT NOT NULL, values_json JSON NOT NULL, formula_cells_json JSON NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_excel_source_row (source_sha256,sheet_name,source_row)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  const dateTag = new Date().toISOString().replace(/[:.]/g, '-')
  const outFile = path.join(outDir, 'import-result.json')
  if (!output.backupPath || !String(output.backupPath).endsWith('.sql')) {
    const tables = [
      't_sr_strategy_special', 't_sr_strategy_period_summary_ap_special',
      't_sr_strategy_reject_reason_special', 't_sr_strategy_daily_ap_special', 't_sr_kpi_summary_special',
      't_sr_channel_summary_ap_special', 't_sr_dim_channel',
    ]
    output.backupPath = backupTables(outDir, tables)
  }
  output.backupCreatedAt = dateTag

  const masterRows = [...masterByCode.values()].map((source) => ({
    strategy_code: source.strategy_code, strategy_name: source.strategy_name,
    tab_type: 'active', strategy_class: '降拆', product_name: null,
    customer_group: source.customer_group, channel: channelMap.get(source.channel),
    strategy_level: source.strategy_level, caliber: source.caliber,
    iteration: source.iteration === null ? null : Number(source.iteration), owner: source.owner,
    status: source.status, start_date: dateOnly(source.start_date), end_date: dateOnly(source.end_date),
    city_id: null, county_id: null, is_deleted: 0,
  }))
  const [existingMasters] = await conn.query(
    "SELECT id,strategy_code FROM t_sr_strategy_special WHERE tab_type='active' AND strategy_class='降拆' AND strategy_code IN (?) AND is_deleted=0",
    [masterRows.map((row) => row.strategy_code)],
  )
  const existingByCode = new Map(existingMasters.map((row) => [row.strategy_code, row.id]))
  const insertMasters = masterRows.filter((row) => !existingByCode.has(row.strategy_code))
  const updateMasters = masterRows.filter((row) => existingByCode.has(row.strategy_code))

  const fileNameBytes = Buffer.from(shaName, 'utf8')
  if (fileNameBytes.length > 255) fail('Snapshot filename exceeds the database key limit')
  const formulaCount = raw.rawRows.reduce((sum, row) => sum + row.formulaCells.length, 0)
  const strategyIds = facts.map((row) => row.strategy_id)
  const idClause = strategyIds.map(() => '?').join(',')

  await conn.beginTransaction()
  try {
    const [previousChannelRows] = await conn.query(
      `SELECT channel,reach_count,push_count
       FROM t_sr_channel_summary_ap_special
       WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999'
         AND stat_month=DATE_SUB('2026-10-01', INTERVAL 1 MONTH) AND is_deleted=0`,
    )
    const previousByChannel = new Map(previousChannelRows.map((row) => [row.channel, pct(row.reach_count, row.push_count)]))
    for (const row of summaries) {
      const previousRate = previousByChannel.get(row.channel)
      row.reach_rate_qoq = previousRate == null || row.reach_rate == null
        ? null
        : Number((Number(row.reach_rate) - Number(previousRate)).toFixed(2))
    }
    const [existingRaw] = await conn.query('SELECT sha256,byte_length,content FROM bqq_source_snapshot_file WHERE file_name=?', [fileNameBytes])
    if (existingRaw.length) {
      const priorHash = crypto.createHash('sha256').update(existingRaw[0].content).digest('hex')
      if (priorHash !== sourceSha || existingRaw[0].sha256 !== sourceSha) fail('A different source file is stored under this snapshot key')
    } else {
      await conn.query(
        'INSERT INTO bqq_source_snapshot_file (file_name,table_name,sha256,byte_length,content) VALUES (?,?,?,?,?)',
        [fileNameBytes, raw.sourcePath, sourceSha, sourceBytes.length, sourceBytes],
      )
    }

    for (let start = 0; start < raw.rawRows.length; start += 100) {
      const batch = raw.rawRows.slice(start, start + 100)
      const sql = `INSERT INTO t_sr_excel_source_row_raw
        (source_sha256,source_file_name,sheet_name,source_row,values_json,formula_cells_json,imported_at)
        VALUES ${batch.map(() => '(?,?,?,?,?,?,CURRENT_TIMESTAMP)').join(',')}
        ON DUPLICATE KEY UPDATE source_file_name=VALUES(source_file_name),values_json=VALUES(values_json),formula_cells_json=VALUES(formula_cells_json),imported_at=CURRENT_TIMESTAMP`
      const compactValues = []
      batch.forEach((row) => compactValues.push(sourceSha, raw.sourceFile, row.sheetName, row.sourceRow, jsonSafe(row.values), jsonSafe(row.formulaCells)))
      await conn.query(sql, compactValues)
    }

    if (dimInserts.length) await insertRows(conn, 't_sr_dim_channel', dimInserts)
    for (const row of updateMasters) {
      const id = existingByCode.get(row.strategy_code)
      const fields = Object.keys(row).filter((column) => column !== 'strategy_code')
      await conn.query(`UPDATE t_sr_strategy_special SET ${fields.map((field) => `${safeIdentifier(field)}=?`).join(',')},update_time=NOW() WHERE id=?`,
        [...fields.map((field) => row[field]), id])
    }
    await insertRows(conn, 't_sr_strategy_special', insertMasters)

    const monthFactsWhere = `tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999' AND stat_month='2026-10-01' AND strategy_id IN (${idClause}) AND is_deleted=0`
    await conn.query(`UPDATE t_sr_strategy_period_summary_ap_special SET is_deleted=1,update_time=NOW() WHERE ${monthFactsWhere}`, strategyIds)
    await conn.query(`UPDATE t_sr_strategy_reject_reason_special SET is_deleted=1,update_time=NOW() WHERE city_id='999' AND county_id='999' AND stat_month='2026-10-01' AND strategy_id IN (${idClause}) AND is_deleted=0`, strategyIds)
    await conn.query(`UPDATE t_sr_strategy_daily_ap_special SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999' AND stat_month BETWEEN '2026-10-01' AND '2026-10-31' AND strategy_id IN (${idClause}) AND is_deleted=0`, strategyIds)
    await conn.query("UPDATE t_sr_kpi_summary_special SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999' AND stat_month='2026-10' AND is_deleted=0")
    await conn.query("UPDATE t_sr_channel_summary_ap_special SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999' AND stat_month='2026-10-01' AND is_deleted=0")
    await insertRows(conn, 't_sr_strategy_period_summary_ap_special', facts.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })))
    await insertRows(conn, 't_sr_strategy_reject_reason_special', reasons.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })))
    await insertRows(conn, 't_sr_strategy_daily_ap_special', dailyFacts.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })))
    await insertRows(conn, 't_sr_kpi_summary_special', kpis.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })))
    await insertRows(conn, 't_sr_channel_summary_ap_special', summaries.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })))
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    throw error
  }

  const [verification] = await conn.query(`
    SELECT 'period' AS kind,COUNT(*) AS row_count,COUNT(DISTINCT strategy_id) AS strategy_count,
           COUNT(DISTINCT channel) AS channel_count,COUNT(DISTINCT county_id) AS county_count
    FROM t_sr_strategy_period_summary_ap_special
    WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999'
      AND stat_month='2026-10-01' AND is_deleted=0
    UNION ALL
    SELECT 'channel',COUNT(*),COUNT(DISTINCT channel),COUNT(DISTINCT channel),COUNT(DISTINCT county_id)
    FROM t_sr_channel_summary_ap_special
    WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999'
      AND stat_month='2026-10-01' AND is_deleted=0
    UNION ALL
    SELECT 'kpi',COUNT(*),COUNT(DISTINCT metric_code),COUNT(DISTINCT metric_code),COUNT(DISTINCT county_id)
    FROM t_sr_kpi_summary_special
    WHERE tab_type='active' AND strategy_class='降拆' AND city_id='999' AND county_id='999'
      AND stat_month='2026-10' AND is_deleted=0
  `)
  const [channelRows] = await conn.query(
    `SELECT c.channel,COALESCE(d.key_name,c.channel) AS channel_name,c.strategy_count,c.push_count,c.reach_count,c.product_conv_num,c.product_conv_rate,c.county_id
     FROM t_sr_channel_summary_ap_special c LEFT JOIN t_sr_dim_channel d ON d.key_code=c.channel
     WHERE c.tab_type='active' AND c.strategy_class='降拆' AND c.city_id='999' AND c.county_id='999'
       AND c.stat_month='2026-10-01' AND c.is_deleted=0 ORDER BY c.channel`,
  )
  const [rejectVerification] = await conn.query(
    `SELECT COUNT(*) AS row_count, COUNT(DISTINCT strategy_id) AS strategy_count, COUNT(DISTINCT reason_code) AS reason_count
     FROM t_sr_strategy_reject_reason_special WHERE stat_month='2026-10-01' AND city_id='999' AND county_id='999'
       AND strategy_id IN (${idClause}) AND is_deleted=0`, strategyIds,
  )
  const [dailyVerification] = await conn.query(
    `SELECT COUNT(*) AS row_count, COUNT(DISTINCT strategy_id) AS strategy_count,
            COUNT(DISTINCT channel) AS channel_count, COUNT(DISTINCT stat_month) AS date_count
     FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND strategy_class='降拆'
       AND city_id='999' AND county_id='999' AND stat_month BETWEEN '2026-10-01' AND ?
       AND strategy_id IN (${idClause}) AND is_deleted=0`, [DAILY_CUTOFF, ...strategyIds],
  )
  const [dailyTotals] = await conn.query(
    `SELECT strategy_id, SUM(push_count) AS push_count, SUM(usage_count) AS usage_count,
            SUM(reach_count) AS reach_count, SUM(product_conv_num) AS product_conv_num
     FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND strategy_class='降拆'
       AND city_id='999' AND county_id='999' AND stat_month BETWEEN '2026-10-01' AND ?
       AND strategy_id IN (${idClause}) AND is_deleted=0 GROUP BY strategy_id`, [DAILY_CUTOFF, ...strategyIds],
  )
  const [rawVerification] = await conn.query(
    'SELECT sheet_name,COUNT(*) AS row_count,SUM(JSON_LENGTH(formula_cells_json)) AS formula_count FROM t_sr_excel_source_row_raw WHERE source_sha256=? GROUP BY sheet_name ORDER BY sheet_name',
    [sourceSha],
  )
  const [blobVerification] = await conn.query('SELECT sha256,byte_length,content FROM bqq_source_snapshot_file WHERE file_name=?', [fileNameBytes])
  const blobHash = blobVerification.length ? crypto.createHash('sha256').update(blobVerification[0].content).digest('hex') : null
  if (blobHash !== sourceSha || Number(blobVerification[0].byte_length) !== sourceBytes.length) fail('Stored workbook checksum verification failed')
  verification.push(
    { kind: 'reject', ...rejectVerification[0] },
    { kind: 'daily', ...dailyVerification[0] },
  )
  const periodCheck = verification.find((row) => row.kind === 'period')
  const channelCheck = verification.find((row) => row.kind === 'channel')
  const kpiCheck = verification.find((row) => row.kind === 'kpi')
  const rejectCheck = verification.find((row) => row.kind === 'reject')
  const dailyCheck = verification.find((row) => row.kind === 'daily')
  const dailyTotalsById = new Map(dailyTotals.map((row) => [row.strategy_id, row]))
  for (const fact of facts) {
    const daily = dailyTotalsById.get(fact.strategy_id)
    if (!daily) fail(`Daily total missing for ${fact.strategy_id}`)
    for (const field of ['push_count', 'usage_count', 'reach_count', 'product_conv_num']) {
      const expected = fact[field] === null ? null : Number(fact[field])
      const actual = daily[field] === null ? null : Number(daily[field])
      if (actual !== expected) fail(`Daily ${field} does not match monthly value for ${fact.strategy_id}: ${actual} vs ${expected}`)
    }
  }
  if (Number(periodCheck.row_count) !== 235 || Number(periodCheck.strategy_count) !== 235 || Number(periodCheck.channel_count) !== 5 || Number(channelCheck.row_count) !== 5 || Number(kpiCheck.row_count) !== 15 ||
      Number(rejectCheck.row_count) !== reasons.length || Number(rejectCheck.strategy_count) !== 235 || Number(rejectCheck.reason_count) !== 5 ||
      Number(dailyCheck.row_count) !== dailyFacts.length || Number(dailyCheck.strategy_count) !== 235 || Number(dailyCheck.channel_count) !== 5 || Number(dailyCheck.date_count) !== dailyDays) {
    fail(`October row-count verification failed: ${JSON.stringify(verification)}`)
  }
  const overall = channelRows.find((row) => row.channel === channelMap.get('整体'))
  if (!overall || overall.channel_name !== '整体' || Number(overall.strategy_count) !== 47) fail('The live API channel filter for 整体 did not match the imported summary')
  output.dryRun = false
  output.verification = verification
  output.channelSummaries = channelRows
  output.rawRowVerification = rawVerification
  output.exactWorkbookSha256InDatabase = blobHash
  output.formulaCells = formulaCount
  output.appliedAt = new Date().toISOString()
  output.resultPath = outFile
  fs.writeFileSync(outFile, jsonSafe(output), 'utf8')
  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
