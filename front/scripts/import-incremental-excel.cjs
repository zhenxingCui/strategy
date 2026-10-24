// One-off local import for the business-provided passive/incremental workbook.
// Backs up the explicitly marked passive seed data before replacing it.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const mysql = require('mysql2/promise')

const input = path.resolve(process.argv[2] || 'outputs/incremental-import-20261023/source.json')
const apply = process.argv.includes('--apply')
const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const out = path.dirname(input)
const database = 'strategy_review_active_class_local'
const CITY = '999'
const TEST_MARK = 'LOCAL_PASSIVE_SEED'
const TEST_OWNER = '本地联调-增量样例'
const month = '2026-10'
const cutoffDay = 21
const round = (n, digits = 2) => n == null ? null : Number(Number(n).toFixed(digits))
const pct = (n, d) => n == null || d == null || Number(d) === 0 ? null : round(Number(n) / Number(d) * 100)
const metricsFields = ['strategy_count', 'original_cust', 'push_count', 'usage_count', 'usage_rate', 'reach_count', 'reach_rate', 'target_conv_num', 'target_conv_rate', 'product_conv_num', 'product_conv_rate', 'expected_income', 'actual_income', 'reject_count', 'reject_rate']
const metricNames = ['策略数', '原始客群', '推送量', '使用量', '使用率', '触达量', '触达率', '目标转化量', '目标转化率', '产品转化量', '产品转化率', '预计收益', '实际收益', '拒绝量', '拒绝率']
const unit = key => key === 'strategy_count' ? '个' : key.endsWith('_rate') ? '%' : key.includes('income') ? '元' : key === 'original_cust' ? '人' : '次'
const ratioFields = new Set(['usage_rate', 'reach_rate', 'target_conv_rate', 'product_conv_rate', 'reject_rate'])
const metricOf = rows => {
  const sum = key => rows.some(r => r[key] == null) ? null : round(rows.reduce((v, r) => v + Number(r[key]), 0))
  const m = { strategy_count: new Set(rows.map(r => r.strategy_id)).size }
  for (const k of ['original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'expected_income', 'actual_income', 'reject_count']) m[k] = sum(k)
  m.usage_rate = pct(m.usage_count, m.push_count); m.reach_rate = pct(m.reach_count, m.usage_count)
  m.target_conv_rate = pct(m.target_conv_num, m.reach_count); m.product_conv_rate = pct(m.product_conv_num, m.reach_count)
  m.reject_rate = pct(m.reject_count, m.push_count)
  return m
}
const qoq = (current, previous, key, partial = false) => {
  if (!previous || current[key] == null || previous[key] == null) return null
  if (ratioFields.has(key)) return round(current[key] - previous[key])
  if (key === 'strategy_count') return round((current[key] - previous[key]) / previous[key] * 100)
  const a = partial ? current[key] * 31 / cutoffDay : current[key]
  return previous[key] === 0 ? null : round((a - previous[key]) / previous[key] * 100)
}
const addQoq = (m, prior, partial = false) => Object.assign({}, m, ...metricsFields.map(k => ({ [`${k}_qoq`]: qoq(m, prior, k, partial) })))
const prevMonth = m => { const [y, n] = m.split('-').map(Number); return new Date(Date.UTC(y, n - 2, 1)).toISOString().slice(0, 7) }
const stable = key => { let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967295 }
const distribute = (total, weights, caps = null) => {
  const values = weights.map(() => 0), remaining = Number(total)
  let left = remaining, open = weights.map((_, i) => i)
  while (left > 0 && open.length) {
    const sum = open.reduce((a, i) => a + weights[i], 0) || open.length
    const exact = open.map(i => ({ i, value: left * (weights[i] || 1) / sum }))
    const room = i => caps ? caps[i] - values[i] : Infinity
    let saturated = false
    for (const x of exact) if (x.value >= room(x.i)) { const n = Math.max(0, room(x.i)); values[x.i] += n; left -= n; open = open.filter(i => i !== x.i); saturated = true; break }
    if (saturated) continue
    for (const x of exact) { const n = Math.floor(x.value); values[x.i] += n; left -= n }
    const order = exact.map(x => ({ i: x.i, frac: x.value - Math.floor(x.value) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
    for (const x of order) if (left > 0 && (!caps || values[x.i] < caps[x.i])) { values[x.i]++; left-- }
    break
  }
  assert.equal(left, 0, `Unable to split ${total} within daily caps`)
  return values
}
const monthDates = (m, days) => Array.from({ length: days }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`)
const dailyWeights = dates => dates.map((d, i) => {
  const weekday = new Date(`${d}T12:00:00+08:00`).getDay()
  return (weekday === 0 ? 0.58 : weekday === 6 ? 0.76 : 1) * ([5, 10, 15, 20, 25].includes(i + 1) ? 1.08 : 1) * (1 + stable(`passive-day:${d}`) * 0.12)
})
const largestRemainder = (rows, field) => {
  const xs = rows.map(r => Number(r[field])), floors = xs.map(Math.floor)
  let left = Math.round(xs.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0)
  const order = xs.map((v, i) => ({ i, f: v - floors[i] })).sort((a, b) => b.f - a.f || a.i - b.i)
  for (let i = 0; i < left; i++) floors[order[i].i]++
  rows.forEach((r, i) => { r[field] = floors[i] })
}
const assertSource = () => {
  assert(source.sha256 && source.strategies.length === 3 && source.execution.length === 3, 'Unexpected workbook source size')
  assert.equal(new Set(source.strategies.map(s => s.strategy_code)).size, 3)
  assert(source.execution.every(r => r.period_type === '月' && r.stat_date === '2026年10月截至21日'), 'Unexpected source period/cutoff')
  assert(source.execution.every(r => source.strategies.some(s => s.strategy_code === r.strategy_code)), 'Execution row has no strategy master')
  assert(source.details.every(r => r.stat_month === '2026年10月截至21日'), 'Unexpected detail period')
}

async function main() {
  assertSource()
  const c = await mysql.createConnection({ host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', database, dateStrings: true, charset: 'utf8mb4' })
  let inTx = false
  try {
    const [mastersExist] = await c.query('SELECT strategy_code,tab_type,owner FROM v_sr_strategy_read WHERE strategy_code IN (?) AND is_deleted=0', [source.strategies.map(x => x.strategy_code)])
    assert.equal(mastersExist.length, 0, 'Source strategy code already exists; refusing cross-tab overwrite')
    const [testOwners] = await c.query("SELECT strategy_code FROM v_sr_strategy_read WHERE tab_type='passive' AND owner<>? AND is_deleted=0", [TEST_OWNER])
    assert.equal(testOwners.length, 0, 'Found non-test passive strategy data; refusing to delete or replace it')

    const [channels] = await c.query("SELECT * FROM t_sr_dim_channel WHERE is_deleted=0")
    const newChannels = []
    const channelCodes = new Map()
    for (const name of [...new Set(source.strategies.map(s => s.channel))]) {
      let row = channels.find(x => x.key_name === name && String(x.tab_type || '').split(',').includes('passive'))
      if (!row) {
        let i = 1, code
        do { code = `PCH${String(i++).padStart(4, '0')}` } while (channels.some(x => x.key_code === code))
        row = { key_code: code, key_name: name, tab_type: 'passive', status: 1, sort_no: 100 + newChannels.length, is_deleted: 0 }
        channels.push(row); newChannels.push(row)
      }
      channelCodes.set(name, row.key_code)
    }
    const bizNames = [...new Set(source.details.filter(r => r.detail_type === '业务产能').map(r => r.item_name))]
    const reasonNames = [...new Set(source.details.filter(r => r.detail_type === '拒绝原因').map(r => r.item_name))]
    const [bizRows] = await c.query('SELECT DISTINCT biz_code code,biz_name name FROM v_sr_strategy_biz_capacity_read WHERE is_deleted=0')
    const [reasonRows] = await c.query('SELECT DISTINCT reason_code code,reason_name name FROM v_sr_strategy_reject_reason_read WHERE is_deleted=0')
    const mappings = { channels: [...channelCodes].map(([name, code]) => ({ name, code })), businesses: [], reasons: [] }
    const resolveCodes = (names, existing, prefix, dest) => names.forEach(name => {
      const matches = [...new Set(existing.filter(x => x.name === name && x.code).map(x => x.code))]
      assert(matches.length <= 1, `Ambiguous existing item code: ${name}`)
      let code = matches[0]
      if (!code) { let i = 1; do { code = `${prefix}${String(i++).padStart(6, '0')}` } while (existing.some(x => x.code === code) || dest.some(x => x.code === code)) }
      dest.push({ name, code })
    })
    resolveCodes(bizNames, bizRows, 'BIZ', mappings.businesses); resolveCodes(reasonNames, reasonRows, 'RSN', mappings.reasons)
    const codeByName = (type, name) => mappings[type].find(x => x.name === name).code

    const common = { city_id: CITY, county_id: null, is_deleted: 0 }
    const masters = source.strategies.map(s => ({ ...common, strategy_code: s.strategy_code, strategy_name: s.strategy_name, tab_type: 'passive', strategy_class: '全部', customer_group: null, product_name: null, channel: channelCodes.get(s.channel), strategy_level: s.strategy_level, caliber: s.caliber, iteration: s.iteration == null ? null : Number(s.iteration), owner: s.owner, status: s.status, start_date: s.start_date, end_date: s.end_date }))
    const masterByCode = new Map(masters.map(x => [x.strategy_code, x]))
    const base = source.execution.map(r => {
      const m = masterByCode.get(r.strategy_code)
      const row = { ...common, tab_type: 'passive', strategy_class: '全部', strategy_id: r.strategy_code, strategy_name: m.strategy_name, channel: channelCodes.get(r.channel), big_category: r.big_category, small_category: r.small_category, stat_month: `${month}-01`, strategy_count: 1, original_cust: null, push_count: Math.round(Number(r.push_count)), usage_count: Math.round(Number(r.usage_count)), reach_count: Math.round(Number(r.reach_count)), target_conv_num: Math.round(Number(r.target_conv_num)), product_conv_num: Math.round(Number(r.target_conv_num)), expected_income: r.actual_income == null ? null : round(r.actual_income), actual_income: r.actual_income == null ? null : round(r.actual_income), reject_count: null }
      row.usage_rate = pct(row.usage_count, row.push_count); row.reach_rate = pct(row.reach_count, row.usage_count); row.target_conv_rate = pct(row.target_conv_num, row.reach_count); row.product_conv_rate = pct(row.product_conv_num, row.reach_count); row.reject_rate = null
      return row
    })
    assert(base.every(r => r.push_count >= r.usage_count && r.usage_count >= r.reach_count && r.reach_count >= r.target_conv_num), 'Source funnel is not monotonic')
    const detailBase = source.details.map(r => ({ strategy_id: r.strategy_code, type: r.detail_type, name: r.item_name, code: codeByName(r.detail_type === '业务产能' ? 'businesses' : 'reasons', r.item_name), count: Number(r.item_count) }))
    for (const code of new Set(detailBase.filter(x => x.type === '业务产能').map(x => x.strategy_id))) largestRemainder(detailBase.filter(x => x.type === '业务产能' && x.strategy_id === code), 'count')
    for (const code of new Set(detailBase.filter(x => x.type === '拒绝原因').map(x => x.strategy_id))) largestRemainder(detailBase.filter(x => x.type === '拒绝原因' && x.strategy_id === code), 'count')
    const businesses = detailBase.filter(x => x.type === '业务产能').map(x => ({ ...common, tab_type: 'passive', strategy_id: x.strategy_id, stat_date: `${month}-01`, biz_code: x.code, biz_name: x.name, count: x.count, mom_ratio: null, yoy_ratio: null }))
    const reasons = []
    for (const id of masters.map(x => x.strategy_code)) {
      const rows = detailBase.filter(x => x.type === '拒绝原因' && x.strategy_id === id), total = rows.reduce((a, x) => a + x.count, 0)
      rows.forEach((x, i) => reasons.push({ ...common, strategy_id: id, stat_month: `${month}-01`, reason_code: x.code, reason_name: x.name, reject_count: x.count, reject_ratio: pct(x.count, total), color: ['#3b82f6', '#5ac4d1', '#a78bfa', '#f6bd60', '#94a3b8'][i % 5], sort_no: i + 1 }))
    }

    // Fixed strategy set, deterministic monthly history through September, plus a December base for January MoM.
    const execution = [...base], historyFactors = new Map()
    for (const r of base) {
      const sept = (31 / cutoffDay) / 1.015
      for (let m = 9; m >= 1; m--) historyFactors.set(`${r.strategy_id}:2026-${String(m).padStart(2, '0')}`, sept / Math.pow(1.01, 9 - m))
    }
    for (let m = 1; m <= 9; m++) for (const b of base) {
      const ym = `2026-${String(m).padStart(2, '0')}`, f = historyFactors.get(`${b.strategy_id}:${ym}`)
      const row = { ...b, stat_month: `${ym}-01` }
      for (const k of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num']) row[k] = Math.round(b[k] * f)
      for (const k of ['expected_income', 'actual_income']) row[k] = b[k] == null ? null : round(b[k] * f)
      row.usage_rate = pct(row.usage_count, row.push_count); row.reach_rate = pct(row.reach_count, row.usage_count); row.target_conv_rate = pct(row.target_conv_num, row.reach_count); row.product_conv_rate = pct(row.product_conv_num, row.reach_count)
      execution.push(row)
    }
    const jan = execution.filter(r => r.stat_month === '2026-01-01')
    for (const r of jan) {
      const f = 0.99 + stable(`base:${r.strategy_id}`) * 0.02, row = { ...r, stat_month: '2025-12-01' }
      for (const k of ['push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num']) row[k] = Math.round(r[k] * f)
      for (const k of ['expected_income', 'actual_income']) row[k] = r[k] == null ? null : round(r[k] * f)
      row.usage_rate = pct(row.usage_count, row.push_count); row.reach_rate = pct(row.reach_count, row.usage_count); row.target_conv_rate = pct(row.target_conv_num, row.reach_count); row.product_conv_rate = pct(row.product_conv_num, row.reach_count); execution.push(row)
    }
    for (const id of masters.map(x => x.strategy_code)) {
      const rows = execution.filter(r => r.strategy_id === id).sort((a, b) => a.stat_month.localeCompare(b.stat_month))
      for (let i = 0; i < rows.length; i++) {
        const prior = i && prevMonth(rows[i].stat_month.slice(0, 7)) === rows[i - 1].stat_month.slice(0, 7) ? metricOf([rows[i - 1]]) : null
        const values = addQoq(metricOf([rows[i]]), prior, rows[i].stat_month.slice(0, 7) === month)
        Object.assign(rows[i], Object.fromEntries(Object.entries(values).filter(([k]) => k.endsWith('_qoq'))))
      }
    }
    const allBusinesses = [...businesses], allReasons = [...reasons]
    const sourceBiz = businesses.slice(), sourceReasons = reasons.slice()
    for (let m = 1; m <= 9; m++) {
      const ym = `2026-${String(m).padStart(2, '0')}`
      for (const baseRow of base) {
        const f = historyFactors.get(`${baseRow.strategy_id}:${ym}`)
        for (const b of sourceBiz.filter(x => x.strategy_id === baseRow.strategy_id)) allBusinesses.push({ ...b, stat_date: `${ym}-01`, count: Math.round(b.count * f) })
        const why = sourceReasons.filter(x => x.strategy_id === baseRow.strategy_id), counts = why.map(x => Math.round(x.reject_count * f)), total = counts.reduce((a, b) => a + b, 0)
        why.forEach((x, i) => allReasons.push({ ...x, stat_month: `${ym}-01`, reject_count: counts[i], reject_ratio: pct(counts[i], total) }))
      }
    }
    for (const b of sourceBiz) allBusinesses.push({ ...b, stat_date: '2025-12-01', count: Math.round(b.count * 0.99) })
    for (const id of masters.map(x => x.strategy_code)) {
      const rows = allBusinesses.filter(x => x.strategy_id === id).sort((a, b) => a.stat_date.localeCompare(b.stat_date))
      for (let i = 0; i < rows.length; i++) rows[i].mom_ratio = i && prevMonth(rows[i].stat_date.slice(0, 7)) === rows[i - 1].stat_date.slice(0, 7) ? qoq({ count: rows[i].count }, { count: rows[i - 1].count }, 'count', rows[i].stat_date.slice(0, 7) === month) : null
    }
    // Reconcile source-month daily totals with bounded largest-remainder allocation.
    const dates = monthDates(month, cutoffDay), weights = dailyWeights(dates), daily = []
    for (const b of base) {
      const push = distribute(b.push_count, weights), usage = distribute(b.usage_count, weights, push), reach = distribute(b.reach_count, weights, usage), conv = distribute(b.target_conv_num, weights, reach)
      const income = b.actual_income == null ? null : distribute(Math.round(b.actual_income * 100), weights).map(x => x / 100)
      dates.forEach((date, i) => daily.push({ ...common, tab_type: 'passive', strategy_class: '全部', strategy_id: b.strategy_id, stat_date: date, channel: b.channel, big_category: b.big_category, small_category: b.small_category, strategy_name: b.strategy_name, original_cust: null, push_count: push[i], usage_count: usage[i], usage_rate: pct(usage[i], push[i]), reach_count: reach[i], target_conv_num: conv[i], target_conv_rate: pct(conv[i], reach[i]), product_conv_num: conv[i], product_conv_rate: pct(conv[i], reach[i]), expected_income: income == null ? null : income[i], actual_income: income == null ? null : income[i], reject_count: null, reject_rate: null }))
    }

    const allFacts = []
    for (const m of [...new Set(execution.map(r => r.stat_month))].sort()) {
      const rows = execution.filter(r => r.stat_month === m)
      allFacts.push(...rows)
      const channelGroups = new Map()
      for (const r of rows) { const k = `${r.channel}\u0000${r.big_category}\u0000${r.small_category}`; if (!channelGroups.has(k)) channelGroups.set(k, []); channelGroups.get(k).push(r) }
      const aggGroups = [rows]
      for (const [key, group] of channelGroups) {
        aggGroups.push(group)
        const [ch, big, small] = key.split('\u0000')
        const sameChannel = rows.filter(r => r.channel === ch)
        const sameCategory = rows.filter(r => r.big_category === big && r.small_category === small)
        if (!aggGroups.some(g => g.__key === `channel:${ch}`)) { Object.defineProperty(sameChannel, '__key', { value: `channel:${ch}` }); aggGroups.push(sameChannel) }
        if (!aggGroups.some(g => g.__key === `category:${big}:${small}`)) { Object.defineProperty(sameCategory, '__key', { value: `category:${big}:${small}` }); aggGroups.push(sameCategory) }
      }
      for (const group of aggGroups) {
        if (!group.length) continue
        const first = group[0], isAll = group === rows, channel = isAll || group.__key?.startsWith('category:') ? '全部' : first.channel
        const big = isAll || group.__key?.startsWith('channel:') ? '全部' : first.big_category
        const small = isAll || group.__key?.startsWith('channel:') ? '全部' : first.small_category
        const previousRows = execution.filter(r => r.stat_month.slice(0, 7) === prevMonth(m.slice(0, 7)) &&
          (channel === '全部' || r.channel === channel) && (big === '全部' || r.big_category === big) && (small === '全部' || r.small_category === small))
        const aggregate = addQoq(metricOf(group), previousRows.length ? metricOf(previousRows) : null, m.slice(0, 7) === month)
        const agg = { ...common, tab_type: 'passive', strategy_class: '全部', strategy_id: '999', strategy_name: '全部', channel, big_category: big, small_category: small, stat_month: m, ...aggregate }
        allFacts.push(agg)
      }
    }
    const kpis = [], channelSummary = [], capacity = [], channelBiz = []
    const sortedMonths = [...new Set(execution.map(r => r.stat_month))].sort()
    for (const m of sortedMonths) {
      const rows = execution.filter(r => r.stat_month === m), ym = m.slice(0, 7), priorRows = execution.filter(r => r.stat_month.slice(0, 7) === prevMonth(ym)), prior = priorRows.length ? metricOf(priorRows) : null
      const total = addQoq(metricOf(rows), prior, ym === month)
      metricsFields.forEach((key, i) => kpis.push({ ...common, tab_type: 'passive', strategy_class: '全部', stat_month: ym, metric_code: key, metric_name: metricNames[i], value: total[key], qoq: total[`${key}_qoq`], yoy: null, unit: unit(key), icon: 'trend', sort_no: i + 1 }))
      const channels = [...new Set(rows.map(r => r.channel))]
      for (const ch of [...channels, '全部']) {
        const current = rows.filter(r => ch === '全部' || r.channel === ch), prev = priorRows.filter(r => ch === '全部' || r.channel === ch)
        const cm = addQoq(metricOf(current), prev.length ? metricOf(prev) : null, ym === month)
        channelSummary.push({ ...common, tab_type: 'passive', strategy_class: '全部', stat_month: m, channel: ch, ...cm })
        capacity.push({ ...common, tab_type: 'passive', strategy_class: '全部', stat_month: m, channel: ch, big_category: '全部', small_category: '全部', capacity: cm.product_conv_num, qoq: cm.product_conv_num_qoq })
      }
    }
    const bizAgg = new Map()
    for (const b of allBusinesses) {
      const fact = execution.find(r => r.strategy_id === b.strategy_id && r.stat_month === b.stat_date)
      if (!fact) continue
      const key = [b.stat_date, fact.channel, fact.big_category, fact.small_category, b.biz_name].join('\u0000')
      const row = bizAgg.get(key) || { ...common, tab_type: 'passive', strategy_class: '全部', stat_month: b.stat_date, channel: fact.channel, big_category: fact.big_category, small_category: fact.small_category, biz_name: b.biz_name, capacity: 0, qoq: null }
      row.capacity += b.count
      bizAgg.set(key, row)
    }
    channelBiz.push(...bizAgg.values())
    for (const row of channelBiz) {
      const prior = channelBiz.find(x => x.stat_month.slice(0, 7) === prevMonth(row.stat_month.slice(0, 7)) && x.channel === row.channel && x.big_category === row.big_category && x.small_category === row.small_category && x.biz_name === row.biz_name)
      if (prior) row.qoq = qoq({ count: row.capacity }, { count: prior.capacity }, 'count', row.stat_month.slice(0, 7) === month)
    }
    const simulation = { tabType: 'passive', strategyClass: '全部', cityId: CITY, startMonth: '2026-01', endMonth: '2026-09', baselineMonth: '2025-12', sourceMonth: month, sourceCutoff: '2026-10-21', dailyStartDate: '2026-10-01', dailyEndDate: '2026-10-21', dailyStrategyIds: masters.map(m => m.strategy_code), strategiesPerMonth: masters.length, monthlyMoMRange: '-2%..5%', sourceSha256: source.sha256, sourceFile: path.basename(source.source), dailyMethod: '固定种子周内/周末权重，最大余数并逐日上限分配；仅为模拟日拆分。' }
    const normalized = { database, source: source.source, sourceSha256: source.sha256, tabType: 'passive', month, cutoffDay, cityId: CITY, countyId: null, mappings, simulation, records: { masters: masters.length, monthlyStrategyFacts: execution.length, dailyStrategyFacts: daily.length, businesses: allBusinesses.length, reasons: allReasons.length, kpis: kpis.length, channelSummary: channelSummary.length, monthlyCapacity: capacity.length, channelBusinessCapacity: channelBiz.length }, execution, daily, businesses: allBusinesses, reasons: allReasons, kpis, channelSummary, capacity, channelBiz }
    fs.writeFileSync(path.join(out, 'normalized.json'), JSON.stringify(normalized, null, 2), 'utf8')
    if (!apply) { console.log(JSON.stringify({ dryRun: true, ...normalized.records, mappings, simulation })); return }

    const tables = ['t_sr_strategy_passive','t_sr_strategy_period_summary_ap_passive','t_sr_strategy_daily_ap_passive','t_sr_strategy_biz_capacity_passive','t_sr_strategy_reject_reason_passive','t_sr_kpi_summary_passive','t_sr_channel_summary_ap_passive','t_sr_channel_monthly_capacity_ap_passive','t_sr_channel_biz_capacity_ap_passive','t_sr_dim_channel','t_sr_warning_rule','t_sr_warning_rule_condition','t_sr_warning_hit']
    const backup = { createdAt: new Date().toISOString(), database, source: source.source, sourceSha256: source.sha256, tables: {} }
    for (const t of tables) {
      const where = t === 't_sr_strategy_passive' ? ['owner=?', [TEST_OWNER]]
        : t === 't_sr_warning_rule' ? ['create_by=?', ['local-passive-control-seed-v1']]
          : t === 't_sr_warning_rule_condition' || t === 't_sr_warning_hit' ? ['rule_id IN (SELECT id FROM t_sr_warning_rule WHERE create_by=?)', ['local-passive-control-seed-v1']]
            : t === 't_sr_dim_channel' ? ['1=0', []] : ['county_id=?', [TEST_MARK]]
      const [rows] = await c.query(`SELECT * FROM ?? WHERE ${where[0]}`, [t, ...where[1]])
      backup.tables[t] = rows
    }
    const backupPath = path.join(out, `database-backup-${Date.now()}.json`)
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8')
    const cols = new Map()
    const insert = async (table, rows) => {
      if (!rows.length) return
      if (!cols.has(table)) { const [r] = await c.query('SHOW COLUMNS FROM ??', [table]); cols.set(table, new Set(r.map(x => x.Field))) }
      const keys = Object.keys(rows[0]).filter(k => k !== 'id' && cols.get(table).has(k))
      for (let i = 0; i < rows.length; i += 300) await c.query('INSERT INTO ?? (??) VALUES ?', [table, keys, rows.slice(i, i + 300).map(r => keys.map(k => r[k] == null ? null : r[k]))])
    }
    await c.beginTransaction(); inTx = true
    try {
      const [ruleRows] = await c.query('SELECT id FROM t_sr_warning_rule WHERE create_by=?', ['local-passive-control-seed-v1'])
      const ruleIds = ruleRows.map(r => r.id)
      if (ruleIds.length) { await c.query('DELETE FROM t_sr_warning_rule_condition WHERE rule_id IN (?)', [ruleIds]); await c.query('DELETE FROM t_sr_warning_hit WHERE rule_id IN (?)', [ruleIds]) }
      await c.query('DELETE FROM t_sr_warning_rule WHERE create_by=?', ['local-passive-control-seed-v1'])
      for (const t of ['t_sr_strategy_biz_capacity_passive','t_sr_strategy_reject_reason_passive','t_sr_strategy_daily_ap_passive','t_sr_channel_biz_capacity_ap_passive','t_sr_channel_monthly_capacity_ap_passive','t_sr_channel_summary_ap_passive','t_sr_strategy_period_summary_ap_passive','t_sr_kpi_summary_passive']) await c.query('DELETE FROM ?? WHERE county_id=?', [t, TEST_MARK])
      await c.query('DELETE FROM t_sr_strategy_passive WHERE owner=?', [TEST_OWNER])
      await insert('t_sr_dim_channel', newChannels)
      await insert('t_sr_strategy_passive', masters)
      await insert('t_sr_strategy_period_summary_ap_passive', allFacts)
      await insert('t_sr_strategy_daily_ap_passive', daily)
      await insert('t_sr_strategy_biz_capacity_passive', allBusinesses)
      await insert('t_sr_strategy_reject_reason_passive', allReasons)
      await insert('t_sr_kpi_summary_passive', kpis)
      await insert('t_sr_channel_summary_ap_passive', channelSummary)
      await insert('t_sr_channel_monthly_capacity_ap_passive', capacity)
      await insert('t_sr_channel_biz_capacity_ap_passive', channelBiz)
      const [verify] = await c.query("SELECT COUNT(*) n,SUM(push_count) push,SUM(usage_count) AS used,SUM(reach_count) reach,SUM(target_conv_num) target,SUM(product_conv_num) product,COUNT(original_cust) original,COUNT(reject_count) rejected FROM t_sr_strategy_period_summary_ap_passive WHERE tab_type='passive' AND city_id=? AND strategy_class='全部' AND strategy_id<>'999' AND stat_month=? AND is_deleted=0", [CITY, `${month}-01`])
      assert.equal(Number(verify[0].n), masters.length)
      assert.equal(Number(verify[0].push), base.reduce((s, r) => s + r.push_count, 0))
      assert.equal(Number(verify[0].product), base.reduce((s, r) => s + r.product_conv_num, 0))
      assert.equal(Number(verify[0].original), 0); assert.equal(Number(verify[0].rejected), 0)
      const [dailySums] = await c.query("SELECT strategy_id,SUM(push_count) push,SUM(usage_count) AS used,SUM(reach_count) reach,SUM(target_conv_num) target,SUM(actual_income) actual,COUNT(*) days FROM t_sr_strategy_daily_ap_passive WHERE tab_type='passive' AND city_id=? AND stat_date BETWEEN '2026-10-01' AND '2026-10-21' AND is_deleted=0 GROUP BY strategy_id", [CITY])
      for (const s of dailySums) {
        const m = base.find(r => r.strategy_id === s.strategy_id)
        assert.equal(Number(s.push), m.push_count); assert.equal(Number(s.used), m.usage_count); assert.equal(Number(s.reach), m.reach_count); assert.equal(Number(s.target), m.target_conv_num); assert.equal(Number(s.actual), m.actual_income); assert.equal(Number(s.days), cutoffDay)
      }
      await c.commit(); inTx = false
      const manifestPath = path.resolve(__dirname, '../src/views/strategyReview/active/incrementalSimulation.json')
      fs.writeFileSync(manifestPath, JSON.stringify(simulation, null, 2), 'utf8')
      fs.writeFileSync(path.join(out, 'import-result.json'), JSON.stringify({ ...normalized.records, database, month, cutoff: '2026-10-21', backupPath, sourceSha256: source.sha256, mappings, verify: verify[0] }, null, 2), 'utf8')
      console.log(JSON.stringify({ applied: true, ...normalized.records, month, cutoff: '2026-10-21', backupPath, mappings, totals: verify[0] }))
    } catch (e) { if (inTx) await c.rollback(); inTx = false; throw e }
  } finally { await c.end() }
}

main().catch(e => { console.error(e.stack); process.exitCode = 1 })
