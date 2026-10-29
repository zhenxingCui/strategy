// Import the review workbooks in D:\工作数据\新建文件夹 into the local strategy review DB.
// Safe by default: without --apply it extracts, maps, and previews rows only.
// Usage: node front/scripts/import-review-folder-local.cjs [folder-or-xlsx] [--file=<xlsx> ...] [--apply] [--only-upgrade --match-strategy-name]
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const SOURCE_DIR = path.resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) || 'D:\\工作数据\\新建文件夹')
const APPLY = process.argv.includes('--apply')
const SOURCE_ONLY = process.argv.includes('--source-only')
const ONLY_DECLINE = process.argv.includes('--only-decline')
const REPLACE_DECLINE = process.argv.includes('--replace-decline')
const ONLY_LEAVE = process.argv.includes('--only-leave')
const REPLACE_LEAVE = process.argv.includes('--replace-leave')
const ONLY_KEY_AUDIENCE = process.argv.includes('--only-key-audience')
const REPLACE_KEY_AUDIENCE = process.argv.includes('--replace-key-audience')
const ONLY_UPGRADE = process.argv.includes('--only-upgrade')
const MATCH_STRATEGY_NAME = process.argv.includes('--match-strategy-name')
const ONLY_STABLE = process.argv.includes('--only-stable')
const ONLY_CLASS = ONLY_UPGRADE ? '升接' : ONLY_STABLE ? '稳' : ONLY_KEY_AUDIENCE ? '重点客群' : ONLY_LEAVE ? '离' : ONLY_DECLINE ? '降拆' : null
const REPLACE_CLASS = REPLACE_KEY_AUDIENCE ? '重点客群' : REPLACE_LEAVE ? '离' : REPLACE_DECLINE ? '降拆' : null
const DATABASE = 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const CITY_ID = '999'
const SOURCE_YEAR = '2026'
const SOURCE_MONTH = '2026-10'
const MONTH_START = `${SOURCE_MONTH}-01`
const NEXT_MONTH = '2026-11-01'
const MONTH_END = '2026-10-31'
const BASELINE_MONTH = '2025-12'
const LEAVE_HISTORY_MOM_MIN = 0.97
const LEAVE_HISTORY_MOM_MAX = 1.03
const LEAVE_HISTORY_CONTROL_FIELDS = ['push_count', 'usage_count', 'reach_count', 'product_conv_num']
const HISTORY_MONTHS = Array.from({ length: 10 }, (_, i) => {
  const date = new Date(Date.UTC(2025, 11 + i, 1))
  return date.toISOString().slice(0, 7)
})
const DECLINE_CONSULT_FACTORS = [1.04, 1.0535, 1.033, 1.05366, 1.045, 1.05, 1.04, 1.05, 1.04, 1.051]
const DECLINE_CHANNEL_CONSULT_FACTORS = [1, 1.008, 0.988848, 1.008625, 1, 1.005, 0.995, 1.005, 1, 1.005]
const DECLINE_ORDER_FACTORS = [1, 1.005, 0.99, 1.00485, 1.01, 1.005, 1.01, 1.002, 1.009, 1.01]
const DECLINE_SUCCESS_FACTORS = [1, 1.005, 0.99, 1.00485, 1.01, 1.005, 1.01, 1.002, 1.009, 1.01]
const DECLINE_ONLINE_DISPATCH_RATES = [22, 22.5, 21, 22.4, 23, 21.8, 22.9, 21.6, 22.2, 21.8]
const COUNT_FIELDS = ['original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'reject_count']
const AMOUNT_FIELDS = ['expected_income', 'actual_income']
const ADDITIVE_FIELDS = [...COUNT_FIELDS, ...AMOUNT_FIELDS]
const METRIC_LABELS = {
  strategy_count: '策略数', original_cust: '原始客群', push_count: '推送量', usage_count: '使用量',
  usage_rate: '使用率', reach_count: '触达量', reach_rate: '触达率', target_conv_num: '目标转化量',
  target_conv_rate: '目标转化率', product_conv_num: '全产品转化量', product_conv_rate: '全产品转化率',
  expected_income: '预期收入', actual_income: '收入', reject_count: '拒绝量', reject_rate: '拒绝率',
}
const RATE_FIELDS = new Set(['usage_rate', 'reach_rate', 'target_conv_rate', 'product_conv_rate', 'reject_rate'])
const COLORS = ['#3b82f6', '#5ac4d1', '#a78bfa', '#f6bd60', '#94a3b8']
const KEY_AUDIENCE_SOURCE_FILES = [
  '异网分流和低价套餐-策略模版.xlsx', '拆弹客户-策略模版.xlsx', '超套客户-策略模版.xlsx',
  '老旧资费客户-策略模版.xlsx', '零低流量客户-策略模版.xlsx',
]

function fail(message) { throw new Error(message) }
function assert(condition, message) { if (!condition) fail(message) }
function isLoopback(host) { return ['127.0.0.1', 'localhost', '::1'].includes(host) }
function round2(value) { return value == null ? null : Math.round((Number(value) + Number.EPSILON) * 100) / 100 }
function pct(numerator, denominator) {
  if (numerator == null || denominator == null || Number(denominator) === 0) return null
  return round2(Number(numerator) * 100 / Number(denominator))
}
function normalizeText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return !text || text === '不填' ? null : text
}
function asNumber(value, label) {
  if (value === null || value === undefined || value === '' || value === '不填') return null
  if (typeof value === 'string' && value.trim().startsWith('=')) return null
  const number = typeof value === 'number' ? value : Number(String(value).replaceAll(',', '').trim())
  if (!Number.isFinite(number)) fail(`无法识别数值 ${label}: ${value}`)
  return number
}
function asDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const serial = typeof value === 'number' ? value : /^\d{5}(?:\.\d+)?$/.test(String(value ?? '').trim()) ? Number(value) : null
  if (serial != null && serial >= 20000 && serial <= 70000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
    return { month: date.toISOString().slice(0, 7), cutoff: null }
  }
  const text = String(value ?? '').trim()
  const chinese = text.match(/(\d{4})年(\d{1,2})月(?:截至(\d{1,2})日)?/)
  if (chinese) return { month: `${chinese[1]}-${String(chinese[2]).padStart(2, '0')}`, cutoff: chinese[3] ? Number(chinese[3]) : null }
  const iso = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return { month: `${iso[1]}-${String(iso[2]).padStart(2, '0')}`, cutoff: null }
  fail(`无法识别账期：${text}`)
}
function asSqlDate(value, label) {
  const text = normalizeText(value)
  if (!text) return null
  if (typeof value === 'number' && value >= 20000 && value <= 70000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10)
  }
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    || text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) fail(`${label} 不是可识别日期：${text}`)
  return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
}
function monthStart(month) { return `${month}-01` }
function previousMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7)
}
function dayCount(month) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).getUTCDate()
}
function fnvNoise(key, lower = 0, upper = 1) {
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
  return lower + (upper - lower) * (hash / 4294967295)
}
function largestRemainder(total, weights) {
  if (total == null) return weights.map(() => null)
  const rounded = Math.round(Number(total))
  assert(Number.isSafeInteger(rounded) && rounded >= 0, `Invalid count to split: ${total}`)
  const sum = weights.reduce((acc, value) => acc + Number(value), 0)
  assert(sum > 0 && Number.isFinite(sum), '日拆分权重合计必须为正数')
  const exact = weights.map((weight) => rounded * Number(weight) / sum)
  const result = exact.map(Math.floor)
  let remaining = rounded - result.reduce((acc, value) => acc + value, 0)
  const order = exact.map((value, index) => ({ index, remainder: value - result[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (let index = 0; index < remaining; index++) result[order[index].index] += 1
  return result
}
function largestRemainderBounded(total, weights, caps) {
  if (total == null) return weights.map(() => null)
  const rounded = Math.round(Number(total))
  assert(Number.isSafeInteger(rounded) && rounded >= 0, `Invalid bounded count: ${total}`)
  assert(rounded <= caps.reduce((sum, cap) => sum + cap, 0), '月度子指标超过可用日上限，无法在不改月合计的情况下分摊')
  const result = Array(caps.length).fill(0)
  let remaining = rounded
  const openCaps = caps.slice()
  while (remaining > 0) {
    const open = openCaps.map((cap, index) => ({ cap, index })).filter((item) => item.cap > 0)
    assert(open.length > 0, '日拆分上限不足')
    const weightTotal = open.reduce((sum, item) => sum + Math.max(0, Number(weights[item.index]) || 0), 0)
    const denom = weightTotal || open.reduce((sum, item) => sum + item.cap, 0)
    const exact = open.map((item) => ({
      index: item.index,
      value: remaining * (weightTotal ? Math.max(0, Number(weights[item.index]) || 0) : item.cap) / denom,
    }))
    const saturated = exact.filter((item) => item.value >= openCaps[item.index] - 1e-10)
    if (saturated.length) {
      for (const item of saturated) {
        result[item.index] += openCaps[item.index]
        remaining -= openCaps[item.index]
        openCaps[item.index] = 0
      }
      continue
    }
    let assigned = 0
    for (const item of exact) {
      const amount = Math.min(openCaps[item.index], Math.floor(item.value))
      result[item.index] += amount
      openCaps[item.index] -= amount
      assigned += amount
    }
    remaining -= assigned
    const order = exact.map((item) => ({ index: item.index, remainder: item.value - Math.floor(item.value) }))
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    for (const item of order) {
      if (!remaining) break
      if (openCaps[item.index] > 0) {
        result[item.index] += 1
        openCaps[item.index] -= 1
        remaining -= 1
      }
    }
  }
  return result
}
function largestRemainderWithMinimum(total, weights, minimum) {
  if (total == null) return weights.map(() => null)
  const rounded = Math.round(Number(total))
  assert(rounded >= weights.length * minimum, `日拆分总量不足以保证每天至少 ${minimum}`)
  return largestRemainder(rounded - weights.length * minimum, weights).map((value) => value + minimum)
}
function boundedRelativeSplit(total, weights, days, relativeRange) {
  if (total == null) return weights.map(() => null)
  const rounded = Math.round(Number(total))
  assert(Number.isSafeInteger(rounded) && rounded >= 0, `Invalid bounded daily total: ${total}`)
  const average = rounded / days
  const minimum = Math.ceil(average * (1 - relativeRange) - 1e-9)
  const maximum = Math.floor(average * (1 + relativeRange) + 1e-9)
  assert(minimum * days <= rounded && maximum * days >= rounded,
    `日推送量整数精度无法同时满足合计和 ±${relativeRange * 100}%：总量${rounded}，日均${average}`)
  const remaining = rounded - minimum * days
  const extras = largestRemainderBounded(remaining, weights, Array(days).fill(maximum - minimum))
  return extras.map((value) => value + minimum)
}
function keyAudienceDailyWeights(days) {
  const raw = Array.from({ length: days }, (_, index) =>
    1 + 0.045 * Math.sin((index + 1) * Math.PI * 2 / 7) + 0.02 * Math.sin((index + 1) * Math.PI * 2 / 5))
  const mean = raw.reduce((sum, value) => sum + value, 0) / days
  return raw.map((value) => value / mean)
}
function keyAudienceDailyRateOffsets(days, dailyWeights) {
  const raw = Array.from({ length: days }, (_, index) =>
    Math.sin((index + 1) * Math.PI * 2 / 7) + 0.35 * Math.sin((index + 1) * Math.PI * 2 / 5))
  const weightTotal = dailyWeights.reduce((sum, value) => sum + value, 0)
  const weightedMean = raw.reduce((sum, value, index) => sum + value * dailyWeights[index], 0) / weightTotal
  const centered = raw.map((value) => value - weightedMean)
  const maximum = Math.max(...centered.map(Math.abs))
  assert(maximum > 0, '重点客群日转化率波动向量为空')
  return centered.map((value) => value / maximum * 1.75)
}
function conversionDailyWeights(dailyReach, monthlyNumerator, monthlyDenominator, offsets) {
  if (monthlyNumerator == null || monthlyDenominator == null || Number(monthlyDenominator) <= 0) {
    return dailyReach.map((value) => Math.max(0, Number(value) || 0))
  }
  const monthlyRate = Number(monthlyNumerator) * 100 / Number(monthlyDenominator)
  if (monthlyRate <= 0) return dailyReach.map((value) => Math.max(0, Number(value) || 0))
  return dailyReach.map((value, index) => Math.max(0, Number(value) || 0)
    * Math.max(0.001, (monthlyRate + offsets[index]) / monthlyRate))
}
function group(rows, keyFn) {
  const grouped = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }
  return grouped
}
function stableKey(parts) { return JSON.stringify(parts) }
function sourceConfig(workbook) {
  const name = workbook.sourceFile
  if (name === '1027升接.xlsx') return { strategyClass: '升接', customerGroup: null, suffix: '', cutoff: 24, mode: 'dailyWeights', displayName: '升接1027' }
  if (name.includes('稳-升接稳补充到厅策略-汇总')) return { strategyClass: '稳', customerGroup: null, suffix: '', cutoff: 0, mode: 'sourceDaily', displayName: '稳补充到厅' }
  if (name.includes('升接-补充到厅策略')) return { strategyClass: '升接', customerGroup: null, suffix: '', cutoff: 21, mode: 'volatile', displayName: '升接补充到厅' }
  if (/^离(?:\.|\(|$)/.test(name)) return { strategyClass: '离', customerGroup: null, suffix: '_special', cutoff: 21, mode: 'leave', displayName: '离' }
  if (name.includes('拆弹客户')) return { strategyClass: '重点客群', customerGroup: '拆弹客户', suffix: '_key_audience', cutoff: 23, mode: 'keyAudience', displayName: '重点客群-拆弹客户' }
  if (name.includes('异网分流和低价套餐')) return { strategyClass: '重点客群', customerGroup: '异网分流客户', expectedCustomerGroups: ['异网分流客户', '低价套餐客户'], suffix: '_key_audience', cutoff: 21, mode: 'keyAudience', displayName: '重点客群-异网分流和低价套餐' }
  if (name.includes('超套客户')) return { strategyClass: '重点客群', customerGroup: '超套客户', expectedCustomerGroups: ['超套客户'], suffix: '_key_audience', cutoff: 21, mode: 'keyAudience', displayName: '重点客群-超套客户' }
  if (name.includes('老旧资费客户')) return { strategyClass: '重点客群', customerGroup: '老旧资费客户', suffix: '_key_audience', cutoff: 21, mode: 'keyAudience', displayName: '重点客群-老旧资费客户' }
  if (name.includes('零低流量客户')) return { strategyClass: '重点客群', customerGroup: '零低流量客户', suffix: '_key_audience', cutoff: 21, mode: 'keyAudience', displayName: '重点客群-零低流量客户' }
  if (/^降拆(?:[ .（(-]|$)/.test(name)) return { strategyClass: '降拆', customerGroup: null, suffix: '_special', cutoff: 21, mode: 'sourceWeights', displayName: '降拆' }
  return null
}
function tableNames(suffix) {
  return {
    master: `t_sr_strategy${suffix}`,
    period: `t_sr_strategy_period_summary_ap${suffix}`,
    daily: `t_sr_strategy_daily_ap${suffix}`,
    business: `t_sr_strategy_biz_capacity${suffix}`,
    reject: `t_sr_strategy_reject_reason${suffix}`,
    kpi: `t_sr_kpi_summary${suffix}`,
    channel: `t_sr_channel_summary_ap${suffix}`,
    channelCapacity: `t_sr_channel_monthly_capacity_ap${suffix}`,
    channelBusiness: `t_sr_channel_biz_capacity_ap${suffix}`,
  }
}
function suffixForClass(strategyClass) {
  if (strategyClass === '离' || strategyClass === '降拆') return '_special'
  if (strategyClass === '重点客群') return '_key_audience'
  return ''
}
function extractWorkbooks(directory) {
  const script = path.join(__dirname, 'extract-review-folder.py')
  const python = process.env.PYTHON || 'D:\\software\\conda\\python.exe'
  const explicitFiles = process.argv.filter((argument) => argument.startsWith('--file=')).map((argument) => path.resolve(argument.slice('--file='.length)))
  if (explicitFiles.length) {
    assert(new Set(explicitFiles).size === explicitFiles.length, '显式来源文件路径重复')
    const workbooks = []
    for (const file of explicitFiles) {
      const result = spawnSync(python, [script, file], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 48 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      })
      if (result.status !== 0) fail(`Excel 提取失败：${(result.stderr || result.stdout || '').trim()}`)
      workbooks.push(...JSON.parse(result.stdout).workbooks)
    }
    return { sourceDirectory: directory, workbooks }
  }
  const result = spawnSync(python, [script, directory], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 48 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  if (result.status !== 0) fail(`Excel 提取失败：${(result.stderr || result.stdout || '').trim()}`)
  return JSON.parse(result.stdout)
}
function pctRow(row) {
  row.usage_rate = pct(row.usage_count, row.push_count)
  if (row.strategy_class === '降拆') {
    row.reach_rate = pct(row.reach_count, row.push_count)
    row.target_conv_rate = pct(row.target_conv_num, row.push_count)
    row.product_conv_rate = pct(row.product_conv_num, row.push_count)
  } else {
    row.reach_rate = pct(row.reach_count, row.usage_count)
    row.target_conv_rate = pct(row.target_conv_num, row.reach_count)
    row.product_conv_rate = pct(row.product_conv_num, row.reach_count)
  }
  row.reject_rate = pct(row.reject_count, row.push_count)
  return row
}
function roundCountsLargestRemainder(rows, fields) {
  for (const field of fields) {
    const indices = rows.map((row, index) => row[field] == null ? null : index).filter((value) => value != null)
    if (!indices.length) continue
    const values = indices.map((index) => Number(rows[index][field]))
    const floors = values.map(Math.floor)
    let remaining = Math.round(values.reduce((sum, value) => sum + value, 0)) - floors.reduce((sum, value) => sum + value, 0)
    const order = values.map((value, index) => ({ index, remainder: value - floors[index] }))
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    for (let index = 0; index < remaining; index++) floors[order[index].index] += 1
    indices.forEach((rowIndex, index) => { rows[rowIndex][field] = floors[index] })
  }
}
function dayWeights(mode, id, field, days, sourceWeights) {
  if (mode === 'sourceWeights' && sourceWeights && sourceWeights[field]) return sourceWeights[field]
  const dates = Array.from({ length: days }, (_, index) => new Date(Date.UTC(2026, 9, index + 1)))
  if (mode === 'weekday') return dates.map((date) => {
    const dow = date.getUTCDay()
    return (dow === 0 || dow === 6) ? 0.65 : 1
  })
  if (mode === 'leave') return dates.map((date, index) => {
    const dow = date.getUTCDay()
    return (dow === 0 || dow === 6 ? 0.78 : 1.08) * fnvNoise(`leave-daily-v1:${id}:${index + 1}`, 0.86, 1.14)
  })
  return dates.map((date, index) => {
    const dow = date.getUTCDay()
    const weekday = (dow === 0 || dow === 6) ? 0.68 : 1
    return weekday * fnvNoise(`review-wave-v1:${id}:${field}:${index + 1}`, 0.8, 1.2)
  })
}
function declineSourceWeights(workbook, days) {
  const sheetRows = workbook.rawRows.filter((row) => row.sheetName === '分日数据')
  const labels = { push_count: '咨询量占比', usage_count: '接触量占比', reach_count: '成功量占比', target_conv_num: '派单量占比', product_conv_num: '派单量占比' }
  const selected = {}
  for (const [field, label] of Object.entries(labels)) {
    const row = sheetRows.find((item) => item.values[1] === label)
    assert(row, `降拆工作簿分日页缺少 ${label}`)
    const all = row.values.slice(2, 32).map(Number)
    assert(all.length === 30 && all.every((weight) => Number.isFinite(weight) && weight >= 0), `${label} 权重无效`)
    const fullTotal = all.reduce((sum, weight) => sum + weight, 0)
    assert(Math.abs(fullTotal - 1) <= 0.001, `${label} 全月权重合计为 ${fullTotal}`)
    const partial = all.slice(0, days)
    const partialTotal = partial.reduce((sum, weight) => sum + weight, 0)
    assert(partialTotal > 0, `${label} 截至日权重为空`)
    selected[field] = partial.map((weight) => weight / partialTotal)
  }
  return selected
}
function leaveSourceWeights(workbook, days) {
  const sheetRows = workbook.rawRows.filter((row) => row.sheetName === '分日展示')
  const groupStarts = sheetRows.filter((row) => /^(反向|查码|停机).+每日拆分比例$/.test(String(row.values[0] || '')))
  const labels = { push_count: '推送量', usage_count: '使用量', reach_count: '触达量', target_conv_num: '目标转化量' }
  const categoryAliases = [['反向', '反向'], ['查码', '查码'], ['停机回捞', '停机']]
  const byCategory = {}
  for (const [category, alias] of categoryAliases) {
    if (!workbook.execution.some((row) => String(row.big_category || '').includes(category))) continue
    const start = groupStarts.find((row) => String(row.values[0]).startsWith(alias))
    assert(start, `离工作簿分日页缺少 ${category} 权重组`)
    const startIndex = sheetRows.indexOf(start)
    const nextStart = groupStarts.map((row) => sheetRows.indexOf(row)).filter((index) => index > startIndex).sort((a, b) => a - b)[0] ?? sheetRows.length
    const groupRows = sheetRows.slice(startIndex, nextStart)
    const weights = {}
    for (const [field, label] of Object.entries(labels)) {
      const row = groupRows.find((item) => item.values[1] === label)
      assert(row, `离工作簿 ${category} 分日页缺少 ${label}`)
      const raw = row.values.slice(2, 2 + days)
      assert(raw.length === days && raw.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0),
        `离工作簿 ${category}/${label} 的 ${days} 日权重无效`)
      const total = raw.reduce((sum, value) => sum + value, 0)
      assert(total > 0 && Math.abs(total - 1) <= 0.001, `离工作簿 ${category}/${label} 权重合计为 ${total}`)
      weights[field] = raw.map((value) => value / total)
    }
    weights.product_conv_num = weights.target_conv_num.slice()
    const matchedCategories = [...new Set(workbook.execution.map((row) => String(row.big_category || '')).filter((value) => value.includes(category)))]
    matchedCategories.forEach((value) => { byCategory[value] = weights })
  }
  const missing = [...new Set(workbook.execution.map((row) => String(row.big_category || '')))].filter((category) => !byCategory[category])
  assert(!missing.length, `离工作簿分日权重无法对应业务类别：${missing.join('、')}`)
  return { byCategory }
}
function sourceDate(workbook, config) {
  const dates = workbook.execution.map((row) => asDate(row.stat_date))
  const months = [...new Set(dates.map((value) => typeof value === 'string' ? value.slice(0, 7) : value.month))]
  assert(months.length === 1 && months[0] === SOURCE_MONTH, `${workbook.sourceFile} 来源月份不是 ${SOURCE_MONTH}: ${months.join(',')}`)
  const explicit = dates.map((value) => typeof value === 'string' ? null : value.cutoff).filter(Boolean)
  if (explicit.length && Math.max(...explicit) < dayCount(SOURCE_MONTH)) config.explicitCutoff = Math.max(...explicit)
  return SOURCE_MONTH
}
function mapDataset(workbook, config, dictionaries, existingStrategies = []) {
  const tables = tableNames(config.suffix)
  const archive = new Map()
  const sourceToCanonical = new Map()
  const sourceNameMappings = []
  const existingByName = new Map()
  const existingByCode = new Map()
  if (MATCH_STRATEGY_NAME) {
    for (const row of existingStrategies) {
      const name = normalizeText(row.strategy_name)
      if (!name) continue
      if (!existingByName.has(name)) existingByName.set(name, [])
      existingByName.get(name).push(row)
      if (!existingByCode.has(row.strategy_code)) existingByCode.set(row.strategy_code, [])
      existingByCode.get(row.strategy_code).push(row)
    }
    const duplicateNames = [...existingByName].filter(([, rows]) => rows.length > 1)
    assert(!duplicateNames.length, `数据库升接策略名不唯一：${JSON.stringify(duplicateNames.map(([name, rows]) => ({ name, codes: rows.map((row) => row.strategy_code) })))}`)
  }
  const sourceNames = new Set()
  for (const source of workbook.strategies) {
    const code = normalizeText(source.strategy_code)
    assert(code, `${workbook.sourceFile} 第${source._source_row}行缺少 strategy_code`)
    assert(!archive.has(code), `${workbook.sourceFile} 策略档案重复编码 ${code}`)
    const name = normalizeText(source.strategy_name ?? source['strategy-name'])
    if (MATCH_STRATEGY_NAME) {
      assert(name, `${workbook.sourceFile} 第${source._source_row}行缺少 strategy_name`)
      assert(!sourceNames.has(name), `${workbook.sourceFile} 策略名重复：${name}`)
      sourceNames.add(name)
    }
    const sourceClass = normalizeText(source.strategy_class)
    if (config.strategyClass === '升接') assert(['升', '接', '升接'].includes(sourceClass), `升接文件分类值不匹配：${sourceClass}`)
    else assert(sourceClass === config.strategyClass, `${workbook.sourceFile} 分类 ${sourceClass} 与文件映射 ${config.strategyClass} 不一致`)
    archive.set(code, source)
    let canonicalCode = code
    if (MATCH_STRATEGY_NAME) {
      const nameMatches = existingByName.get(name) || []
      assert(nameMatches.length <= 1, `策略名 ${name} 在数据库升接档案中不唯一`)
      const codeMatches = existingByCode.get(code) || []
      assert(!codeMatches.length || codeMatches.some((row) => row.strategy_name === name) || nameMatches.length === 1,
        `策略编码 ${code} 已对应不同策略名，无法按名称安全更新：${codeMatches.map((row) => row.strategy_name).join('、')}`)
      canonicalCode = nameMatches[0]?.strategy_code || code
      sourceNameMappings.push({ sourceCode: code, strategyName: name, strategyCode: canonicalCode,
        matchedBy: nameMatches.length ? 'strategy_name' : 'new_strategy_name' })
    }
    assert(![...sourceToCanonical.values()].includes(canonicalCode), `${workbook.sourceFile} 多个源策略名映射到同一策略编码 ${canonicalCode}`)
    sourceToCanonical.set(code, canonicalCode)
  }
  assert(archive.size > 0, `${workbook.sourceFile} 没有策略档案记录`)

  const masterRows = [...archive.values()].map((source) => ({
    strategy_code: sourceToCanonical.get(String(source.strategy_code)) || String(source.strategy_code),
    strategy_name: normalizeText(source.strategy_name ?? source['strategy-name']), tab_type: 'active', strategy_class: config.strategyClass,
    customer_group: normalizeText(source.customer_group) || config.customerGroup,
    channel: dictionaries.channelCode(normalizeText(source.channel)),
    strategy_level: normalizeText(source.strategy_level), caliber: normalizeText(source.caliber),
    iteration: asNumber(source.iteration, `iteration/${source.strategy_code}`), status: normalizeText(source.status),
    owner: normalizeText(source.owner), city_id: CITY_ID, county_id: null,
    start_date: asSqlDate(source.start_date, `start_date/${source.strategy_code}`),
    end_date: asSqlDate(source.end_date, `end_date/${source.strategy_code}`), is_deleted: 0,
  }))
  if (MATCH_STRATEGY_NAME) {
    const usedSourceCodes = new Set([...workbook.execution, ...workbook.details].map((row) => normalizeText(row.strategy_code)).filter(Boolean))
    for (const sourceCode of usedSourceCodes) {
      if (sourceToCanonical.has(sourceCode)) continue
      const codeMatches = existingByCode.get(sourceCode) || []
      assert(codeMatches.length === 1,
        `${workbook.sourceFile} 执行/明细策略编码 ${sourceCode} 不在策略档案中，且无法唯一关联到现有策略名`)
      const existing = codeMatches[0]
      const name = normalizeText(existing.strategy_name)
      const nameMatches = existingByName.get(name) || []
      assert(nameMatches.length === 1 && nameMatches[0].strategy_code === sourceCode,
        `工作簿外策略 ${sourceCode} 无法通过唯一策略名关联现有档案`)
      sourceToCanonical.set(sourceCode, nameMatches[0].strategy_code)
      if (!masterRows.some((row) => row.strategy_code === sourceCode)) {
        const preserved = Object.fromEntries(Object.entries(existing).filter(([key]) => !['id', 'create_time', 'update_time'].includes(key)))
        masterRows.push({ ...preserved, tab_type: 'active', strategy_class: config.strategyClass,
          city_id: CITY_ID, county_id: null, is_deleted: 0 })
      }
      sourceNameMappings.push({ sourceCode, strategyName: name, strategyCode: sourceCode, matchedBy: 'existing_name_bridge' })
    }
  }
  const customerGroups = [...new Set(masterRows.map((row) => row.customer_group).filter(Boolean))].sort()
  if (config.expectedCustomerGroups) {
    assert(JSON.stringify(customerGroups) === JSON.stringify([...config.expectedCustomerGroups].sort()),
      `${workbook.sourceFile} 客群分类不匹配：${customerGroups.join('、')}`)
  }
  const masterById = new Map(masterRows.map((row) => [row.strategy_code, row]))
  const monthlySources = workbook.execution.filter((source) => String(source.period_type || '').trim() === '月')
  const dailySources = workbook.execution.filter((source) => String(source.period_type || '').trim() === '日')
  assert(monthlySources.length > 0, `${workbook.sourceFile} 没有月度口径行`)
  assert(workbook.execution.every((source) => ['月', '日'].includes(String(source.period_type || '').trim())),
    `${workbook.sourceFile} 存在无法识别的数据周期`)
  if (['sourceDaily', 'dailyWeights'].includes(config.mode)) assert(dailySources.length > 0, `${workbook.sourceFile} 缺少来源日数据`)
  else assert(dailySources.length === 0, `${workbook.sourceFile} 含日数据，但当前来源映射未声明读取日数据`)
  const mapExecution = (source, isDaily = false) => {
    const sourceCode = normalizeText(source.strategy_code)
    const code = sourceToCanonical.get(sourceCode) || sourceCode
    assert(masterById.has(code), `${workbook.sourceFile} 执行数据引用了档案外策略 ${code}`)
    const sourceChannel = normalizeText(source.channel)
    const sourceDateValue = isDaily ? asSqlDate(source.stat_date, `${sourceCode}/stat_date`) : null
    if (isDaily) assert(sourceDateValue.startsWith(`${SOURCE_MONTH}-`), `${code} 日数据日期不在来源月：${sourceDateValue}`)
    const targetConversion = asNumber(source.target_conv_num, `${code}/target_conv_num`)
    const common = {
      tab_type: 'active', strategy_class: config.strategyClass,
      strategy_id: code, strategy_code: code, strategy_name: masterById.get(code).strategy_name,
      channel: dictionaries.channelCode(sourceChannel), big_category: normalizeText(source.big_category),
      small_category: normalizeText(source.small_category), stat_month: isDaily ? sourceDateValue : MONTH_START,
      strategy_count: 1, city_id: CITY_ID, county_id: null, is_deleted: 0,
    }
    let metrics
    if (config.strategyClass === '降拆') {
      metrics = {
        original_cust: asNumber(source.original_cust, `${code}/original_cust`),
        push_count: asNumber(source.push_count, `${code}/咨询或接单量`),
        usage_count: asNumber(source.usage_count, `${code}/usage_count`),
        reach_count: asNumber(source.reach_count, `${code}/成功量`),
        target_conv_num: asNumber(source.target_conv_num, `${code}/派单量`),
        product_conv_num: asNumber(source.product_conv_num, `${code}/派单量副本`),
        expected_income: asNumber(source.expected_income, `${code}/expected_income`),
        actual_income: asNumber(source.actual_income, `${code}/actual_income`),
        reject_count: asNumber(source.reject_count, `${code}/reject_count`),
      }
      assert(metrics.target_conv_num === metrics.product_conv_num, `${code} V3 派单量 target_conv_num 与 product_conv_num 不一致`)
    } else {
      const actualIncome = asNumber(source.actual_income, `${code}/actual_income`)
      const product = asNumber(source.product_conv_num, `${code}/product_conv_num`)
      metrics = {
        original_cust: asNumber(source.original_cust, `${code}/original_cust`),
        push_count: asNumber(source.push_count, `${code}/push_count`),
        usage_count: asNumber(source.usage_count, `${code}/usage_count`),
        reach_count: asNumber(source.reach_count, `${code}/reach_count`),
        target_conv_num: targetConversion,
        product_conv_num: ['sourceDaily', 'dailyWeights'].includes(config.mode)
          ? targetConversion
          : product == null ? targetConversion : product,
        expected_income: asNumber(source.expected_income, `${code}/expected_income`) ?? actualIncome,
        actual_income: actualIncome,
        reject_count: asNumber(source.reject_count, `${code}/reject_count`),
      }
      // In this source folder product_conv_num is a formula/share helper, not an independent count.
      if ((source._formula_fields || []).includes('product_conv_num')) metrics.product_conv_num = metrics.target_conv_num
    }
    for (const field of COUNT_FIELDS) assert(metrics[field] == null || metrics[field] >= 0, `${code}/${field} 不能为负数`)
    if (config.mode === 'sourceDaily') {
      for (const field of COUNT_FIELDS) assert(metrics[field] == null || Number.isInteger(metrics[field]), `${code}/${field} 来源数量不是整数：${metrics[field]}`)
    }
    for (const field of AMOUNT_FIELDS) if (metrics[field] != null) metrics[field] = round2(metrics[field])
    const row = pctRow({ ...common, ...metrics, sourceRow: source._source_row, sourceChannel })
    if (isDaily) {
      row.stat_date = sourceDateValue
      delete row.strategy_count
    }
    return row
  }
  const executionRows = monthlySources.map((source) => mapExecution(source))
  const sourceDailyRows = dailySources.map((source) => mapExecution(source, true))
  const sourceMonthlyStrategyIds = new Set(executionRows.map((row) => row.strategy_id))
  const sourceMonthlyDerivedMetrics = []
  if (config.mode === 'dailyWeights') {
    const rawDailyByStrategy = group(sourceDailyRows, (row) => row.strategy_id)
    const sumSourceField = (rows, field) => {
      const values = rows.map((row) => row[field])
      if (!values.length || values.some((value) => value == null)) return null
      const numbers = values.map(Number)
      assert(numbers.every(Number.isFinite), `${field} 日权重含非数值`)
      return numbers.reduce((sum, value) => sum + value, 0)
    }
    for (const fact of executionRows) {
      const daily = rawDailyByStrategy.get(fact.strategy_id) || []
      assert(daily.length > 0, `${fact.strategy_id} 月事实缺少日权重`)
      assert(daily.every((row) => row.channel === fact.channel && row.big_category === fact.big_category
        && row.small_category === fact.small_category), `${fact.strategy_id} 月行和日权重筛选维度不一致`)
      for (const field of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'actual_income']) {
        if (fact[field] == null) {
          fact[field] = sumSourceField(daily, field)
          if (fact[field] != null) sourceMonthlyDerivedMetrics.push({ strategyId: fact.strategy_id, metric: field, method: 'sum_daily_rows' })
        }
      }
      if (fact.expected_income == null && fact.actual_income != null) fact.expected_income = fact.actual_income
      if (fact.product_conv_num == null && fact.target_conv_num != null) fact.product_conv_num = fact.target_conv_num
      for (const field of AMOUNT_FIELDS) if (fact[field] != null) fact[field] = round2(fact[field])
      pctRow(fact)
    }
    for (const [strategyId, daily] of rawDailyByStrategy) {
      if (sourceMonthlyStrategyIds.has(strategyId)) continue
      const first = daily[0]
      assert(daily.every((row) => row.channel === first.channel && row.big_category === first.big_category
        && row.small_category === first.small_category), `${strategyId} 日行筛选维度不一致`)
      const target = sumSourceField(daily, 'target_conv_num')
      const actualIncome = sumSourceField(daily, 'actual_income')
      const derived = {
        ...first, stat_month: MONTH_START, strategy_count: 1, original_cust: null,
        push_count: sumSourceField(daily, 'push_count'),
        usage_count: sumSourceField(daily, 'usage_count'),
        reach_count: sumSourceField(daily, 'reach_count'),
        target_conv_num: target, product_conv_num: target,
        expected_income: sumSourceField(daily, 'expected_income') ?? actualIncome,
        actual_income: actualIncome,
        reject_count: sumSourceField(daily, 'reject_count'),
      }
      delete derived.stat_date
      for (const field of COUNT_FIELDS) if (derived[field] != null) sourceMonthlyDerivedMetrics.push({ strategyId: derived.strategy_id, metric: field, method: 'sum_daily_rows' })
      for (const field of AMOUNT_FIELDS) if (derived[field] != null) {
        derived[field] = round2(derived[field])
        sourceMonthlyDerivedMetrics.push({ strategyId: derived.strategy_id, metric: field, method: 'sum_daily_rows' })
      }
      executionRows.push(pctRow(derived))
    }
  }
  assert(new Set(executionRows.map((row) => row.strategy_id)).size === executionRows.length,
    `${workbook.sourceFile} 策略月度行按名称映射后出现重复策略`)
  assert(executionRows.every((row) => masterById.has(row.strategy_id)), `${workbook.sourceFile} 月事实包含档案外策略`)
  if (config.mode !== 'dailyWeights') {
    assert(new Set(executionRows.map((row) => row.strategy_id)).size === archive.size || config.strategyClass === '降拆',
      `${workbook.sourceFile} 策略档案与执行行数量不一致`)
  }
  assert(executionRows.every((row) => row.stat_month === MONTH_START), `${workbook.sourceFile} 执行数据月份不一致`)
  if (config.mode !== 'sourceDaily') roundCountsLargestRemainder(executionRows, COUNT_FIELDS)
  for (const row of executionRows) pctRow(row)
  for (const row of sourceDailyRows) pctRow(row)
  let sourceDailyReconciliation = []
  let sourceDailyCutoff = null
  if (['sourceDaily', 'dailyWeights'].includes(config.mode)) {
    const dates = [...new Set(sourceDailyRows.map((row) => row.stat_date))].sort()
    assert(dates.length > 0 && dates[0] === `${SOURCE_MONTH}-01`, '来源日数据必须从来源月1日开始')
    sourceDailyCutoff = Number(dates.at(-1).slice(-2))
    assert(dates.length === sourceDailyCutoff && dates.every((date, index) => date === `${SOURCE_MONTH}-${String(index + 1).padStart(2, '0')}`),
      `来源日数据日期不连续：${dates[0]} 至 ${dates.at(-1)}`)
  }
  if (config.mode === 'sourceDaily') {
    const dailyByStrategy = group(sourceDailyRows, (row) => row.strategy_id)
    assert(dailyByStrategy.size === executionRows.length, '来源月行与来源日策略集合不一致')
    const monthlyByStrategy = new Map(executionRows.map((row) => [row.strategy_id, row]))
    for (const [strategyId, rows] of dailyByStrategy) {
      assert(rows.length === sourceDailyCutoff, `${strategyId} 日记录数 ${rows.length} 与截止日 ${sourceDailyCutoff} 不一致`)
      assert(new Set(rows.map((row) => row.stat_date)).size === sourceDailyCutoff, `${strategyId} 存在重复日记录`)
      const monthly = monthlyByStrategy.get(strategyId)
      assert(rows.every((row) => row.channel === monthly.channel && row.big_category === monthly.big_category
        && row.small_category === monthly.small_category), `${strategyId} 月行和日行筛选维度不一致`)
      const fields = [...COUNT_FIELDS, ...AMOUNT_FIELDS]
      for (const field of fields) {
        const values = rows.map((row) => row[field]).filter((value) => value != null)
        const dailyTotal = values.length ? round2(values.reduce((sum, value) => sum + Number(value), 0)) : null
        const monthlyValue = monthly[field] == null ? null : round2(monthly[field])
        if (dailyTotal != null && monthlyValue != null && Math.abs(dailyTotal - monthlyValue) > 0.01) {
          sourceDailyReconciliation.push({ strategyId, metric: field, monthlyValue, dailyTotal, difference: round2(dailyTotal - monthlyValue) })
        }
      }
    }
  }
  let sourceDailyWeightSummary = []
  if (config.mode === 'dailyWeights') {
    const monthlyByStrategy = new Map(executionRows.map((row) => [row.strategy_id, row]))
    const dailyByStrategy = group(sourceDailyRows, (row) => row.strategy_id)
    const dailyKeys = new Set()
    for (const row of sourceDailyRows) {
      const monthly = monthlyByStrategy.get(row.strategy_id)
      assert(monthly, `${row.strategy_id} 日权重没有可关联的月事实`)
      assert(row.stat_date <= `${SOURCE_MONTH}-${String(sourceDailyCutoff).padStart(2, '0')}`,
        `${row.strategy_id} 日权重超出来源截至日`)
      assert(row.channel === monthly.channel && row.big_category === monthly.big_category
        && row.small_category === monthly.small_category, `${row.strategy_id} 月行和日权重筛选维度不一致`)
      const key = stableKey([row.strategy_id, row.stat_date, row.channel, row.big_category, row.small_category])
      assert(!dailyKeys.has(key), `${row.strategy_id}/${row.stat_date} 存在重复日权重行`)
      dailyKeys.add(key)
      for (const field of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'actual_income']) {
        assert(row[field] == null || (Number.isFinite(Number(row[field])) && Number(row[field]) >= 0),
          `${row.strategy_id}/${row.stat_date}/${field} 日权重无效`)
      }
    }
    sourceDailyWeightSummary = [...dailyByStrategy].map(([strategyId, rows]) => ({
      strategyId, rows: rows.length,
      missingDays: sourceDailyCutoff - new Set(rows.map((row) => row.stat_date)).size,
    }))
  }
  const gridFaceRows = executionRows.filter((row) => row.sourceChannel === '网格-面客')
  assert(gridFaceRows.every((row) => row.usage_count == null && row.product_conv_num == null && row.target_conv_num == null),
    '降拆面客只映射接单量和成功量；接触量、派单量必须为空')

  const sourceDetails = workbook.details.filter((row) => normalizeText(row.item_name) && row.item_count != null)
  let details = sourceDetails.map((source) => {
    const sourceCode = normalizeText(source.strategy_code)
    const code = sourceToCanonical.get(sourceCode) || sourceCode
    assert(masterById.has(code) || (config.strategyClass === '降拆' && code.startsWith('jd_')), `${workbook.sourceFile} 明细引用了档案外策略 ${sourceCode}`)
    const type = normalizeText(source.detail_type)
    assert(type === '业务产能' || type === '拒绝原因', `${workbook.sourceFile} 第${source._source_row}行明细类型无法映射：${type}`)
    const name = normalizeText(source.item_name)
    const mapped = dictionaries.detailCode(name, type === '业务产能' ? 'businesses' : 'reasons', source.item_code, config.strategyClass)
    return {
      detail_type: type, strategy_id: code, source_strategy_id: sourceCode,
      code: mapped.code, name, count: asNumber(source.item_count, `${code}/${name}`), sourceRow: source._source_row,
      source_channel: normalizeText(source.channel),
    }
  })
  roundCountsLargestRemainder(details, ['count'])

  if (config.strategyClass === '降拆') {
    const byChannel = group(executionRows, (row) => row.sourceChannel)
    const overall = byChannel.get('整体') || []
    assert(overall.length === 47, `降拆工作簿应有47条整体策略，实际 ${overall.length}`)
    const variants = new Map()
    const orderedOverall = overall.slice().sort((left, right) => Number(left.strategy_id.match(/jd_(\d+)/)[1]) - Number(right.strategy_id.match(/jd_(\d+)/)[1]))
    for (const [channelName, rows] of byChannel.entries()) {
      assert(rows.length === overall.length, `降拆渠道 ${channelName} 策略数与整体不一致`)
      const ordered = rows.slice().sort((left, right) => Number(left.strategy_id.match(/jd_(\d+)/)[1]) - Number(right.strategy_id.match(/jd_(\d+)/)[1]))
      for (let index = 0; index < orderedOverall.length; index++) {
        const source = orderedOverall[index]
        const target = ordered[index]
        assert(source.big_category === target.big_category && source.small_category === target.small_category,
          `降拆渠道 ${channelName} 第${index + 1}条策略与整体分类顺序不一致`)
        if (!variants.has(source.strategy_id)) variants.set(source.strategy_id, [])
        variants.get(source.strategy_id).push(target.strategy_id)
      }
    }
    const reasons = details.filter((row) => row.detail_type === '拒绝原因')
    assert(reasons.every((row) => row.source_strategy_id && variants.has(row.source_strategy_id)), '降拆拒绝原因找不到渠道策略对应关系')
    for (const row of reasons) row.strategy_ids = variants.get(row.source_strategy_id)
    details = details.flatMap((row) => row.detail_type === '拒绝原因'
      ? row.strategy_ids.map((strategyId) => ({ ...row, strategy_id: strategyId }))
      : [row])
  }

  for (const rows of group(details.filter((row) => row.detail_type === '拒绝原因'), (row) => row.strategy_id).values()) {
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0)
    rows.forEach((row, index) => {
      row.reject_ratio = pct(row.count, total)
      row.sort_no = index + 1
      row.color = COLORS[index % COLORS.length]
    })
  }

  const parsedMonth = sourceDate(workbook, config)
  const cutoff = ['sourceDaily', 'dailyWeights'].includes(config.mode) ? sourceDailyCutoff
    : config.strategyClass === '降拆' || config.strategyClass === '升接' ? 21 : (config.explicitCutoff || config.cutoff)
  const sourceWeights = config.mode === 'sourceWeights' ? declineSourceWeights(workbook, cutoff)
    : config.mode === 'leave' ? leaveSourceWeights(workbook, cutoff) : null
  return {
    sourceFile: workbook.sourceFile, sourcePath: workbook.sourcePath, sourceSha256: workbook.sha256,
    byteLength: workbook.byteLength, sheetNames: workbook.sheetNames, strategyClass: config.strategyClass,
    customerGroup: config.customerGroup, customerGroups, suffix: config.suffix, tables, sourceMonth: parsedMonth,
    cutoff, cutoffDate: `${parsedMonth}-${String(cutoff).padStart(2, '0')}`, countyId: config.countyId ?? null,
    mode: config.mode, sourceWeights, sourceDailyRows, sourceDailyReconciliation, sourceDailyWeightSummary,
    sourceNameMappings, sourceArchiveRows: archive.size, sourceMonthlyRowCount: monthlySources.length,
    sourceMonthlyStrategyIds: [...sourceMonthlyStrategyIds], sourceMonthlyDerivedMetrics,
    masters: masterRows, facts: executionRows,
    sourceRejectRows: sourceDetails.filter((row) => normalizeText(row.detail_type) === '拒绝原因').length,
    businesses: details.filter((row) => row.detail_type === '业务产能'),
    reasons: details.filter((row) => row.detail_type === '拒绝原因'),
    mappings: {
      archive: { identity: MATCH_STRATEGY_NAME ? 'strategy_name唯一匹配当前升接策略；strategy_code仅作为输入行关联值' : 'strategy_code', strategy_code: 'strategy_code（映射到数据库策略编码）', strategy_name: 'strategy_name（兼容源列 strategy-name）', strategy_class: 'strategy_class（升/接/升接规范为升接）', customer_group: 'customer_group', channel: 't_sr_dim_channel.key_name → channel/key_code', strategy_level: 'strategy_level', caliber: 'caliber', iteration: 'iteration', owner: 'owner', status: 'status', start_date: 'start_date', end_date: 'end_date' },
      strategyNameMappings: sourceNameMappings,
      execution: ['sourceDaily', 'dailyWeights'].includes(config.mode)
        ? { period_type: '月→t_sr_strategy_period_summary_ap，日→t_sr_strategy_daily_ap', stat_date: '月行统一使用来源月；日行保留原始日期', strategy_code: 'strategy_id/strategy_code', channel: 'channel code', original_cust: 'original_cust；空值保留NULL', push_count: 'push_count', usage_count: 'usage_count；空值保留NULL', reach_count: 'reach_count；空值保留NULL', target_conv_num: 'target_conv_num', product_conv_num: '源列为转化率辅助值；产品转化量按项目规则取 target_conv_num', expected_income: 'expected_income；源缺失取 actual_income', actual_income: 'actual_income', reject_count: 'reject_count；源缺失保留 NULL' }
        : config.strategyClass === '降拆'
        ? { period_type: '仅月度来源；映射 stat_month', stat_date: 'stat_month', strategy_code: 'strategy_id/strategy_code', channel: 'channel code', big_category: 'big_category', small_category: 'small_category', push_count: '咨询量/接单量；直接保留V3原列', usage_count: '接触量；保留原值和NULL', reach_count: '全部渠道成功量；直接保留V3原列', target_conv_num: '在线/营服派单量；直接保留V3原列', product_conv_num: '派单量副本，与target_conv_num逐行一致', reach_rate: '成功量reach_count/push_count×100', target_conv_rate: '派单量target_conv_num/push_count×100' }
        : { period_type: '仅月度来源；映射 stat_month', stat_date: 'stat_month', strategy_code: 'strategy_id/strategy_code', channel: 'channel code', original_cust: 'original_cust', push_count: 'push_count', usage_count: 'usage_count', reach_count: 'reach_count', target_conv_num: 'target_conv_num', product_conv_num: 'product_conv_num；公式辅助比例按项目规则取 target_conv_num', expected_income: 'expected_income；源缺失取 actual_income', actual_income: 'actual_income', reject_count: 'reject_count；源缺失保留 NULL' },
      details: { item_code: 'biz_code/reason_code（按同名现有码复用；缺失时稳定生成）', item_name: 'biz_name/reason_name', item_count: 'count/reject_count', stat_month: '业务 stat_date 或原因 stat_month（月首日）', strategy_code: 'strategy_id' },
    },
  }
}

function factIdentity(row) { return stableKey([row.strategy_id, row.channel, row.big_category, row.small_category]) }
function isDeclineServiceRows(rows) {
  return rows.length > 0 && rows.every((row) => row.strategy_class === '降拆'
    && (row.sourceChannel === '市级-营服' || row.target_conv_num != null))
}
function calcMetrics(rows) {
  const result = { strategy_count: new Set(rows.map((row) => row.strategy_id)).size }
  for (const field of ADDITIVE_FIELDS) {
    result[field] = rows.length && rows.some((row) => row[field] == null)
      ? null
      : round2(rows.reduce((sum, row) => sum + Number(row[field]), 0))
  }
  result.usage_rate = pct(result.usage_count, result.push_count)
  if (rows.some((row) => row.strategy_class === '降拆')) {
    result.reach_rate = pct(result.reach_count, result.push_count)
    result.target_conv_rate = pct(result.target_conv_num, result.push_count)
    result.product_conv_rate = pct(result.product_conv_num, result.push_count)
  } else {
    result.reach_rate = pct(result.reach_count, result.usage_count)
    result.target_conv_rate = pct(result.target_conv_num, result.reach_count)
    result.product_conv_rate = pct(result.product_conv_num, result.reach_count)
  }
  result.reject_rate = pct(result.reject_count, result.push_count)
  return result
}
function calcComparableMetrics(rows, month, cutoffByStrategy) {
  const result = calcMetrics(rows)
  if (month !== SOURCE_MONTH) return result
  const previousDays = dayCount(previousMonth(month))
  for (const field of ADDITIVE_FIELDS) {
    result[field] = rows.length && rows.some((row) => row[field] == null)
      ? null
      : round2(rows.reduce((sum, row) => {
        const cutoff = cutoffByStrategy.get(row.strategy_id) || 21
        return sum + Number(row[field]) * previousDays / cutoff
      }, 0))
  }
  result.usage_rate = pct(result.usage_count, result.push_count)
  if (rows.some((row) => row.strategy_class === '降拆')) {
    result.reach_rate = pct(result.reach_count, result.push_count)
    result.target_conv_rate = pct(result.target_conv_num, result.push_count)
    result.product_conv_rate = pct(result.product_conv_num, result.push_count)
  } else {
    result.reach_rate = pct(result.reach_count, result.usage_count)
    result.target_conv_rate = pct(result.target_conv_num, result.reach_count)
    result.product_conv_rate = pct(result.product_conv_num, result.reach_count)
  }
  result.reject_rate = pct(result.reject_count, result.push_count)
  return result
}
function compareMetrics(current, previous, partialDays = null) {
  const previousDays = dayCount(previousMonth(SOURCE_MONTH))
  const output = {}
  for (const field of Object.keys(METRIC_LABELS)) {
    const before = previous && previous[field]
    const now = current[field]
    if (!previous || now == null || before == null || Number(before) === 0) output[`${field}_qoq`] = null
    else if (RATE_FIELDS.has(field)) output[`${field}_qoq`] = round2(Number(now) - Number(before))
    else if (field === 'strategy_count' || !partialDays) output[`${field}_qoq`] = round2((Number(now) - Number(before)) * 100 / Number(before))
    else output[`${field}_qoq`] = round2((Number(now) * previousDays / partialDays - Number(before)) * 100 / Number(before))
  }
  return output
}
function withComparisons(row, current, previous, partialDays = null) {
  const comparison = compareMetrics(current, previous, partialDays)
  for (const [field, qoq] of Object.entries(comparison)) row[field] = qoq
  return row
}
function simulateHistory(dataset, existingPriorIds) {
  if (SOURCE_ONLY) return { facts: [], businesses: [], reasons: [], ids: [] }
  if (dataset.strategyClass === '降拆' && REPLACE_DECLINE) return simulateDeclineHistory(dataset)
  const missingIds = new Set(dataset.facts.map((row) => row.strategy_id).filter((id) => !existingPriorIds.has(id)))
  if (!missingIds.size) return { facts: [], businesses: [], reasons: [], ids: [] }
  const facts = []
  const businesses = []
  const reasons = []
  const sourceFacts = dataset.facts.filter((row) => missingIds.has(row.strategy_id))
  const sourceBusinesses = dataset.businesses.filter((row) => missingIds.has(row.strategy_id))
  const sourceReasons = dataset.reasons.filter((row) => missingIds.has(row.strategy_id))
  for (const fact of sourceFacts) {
    const byMonth = new Map([[SOURCE_MONTH, { ...fact }]])
    let next = { ...fact }
    for (let index = 9; index >= 0; index--) {
      const month = HISTORY_MONTHS[index]
      const growth = dataset.strategyClass === '离'
        ? fnvNoise(`review-history-v2:${fact.strategy_id}:${month}`, LEAVE_HISTORY_MOM_MIN, LEAVE_HISTORY_MOM_MAX)
        : fnvNoise(`review-history-v1:${fact.strategy_id}:${month}`, 0.985, 1.045)
      let scale
      if (month === '2026-09') scale = dayCount(month) / dataset.cutoff / growth
      else scale = 1 / growth
      const prior = { ...next, stat_month: monthStart(month), sourceRow: undefined, simulated: true }
      for (const field of COUNT_FIELDS) prior[field] = next[field] == null ? null : Math.max(0, Math.round(Number(next[field]) * scale))
      for (const field of AMOUNT_FIELDS) prior[field] = next[field] == null ? null : round2(Number(next[field]) * scale)
      if (prior.product_conv_num != null && prior.target_conv_num != null && fact.product_conv_num === fact.target_conv_num) prior.product_conv_num = prior.target_conv_num
      if (prior.expected_income != null && prior.actual_income != null && fact.expected_income === fact.actual_income) prior.expected_income = prior.actual_income
      pctRow(prior)
      facts.push(prior)
      byMonth.set(month, prior)
      next = prior
    }
    if (dataset.strategyClass === '离') {
      for (const month of [...HISTORY_MONTHS, SOURCE_MONTH]) {
        const current = byMonth.get(month)
        const prior = byMonth.get(previousMonth(month))
        if (!current || !prior) continue
        for (const field of LEAVE_HISTORY_CONTROL_FIELDS) {
          if (current[field] == null || prior[field] == null || Number(prior[field]) === 0) continue
          const currentValue = Number(current[field]) * (month === SOURCE_MONTH
            ? dayCount(previousMonth(month)) / dataset.cutoff
            : 1)
          const mom = (currentValue - Number(prior[field])) * 100 / Number(prior[field])
          assert(mom >= -5 && mom <= 5,
            `${fact.strategy_id}/${month}/${field} 模拟环比超出 -5%～5%：${round2(mom)}%`)
        }
      }
    }
    for (const month of HISTORY_MONTHS) {
      const current = byMonth.get(month)
      const prior = byMonth.get(previousMonth(month))
      if (prior) withComparisons(current, calcMetrics([current]), calcMetrics([prior]))
    }
  }
  for (const source of sourceBusinesses) {
    const fact = sourceFacts.find((row) => row.strategy_id === source.strategy_id)
    let next = Number(source.count)
    for (let index = 9; index >= 0; index--) {
      const month = HISTORY_MONTHS[index]
      const growth = fnvNoise(`review-history-v1:${source.strategy_id}:${month}`, 0.985, 1.045)
      const scale = month === '2026-09' ? dayCount(month) / dataset.cutoff / growth : 1 / growth
      const count = Math.max(0, Math.round(next * scale))
      businesses.push({ ...source, strategy_id: source.strategy_id, source_strategy_id: undefined,
        stat_month: monthStart(month), stat_date: monthStart(month), count, simulated: true,
        strategy_class: dataset.strategyClass, tab_type: 'active', city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0 })
      next = count
    }
  }
  for (const source of sourceReasons) {
    let next = Number(source.count)
    for (let index = 9; index >= 0; index--) {
      const month = HISTORY_MONTHS[index]
      const growth = fnvNoise(`review-history-v1:${source.strategy_id}:${month}`, 0.985, 1.045)
      const scale = month === '2026-09' ? dayCount(month) / dataset.cutoff / growth : 1 / growth
      const count = Math.max(0, Math.round(next * scale))
      reasons.push({ ...source, strategy_id: source.strategy_id,
        stat_month: monthStart(month), count, simulated: true,
        tab_type: 'active', strategy_class: dataset.strategyClass, city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0 })
      next = count
    }
  }
  for (const rows of group(reasons, (row) => stableKey([row.strategy_id, row.stat_month])).values()) {
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0)
    rows.forEach((row) => { row.reject_ratio = pct(row.count, total) })
  }
  return { facts, businesses, reasons, ids: [...missingIds] }
}
function distributeHistoricalTotal(rows, field, total) {
  if (total == null) return rows.map(() => null)
  const values = rows.map((row) => Math.max(0, Number(row[field]) || 0))
  const weights = values.some((value) => value > 0)
    ? values
    : rows.map((row) => Math.max(0, Number(row.push_count) || 0))
  return largestRemainder(Math.round(total), weights)
}
function simulateDeclineHistory(dataset) {
  const facts = []
  const reasons = []
  const channelRows = group(dataset.facts, (row) => row.sourceChannel)
  const actualOverallPush = (channelRows.get('整体') || []).reduce((sum, row) => sum + Number(row.push_count || 0), 0)
  // Compare the 21-day October source to the same 30-day calendar span as September.
  const septemberOverallPush = Math.round(actualOverallPush * dayCount(previousMonth(SOURCE_MONTH)) / dataset.cutoff / 0.98)
  const allIds = [...new Set(dataset.facts.map((row) => row.strategy_id))]

  for (let index = 0; index < HISTORY_MONTHS.length; index++) {
    const month = HISTORY_MONTHS[index]
    const consultFactor = DECLINE_CONSULT_FACTORS[index]
    const orderFactor = DECLINE_ORDER_FACTORS[index]
    const successFactor = DECLINE_SUCCESS_FACTORS[index]
    const monthlyTargets = new Map([
      ['整体', {
        push_count: month === '2026-09' ? septemberOverallPush : Math.round(1_800_000 * consultFactor),
        product_conv_num: Math.round(1_420_000 * successFactor),
      }],
      ['省级-在线', {
        push_count: Math.round(1_330_000 * DECLINE_CHANNEL_CONSULT_FACTORS[index]),
        reach_count: null,
        product_conv_num: Math.round(950_000 * successFactor),
      }],
      ['市级-营服', {
        push_count: Math.round(300_000 * orderFactor),
        reach_count: Math.round(300_000 * successFactor),
        target_conv_num: Math.round(300_000 * orderFactor * 0.32 * (1.03 ** index)),
      }],
      ['网格-面客', {
        push_count: Math.round(70_000 * (1.03 ** index)),
        product_conv_num: Math.round(40_000 * successFactor),
      }],
      ['网格-到厅', {
        push_count: Math.round(500_000 * DECLINE_CHANNEL_CONSULT_FACTORS[index]),
        product_conv_num: Math.round(240_000 * successFactor),
      }],
    ])
    monthlyTargets.get('省级-在线').reach_count = Math.round(monthlyTargets.get('省级-在线').push_count * DECLINE_ONLINE_DISPATCH_RATES[index] / 100)

    for (const [channel, targets] of monthlyTargets) {
      const sourceRows = channelRows.get(channel) || []
      assert(sourceRows.length === 47, `降拆模拟渠道 ${channel} 应有47条策略，实际 ${sourceRows.length}`)
      const sourcePush = sourceRows.reduce((sum, row) => sum + Number(row.push_count || 0), 0)
      const pushValues = distributeHistoricalTotal(sourceRows, 'push_count', targets.push_count)
      const successField = channel === '市级-营服' ? 'reach_count' : 'product_conv_num'
      const successValues = targets[successField] == null
        ? sourceRows.map(() => null)
        : distributeHistoricalTotal(sourceRows, successField, targets[successField])
      const dispatchField = channel === '市级-营服' ? 'target_conv_num' : channel === '省级-在线' ? 'reach_count' : null
      const dispatchValues = dispatchField && dispatchField !== successField
        ? distributeHistoricalTotal(sourceRows, dispatchField, targets[dispatchField])
        : null

      sourceRows.forEach((source, rowIndex) => {
        const sourceCount = Number(source.push_count) || 0
        const ratio = sourceCount > 0 ? pushValues[rowIndex] / sourceCount : 0
        const row = {
          ...source,
          stat_month: monthStart(month), simulated: true, county_id: dataset.countyId,
          original_cust: source.original_cust == null ? null : Math.round(Number(source.original_cust) * ratio),
          push_count: pushValues[rowIndex],
          usage_count: channel === '网格-面客' || source.usage_count == null ? null : Math.round(Number(source.usage_count) * ratio),
          reach_count: successField === 'reach_count' ? successValues[rowIndex]
            : dispatchField === 'reach_count' ? dispatchValues[rowIndex] : null,
          target_conv_num: channel === '市级-营服' ? dispatchValues[rowIndex] : null,
          product_conv_num: channel === '市级-营服' ? dispatchValues[rowIndex]
            : successField === 'product_conv_num' ? successValues[rowIndex] : null,
          reject_count: source.reject_count == null ? null : Math.max(0, Math.round(Number(source.reject_count) * ratio)),
          expected_income: source.expected_income == null ? null : round2(Number(source.expected_income) * ratio),
          actual_income: source.actual_income == null ? null : round2(Number(source.actual_income) * ratio),
        }
        pctRow(row)
        facts.push(row)
      })
    }
  }

  const sourceReasons = dataset.reasons
  for (const source of sourceReasons) {
    let next = Number(source.count)
    for (let index = HISTORY_MONTHS.length - 1; index >= 0; index--) {
      const month = HISTORY_MONTHS[index]
      const growth = fnvNoise(`review-history-v1:${source.strategy_id}:${month}`, 0.985, 1.045)
      const scale = month === '2026-09' ? dayCount(month) / dataset.cutoff / growth : 1 / growth
      const count = Math.max(0, Math.round(next * scale))
      reasons.push({ ...source, stat_month: monthStart(month), count, simulated: true,
        tab_type: 'active', strategy_class: dataset.strategyClass, city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0 })
      next = count
    }
  }
  for (const rows of group(reasons, (row) => stableKey([row.strategy_id, row.stat_month])).values()) {
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0)
    rows.forEach((row) => { row.reject_ratio = pct(row.count, total) })
  }
  for (const rows of group(facts, factIdentity).values()) {
    const byMonth = new Map(rows.map((row) => [String(row.stat_month).slice(0, 7), row]))
    for (const month of HISTORY_MONTHS) {
      const current = byMonth.get(month)
      const prior = byMonth.get(previousMonth(month))
      if (current && prior) withComparisons(current, calcMetrics([current]), calcMetrics([prior]))
    }
  }
  return { facts, businesses: [], reasons, ids: allIds }
}
function buildDailyFromWeights(dataset) {
  const days = dataset.cutoff
  const datePrefix = `${SOURCE_MONTH}-`
  const inputByStrategy = group(dataset.sourceDailyRows, (row) => row.strategy_id)
  const dateKeys = Array.from({ length: days }, (_, index) => `${datePrefix}${String(index + 1).padStart(2, '0')}`)
  const output = []
  for (const monthly of dataset.facts) {
    const inputRows = inputByStrategy.get(monthly.strategy_id) || []
    assert(inputRows.length > 0, `${monthly.strategy_id} 缺少 Excel 日权重`)
    const byDate = new Map(inputRows.map((row) => [row.stat_date, row]))
    assert(byDate.size === inputRows.length, `${monthly.strategy_id} 日权重日期重复`)
    assert(inputRows.every((row) => row.channel === monthly.channel && row.big_category === monthly.big_category
      && row.small_category === monthly.small_category), `${monthly.strategy_id} 月事实与日权重维度不一致`)
    const weights = (field) => dateKeys.map((date) => {
      const value = byDate.get(date)?.[field]
      return value == null ? 0 : Number(value)
    })
    const positiveWeights = (field, fallback) => {
      const primary = weights(field)
      if (primary.some((value) => value > 0)) return primary
      const secondary = fallback ? weights(fallback) : []
      assert(secondary.some((value) => value > 0), `${monthly.strategy_id}/${field} 没有可用日权重`)
      return secondary
    }
    const split = {}
    const pushWeights = positiveWeights('push_count')
    const usageWeights = positiveWeights('usage_count', 'push_count')
    const reachWeights = positiveWeights('reach_count', 'usage_count')
    const targetWeights = positiveWeights('target_conv_num', 'reach_count')
    const standard = dataset.strategyClass !== '降拆'
    const validUsageFunnel = standard && monthly.usage_count != null && monthly.push_count != null
      && monthly.usage_count <= monthly.push_count
    const validReachFunnel = standard && monthly.reach_count != null && monthly.usage_count != null
      && monthly.reach_count <= monthly.usage_count
    const validTargetFunnel = standard && monthly.target_conv_num != null && monthly.reach_count != null
      && monthly.target_conv_num <= monthly.reach_count
    split.push_count = monthly.push_count == null ? dateKeys.map(() => null) : largestRemainder(monthly.push_count, pushWeights)
    split.usage_count = monthly.usage_count == null ? dateKeys.map(() => null) : validUsageFunnel
      ? largestRemainderBounded(monthly.usage_count, usageWeights, split.push_count)
      : largestRemainder(monthly.usage_count, usageWeights)
    split.reach_count = monthly.reach_count == null ? dateKeys.map(() => null) : validReachFunnel
      ? largestRemainderBounded(monthly.reach_count, reachWeights, split.usage_count)
      : largestRemainder(monthly.reach_count, reachWeights)
    split.target_conv_num = monthly.target_conv_num == null ? dateKeys.map(() => null) : validTargetFunnel
      ? largestRemainderBounded(monthly.target_conv_num, targetWeights, split.reach_count)
      : largestRemainder(monthly.target_conv_num, targetWeights)
    const productWeights = monthly.product_conv_num === monthly.target_conv_num
      ? targetWeights : positiveWeights('product_conv_num', 'target_conv_num')
    split.product_conv_num = monthly.product_conv_num == null ? dateKeys.map(() => null)
      : monthly.product_conv_num === monthly.target_conv_num ? split.target_conv_num.slice()
        : largestRemainder(monthly.product_conv_num, productWeights)
    split.reject_count = monthly.reject_count == null ? dateKeys.map(() => null)
      : largestRemainder(monthly.reject_count, pushWeights)
    const actualWeights = positiveWeights('actual_income', 'push_count')
    const expectedWeights = positiveWeights('expected_income', 'actual_income')
    const splitMoney = (total, weight) => total == null ? dateKeys.map(() => null)
      : largestRemainder(Math.round(Number(total) * 100), weight).map((value) => value / 100)
    split.actual_income = splitMoney(monthly.actual_income, actualWeights)
    split.expected_income = monthly.expected_income === monthly.actual_income
      ? split.actual_income.slice() : splitMoney(monthly.expected_income, expectedWeights)

    for (let index = 0; index < days; index++) {
      const row = {
        tab_type: 'active', strategy_class: monthly.strategy_class, strategy_id: monthly.strategy_id,
        strategy_code: monthly.strategy_code, strategy_name: monthly.strategy_name,
        channel: monthly.channel, big_category: monthly.big_category, small_category: monthly.small_category,
        stat_date: dateKeys[index], stat_month: dateKeys[index], original_cust: null,
        push_count: split.push_count[index], usage_count: split.usage_count[index],
        reach_count: split.reach_count[index], target_conv_num: split.target_conv_num[index],
        product_conv_num: split.product_conv_num[index], expected_income: split.expected_income[index],
        actual_income: split.actual_income[index], reject_count: split.reject_count[index],
        city_id: CITY_ID, county_id: monthly.county_id, is_deleted: 0, daily_is_simulated: 1,
      }
      pctRow(row)
      output.push(row)
    }
  }
  return output
}

