// Read-only local API baseline for the five retained strategy classes.
// Capture: node scripts/stock-refactor-baseline.cjs capture <output.json>
// Compare: node scripts/stock-refactor-baseline.cjs compare <output.json>
const fs = require('node:fs')
const path = require('node:path')

const mode = process.argv[2]
const target = process.argv[3]
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const endpoint = new URL(base)
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(endpoint.hostname)) throw new Error('Only a local API is permitted')
if (!['capture', 'compare'].includes(mode) || !target) throw new Error('Usage: capture|compare <output.json>')
const file = path.resolve(target)
const classes = ['升接', '稳', '降拆', '离', '重点客群']

async function request(url, payload) {
  const response = await fetch(base + url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
  })
  const body = await response.json()
  if (!response.ok || body.status !== 'SUCCESS') {
    throw new Error(`${url}: HTTP ${response.status}; ${body.message || body.status || 'unknown error'}`)
  }
  return body.data === undefined ? null : body.data
}

async function capture() {
  const cases = []
  async function save(name, url, payload) {
    const data = await request(url, payload)
    cases.push({ name, url, payload, data })
    return data
  }
  for (const strategyClass of classes) {
    const scope = { tabType: 'active', strategyClass, cityId: '999', userId: 'root' }
    const latest = await save(`${strategyClass}/最新日期`, '/latestDate', scope)
    if (!latest || !/^\d{4}-\d{2}-\d{2}/.test(latest)) throw new Error(`${strategyClass}: invalid latest date`)
    const query = { ...scope, statMonth: latest.slice(0, 7) }
    const channels = await save(`${strategyClass}/渠道`, '/dim', { ...query, type: '触点渠道' })
    const requests = [
      ['整体指标', '/overview/kpi', {}],
      ['整体趋势', '/overview/trend', { metricCode: 'push_count' }],
      ['渠道汇总', '/touchpoint/channelSummary', {}],
      ['策略列表', '/touchpoint/strategyList', { pageNum: 1, pageSize: 10 }],
      ['分类选项', '/touchpoint/strategyCategoryOptions', {}],
      ['分类汇总', '/touchpoint/categorySummary', {}],
      ['渠道趋势', '/touchpoint/channelCapacityTrend', {}],
      ['业务产能', '/touchpoint/channelBizCapacity', {}],
    ]
    for (const [name, url, params] of requests) await save(`${strategyClass}/${name}`, url, { ...query, ...params })
    if (Array.isArray(channels) && channels.length) {
      const selected = { ...query, channel: channels[0].keyCode }
      await save(`${strategyClass}/指定渠道指标`, '/overview/kpi', selected)
      const list = await save(`${strategyClass}/指定渠道策略`, '/touchpoint/strategyList', { ...selected, pageNum: 1, pageSize: 10 })
      const first = list && Array.isArray(list.list) && list.list[0]
      if (first && first.strategyId) {
        const detail = { ...selected, strategyId: first.strategyId, bigCategory: first.bigCategory, smallCategory: first.smallCategory }
        const [year, month] = query.statMonth.split('-').map(Number)
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
        for (const [name, url, params] of [
          ['策略信息', '/execution/strategyInfo', {}],
          ['策略趋势', '/execution/capacityTrend', { metricCode: 'productConvNum' }],
          ['策略业务', '/execution/bizCapacity', { pageNum: 1, pageSize: 10 }],
          ['分日明细', '/execution/dailyDetail', { startDate: query.statMonth + '-01', endDate: `${query.statMonth}-${lastDay}`, pageNum: 1, pageSize: 10 }],
          ['拒绝原因', '/execution/rejectReason', {}],
        ]) await save(`${strategyClass}/${name}`, url, { ...detail, ...params })
      }
    }
    if (strategyClass === '重点客群') {
      const groups = await save(`${strategyClass}/客群`, '/dim', { ...query, type: '客群分类' })
      if (Array.isArray(groups) && groups.length) await save(`${strategyClass}/指定客群指标`, '/overview/kpi', { ...query, customerGroup: groups[0].keyCode })
    }
  }
  return { formatVersion: 1, cases }
}

async function main() {
  if (mode === 'capture') {
    if (fs.existsSync(file)) throw new Error(`Refusing to overwrite existing baseline: ${file}`)
    const snapshot = await capture()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' })
    console.log(`Saved ${snapshot.cases.length} read-only API cases to ${file}`)
  } else {
    const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (snapshot.formatVersion !== 1 || !Array.isArray(snapshot.cases)) throw new Error('Unsupported baseline format')
    const failures = []
    for (const test of snapshot.cases) {
      try {
        const actual = await request(test.url, test.payload)
        if (JSON.stringify(actual) !== JSON.stringify(test.data)) failures.push(`${test.name}: response differs`)
      } catch (error) { failures.push(`${test.name}: ${error.message}`) }
    }
    console.log(`Compared ${snapshot.cases.length} cases; ${failures.length} differ`)
    failures.forEach((failure) => console.error(failure))
    if (failures.length) process.exitCode = 1
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