function buildDaily(dataset) {
  if (dataset.mode === 'sourceDaily') return dataset.sourceDailyRows.map((row) => ({ ...row, daily_is_simulated: 0 }))
  if (dataset.mode === 'dailyWeights') return buildDailyFromWeights(dataset)
  const days = dataset.cutoff
  const datePrefix = `${SOURCE_MONTH}-`
  const dailyRows = []
  const keyAudience = dataset.strategyClass === '重点客群'
  const keyAudienceWeights = keyAudience ? keyAudienceDailyWeights(days) : null
  const keyAudienceRateOffsets = keyAudience ? keyAudienceDailyRateOffsets(days, keyAudienceWeights) : null
  const strictFunnelReductions = { usage_count: 0, reach_count: 0, target_conv_num: 0, product_conv_num: 0 }
  for (const monthly of dataset.facts) {
    const mode = dataset.mode
    const fields = ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num']
    const rowWeightSource = mode === 'leave' ? dataset.sourceWeights?.byCategory?.[monthly.big_category] : dataset.sourceWeights
    if (mode === 'leave') assert(rowWeightSource, `${monthly.strategy_id} 缺少离工作簿 ${monthly.big_category} 分日权重`)
    const weightMode = mode === 'leave' ? 'sourceWeights' : mode
    const weights = Object.fromEntries(fields.map((field) => [field, dayWeights(weightMode, monthly.strategy_id, field, days, rowWeightSource)]))
    if (keyAudience) {
      weights.push_count = keyAudienceWeights
      weights.usage_count = keyAudienceWeights
      weights.reach_count = keyAudienceWeights
      weights.target_conv_num = keyAudienceWeights
      weights.product_conv_num = keyAudienceWeights
    }
    if (dataset.strategyClass === '降拆') {
      weights.reach_count = dataset.sourceWeights.reach_count
      weights.target_conv_num = dataset.sourceWeights.target_conv_num
      weights.product_conv_num = weights.target_conv_num
    } else if (monthly.product_conv_num === monthly.target_conv_num) {
      weights.product_conv_num = weights.target_conv_num
    }
    const split = {}
    const strictLeave = dataset.strategyClass === '离'
    const strictTotals = strictLeave ? strictLeaveDailyTotals(monthly, days) : null
    split.push_count = strictLeave
      ? largestRemainderWithMinimum(monthly.push_count, weights.push_count, 3)
      : keyAudience
        ? boundedRelativeSplit(monthly.push_count, weights.push_count, days, 0.10)
      : largestRemainder(monthly.push_count, weights.push_count)
    const standard = dataset.strategyClass !== '降拆'
    const validUsageFunnel = standard && monthly.usage_count != null && monthly.push_count != null && monthly.usage_count <= monthly.push_count
    const validReachFunnel = standard && monthly.reach_count != null && monthly.usage_count != null && monthly.reach_count <= monthly.usage_count
    split.usage_count = strictLeave
      ? largestRemainderBounded(strictTotals.usage_count, weights.usage_count, split.push_count.map((value) => value - 1))
      : validUsageFunnel
      ? largestRemainderBounded(monthly.usage_count, weights.usage_count, split.push_count)
      : largestRemainder(monthly.usage_count, weights.usage_count)
    split.reach_count = strictLeave
      ? largestRemainderBounded(strictTotals.reach_count, weights.reach_count, split.usage_count.map((value) => value - 1))
      : validReachFunnel
      ? largestRemainderBounded(monthly.reach_count, weights.reach_count, split.usage_count)
      : largestRemainder(monthly.reach_count, weights.reach_count)
    const validTargetFunnel = standard && monthly.target_conv_num != null && monthly.reach_count != null && monthly.target_conv_num <= monthly.reach_count
    const targetWeights = keyAudience
      ? conversionDailyWeights(split.reach_count, monthly.target_conv_num, monthly.reach_count, keyAudienceRateOffsets)
      : weights.target_conv_num
    split.target_conv_num = strictLeave
      ? largestRemainderBounded(strictTotals.target_conv_num, weights.target_conv_num, split.reach_count.map((value) => value - 1))
      : validTargetFunnel
      ? largestRemainderBounded(monthly.target_conv_num, targetWeights, split.reach_count)
      : largestRemainder(monthly.target_conv_num, targetWeights)
    const validProductFunnel = standard && monthly.product_conv_num != null && monthly.reach_count != null && monthly.product_conv_num <= monthly.reach_count
    const productWeights = keyAudience
      ? conversionDailyWeights(split.reach_count, monthly.product_conv_num, monthly.reach_count, keyAudienceRateOffsets)
      : weights.product_conv_num
    split.product_conv_num = monthly.product_conv_num === monthly.target_conv_num
      ? split.target_conv_num.slice()
      : (strictLeave
        ? largestRemainderBounded(strictTotals.product_conv_num, weights.product_conv_num, split.reach_count.map((value) => value - 1))
        : validProductFunnel
        ? largestRemainderBounded(monthly.product_conv_num, productWeights, split.reach_count)
        : largestRemainder(monthly.product_conv_num, productWeights))
    if (strictLeave) {
      for (const field of Object.keys(strictFunnelReductions)) {
        strictFunnelReductions[field] += Number(monthly[field] || 0) - Number(strictTotals[field] || 0)
      }
    }
    split.reject_count = largestRemainder(monthly.reject_count, weights.push_count)
    for (const field of AMOUNT_FIELDS) {
      const totalCents = monthly[field] == null ? null : Math.round(Number(monthly[field]) * 100)
      const amountWeights = dataset.mode === 'leave' ? weights.target_conv_num : weights.push_count
      const amount = totalCents == null ? null : largestRemainder(totalCents, amountWeights).map((value) => value / 100)
      split[field] = amount
    }
    for (let index = 0; index < days; index++) {
      const row = {
        tab_type: 'active', strategy_class: monthly.strategy_class, strategy_id: monthly.strategy_id,
        strategy_code: monthly.strategy_code, strategy_name: monthly.strategy_name,
        channel: monthly.channel, big_category: monthly.big_category, small_category: monthly.small_category,
        stat_date: `${datePrefix}${String(index + 1).padStart(2, '0')}`,
        stat_month: `${datePrefix}${String(index + 1).padStart(2, '0')}`,
        original_cust: null, reject_count: split.reject_count[index], city_id: CITY_ID,
        county_id: monthly.county_id, is_deleted: 0,
        push_count: split.push_count[index], usage_count: split.usage_count[index],
        reach_count: split.reach_count[index], target_conv_num: split.target_conv_num[index],
        product_conv_num: split.product_conv_num[index],
        expected_income: split.expected_income == null ? null : split.expected_income[index],
        actual_income: split.actual_income == null ? null : split.actual_income[index],
        daily_is_simulated: 1,
      }
      pctRow(row)
      dailyRows.push(row)
    }
  }
  dataset.dailyFunnelReductions = strictFunnelReductions
  return dailyRows
}
function strictLeaveDailyTotals(monthly, days) {
  const push = Number(monthly.push_count || 0)
  const usage = Math.min(Number(monthly.usage_count || 0), push - days)
  const reach = Math.min(Number(monthly.reach_count || 0), usage - days)
  const target = Math.min(Number(monthly.target_conv_num || 0), reach - days)
  assert(push >= days * 3 && usage >= days && reach >= days && target >= 0,
    `${monthly.strategy_id} 月事实不足以生成 ${days} 天的严格日漏斗`)
  const product = monthly.product_conv_num == null ? null
    : monthly.product_conv_num === monthly.target_conv_num ? target
      : Math.min(Number(monthly.product_conv_num || 0), reach - days)
  return { push_count: push, usage_count: usage, reach_count: reach, target_conv_num: target, product_conv_num: product }
}
function verifyDailySplit(dataset, monthlyRows, dailyRows) {
  if (dataset.mode === 'sourceDaily') {
    for (const monthly of monthlyRows) {
      const rows = dailyRows.filter((row) => factIdentity(row) === factIdentity(monthly))
      assert(rows.length === dataset.cutoff, `${monthly.strategy_id} 来源日记录数 ${rows.length} 与截止日 ${dataset.cutoff} 不一致`)
      const dates = rows.map((row) => row.stat_date).sort()
      assert(dates[0] === `${SOURCE_MONTH}-01` && dates.at(-1) === dataset.cutoffDate,
        `${monthly.strategy_id} 来源日范围 ${dates[0]}—${dates.at(-1)} 与来源截止日不符`)
    }
    return
  }
  for (const monthly of monthlyRows) {
    const rows = dailyRows.filter((row) => factIdentity(row) === factIdentity(monthly))
    assert(rows.length > 0, `日分摊缺少策略 ${monthly.strategy_id}`)
    for (const field of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'reject_count', ...AMOUNT_FIELDS]) {
      if (monthly[field] == null) {
        assert(rows.every((row) => row[field] == null), `${monthly.strategy_id}/${field} 月度为空但日值不为空`)
        continue
      }
      const dailyTotal = rows.reduce((sum, row) => sum + Number(row[field] || 0), 0)
      const expected = dataset.strategyClass === '离' && Object.hasOwn(strictLeaveDailyTotals(monthly, dataset.cutoff), field)
        ? strictLeaveDailyTotals(monthly, dataset.cutoff)[field]
        : Number(monthly[field])
      assert(Math.abs(dailyTotal - Number(expected)) < 0.011,
        `${monthly.strategy_id}/${field} 日累计 ${dailyTotal} 与模拟日目标 ${expected} 不一致`)
    }
    if (dataset.strategyClass === '离') {
      for (const row of rows) {
        assert(Number(row.push_count) > Number(row.usage_count)
          && Number(row.usage_count) > Number(row.reach_count)
          && Number(row.reach_count) > Math.max(Number(row.target_conv_num), Number(row.product_conv_num)),
        `${monthly.strategy_id}/${row.stat_date} 未满足逐策略严格日漏斗`)
      }
    }
  }
}
function allocateConversionsByDay(facts, dateGroups, dates, field, dailyTotals) {
  const monthlyByStrategy = new Map(facts.map((fact) => [fact.strategy_id, Math.round(Number(fact[field]))]))
  const strategyIds = [...monthlyByStrategy.keys()].sort()
  const source = 0
  const strategyStart = 1
  const dateStart = strategyStart + strategyIds.length
  const sink = dateStart + dates.length
  const graph = Array.from({ length: sink + 1 }, () => [])
  const addEdge = (from, to, capacity) => {
    const forward = { to, reverse: graph[to].length, capacity, originalCapacity: capacity }
    const reverse = { to: from, reverse: graph[from].length, capacity: 0, originalCapacity: 0 }
    graph[from].push(forward)
    graph[to].push(reverse)
    return forward
  }
  const strategyIndex = new Map(strategyIds.map((id, index) => [id, strategyStart + index]))
  const allocationEdges = new Map()
  for (const id of strategyIds) {
    const node = strategyIndex.get(id)
    addEdge(source, node, monthlyByStrategy.get(id))
    for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
      const row = (dateGroups.get(dates[dateIndex]) || []).find((item) => item.strategy_id === id)
      assert(row, `${id}/${dates[dateIndex]} 缺少日事实，无法分配转化量`)
      const capacity = Math.max(0, Math.floor(Number(row.reach_count) || 0))
      allocationEdges.set(stableKey([id, dates[dateIndex]]), addEdge(node, dateStart + dateIndex, capacity))
    }
  }
  dates.forEach((date, index) => addEdge(dateStart + index, sink, dailyTotals[index]))

  let flow = 0
  while (true) {
    const levels = Array(graph.length).fill(-1)
    const queue = [source]
    levels[source] = 0
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head]
      for (const edge of graph[from]) {
        if (edge.capacity > 0 && levels[edge.to] < 0) {
          levels[edge.to] = levels[from] + 1
          queue.push(edge.to)
        }
      }
    }
    if (levels[sink] < 0) break
    const cursor = Array(graph.length).fill(0)
    const send = (from, amount) => {
      if (from === sink) return amount
      for (; cursor[from] < graph[from].length; cursor[from]++) {
        const edge = graph[from][cursor[from]]
        if (edge.capacity <= 0 || levels[edge.to] !== levels[from] + 1) continue
        const pushed = send(edge.to, Math.min(amount, edge.capacity))
        if (!pushed) continue
        edge.capacity -= pushed
        graph[edge.to][edge.reverse].capacity += pushed
        return pushed
      }
      return 0
    }
    while (true) {
      const pushed = send(source, Number.MAX_SAFE_INTEGER)
      if (!pushed) break
      flow += pushed
    }
  }
  const expected = [...monthlyByStrategy.values()].reduce((sum, value) => sum + value, 0)
  assert(flow === expected, `${field} 日转化量无法在逐策略月合计和每日触达上限内分配：${flow}/${expected}`)
  return new Map(strategyIds.map((id) => [id, dates.map((date) =>
    allocationEdges.get(stableKey([id, date])).originalCapacity - allocationEdges.get(stableKey([id, date])).capacity)]))
}
function balanceKeyAudienceDailyConversionRates(datasets, dailyRows) {
  const keyAudienceDatasets = datasets.filter((dataset) => dataset.strategyClass === '重点客群')
  if (!keyAudienceDatasets.length) return 0
  const strategyGroups = new Map()
  const monthlyByGroupChannel = new Map()
  const dailyByGroupChannel = new Map()
  for (const dataset of keyAudienceDatasets) {
    const groupByCode = new Map(dataset.masters.map((master) => [master.strategy_code, master.customer_group || dataset.customerGroup || '未分类客群']))
    for (const fact of dataset.facts) {
      const customerGroup = groupByCode.get(fact.strategy_id)
      const key = stableKey([customerGroup, fact.channel])
      if (!monthlyByGroupChannel.has(key)) monthlyByGroupChannel.set(key, [])
      monthlyByGroupChannel.get(key).push(fact)
      strategyGroups.set(fact.strategy_id, { customerGroup, dataset })
    }
  }
  for (const row of dailyRows) {
    const source = strategyGroups.get(row.strategy_id)
    if (!source) continue
    const key = stableKey([source.customerGroup, row.channel])
    if (!dailyByGroupChannel.has(key)) dailyByGroupChannel.set(key, [])
    dailyByGroupChannel.get(key).push(row)
  }

  let adjustments = 0
  for (const [key, facts] of monthlyByGroupChannel) {
    const rows = dailyByGroupChannel.get(key) || []
    const [groupName, channelName] = JSON.parse(key)
    assert(rows.length > 0, `${groupName}/${channelName} 缺少日记录`)
    const dateGroups = group(rows, (row) => row.stat_date)
    const dates = [...dateGroups.keys()].sort()
    for (const field of ['target_conv_num', 'product_conv_num']) {
      const validFacts = facts.filter((fact) => fact[field] != null && fact.reach_count != null)
      if (field === 'product_conv_num' && facts.every((fact) => fact.target_conv_num === fact.product_conv_num)
        && rows.every((row) => row.target_conv_num === row.product_conv_num)) continue
      if (validFacts.length !== facts.length) continue
      const totalReach = validFacts.reduce((sum, fact) => sum + Number(fact.reach_count), 0)
      const totalConversions = validFacts.reduce((sum, fact) => sum + Number(fact[field]), 0)
      if (!totalReach) continue
      if (!totalConversions) continue
      const rate = totalConversions * 100 / totalReach
      const daily = dates.map((date) => {
        const dayRows = dateGroups.get(date)
        const denominator = dayRows.reduce((sum, row) => sum + Number(row.reach_count || 0), 0)
        const numerator = dayRows.reduce((sum, row) => sum + Number(row[field] || 0), 0)
        return {
          date, rows: dayRows, numerator, denominator,
          minimum: Math.ceil(denominator * Math.max(0, rate - 2) / 100 - 1e-9),
          maximum: Math.floor(denominator * Math.min(100, rate + 2) / 100 + 1e-9),
        }
      })
      const minimumTotal = daily.reduce((sum, day) => sum + day.minimum, 0)
      const maximumTotal = daily.reduce((sum, day) => sum + day.maximum, 0)
      assert(minimumTotal <= totalConversions && totalConversions <= maximumTotal,
        `${groupName}/${channelName}/${field} 的日整数范围无法同时满足月合计和 ±2pp：月转化${totalConversions}，可分配${minimumTotal}—${maximumTotal}`)

      const mirrorsOtherConversion = field === 'target_conv_num'
        && facts.every((fact) => fact.target_conv_num === fact.product_conv_num)
        && rows.every((row) => row.target_conv_num === row.product_conv_num)
      const desiredDailyTotals = largestRemainderBounded(
        totalConversions - minimumTotal,
        daily.map((day) => Math.max(0, day.numerator - day.minimum)),
        daily.map((day) => day.maximum - day.minimum),
      ).map((value, index) => value + daily[index].minimum)
      const allocation = allocateConversionsByDay(validFacts, dateGroups, dates, field, desiredDailyTotals)
      for (const fact of validFacts) {
        const values = allocation.get(fact.strategy_id)
        for (let index = 0; index < dates.length; index++) {
          const row = dateGroups.get(dates[index]).find((item) => item.strategy_id === fact.strategy_id)
          const previous = Number(row[field] || 0)
          row[field] = values[index]
          if (mirrorsOtherConversion) {
            const other = field === 'target_conv_num' ? 'product_conv_num' : 'target_conv_num'
            row[other] = values[index]
          }
          if (previous !== values[index]) adjustments++
          pctRow(row)
        }
      }
    }
  }
  return adjustments
}
function balanceStrictDailyFunnel(dataset, dailyRows) {
  if (dataset.strategyClass !== '离') return 0
  let adjustments = 0
  const dimensionGroups = group(dailyRows, (row) => stableKey([row.channel]))
  for (const rows of dimensionGroups.values()) {
    const byDay = group(rows, (row) => row.stat_date)
    const dates = [...byDay.keys()].sort()
    const totals = () => new Map(dates.map((date) => {
      const dayRows = byDay.get(date)
      const sum = (field) => dayRows.reduce((value, row) => value + Number(row[field] || 0), 0)
      return [date, { push_count: sum('push_count'), usage_count: sum('usage_count'), reach_count: sum('reach_count'),
        target_conv_num: sum('target_conv_num'), product_conv_num: sum('product_conv_num') }]
    }))
    for (const [field, parentField] of [['usage_count', 'push_count'], ['reach_count', 'usage_count'], ['target_conv_num', 'reach_count']]) {
      let current = totals()
      let attempts = 0
      while (dates.some((date) => current.get(date)[field] >= current.get(date)[parentField])) {
        assert(++attempts <= rows.length * 4, `离${field}日汇总顺序无法在保留月合计时调整`)
        const sourceDate = dates.find((date) => {
          const value = current.get(date)
          if (value[field] < value[parentField]) return false
          if (field === 'usage_count') return value.usage_count - value.reach_count >= 2
          if (field === 'reach_count') return value.reach_count - Math.max(value.target_conv_num, value.product_conv_num) >= 2
          return true
        })
        assert(sourceDate, `离${rows[0].channel}/${field}无法在保留下一级日漏斗的情况下调整：${JSON.stringify([...current.entries()].slice(0, 6))}`)
        const sourceRows = byDay.get(sourceDate).filter((row) => {
          const value = Number(row[field] || 0)
          if (field === 'usage_count') return value > Math.max(Number(row.reach_count || 0), Number(row.target_conv_num || 0), Number(row.product_conv_num || 0))
          if (field === 'reach_count') return value > Math.max(Number(row.target_conv_num || 0), Number(row.product_conv_num || 0))
          return value > 0
        }).sort((left, right) => Number(right[field] || 0) - Number(left[field] || 0) || left.strategy_id.localeCompare(right.strategy_id))
        let moved = false
        for (const source of sourceRows) {
          const destinationDate = dates.filter((date) => date !== sourceDate
            && current.get(date)[parentField] - current.get(date)[field] >= 2)
            .sort((left, right) => (current.get(right)[parentField] - current.get(right)[field])
              - (current.get(left)[parentField] - current.get(left)[field]) || left.localeCompare(right))
          for (const date of destinationDate) {
            const destination = byDay.get(date).find((row) => row.strategy_id === source.strategy_id)
            if (!destination) continue
            const hasCapacity = field === 'usage_count'
              ? Number(destination.push_count || 0) > Number(destination.usage_count || 0)
              : field === 'reach_count'
                ? Number(destination.usage_count || 0) > Number(destination.reach_count || 0)
                : Number(destination.reach_count || 0) > Math.max(Number(destination.target_conv_num || 0), Number(destination.product_conv_num || 0))
            if (!hasCapacity) continue
            source[field] = Number(source[field]) - 1
            destination[field] = Number(destination[field] || 0) + 1
            if (field === 'target_conv_num') {
              source.product_conv_num = Number(source.product_conv_num) - 1
              destination.product_conv_num = Number(destination.product_conv_num || 0) + 1
            }
            pctRow(source)
            pctRow(destination)
            adjustments++
            moved = true
            break
          }
          if (moved) break
        }
        assert(moved, `离${field}日汇总漏斗无法在保留 Excel 月合计及逐策略漏斗的情况下满足严格大于`)
        current = totals()
      }
    }
  }
  return adjustments
}
function verifyDailyFunnel(dataset, dailyRows) {
  if (dataset.strategyClass !== '离') return []
  const groups = group(dailyRows, (row) => stableKey([row.stat_date, row.channel]))
  const violations = []
  for (const rows of groups.values()) {
    const total = Object.fromEntries(['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num'].map((field) => [
      field,
      rows.some((row) => row[field] == null) ? null : rows.reduce((sum, row) => sum + Number(row[field]), 0),
    ]))
    const conversion = Math.max(Number(total.target_conv_num ?? 0), Number(total.product_conv_num ?? 0))
    if (total.push_count == null || total.usage_count == null || total.reach_count == null
      || total.target_conv_num == null || total.product_conv_num == null
      || !(total.push_count > total.usage_count && total.usage_count > total.reach_count && total.reach_count > conversion)) {
      const first = rows[0]
      violations.push({ date: first.stat_date, channel: first.channel, ...total })
    }
  }
  assert(!violations.length, `离页面日汇总漏斗未满足“推送量＞使用量＞触达量＞转化量”：${JSON.stringify(violations.slice(0, 10))}`)
  return [...groups.keys()].length
}
function verifyKeyAudienceDailyVariability(datasets, dailyRows) {
  const scopedDatasets = datasets.filter((dataset) => dataset.strategyClass === '重点客群')
  if (!scopedDatasets.length) return { groups: [], conversionRateVariancePp: 2, dailyPushRelativeVariance: 0.10 }
  const allFacts = []
  const factsByCustomerGroup = new Map()
  const dailyByStrategy = group(dailyRows, (row) => row.strategy_id)
  const allIds = new Set()
  for (const dataset of scopedDatasets) {
    for (const fact of dataset.facts) {
      const master = dataset.masters.find((row) => row.strategy_code === fact.strategy_id)
      const customerGroup = master?.customer_group || dataset.customerGroup || '未分类客群'
      const enriched = { ...fact, customer_group: customerGroup }
      allFacts.push(enriched)
      allIds.add(fact.strategy_id)
      if (!factsByCustomerGroup.has(customerGroup)) factsByCustomerGroup.set(customerGroup, [])
      factsByCustomerGroup.get(customerGroup).push(enriched)

      const daily = dailyByStrategy.get(fact.strategy_id) || []
      assert(daily.length === dataset.cutoff, `${customerGroup}/${fact.strategy_id} 日记录数不是 ${dataset.cutoff}`)
      if (fact.push_count != null) {
        const mean = Number(fact.push_count) / dataset.cutoff
        for (const row of daily) {
          const deviation = mean > 0 ? Math.abs(Number(row.push_count) - mean) / mean : 0
          assert(deviation <= 0.1000001,
            `${customerGroup}/${fact.strategy_id}/${row.stat_date} 日推送量偏离日均 ${round2(deviation * 100)}%，超过 ±10%`)
        }
      }
    }
  }
  const scopes = [
    { name: '全部重点客群', facts: allFacts, ids: allIds },
    ...[...factsByCustomerGroup].map(([name, facts]) => ({ name, facts, ids: new Set(facts.map((row) => row.strategy_id)) })),
    ...[...group(allFacts, (row) => stableKey([row.customer_group, row.channel]))].map(([identityKey, facts]) => {
      const [customerGroup, channel] = JSON.parse(identityKey)
      return { name: `${customerGroup}/${channel}`, customerGroup, channel, facts,
        ids: new Set(facts.map((row) => row.strategy_id)) }
    }),
  ]
  const results = []
  for (const scope of scopes) {
    const daily = dailyRows.filter((row) => scope.ids.has(row.strategy_id))
    const byDate = group(daily, (row) => row.stat_date)
    const metrics = {}
    for (const field of ['target_conv_num', 'product_conv_num']) {
      const baseRows = scope.facts.filter((row) => row[field] != null && row.reach_count != null)
      const numerator = baseRows.reduce((sum, row) => sum + Number(row[field]), 0)
      const denominator = baseRows.reduce((sum, row) => sum + Number(row.reach_count), 0)
      if (!denominator) continue
      const sourceRate = numerator * 100 / denominator
      const dailyRates = []
      for (const [date, rows] of byDate) {
        const usable = rows.filter((row) => row[field] != null && row.reach_count != null)
        const dayReach = usable.reduce((sum, row) => sum + Number(row.reach_count), 0)
        if (!dayReach) continue
        const dayConversions = usable.reduce((sum, row) => sum + Number(row[field]), 0)
        const rate = dayConversions * 100 / dayReach
        const deviation = rate - sourceRate
        assert(Math.abs(deviation) <= 2.0001,
          `${scope.name}/${date}/${field} 日转化率偏离来源月 ${round2(deviation)}pp，超过 ±2pp`)
        dailyRates.push({ date, rate: round2(rate), deviationPp: round2(deviation) })
      }
      metrics[field] = {
        sourceRate: round2(sourceRate), minDailyRate: round2(Math.min(...dailyRates.map((row) => row.rate))),
        maxDailyRate: round2(Math.max(...dailyRates.map((row) => row.rate))),
        minDeviationPp: round2(Math.min(...dailyRates.map((row) => row.deviationPp))),
        maxDeviationPp: round2(Math.max(...dailyRates.map((row) => row.deviationPp))),
        dailyCount: dailyRates.length,
      }
    }
    results.push({ customerGroup: scope.customerGroup || scope.name, channel: scope.channel || null,
      strategyCount: scope.ids.size, metrics })
  }
  return { groups: results, conversionRateVariancePp: 2, dailyPushRelativeVariance: 0.10 }
}
function tableSet(config) { return tableNames(config.suffix) }
async function tableColumns(conn, table) {
  const [rows] = await conn.query('SHOW COLUMNS FROM ??', [table])
  return new Set(rows.map((row) => row.Field))
}
function validateRows(table, rows, available) {
  if (!rows.length) return
  const derivedOnly = new Set(['reach_rate', 'reach_rate_qoq', 'reach_rate_yoy', 'stat_date', 'stat_month', 'tab_type', 'strategy_class'])
  for (const row of rows) {
    const missing = Object.keys(row).filter((key) => row[key] !== undefined && key !== 'id' && key !== 'sourceRow' && key !== 'sourceChannel' && key !== 'source_strategy_id' && key !== 'source_channel' && key !== 'strategy_ids' && key !== 'simulated' && key !== 'daily_is_simulated' && !derivedOnly.has(key) && !/_qoq$|_yoy$/.test(key) && !available.has(key))
    if (missing.length) fail(`${table} 没有映射字段：${missing.join(',')}`)
  }
}
async function insertRows(conn, table, rows, columns) {
  if (!rows.length) return
  const available = columns.get(table) || await tableColumns(conn, table)
  columns.set(table, available)
  validateRows(table, rows, available)
  const keys = Object.keys(rows[0]).filter((key) => key !== 'id' && available.has(key))
  const values = rows.map((row) => keys.map((key) => row[key] === undefined ? null : row[key]))
  for (let start = 0; start < values.length; start += 250) {
    await conn.query('INSERT INTO ?? (??) VALUES ?', [table, keys, values.slice(start, start + 250)])
  }
}
function stripInternal(row) {
  const copy = { ...row }
  for (const key of ['sourceRow', 'sourceChannel', 'source_strategy_id', 'source_channel', 'strategy_ids', 'simulated', 'daily_is_simulated']) delete copy[key]
  return copy
}
function detailDatabaseRows(dataset, records, type) {
  const rows = records.map((source, index) => ({
    tab_type: 'active', strategy_class: dataset.strategyClass,
    strategy_id: source.strategy_id, city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0,
    stat_month: MONTH_START, stat_date: MONTH_START,
    biz_code: type === 'business' ? source.code : undefined,
    biz_name: type === 'business' ? source.name : undefined,
    count: type === 'business' ? source.count : undefined,
    mom_ratio: type === 'business' ? source.mom_ratio ?? null : undefined,
    yoy_ratio: type === 'business' ? null : undefined,
    reason_code: type === 'reject' ? source.code : undefined,
    reason_name: type === 'reject' ? source.name : undefined,
    reject_count: type === 'reject' ? source.count : undefined,
    reject_ratio: type === 'reject' ? source.reject_ratio ?? null : undefined,
    sort_no: type === 'reject' ? source.sort_no ?? index + 1 : undefined,
    color: type === 'reject' ? source.color ?? COLORS[index % COLORS.length] : undefined,
  }))
  if (type === 'reject') {
    for (const rowsByStrategy of group(rows, (row) => row.strategy_id).values()) {
      const total = rowsByStrategy.reduce((sum, row) => sum + Number(row.reject_count || 0), 0)
      rowsByStrategy.forEach((row) => { row.reject_ratio = pct(row.reject_count, total) })
    }
  }
  return rows
}
function historicalBusinessDatabaseRows(dataset, history) {
  return history.businesses.map((row) => ({
    tab_type: 'active', strategy_class: dataset.strategyClass, strategy_id: row.strategy_id,
    stat_month: row.stat_month, stat_date: row.stat_date, biz_code: row.code, biz_name: row.name,
    count: row.count, mom_ratio: row.mom_ratio ?? null, yoy_ratio: null, city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0,
  }))
}
function historicalReasonDatabaseRows(dataset, history) {
  return history.reasons.map((row) => ({
    strategy_id: row.strategy_id, stat_month: row.stat_month, reason_code: row.code, reason_name: row.name,
    reject_count: row.count, reject_ratio: row.reject_ratio ?? null, color: row.color ?? null, sort_no: row.sort_no ?? null,
    city_id: CITY_ID, county_id: dataset.countyId, is_deleted: 0,
  }))
}
function outputSummary(datasets, history, dailyRows) {
  return {
    dryRun: !APPLY, database: DATABASE,
    sourceDirectory: fs.statSync(SOURCE_DIR).isFile() ? path.dirname(SOURCE_DIR) : SOURCE_DIR,
    sourcePath: SOURCE_DIR,
    sourceMonth: SOURCE_MONTH, cityId: CITY_ID, countyId: null,
    rule: {
      sourceFactsPreserved: true,
      syntheticDaily: datasets.some((dataset) => dataset.mode !== 'sourceDaily'),
      dailyLabel: datasets.every((dataset) => dataset.mode === 'sourceDaily')
        ? '逐日记录直接来自 Excel；未按月度值重新分摊。'
        : datasets.some((dataset) => dataset.mode === 'dailyWeights')
          ? '按 Excel 逐日数值作为权重，以来源月总量拆分整数模拟日数据；不代表实际逐日业绩。'
        : '模拟日分摊，不代表实际逐日业绩',
      dailyRangeByFile: datasets.map((dataset) => `${dataset.sourceFile}: ${SOURCE_MONTH}-01 至 ${dataset.cutoffDate}`).join('；'),
      sourceDailyReconciliation: datasets.flatMap((dataset) => dataset.sourceDailyReconciliation || []),
      dailyWeightSummary: datasets.flatMap((dataset) => dataset.sourceDailyWeightSummary || []),
      sourceMonthlyDerivedMetrics: datasets.flatMap((dataset) => dataset.sourceMonthlyDerivedMetrics || []),
      keyAudienceDailyRule: datasets.some((dataset) => dataset.strategyClass === '重点客群')
        ? '客群及触点汇总转化率相对来源月在 ±2pp 内波动；每条策略每日推送量相对该策略日均值在 ±10% 内；每日整数分配后保留来源月月合计。'
        : null,
      missingCounts: 'NULL 保持为空；不由拒绝原因推算拒绝总量；用户去重原始客群量不拆入日表。',
      syntheticHistory: SOURCE_ONLY ? '本次仅导入来源月，历史模拟待规则冲突确认后执行。' : REPLACE_CLASS
        ? `${REPLACE_CLASS} 历史先逻辑删除，再按本次来源表重建 2025-12 至 2026-09 模拟月表；2026-10 保留 Excel 实值。`
        : '仅为没有既有历史的来源策略补 2025-12 至 2026-09 模拟月表；保留已存在历史。',
      leaveDailyFunnel: datasets.some((dataset) => dataset.strategyClass === '离')
        ? '逐策略每日记录及页面展示维度（日期、触点）汇总均校验推送量＞使用量＞触达量＞转化量；月度事实保留 Excel 原值，严格日分摊必要时只下调模拟日明细。'
        : null,
    },
    datasets: datasets.map((dataset) => ({
      sourceFile: dataset.sourceFile, sha256: dataset.sourceSha256, sourceMonth: dataset.sourceMonth,
      sourceCutoff: dataset.cutoffDate, strategyClass: dataset.strategyClass, customerGroup: dataset.customerGroup,
      customerGroups: dataset.customerGroups,
      countyId: dataset.countyId,
      counts: { strategies: dataset.masters.length, monthly: dataset.facts.length, business: dataset.businesses.length, reject: dataset.reasons.length,
        simulatedHistoryMonths: new Set((history.get(dataset.sourceFile)?.facts || []).map((row) => String(row.stat_month).slice(0, 7))).size,
        simulatedHistoryFacts: history.get(dataset.sourceFile)?.facts.length || 0,
        daily: dailyRows.filter((row) => dataset.facts.some((fact) => fact.strategy_id === row.strategy_id)).length,
        dailyFunnelGroups: dataset.dailyFunnelGroups ?? null,
        dailyFunnelAdjustments: dataset.dailyFunnelAdjustments ?? null,
        dailyFunnelReductions: dataset.dailyFunnelReductions ?? null },
      tables: dataset.tables, mappings: dataset.mappings,
    })),
    addedChannels: [], mappings: [], backupPath: null,
  }
}

async function prepareDictionaries(conn, strategyClasses = []) {
  const [channels] = await conn.query('SELECT key_code,key_name,tab_type,status,sort_no,is_deleted FROM t_sr_dim_channel')
  const [bizNames] = await conn.query('SELECT DISTINCT biz_code AS code,biz_name AS name FROM v_sr_strategy_biz_capacity_read WHERE is_deleted=0 AND biz_code IS NOT NULL')
  const [reasonNames] = await conn.query('SELECT DISTINCT reason_code AS code,reason_name AS name FROM v_sr_strategy_reject_reason_read WHERE is_deleted=0 AND reason_code IS NOT NULL')
  const targetNames = { businesses: Object.create(null), reasons: Object.create(null) }
  for (const strategyClass of strategyClasses) {
    const tables = tableNames(suffixForClass(strategyClass))
    const [businesses] = await conn.query(
      "SELECT DISTINCT b.biz_code AS code,b.biz_name AS name FROM ?? b JOIN ?? s ON s.strategy_code=b.strategy_id AND s.tab_type='active' AND s.strategy_class=? AND s.is_deleted=0 WHERE b.tab_type='active' AND b.is_deleted=0 AND b.city_id=? AND b.county_id IS NULL AND b.biz_code IS NOT NULL",
      [tables.business, tables.master, strategyClass, CITY_ID],
    )
    const [reasons] = await conn.query(
      "SELECT DISTINCT r.reason_code AS code,r.reason_name AS name FROM ?? r JOIN ?? s ON s.strategy_code=r.strategy_id AND s.tab_type='active' AND s.strategy_class=? AND s.is_deleted=0 WHERE r.is_deleted=0 AND r.city_id=? AND r.county_id IS NULL AND r.reason_code IS NOT NULL",
      [tables.reject, tables.master, strategyClass, CITY_ID],
    )
    targetNames.businesses[strategyClass] = businesses
    targetNames.reasons[strategyClass] = reasons
  }
  const newChannels = []
  const mappings = { channels: [], businesses: [], reasons: [] }
  function channelCode(name) {
    assert(name, '触点名称为空，无法对应数据库字典')
    const allChannels = [...channels, ...newChannels]
    const matches = allChannels.filter((row) => row.key_name === name
      && Number(row.status) === 1 && Number(row.is_deleted) === 0
      && String(row.tab_type || '').split(',').includes('active'))
    const codes = [...new Set(matches.map((row) => row.key_code))]
    assert(codes.length <= 1, `触点 ${name} 对应多个数据库编码：${codes.join(',')}`)
    let row
    if (codes.length) row = matches.find((item) => item.key_code === codes[0])
    else {
      row = newChannels.find((item) => item.key_name === name)
      if (!row) {
        let number = 1
        while (allChannels.some((item) => item.key_code === `ACH${String(number).padStart(4, '0')}`)) number++
        row = { key_code: `ACH${String(number).padStart(4, '0')}`, key_name: name, tab_type: 'active', status: 1, sort_no: 100 + newChannels.length, is_deleted: 0 }
        newChannels.push(row)
      }
    }
    if (!mappings.channels.some((item) => item.name === name)) mappings.channels.push({ name, code: row.key_code })
    return row.key_code
  }
  function detailCode(name, kind, sourceCode, strategyClass) {
    assert(name, '业务或拒绝原因名称为空')
    const current = mappings[kind].find((item) => item.name === name)
    if (current) return current
    const existing = kind === 'businesses' ? bizNames : reasonNames
    const scoped = targetNames[kind][strategyClass] || []
    const scopedMatches = scoped.filter((row) => row.name === name)
    const matching = scopedMatches.length ? scopedMatches : existing.filter((row) => row.name === name)
    const unique = [...new Set(matching.map((row) => row.code))]
    assert(unique.length <= 1, `${name} 在当前数据库中有多个编码：${unique.join(',')}`)
    let code = unique[0] || null
    const candidate = normalizeText(sourceCode)
    if (!code && candidate && candidate !== '0' && candidate !== '不填') {
      const conflict = existing.find((row) => row.code === candidate && row.name !== name)
      assert(!conflict, `源明细编码 ${candidate} 已对应其他名称 ${conflict?.name}`)
      code = candidate
    }
    if (!code) {
      const prefix = kind === 'businesses' ? 'BIZ' : 'RSN'
      let number = 1
      const used = new Set(existing.map((row) => row.code))
      while (used.has(`${prefix}${String(number).padStart(6, '0')}`) || mappings[kind].some((item) => item.code === `${prefix}${String(number).padStart(6, '0')}`)) number++
      code = `${prefix}${String(number).padStart(6, '0')}`
    }
    const codeScope = scopedMatches.length ? scoped : existing
    const codeConflict = codeScope.find((row) => row.code === code && row.name !== name)
    assert(!codeConflict, `${code} 已对应 ${codeConflict?.name}，不能映射到 ${name}`)
    const mapped = { name, code }
    mappings[kind].push(mapped)
    return mapped
  }
  return { channelCode, detailCode, newChannels, mappings }
}

function summaryRows(facts, businesses, strategyClass, tabType = 'active', cutoffByStrategy = new Map(), countyId = null) {
  const common = { tab_type: tabType, strategy_class: strategyClass, city_id: CITY_ID, county_id: countyId, is_deleted: 0 }
  const labels = strategyClass === '降拆' ? {
    ...METRIC_LABELS, original_cust: '原始客群', push_count: '咨询量', usage_count: '接触量', usage_rate: '接触率',
    reach_count: '成功量', reach_rate: '成功率', target_conv_num: '派单量', target_conv_rate: '派单率',
    product_conv_num: '派单量副本', product_conv_rate: '派单率副本',
  } : METRIC_LABELS
  const byMonth = group(facts, (row) => String(row.stat_month).slice(0, 7))
  const periods = []
  const kpis = []
  const channels = []
  const capacities = []
  const channelBusinesses = []
  const months = [...byMonth.keys()].sort()
  const metricRowsByMonth = new Map()
  for (const month of months) {
    const rows = byMonth.get(month)
    const total = calcMetrics(rows)
    const comparableTotal = calcComparableMetrics(rows, month, cutoffByStrategy)
    metricRowsByMonth.set(month, comparableTotal)
    const previous = metricRowsByMonth.get(previousMonth(month)) || null
    const kpiDiff = compareMetrics(comparableTotal, previous)
    Object.entries(labels).forEach(([metricCode, metricName], index) => {
      const unit = metricCode === 'strategy_count' ? '个' : RATE_FIELDS.has(metricCode) ? '%' : /income/.test(metricCode) ? '元' : metricCode === 'original_cust' ? '人' : '次'
      kpis.push({ ...common, stat_month: month, metric_code: metricCode, metric_name: metricName,
        value: total[metricCode], unit, qoq: kpiDiff[`${metricCode}_qoq`], yoy: null, icon: null, sort_no: index + 1 })
    })
    const channelGroups = [...group(rows, (row) => row.channel).values()]
    for (const channelRows of [...channelGroups, rows]) {
      const channel = channelRows === rows ? '全部' : channelRows[0].channel
      const chMetrics = calcMetrics(channelRows)
      const priorRows = byMonth.get(previousMonth(month)) || []
      const priorChannelRows = priorRows.filter((row) => channel === '全部' || row.channel === channel)
      const priorChannel = priorChannelRows.length ? calcMetrics(priorChannelRows) : null
      const channelDiff = compareMetrics(calcComparableMetrics(channelRows, month, cutoffByStrategy), priorChannel)
      const channelMetrics = { ...chMetrics }
      const channelComparisons = { ...channelDiff }
      for (const field of ['reject_count', 'reject_rate']) {
        delete channelMetrics[field]
        delete channelComparisons[`${field}_qoq`]
      }
      if (strategyClass !== '降拆') {
        delete channelMetrics.reach_rate
        delete channelComparisons.reach_rate_qoq
      }
      channels.push({ ...common, stat_month: monthStart(month), channel, ...channelMetrics, ...channelComparisons })
      const categoryGroups = [...group(channelRows, (row) => stableKey([row.big_category, row.small_category])).values()]
      for (const categoryRows of [...categoryGroups, channelRows]) {
        const allCategories = categoryRows === channelRows
        const big = allCategories ? '全部' : categoryRows[0].big_category
        const small = allCategories ? '全部' : categoryRows[0].small_category
        const categoryMetrics = calcMetrics(categoryRows)
        const previousCategoryRows = priorChannelRows.filter((row) => allCategories || (row.big_category === big && row.small_category === small))
        const previousCategory = previousCategoryRows.length ? calcMetrics(previousCategoryRows) : null
        const categoryDiff = compareMetrics(calcComparableMetrics(categoryRows, month, cutoffByStrategy), previousCategory)
        periods.push({ ...common, strategy_id: '999', strategy_code: '999', strategy_name: '分类汇总', channel,
          big_category: big, small_category: small, stat_month: monthStart(month), ...categoryMetrics, ...categoryDiff })
        capacities.push({ ...common, stat_month: monthStart(month), channel, big_category: big, small_category: small,
          capacity: strategyClass === '降拆' ? categoryMetrics.reach_count : categoryMetrics.product_conv_num,
          qoq: strategyClass === '降拆' ? categoryDiff.reach_count_qoq : categoryDiff.product_conv_num_qoq, yoy: null })
      }
    }
  }
  const byBiz = group(businesses.filter((row) => row.biz_name !== '全部'), (row) => stableKey([
    String(row.stat_month || row.stat_date).slice(0, 7), row.channel, row.big_category, row.small_category, row.biz_name,
  ]))
  for (const [identityKey, rows] of byBiz) {
    const row = rows[0]
    const month = String(row.stat_month || row.stat_date).slice(0, 7)
    const [, channel, bigCategory, smallCategory, bizName] = JSON.parse(identityKey)
    const previousRows = byBiz.get(stableKey([previousMonth(month), channel, bigCategory, smallCategory, bizName])) || []
    const capacity = rows.reduce((sum, item) => {
      const cutoff = cutoffByStrategy.get(item.strategy_id) || 21
      const scale = month === SOURCE_MONTH ? dayCount(previousMonth(month)) / cutoff : 1
      return sum + Number(item.count || 0) * scale
    }, 0)
    const previousCapacity = previousRows.length ? previousRows.reduce((sum, item) => sum + Number(item.count || 0), 0) : null
    let qoq = previousCapacity == null || previousCapacity === 0 ? null : round2((capacity - previousCapacity) * 100 / previousCapacity)
    channelBusinesses.push({ ...common, stat_month: monthStart(month), channel: row.channel, big_category: row.big_category,
      small_category: row.small_category, biz_name: row.biz_name, capacity, qoq })
  }
  // Add per-class, per-channel business capacity totals for the active capacity API.
  const channelBizGroups = group(channelBusinesses, (row) => stableKey([String(row.stat_month).slice(0, 7), row.channel, row.big_category, row.small_category]))
  for (const [identityKey, rows] of channelBizGroups) {
    const first = rows[0]
    const month = String(first.stat_month).slice(0, 7)
    const [, channel, bigCategory, smallCategory] = JSON.parse(identityKey)
    const previousRows = channelBizGroups.get(stableKey([previousMonth(month), channel, bigCategory, smallCategory])) || []
    const capacity = rows.reduce((sum, row) => sum + Number(row.capacity || 0), 0)
    const previousCapacity = previousRows.length ? previousRows.reduce((sum, row) => sum + Number(row.capacity || 0), 0) : null
    let qoq = previousCapacity == null || previousCapacity === 0 ? null : round2((capacity - previousCapacity) * 100 / previousCapacity)
    channelBusinesses.push({ ...common, stat_month: monthStart(month), channel: first.channel, big_category: first.big_category,
      small_category: first.small_category, biz_name: '全部', capacity, qoq })
  }
  return { periods, kpis, channels, capacities, channelBusinesses }
}

async function fetchRowsForCodes(conn, table, codeField, codes) {
  if (!codes.length) return []
  const [rows] = await conn.query('SELECT * FROM ?? WHERE ?? IN (?)', [table, codeField, codes])
  return rows
}
async function backupTables(conn, datasets, tablesToRefresh, outDir, extraCodesByTable = {}) {
  const backup = { createdAt: new Date().toISOString(), database: DATABASE, sourceFiles: datasets.map((dataset) => ({ file: dataset.sourceFile, sha256: dataset.sourceSha256 })), tables: {} }
  const codesByTable = new Map()
  for (const dataset of datasets) {
    const master = dataset.tables.master
    const codes = dataset.masters.map((row) => row.strategy_code)
    if (!codesByTable.has(master)) codesByTable.set(master, new Set())
    codes.forEach((code) => codesByTable.get(master).add(code))
    for (const table of [dataset.tables.period, dataset.tables.daily, dataset.tables.business, dataset.tables.reject]) {
      if (!codesByTable.has(table)) codesByTable.set(table, new Set())
      codes.forEach((code) => codesByTable.get(table).add(code))
    }
  }
  for (const [table, codes] of Object.entries(extraCodesByTable)) {
    if (!codesByTable.has(table)) codesByTable.set(table, new Set())
    codes.forEach((code) => codesByTable.get(table).add(code))
  }
  for (const [table, codes] of codesByTable) {
    const codeField = table.includes('t_sr_strategy') && !table.includes('period') && !table.includes('daily') && !table.includes('biz_capacity') && !table.includes('reject_reason') ? 'strategy_code' : 'strategy_id'
    backup.tables[table] = await fetchRowsForCodes(conn, table, codeField, [...codes])
  }
  for (const [table, clauses] of Object.entries(tablesToRefresh)) {
    const rows = []
    for (const clause of clauses) {
      const [found] = await conn.query(`SELECT * FROM ?? WHERE ${clause.sql}`, [table, ...clause.values])
      rows.push(...found)
    }
    const combined = [...(backup.tables[table] || []), ...rows]
    backup.tables[table] = [...new Map(combined.map((row) => [row.id == null ? JSON.stringify(row) : String(row.id), row])).values()]
  }
  const [dimensions] = await conn.query('SELECT * FROM t_sr_dim_channel WHERE is_deleted=0')
  backup.tables.t_sr_dim_channel = dimensions
  if (datasets.some((dataset) => dataset.strategyClass === '重点客群')) {
    const activeDir = path.join(ROOT, 'front/src/views/strategyReview/active')
    const filenames = ['customerGroupSimulation.json', 'networkDiversionSimulation.json', 'overageSimulation.json', 'oldTariffSimulation.json', 'zeroLowFlowSimulation.json']
    backup.manifests = Object.fromEntries(filenames.map((filename) => {
      const manifestPath = path.join(activeDir, filename)
      return [filename, fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : null]
    }))
  }
  const backupPath = path.join(outDir, `database-backup-${Date.now()}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  return backupPath
}

function rollupTables(config) {
  const tables = tableNames(config.suffix)
  return [tables.period, tables.kpi, tables.channel, tables.channelCapacity, tables.channelBusiness]
}
function rollupRefreshWhere(strategyClass, suffix) {
  const tables = tableNames(suffix)
  const where = "tab_type='active' AND strategy_class=? AND city_id='999'"
  return [
    [tables.period, `${where} AND strategy_id='999'`, [strategyClass]],
    [tables.kpi, where, [strategyClass]],
    [tables.channel, where, [strategyClass]],
    [tables.channelCapacity, where, [strategyClass]],
    [tables.channelBusiness, where, [strategyClass]],
  ]
}
function normalizeRollupRows(table, rows) {
  if (!['t_sr_kpi_summary', 't_sr_channel_monthly_capacity_ap'].includes(table)) return rows
  return rows.map((row) => ({ ...row, stat_month: String(row.stat_month).slice(0, 7).replace('-', '') }))
}
async function allSourceFacts(conn, table, strategyClass) {
  const [rows] = await conn.query(
    `SELECT * FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id='999' AND is_deleted=0 AND strategy_id<>'999' AND channel<>'全部' AND big_category<>'全部' AND small_category<>'全部' ORDER BY stat_month, strategy_id`,
    [table, strategyClass],
  )
  return rows.map((row) => ({ ...row, original_cust: row.original_cust == null ? null : Number(row.original_cust) }))
}
async function allSourceBusinesses(conn, table, strategyClass) {
  const [rows] = await conn.query(
    `SELECT b.*,f.channel,f.big_category,f.small_category FROM ?? b LEFT JOIN ?? f ON f.strategy_id=b.strategy_id AND f.tab_type='active' AND f.strategy_class=? AND f.stat_month=b.stat_date AND f.is_deleted=0 AND f.channel<>'全部' AND f.big_category<>'全部' AND f.small_category<>'全部' WHERE b.tab_type='active' AND b.city_id='999' AND b.is_deleted=0 AND b.stat_date BETWEEN ? AND ? AND f.strategy_id IS NOT NULL`,
    [table, table === 't_sr_strategy_biz_capacity' ? 't_sr_strategy_period_summary_ap' : table.replace('t_sr_strategy_biz_capacity', 't_sr_strategy_period_summary_ap'), strategyClass, `${BASELINE_MONTH}-01`, `${SOURCE_MONTH}-31`],
  )
  return rows
}
async function refreshRollups(conn, targetClass, suffix, factsSource, businessSource, cutoffByStrategy, columns) {
  const tables = tableNames(suffix)
  const sourceFacts = await allSourceFacts(conn, factsSource, targetClass)
  const sourceBusinesses = await allSourceBusinesses(conn, businessSource, targetClass)
  const countyId = ['离', '降拆'].includes(targetClass) ? '999' : null
  const rollups = summaryRows(sourceFacts, sourceBusinesses, targetClass, 'active', cutoffByStrategy, countyId)
  const clauses = rollupRefreshWhere(targetClass, suffix)
  for (const [table, where, values] of clauses) await conn.query(`UPDATE ?? SET is_deleted=1 WHERE ${where}`, [table, ...values])
  const timestamp = new Date()
  const allRows = [
    [tables.period, rollups.periods], [tables.kpi, rollups.kpis], [tables.channel, rollups.channels],
    [tables.channelCapacity, rollups.capacities], [tables.channelBusiness, rollups.channelBusinesses],
  ]
  for (const [table, rows] of allRows) await insertRows(conn, table, normalizeRollupRows(table, rows).map((row) => ({ ...row, create_time: timestamp, update_time: timestamp })), columns)
  return { class: targetClass, suffix, ...Object.fromEntries(allRows.map(([table, rows]) => [table, rows.length])) }
}
async function refreshAllClass(conn, cutoffByStrategy, columns) {
  const baseFacts = await allSourceFacts(conn, 't_sr_strategy_period_summary_ap', '升接')
  const stableFacts = await allSourceFacts(conn, 't_sr_strategy_period_summary_ap', '稳')
  const keyFacts = await allSourceFacts(conn, 't_sr_strategy_period_summary_ap_key_audience', '重点客群')
  const facts = [...baseFacts, ...stableFacts, ...keyFacts]
  const baseBusiness = await allSourceBusinesses(conn, 't_sr_strategy_biz_capacity', '升接')
  const stableBusiness = await allSourceBusinesses(conn, 't_sr_strategy_biz_capacity', '稳')
  const keyBusiness = await allSourceBusinesses(conn, 't_sr_strategy_biz_capacity_key_audience', '重点客群')
  const businesses = [...baseBusiness, ...stableBusiness, ...keyBusiness]
  const rollups = summaryRows(facts, businesses, '全部', 'active', cutoffByStrategy, null)
  const tables = tableNames('')
  for (const [table, where] of [
    [tables.period, "tab_type='active' AND strategy_class='全部' AND city_id='999' AND strategy_id='999'"],
    [tables.kpi, "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
    [tables.channel, "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
    [tables.channelCapacity, "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
    [tables.channelBusiness, "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
  ]) await conn.query(`UPDATE ?? SET is_deleted=1 WHERE ${where}`, [table])
  const timestamp = new Date()
  for (const [table, rows] of [[tables.period, rollups.periods], [tables.kpi, rollups.kpis], [tables.channel, rollups.channels], [tables.channelCapacity, rollups.capacities], [tables.channelBusiness, rollups.channelBusinesses]]) {
    await insertRows(conn, table, normalizeRollupRows(table, rows).map((row) => ({ ...row, strategy_class: '全部', create_time: timestamp, update_time: timestamp })), columns)
  }
  return { class: '全部', suffix: '', rollupRows: rollups.periods.length }
}

async function prepareBusinessComparisons(conn, datasets, histories, detailsByFile) {
  for (const dataset of datasets) {
    const ids = dataset.masters.map((row) => row.strategy_code)
    const [existing] = await conn.query(
      "SELECT strategy_id,biz_code,biz_name,stat_date,count FROM ?? WHERE tab_type='active' AND city_id=? AND strategy_id IN (?) AND stat_date>=? AND stat_date<? AND is_deleted=0",
      [dataset.tables.business, CITY_ID, ids, `${BASELINE_MONTH}-01`, MONTH_START],
    )
    const monthValues = new Map(existing.map((row) => [stableKey([row.strategy_id, row.biz_code, row.biz_name, String(row.stat_date).slice(0, 7)]), Number(row.count)]))
    const historyRows = historicalBusinessDatabaseRows(dataset, histories.get(dataset.sourceFile))
    for (const rows of group(historyRows, (row) => stableKey([row.strategy_id, row.biz_code, row.biz_name])).values()) {
      rows.sort((left, right) => String(left.stat_date).localeCompare(String(right.stat_date)))
      for (const row of rows) {
        const month = String(row.stat_date).slice(0, 7)
        const key = (targetMonth) => stableKey([row.strategy_id, row.biz_code, row.biz_name, targetMonth])
        const prior = monthValues.get(key(previousMonth(month)))
        row.mom_ratio = prior == null || prior === 0 ? null : round2((Number(row.count) - prior) * 100 / prior)
        monthValues.set(key(month), Number(row.count))
      }
    }
    for (const row of detailsByFile.get(dataset.sourceFile).businessRows) {
      const month = String(row.stat_date).slice(0, 7)
      const prior = monthValues.get(stableKey([row.strategy_id, row.biz_code, row.biz_name, previousMonth(month)]))
      row.mom_ratio = prior == null || prior === 0
        ? null
        : round2((Number(row.count) * dayCount(previousMonth(month)) / dataset.cutoff - prior) * 100 / prior)
    }
    detailsByFile.get(dataset.sourceFile).historicalBusinessRows = historyRows
  }
}

function sourceMonthRows(dataset, history) {
  const facts = [...dataset.facts]
  const businesses = dataset.businesses.map((row) => ({ ...row, strategy_class: dataset.strategyClass, tab_type: 'active', city_id: CITY_ID, county_id: null, is_deleted: 0 }))
  const reasons = dataset.reasons.map((row) => ({ ...row, strategy_class: dataset.strategyClass, tab_type: 'active', city_id: CITY_ID, county_id: null, is_deleted: 0 }))
  if (history) {
    facts.push(...history.facts)
    businesses.push(...history.businesses)
    reasons.push(...history.reasons)
  }
  return { facts, businesses, reasons }
}

function manifestUpdates(datasets, dailyRows, histories) {
  const activeDir = path.join(ROOT, 'front/src/views/strategyReview/active')
  const updates = []
  for (const dataset of datasets) {
    const ids = dataset.masters.map((row) => row.strategy_code)
    const common = {
      tabType: 'active', strategyClass: dataset.strategyClass, cityId: CITY_ID,
      countyId: dataset.countyId,
      sourceMonth: SOURCE_MONTH, sourceCutoff: dataset.cutoffDate,
      dailyStartDate: `${SOURCE_MONTH}-01`, dailyEndDate: dataset.cutoffDate,
      dailyDays: dataset.cutoff,
      dailyRowCount: dataset.facts.length * dataset.cutoff,
      dailyIsSimulated: dataset.mode !== 'sourceDaily',
      dailyMethod: dataset.mode === 'sourceDaily'
        ? '日明细按 Excel 逐日记录原样导入；月度指标按 Excel 月度行保留，两种来源不相互分摊或调整。'
        : dataset.mode === 'dailyWeights'
        ? 'Excel“2_执行数据”的逐日数值作为分日权重；按月行总量用最大余数法拆分并按逐日上限校验漏斗。无月行策略按可加总的日报指标汇总生成月事实。日数据为模拟分摊，不代表实际逐日业绩。'
        : dataset.mode === 'sourceWeights'
        ? 'Excel 分日比例按截至日重新归一化后进行最大余数拆分；为模拟分摊，不代表实际逐日业绩。'
        : dataset.mode === 'leave'
          ? '按 Excel“分日展示”中查码、反向、停机回捞各自的指标权重拆分；逐策略每日严格递减，月度差额不足时仅下调模拟日指标；为模拟分摊，不代表实际逐日业绩。'
          : dataset.mode === 'keyAudience'
            ? '客群及触点汇总转化率围绕来源月波动 ±2 个百分点；每条策略的每日推送量围绕自身日均波动 ±10%；逐日整数分配后保留来源月合计；模拟分摊，不代表实际逐日业绩。'
          : dataset.mode === 'weekday'
            ? '工作日权重1.0、周末权重0.65；使用最大余数法并按逐日上限分配；为模拟分摊，不代表实际逐日业绩。'
            : '按固定种子生成有波动的每日权重，使用最大余数法；适用时按逐日上限分配；为模拟分摊，不代表实际逐日业绩。',
      dailyRuleSource: dataset.mode === 'sourceWeights'
        ? 'Excel分日权重按10月1日至截至日范围重新归一化'
        : dataset.mode === 'sourceDaily'
          ? 'Excel“2_执行数据”中 period_type=日 的逐日记录'
        : dataset.mode === 'dailyWeights'
          ? 'Excel“2_执行数据”中的逐日数值按策略/指标作为权重；保留源文件缓存值，不重算辅助RAND公式'
        : dataset.mode === 'weekday'
          ? '工作日/周末固定权重（1.0/0.65）'
          : dataset.mode === 'keyAudience'
            ? '用户指定：客群及触点汇总日转化率 ±2pp、逐策略日推送量 ±10%；精确保持来源月合计'
          : dataset.mode === 'leave'
            ? 'Excel“分日展示”中的业务分类/指标权重；来源公式读取已保存缓存值，不重算随机公式；逐策略日漏斗严格递减，必要时最小下调模拟日明细'
            : '固定种子生成有波动的日权重',
      dailyConversionRateVariancePp: dataset.mode === 'keyAudience' ? 2 : null,
      dailyPushRelativeVariance: dataset.mode === 'keyAudience' ? 0.10 : null,
      dailyVariationScope: dataset.mode === 'keyAudience' ? '客群及触点汇总转化率；逐策略推送量' : null,
      dailySimulationMonths: dataset.mode === 'keyAudience' ? [SOURCE_MONTH] : undefined,
      dailyRuleSourceSha256: dataset.sourceSha256,
      dailyStrategyIds: [...new Set(dataset.facts.map((row) => row.strategy_id))],
      sourceFile: dataset.sourceFile, sourceSha256: dataset.sourceSha256,
      sourceRows: { strategies: dataset.strategyClass === '降拆' ? 47 : dataset.masters.length,
        strategyArchive: dataset.sourceArchiveRows ?? dataset.masters.length,
        monthly: dataset.sourceMonthlyRowCount ?? dataset.facts.length,
        sourceMonthFacts: dataset.facts.length,
        monthlyDerivedFromDaily: dataset.sourceMonthlyDerivedMetrics?.length || 0,
        daily: dataset.sourceDailyRows?.length || 0,
        businesses: dataset.businesses.length, rejectReasons: dataset.sourceRejectRows,
        mappedRejectReasons: dataset.reasons.length },
      sourceMonthlyDailyMismatchCount: dataset.sourceDailyReconciliation?.length || 0,
      sourceDailyReconciliation: dataset.sourceDailyReconciliation || [],
      dailyWeightSummary: dataset.sourceDailyWeightSummary || [],
      sourceMonthlyDerivedMetrics: dataset.sourceMonthlyDerivedMetrics || [],
    }
    if (dataset.strategyClass === '降拆') {
      common.fieldMappingVersion = 3
      common.strategiesPerMonth = 47
      common.sourceStrategies = 47
      common.sourceStrategyArchiveRows = dataset.masters.length
      common.sourceMonthlyRows = dataset.facts.length
      common.sourceRejectRows = dataset.sourceRejectRows
      common.mappedRejectRows = dataset.reasons.length
      common.missingDispatchRows = dataset.facts.filter((row) => row.sourceChannel !== '省级-在线' && row.sourceChannel !== '市级-营服' && row.target_conv_num == null).length
      if (SOURCE_ONLY) {
        common.startMonth = SOURCE_MONTH
        common.endMonth = SOURCE_MONTH
        common.baselineMonth = null
        common.baselineSimulated = false
        common.monthlySimulationMonths = []
        common.monthlySimulationRule = null
        common.historyStatus = 'pending-rule-clarification'
        common.method = `${SOURCE_MONTH} 保留 ${dataset.sourceFile} 月度原值；历史规则待确认。`
      }
    }
    if (dataset.strategyClass === '离') {
      common.strategiesPerMonth = dataset.masters.length
      common.sourceStrategies = dataset.masters.length
      common.sourceStrategyArchiveRows = dataset.masters.length
      common.sourceMonthlyRows = dataset.facts.length
      common.monthlyMoMRange = '-5%..5%'
      common.monthlySimulationRule = '2025-12 至 2026-09 每条策略的推送量、使用量、触达量、全产品成功量环比控制在 -5% 至 +5%；9月按10月Excel截至21日折算为整月进行锚定；10月月事实保持Excel实值。'
      common.method = REPLACE_LEAVE
        ? `${HISTORY_MONTHS[0]} 至 ${HISTORY_MONTHS.at(-1)} 按本次 Excel 策略集合重建模拟月事实；${SOURCE_MONTH} 以 ${dataset.sourceFile} 中的月事实替换。`
        : `保留已有模拟历史；${SOURCE_MONTH} 以 ${dataset.sourceFile} 中的月事实替换。`
    }
    common.customerGroups = dataset.customerGroups
    common.customerGroup = dataset.customerGroups.length === 1 ? dataset.customerGroups[0] : null
    const history = histories.get(dataset.sourceFile)
    if (history?.facts.length) {
      common.startMonth = `${SOURCE_YEAR}-01`
      common.endMonth = HISTORY_MONTHS.at(-1)
      common.baselineMonth = BASELINE_MONTH
      common.baselineSimulated = true
      common.monthlySimulationMonths = dataset.strategyClass === '稳'
        ? HISTORY_MONTHS.filter((month) => month !== BASELINE_MONTH)
        : HISTORY_MONTHS
      if (dataset.strategyClass === '降拆' && REPLACE_DECLINE) {
        common.monthlySimulationRule = '按数量基准分配模拟：整体/在线/到厅咨询180万/133万/50万，整体/在线/到厅成功142万/95万/24万，营服接单/成功30万/30万，面客接单/成功7万/4万；在线派单率以22%为基准按月波动，营服派单率以32%为基准逐月增长3%。成功率按成功量÷对应咨询量或接单量计算；10月Excel实值保留，整体10月环比按-2%锚定9月。'
      }
    }
    const filename = dataset.strategyClass === '稳' ? 'stableSimulation.json'
      : dataset.strategyClass === '升接' ? 'upgradeSimulation.json'
      : dataset.strategyClass === '重点客群' && dataset.customerGroup === '拆弹客户' ? 'customerGroupSimulation.json'
        : dataset.strategyClass === '重点客群' && dataset.customerGroup === '异网分流客户' ? 'networkDiversionSimulation.json'
          : dataset.strategyClass === '重点客群' && dataset.customerGroup === '超套客户' ? 'overageSimulation.json'
          : dataset.strategyClass === '重点客群' && dataset.customerGroup === '老旧资费客户' ? 'oldTariffSimulation.json'
            : dataset.strategyClass === '重点客群' && dataset.customerGroup === '零低流量客户' ? 'zeroLowFlowSimulation.json'
              : dataset.strategyClass === '离' ? 'leaveSimulation.json' : 'declineSimulation.json'
    const existingPath = path.join(activeDir, filename)
    const prior = fs.existsSync(existingPath) ? JSON.parse(fs.readFileSync(existingPath, 'utf8')) : {}
    if (dataset.mode === 'dailyWeights' && dataset.strategyClass === '升接') {
      const dailyStrategies = new Set(dataset.sourceDailyRows.map((row) => row.strategy_id))
      const derivedStrategies = new Set((dataset.sourceMonthlyDerivedMetrics || []).map((row) => row.strategyId))
      const currentSource = {
        sourceFile: dataset.sourceFile, sourceSha256: dataset.sourceSha256,
        sourceMonth: SOURCE_MONTH, sourceCutoff: dataset.cutoffDate,
        dailyIsSimulated: true, dailyWeightMode: true,
        counts: {
          strategies: dataset.sourceArchiveRows,
          matchedStrategies: dataset.masters.length,
          monthlyFacts: dataset.facts.length,
          sourceMonthlyRows: dataset.sourceMonthlyRowCount,
          dailyRows: dataset.sourceDailyRows.length,
          dailyStrategies: dailyStrategies.size,
          archiveOnlyStrategies: dataset.masters.length - dailyStrategies.size,
          dailyOnlyStrategies: derivedStrategies.size,
          businessRows: dataset.businesses.length,
          rejectReasonRows: dataset.sourceRejectRows,
        },
        strategyNameIdentity: 'strategy_name',
        strategyNameMappingCount: dataset.sourceNameMappings.length,
        sourceMonthlyDailyComparison: { compared: 0, mismatchCount: 0, examples: [],
          method: '逐日数值作为权重重新分摊；月行作为总量锚点，不将原始日值当作实绩。' },
        dailyWeightSummary: dataset.sourceDailyWeightSummary,
        derivedMonthlyStrategyIds: [...derivedStrategies],
      }
      common.supplementalSources = [
        ...(prior.supplementalSources || []).filter((item) => item.sourceFile !== dataset.sourceFile),
        currentSource,
      ]
      common.supplementalSources.at(-1).counts.monthlySourceStrategies = dataset.sourceMonthlyStrategyIds.length
    }
    const payload = REPLACE_KEY_AUDIENCE ? { ...common } : { ...prior, ...common }
    if (prior.dailyStartDate && prior.dailyStartDate < common.dailyStartDate && !(REPLACE_CLASS && dataset.strategyClass === REPLACE_CLASS)) payload.dailyStartDate = prior.dailyStartDate
    if (prior.dailySimulationMonths && dataset.customerGroup === '拆弹客户' && !(REPLACE_CLASS && dataset.strategyClass === REPLACE_CLASS)) {
      payload.dailySimulationMonths = [...new Set([...prior.dailySimulationMonths, SOURCE_MONTH])]
    }
    updates.push({ path: existingPath, payload })
  }
  return updates
}

async function main() {
  assert(isLoopback(HOST), '导入程序仅允许连接本机数据库')
  assert(DATABASE === 'strategy_review_active_class_local', '导入程序仅允许 strategy_review_active_class_local')
  assert([ONLY_UPGRADE, ONLY_STABLE, ONLY_DECLINE, ONLY_LEAVE, ONLY_KEY_AUDIENCE].filter(Boolean).length <= 1,
    '不能同时指定多个 --only-* 分类')
  assert([REPLACE_DECLINE, REPLACE_LEAVE, REPLACE_KEY_AUDIENCE].filter(Boolean).length <= 1,
    '不能同时替换多个分类')
  assert(!REPLACE_CLASS || ONLY_CLASS === REPLACE_CLASS, '整类替换必须同时指定相同分类的 --only-* 参数')
  assert(!MATCH_STRATEGY_NAME || ONLY_CLASS === '升接', '--match-strategy-name 仅用于升接分类')
  assert(!REPLACE_DECLINE || SOURCE_ONLY, 'V3历史规则的数量、成功率和关键月份约束存在冲突；待确认优先级后生成历史。当前可用 --source-only 导入10月原值。')
  assert(!REPLACE_KEY_AUDIENCE || !SOURCE_ONLY, '重点客群整类替换需要同时生成模拟历史')
  assert(fs.existsSync(SOURCE_DIR), `来源目录不存在：${SOURCE_DIR}`)
  const extracted = extractWorkbooks(SOURCE_DIR)
  const allWorkbookConfigs = extracted.workbooks.map((workbook) => ({ workbook, config: sourceConfig(workbook) }))
  const workbookConfigs = ONLY_CLASS
    ? allWorkbookConfigs.filter((item) => item.config && item.config.strategyClass === ONLY_CLASS)
    : allWorkbookConfigs
  if (!ONLY_CLASS) assert(allWorkbookConfigs.every((item) => item.config), `来源中有无法识别的 Excel：${allWorkbookConfigs.filter((item) => !item.config).map((item) => item.workbook.sourceFile).join(', ')}`)
  if (ONLY_CLASS === '重点客群') assert(workbookConfigs.length === KEY_AUDIENCE_SOURCE_FILES.length,
    `重点客群模式需要 ${KEY_AUDIENCE_SOURCE_FILES.length} 个来源 Excel，实际 ${workbookConfigs.length}`)
  else if (ONLY_CLASS) assert(workbookConfigs.length === 1, `仅${ONLY_CLASS}模式要求恰好 1 个来源 Excel，实际 ${workbookConfigs.length}`)
  else assert(workbookConfigs.length === 7, `预期 7 个来源 Excel，实际 ${workbookConfigs.length}`)
  if (REPLACE_KEY_AUDIENCE) {
    const actual = workbookConfigs.map((item) => item.workbook.sourceFile).sort()
    const expected = [...KEY_AUDIENCE_SOURCE_FILES].sort()
    assert(JSON.stringify(actual) === JSON.stringify(expected),
      `整类替换来源必须恰好是指定的五份重点客群模板；实际：${actual.join('、')}`)
  }
  const names = workbookConfigs.map((item) => item.config.displayName)
  assert(new Set(names).size === workbookConfigs.length, `来源文件映射重复：${names.join(',')}`)
  const outDir = path.join(ROOT, 'outputs', `review-folder-${SOURCE_MONTH}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'source-extract.json'), JSON.stringify(extracted, null, 2), 'utf8')

  const conn = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE, dateStrings: true, decimalNumbers: true, charset: 'utf8mb4' })
  let transaction = false
  try {
    const [[identity]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    assert(identity.db === DATABASE && isLoopback(HOST), `当前数据库不匹配：${JSON.stringify(identity)}`)
    const targetStrategyClasses = [...new Set(workbookConfigs.map(({ config }) => config.strategyClass))]
    const dictionaries = await prepareDictionaries(conn, targetStrategyClasses)
    const [existingStrategies] = MATCH_STRATEGY_NAME
      ? await conn.query("SELECT * FROM t_sr_strategy WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0", [ONLY_CLASS, CITY_ID])
      : [[]]
    const mappedDatasets = workbookConfigs.map(({ workbook, config }) => mapDataset(workbook, config, dictionaries, existingStrategies))
    const datasets = mappedDatasets
    if (ONLY_CLASS === '重点客群') assert(datasets.length === KEY_AUDIENCE_SOURCE_FILES.length && datasets.every((dataset) => dataset.strategyClass === ONLY_CLASS),
      `重点客群模式需要 ${KEY_AUDIENCE_SOURCE_FILES.length} 个重点客群 Excel`)
    else if (ONLY_CLASS) assert(datasets.length === 1 && datasets[0].strategyClass === ONLY_CLASS, `仅${ONLY_CLASS}模式要求恰好有 1 个${ONLY_CLASS} Excel`)
    const cutoffByStrategy = new Map(datasets.flatMap((dataset) => dataset.masters.map((row) => [row.strategy_code, dataset.cutoff])))
    for (const [dailyTable, dateColumn, strategyClasses] of [
      ['t_sr_strategy_daily_ap', 'stat_month', ['升接', '稳']],
      ['t_sr_strategy_daily_ap_key_audience', 'stat_date', ['重点客群']],
    ]) {
      const [dailyCutoffs] = await conn.query(
        'SELECT strategy_id,MAX(DAY(??)) AS cutoff_day FROM ?? WHERE tab_type=\'active\' AND strategy_class IN (?) AND city_id=? AND is_deleted=0 AND ?? >=? AND ?? <? GROUP BY strategy_id',
        [dateColumn, dailyTable, strategyClasses, CITY_ID, dateColumn, MONTH_START, dateColumn, NEXT_MONTH],
      )
      for (const row of dailyCutoffs) {
        if (!cutoffByStrategy.has(row.strategy_id)) cutoffByStrategy.set(row.strategy_id, Number(row.cutoff_day))
      }
    }
    const allCodes = datasets.flatMap((dataset) => dataset.masters.map((row) => row.strategy_code))
    assert(new Set(allCodes).size === allCodes.length, '不同 Excel 的策略编码重复')

    const allMasterTables = ['t_sr_strategy', 't_sr_strategy_special', 't_sr_strategy_key_audience']
    const codePlaceholders = allCodes.map(() => '?').join(',')
    const conflicts = []
    for (const table of allMasterTables) {
      const [rows] = await conn.query(`SELECT strategy_code,tab_type,strategy_class,is_deleted FROM ?? WHERE strategy_code IN (${codePlaceholders}) AND is_deleted=0`, [table, ...allCodes])
      for (const row of rows) {
        const target = datasets.find((dataset) => dataset.masters.some((master) => master.strategy_code === row.strategy_code))
        if (target && target.tables.master !== table) conflicts.push({ ...row, targetTable: target.tables.master })
        else if (target && row.tab_type !== 'active') conflicts.push({ ...row, targetTable: target.tables.master })
        else if (target && row.strategy_class && row.strategy_class !== target.strategyClass) conflicts.push({ ...row, targetTable: target.tables.master })
      }
    }
    assert(!conflicts.length, `策略编码已归属其他页签/表，拒绝覆盖：${JSON.stringify(conflicts.slice(0, 20))}`)

    let oldClassCodes = []
    if (REPLACE_CLASS) {
      const oldTables = tableNames(suffixForClass(REPLACE_CLASS))
      const [oldMasters] = await conn.query(
        'SELECT DISTINCT strategy_code FROM ?? WHERE strategy_class=? AND strategy_code IS NOT NULL',
        [oldTables.master, REPLACE_CLASS],
      )
      const [oldFacts] = await conn.query(
        "SELECT DISTINCT strategy_id FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND strategy_id<>'999'",
        [oldTables.period, REPLACE_CLASS, CITY_ID],
      )
      const [oldDaily] = await conn.query(
        "SELECT DISTINCT strategy_id FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=?",
        [oldTables.daily, REPLACE_CLASS, CITY_ID],
      )
      const [oldBusiness] = await conn.query(
        "SELECT DISTINCT b.strategy_id FROM ?? b JOIN ?? s ON s.strategy_code=b.strategy_id AND s.tab_type='active' WHERE s.strategy_class=? AND b.city_id=? AND b.strategy_id IS NOT NULL",
        [oldTables.business, oldTables.master, REPLACE_CLASS, CITY_ID],
      )
      const [oldReasons] = await conn.query(
        "SELECT DISTINCT r.strategy_id FROM ?? r JOIN ?? s ON s.strategy_code=r.strategy_id AND s.tab_type='active' WHERE s.strategy_class=? AND r.city_id=? AND r.strategy_id IS NOT NULL",
        [oldTables.reject, oldTables.master, REPLACE_CLASS, CITY_ID],
      )
      oldClassCodes = [...new Set([
        ...oldMasters.map((row) => row.strategy_code),
        ...oldFacts.map((row) => row.strategy_id),
        ...oldDaily.map((row) => row.strategy_id),
        ...oldBusiness.map((row) => row.strategy_id),
        ...oldReasons.map((row) => row.strategy_id),
      ].filter(Boolean))]
    }

    const historyByFile = new Map()
    const dailyRows = []
    const tableColumnCache = new Map()
    for (const dataset of datasets) {
      const ids = dataset.masters.map((row) => row.strategy_code)
      const [currentScopeRows] = await conn.query(
        'SELECT DISTINCT county_id FROM ?? WHERE tab_type=\'active\' AND city_id=? AND strategy_id IN (?) AND stat_month=? AND is_deleted=0',
        [dataset.tables.period, CITY_ID, ids, MONTH_START],
      )
      assert(currentScopeRows.length <= 1, `${dataset.sourceFile} 现有10月数据使用多个 county_id，无法安全替换`)
      dataset.countyId = currentScopeRows.length ? currentScopeRows[0].county_id : dataset.strategyClass === '降拆' ? '999' : null
      for (const fact of dataset.facts) fact.county_id = dataset.countyId
      const [priorRows] = await conn.query(
        'SELECT strategy_id,stat_month FROM ?? WHERE tab_type=\'active\' AND city_id=? AND strategy_id IN (?) AND stat_month<? AND is_deleted=0 AND strategy_id<>\'999\' AND channel<>\'全部\' AND big_category<>\'全部\' AND small_category<>\'全部\'',
        [dataset.tables.period, CITY_ID, ids, MONTH_START],
      )
      const priorIds = new Set(priorRows.map((row) => row.strategy_id))
      const history = simulateHistory(dataset,
        REPLACE_CLASS && dataset.strategyClass === REPLACE_CLASS ? new Set() : priorIds)
      historyByFile.set(dataset.sourceFile, history)
      const datasetDaily = buildDaily(dataset)
      const aggregateAdjustments = balanceStrictDailyFunnel(dataset, datasetDaily)
      dataset.dailyFunnelAdjustments = aggregateAdjustments + Object.values(dataset.dailyFunnelReductions || {}).reduce((sum, value) => sum + Number(value || 0), 0)
      verifyDailySplit(dataset, dataset.facts, datasetDaily)
      dataset.dailyFunnelGroups = verifyDailyFunnel(dataset, datasetDaily)
      dailyRows.push(...datasetDaily)
      for (const table of Object.values(dataset.tables)) tableColumnCache.set(table, await tableColumns(conn, table))
    }
    const keyAudienceDailyRateAdjustments = balanceKeyAudienceDailyConversionRates(datasets, dailyRows)
    for (const dataset of datasets) {
      const ids = new Set(dataset.masters.map((master) => master.strategy_code))
      verifyDailySplit(dataset, dataset.facts, dailyRows.filter((row) => ids.has(row.strategy_id)))
    }
    const keyAudienceDailyVariationVerification = verifyKeyAudienceDailyVariability(datasets, dailyRows)
    for (const table of [...Object.values(tableNames('')), ...Object.values(tableNames('_special')), ...Object.values(tableNames('_key_audience'))]) {
      if (!tableColumnCache.has(table)) tableColumnCache.set(table, await tableColumns(conn, table))
    }
    const allRows = datasets.map((dataset) => ({ dataset, ...sourceMonthRows(dataset, historyByFile.get(dataset.sourceFile)) }))
    const detailsForInsert = new Map()
    for (const { dataset, businesses, reasons } of allRows) {
      const businessRows = detailDatabaseRows(dataset, dataset.businesses, 'business')
      const reasonRows = detailDatabaseRows(dataset, dataset.reasons, 'reject')
      detailsForInsert.set(dataset.sourceFile, { businessRows, reasonRows })
    }
    await prepareBusinessComparisons(conn, datasets, historyByFile, detailsForInsert)
    for (const dataset of datasets) {
      const table = dataset.tables
      const history = historyByFile.get(dataset.sourceFile)
      const detail = detailsForInsert.get(dataset.sourceFile)
      validateRows(table.master, dataset.masters, tableColumnCache.get(table.master))
      validateRows(table.period, [...dataset.facts, ...history.facts], tableColumnCache.get(table.period))
      validateRows(table.daily, dailyRows.filter((row) => dataset.masters.some((master) => master.strategy_code === row.strategy_id)), tableColumnCache.get(table.daily))
      validateRows(table.business, [...detail.historicalBusinessRows, ...detail.businessRows], tableColumnCache.get(table.business))
      validateRows(table.reject, [...historicalReasonDatabaseRows(dataset, history), ...detail.reasonRows], tableColumnCache.get(table.reject))
    }

    const output = outputSummary(datasets, historyByFile, dailyRows)
    output.dailyVariationVerification = keyAudienceDailyVariationVerification
    output.dailyRateAdjustments = keyAudienceDailyRateAdjustments
    output.ignoredWorkbooks = allWorkbookConfigs.filter((item) => !workbookConfigs.includes(item)).map((item) => item.workbook.sourceFile)
    output.addedChannels = dictionaries.newChannels
    output.mappings = dictionaries.mappings
    output.previewPath = path.join(outDir, 'prepared-review-import.json')
    const prepared = {
      output,
      datasets: datasets.map((dataset) => ({
        ...dataset,
        masters: dataset.masters,
        facts: dataset.facts,
        businesses: dataset.businesses,
        reasons: dataset.reasons,
        history: historyByFile.get(dataset.sourceFile),
        dailyRows: dailyRows.filter((row) => dataset.facts.some((fact) => fact.strategy_id === row.strategy_id)),
        detailRows: detailsForInsert.get(dataset.sourceFile),
      })),
    }
    fs.writeFileSync(path.join(outDir, 'prepared-review-import.json'), JSON.stringify(prepared, null, 2), 'utf8')
    if (!APPLY) {
      console.log(JSON.stringify({ ...output, dryRun: true, outputDirectory: outDir }, null, 2))
      return
    }

    const refreshScopes = {}
    const affectedClassTables = ONLY_CLASS
      ? [[ONLY_CLASS, suffixForClass(ONLY_CLASS)]]
      : [['升接', ''], ['稳', ''], ['重点客群', '_key_audience'], ['离', '_special'], ['降拆', '_special']]
    for (const [strategyClass, suffix] of affectedClassTables) {
      for (const [table, where, values] of rollupRefreshWhere(strategyClass, suffix)) {
        if (!refreshScopes[table]) refreshScopes[table] = []
        refreshScopes[table].push({ sql: where, values })
      }
    }
    for (const [table, where] of [
      ['t_sr_strategy_period_summary_ap', "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
      ['t_sr_kpi_summary', "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
      ['t_sr_channel_summary_ap', "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
      ['t_sr_channel_monthly_capacity_ap', "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
      ['t_sr_channel_biz_capacity_ap', "tab_type='active' AND strategy_class='全部' AND city_id='999'"],
    ]) {
      if (!refreshScopes[table]) refreshScopes[table] = []
      refreshScopes[table].push({ sql: where, values: [] })
    }
    const replaceTables = REPLACE_CLASS ? tableNames(suffixForClass(REPLACE_CLASS)) : null
    const replaceCodes = [...new Set([
      ...oldClassCodes,
      ...datasets.flatMap((dataset) => dataset.strategyClass === REPLACE_CLASS ? dataset.masters.map((row) => row.strategy_code) : []),
    ])]
    const extraCodesByTable = REPLACE_CLASS ? Object.fromEntries(
      [replaceTables.master, replaceTables.period, replaceTables.daily, replaceTables.business, replaceTables.reject]
        .map((table) => [table, oldClassCodes]),
    ) : {}
    const backupPath = await backupTables(conn, datasets, refreshScopes, outDir, extraCodesByTable)
    output.backupPath = backupPath
    fs.writeFileSync(path.join(outDir, 'prepared-review-import.json'), JSON.stringify(prepared, null, 2), 'utf8')
    console.error(`[导入] 备份完成：${backupPath}`)

    await conn.beginTransaction(); transaction = true
    console.error('[导入] 写入策略档案、月事实、明细和日分摊')
    for (const channel of dictionaries.newChannels) await insertRows(conn, 't_sr_dim_channel', [channel], tableColumnCache)

    if (REPLACE_CLASS) {
      console.error(`[导入] 逻辑删除旧${REPLACE_CLASS}数据 ${oldClassCodes.length} 个策略编码，并从本次 Excel 重建历史`)
      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class=? AND is_deleted=0", [replaceTables.master, REPLACE_CLASS])
      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0", [replaceTables.period, REPLACE_CLASS, CITY_ID])
      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0", [replaceTables.daily, REPLACE_CLASS, CITY_ID])
      if (replaceCodes.length) {
        await conn.query('UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE city_id=? AND strategy_id IN (?) AND is_deleted=0', [replaceTables.business, CITY_ID, replaceCodes])
        await conn.query('UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE city_id=? AND strategy_id IN (?) AND is_deleted=0', [replaceTables.reject, CITY_ID, replaceCodes])
      }
    }

    for (const { dataset, facts, businesses, reasons } of allRows) {
      console.error(`[导入] ${dataset.sourceFile}`)
      const table = dataset.tables
      const ids = dataset.masters.map((row) => row.strategy_code)
      for (const master of dataset.masters) {
        const [old] = await conn.query('SELECT id,is_deleted FROM ?? WHERE strategy_code=? AND tab_type=\'active\' ORDER BY id', [table.master, master.strategy_code])
        if (old.length) {
          const keepId = old.find((row) => Number(row.is_deleted) === 0)?.id || old[old.length - 1].id
          const fields = Object.keys(master).filter((key) => key !== 'id')
          const assignments = fields.map(() => '??=?').join(',')
          const parameters = fields.flatMap((key) => [key, master[key]])
          await conn.query('UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE strategy_code=? AND tab_type=\'active\'', [table.master, master.strategy_code])
          await conn.query(`UPDATE ?? SET ${assignments},is_deleted=0,update_time=NOW() WHERE id=?`, [table.master, ...parameters, keepId])
        } else await insertRows(conn, table.master, [{ ...master, create_time: new Date(), update_time: new Date() }], tableColumnCache)
      }

      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND city_id=? AND strategy_id IN (?) AND stat_month>=? AND stat_month<? AND is_deleted=0", [table.period, CITY_ID, ids, MONTH_START, NEXT_MONTH])
      const dailyColumns = tableColumnCache.get(table.daily)
      const dailyDateColumn = dailyColumns.has('stat_date') ? 'stat_date' : 'stat_month'
      await conn.query("UPDATE ?? SET is_deleted=1 WHERE tab_type='active' AND city_id=? AND strategy_id IN (?) AND ??>=? AND ??<=? AND is_deleted=0", [table.daily, CITY_ID, ids, dailyDateColumn, MONTH_START, dailyDateColumn, MONTH_END])
      const businessDateColumn = (tableColumnCache.get(table.business).has('stat_date')) ? 'stat_date' : 'stat_month'
      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE tab_type='active' AND city_id=? AND strategy_id IN (?) AND ??>=? AND ??<? AND is_deleted=0", [table.business, CITY_ID, ids, businessDateColumn, MONTH_START, businessDateColumn, NEXT_MONTH])
      await conn.query("UPDATE ?? SET is_deleted=1,update_time=NOW() WHERE city_id=? AND strategy_id IN (?) AND stat_month>=? AND stat_month<? AND is_deleted=0", [table.reject, CITY_ID, ids, MONTH_START, NEXT_MONTH])

      // sourceMonthRows() returns source facts plus the simulated history for
      // rollup preparation. Insert the source month separately here because
      // historicalRows is appended explicitly below.
      const sourceRows = dataset.facts.map((row) => stripInternal(row))
      const historicalRows = historyByFile.get(dataset.sourceFile).facts.map((row) => stripInternal(row))
      await insertRows(conn, table.period, [...historicalRows, ...sourceRows].map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })), tableColumnCache)
      const detail = detailsForInsert.get(dataset.sourceFile)
      const historicalBusinessRows = detail.historicalBusinessRows
      await insertRows(conn, table.business, [...historicalBusinessRows, ...detail.businessRows].map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })), tableColumnCache)
      const historicalReasonRows = historicalReasonDatabaseRows(dataset, historyByFile.get(dataset.sourceFile))
      await insertRows(conn, table.reject, [...historicalReasonRows, ...detail.reasonRows].map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })), tableColumnCache)

      const daily = dailyRows.filter((row) => ids.includes(row.strategy_id)).map((row) => stripInternal(row))
      await insertRows(conn, table.daily, daily.map((row) => ({ ...row, create_time: new Date(), update_time: new Date() })), tableColumnCache)
    }

    // Compute source-month and historical row-level QoQ after the new facts are present.
    for (const dataset of datasets) {
      const [facts] = await conn.query("SELECT * FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0 AND strategy_id IN (?) ORDER BY stat_month", [dataset.tables.period, dataset.strategyClass, CITY_ID, dataset.masters.map((row) => row.strategy_code)])
      const byIdentity = group(facts, factIdentity)
      for (const rows of byIdentity.values()) {
        const byMonth = new Map(rows.map((row) => [String(row.stat_month).slice(0, 7), row]))
        for (const row of rows) {
          const month = String(row.stat_month).slice(0, 7)
          if (month < BASELINE_MONTH) continue
          const previous = byMonth.get(previousMonth(month))
          if (!previous) continue
          const currentMetrics = calcMetrics([row])
          const previousMetrics = calcMetrics([previous])
          const partial = month === SOURCE_MONTH ? dataset.cutoff : null
          const diff = compareMetrics(currentMetrics, previousMetrics, partial)
          const keys = Object.keys(diff).filter((key) => tableColumnCache.get(dataset.tables.period).has(key))
          if (keys.length) {
            const assignments = keys.map(() => '??=?').join(',')
            await conn.query(`UPDATE ?? SET ${assignments} WHERE id=?`, [dataset.tables.period, ...keys.flatMap((key) => [key, diff[key]]), row.id])
          }
        }
      }
    }

    const summaryResults = []
    for (const [strategyClass, suffix, factTable, businessTable] of [
      ['升接', '', 't_sr_strategy_period_summary_ap', 't_sr_strategy_biz_capacity'],
      ['稳', '', 't_sr_strategy_period_summary_ap', 't_sr_strategy_biz_capacity'],
      ['重点客群', '_key_audience', 't_sr_strategy_period_summary_ap_key_audience', 't_sr_strategy_biz_capacity_key_audience'],
      ['离', '_special', 't_sr_strategy_period_summary_ap_special', 't_sr_strategy_biz_capacity_special'],
      ['降拆', '_special', 't_sr_strategy_period_summary_ap_special', 't_sr_strategy_biz_capacity_special'],
    ]) {
      if (!datasets.some((dataset) => dataset.strategyClass === strategyClass)) continue
      console.error(`[导入] 重建${strategyClass}汇总`)
      summaryResults.push(await refreshRollups(conn, strategyClass, suffix, factTable, businessTable,
        cutoffByStrategy, tableColumnCache))
    }
    // The active "全部" page aggregates 升接、稳、重点客群. Special classes use their own page tables.
    if (!ONLY_CLASS || ['升接', '稳', '重点客群'].includes(ONLY_CLASS)) {
      summaryResults.push(await refreshAllClass(conn, cutoffByStrategy, tableColumnCache))
    }

    // Check imported source-month facts and the day split before committing.
    const verification = []
    for (const dataset of datasets) {
      const [monthly] = await conn.query("SELECT COUNT(*) n,COUNT(DISTINCT strategy_id) strategies FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND stat_month=? AND strategy_id IN (?) AND is_deleted=0", [dataset.tables.period, dataset.strategyClass, CITY_ID, MONTH_START, dataset.masters.map((row) => row.strategy_code)])
      const [daily] = await conn.query("SELECT COUNT(*) n,COUNT(DISTINCT strategy_id) strategies,MIN(??) first_day,MAX(??) last_day FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND strategy_id IN (?) AND ?? BETWEEN ? AND ? AND is_deleted=0", [tableColumnCache.get(dataset.tables.daily).has('stat_date') ? 'stat_date' : 'stat_month', tableColumnCache.get(dataset.tables.daily).has('stat_date') ? 'stat_date' : 'stat_month', dataset.tables.daily, dataset.strategyClass, CITY_ID, dataset.masters.map((row) => row.strategy_code), tableColumnCache.get(dataset.tables.daily).has('stat_date') ? 'stat_date' : 'stat_month', `${SOURCE_MONTH}-01`, dataset.cutoffDate])
      const expectedDaily = dataset.facts.length * dataset.cutoff
      assert(Number(monthly[0].n) === dataset.facts.length, `${dataset.sourceFile} 月事实记录数校验失败：${monthly[0].n}/${dataset.facts.length}`)
      assert(Number(daily[0].n) === expectedDaily, `${dataset.sourceFile} 日事实记录数校验失败：${daily[0].n}/${expectedDaily}`)
      const expectedDailyStrategies = new Set(dataset.facts.map((row) => row.strategy_id)).size
      assert(Number(daily[0].strategies) === expectedDailyStrategies,
        `${dataset.sourceFile} 日策略数校验失败：${daily[0].strategies}/${expectedDailyStrategies}`)
      assert(daily[0].first_day === `${SOURCE_MONTH}-01` && daily[0].last_day === dataset.cutoffDate, `${dataset.sourceFile} 日表范围不符：${daily[0].first_day}—${daily[0].last_day}`)
      verification.push({ sourceFile: dataset.sourceFile, monthly: monthly[0], daily: daily[0], expectedDaily })
      if (REPLACE_CLASS === dataset.strategyClass) {
        const expectedMonthly = dataset.facts.length + (historyByFile.get(dataset.sourceFile)?.facts.length || 0)
        const [allMonths] = await conn.query(
          "SELECT COUNT(*) n FROM ?? WHERE tab_type='active' AND strategy_class=? AND city_id=? AND is_deleted=0 AND strategy_id IN (?) AND stat_month>=? AND stat_month<?",
          [dataset.tables.period, dataset.strategyClass, CITY_ID, dataset.masters.map((row) => row.strategy_code), `${BASELINE_MONTH}-01`, NEXT_MONTH],
        )
        assert(Number(allMonths[0].n) === expectedMonthly,
          `${dataset.sourceFile} 替换后月事实重复或缺失：${allMonths[0].n}/${expectedMonthly}`)
        verification[verification.length - 1].allMonths = { n: Number(allMonths[0].n), expected: expectedMonthly }
      }
    }
    console.error('[导入] SQL 行数和日期范围核对通过，提交事务')
    await conn.commit(); transaction = false

    const manifestPayloads = manifestUpdates(datasets, dailyRows, historyByFile)
    for (const item of manifestPayloads) fs.writeFileSync(item.path, JSON.stringify(item.payload, null, 2), 'utf8')
    output.dryRun = false
    output.backupPath = backupPath
    output.appliedAt = new Date().toISOString()
    output.verification = verification
    output.rollups = summaryResults
    output.outputDirectory = outDir
    output.resultPath = path.join(outDir, 'import-result.json')
    fs.writeFileSync(output.resultPath, JSON.stringify(output, null, 2), 'utf8')
    console.log(JSON.stringify(output, null, 2))
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
