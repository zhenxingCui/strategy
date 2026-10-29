// Capture/compare all available stock overview scopes through read-only APIs.
// capture <file> [month]; compare <file>. Snapshot contains local business data.
const fs = require('node:fs')
const path = require('node:path')
const [mode, target, requestedMonth] = process.argv.slice(2)
const currentOnly = process.argv.includes('--current-only')
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const url = new URL(base)
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) throw new Error('Only local APIs are allowed')
if (!['capture', 'compare'].includes(mode) || !target) throw new Error('Usage: capture|compare <file> [yyyy-MM]')
const file = path.resolve(target)
async function request(endpoint, params) {
  const res = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(30000) })
  const result = await res.json()
  if (!res.ok || result.status !== 'SUCCESS') throw new Error(`${endpoint}: ${result.message || result.status || res.status}`)
  return result.data === undefined ? null : result.data
}
async function capture() {
  const cases = []
  async function save(name, endpoint, params) { const data = await request(endpoint, params); cases.push({ name, endpoint, params, data }); return data }
  for (const cls of ['升接', '稳', '降拆', '离', '重点客群']) {
    const baseParams = { tabType: 'active', strategyClass: cls, cityId: '999', userId: 'root' }
    const latest = await save(`${cls}/latest`, '/latestDate', baseParams)
    const month = requestedMonth || latest.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month')
    const dims = await save(`${cls}/channels`, '/dim', { ...baseParams, statMonth: month, type: '触点渠道' })
    const channels = ['', ...new Set((dims || []).map(item => item.keyCode).filter(Boolean))]
    let groups = ['']
    if (cls === '重点客群') {
      const dimGroups = await save(`${cls}/groups`, '/dim', { ...baseParams, statMonth: month, type: '客群分类' })
      groups = ['', ...new Set((dimGroups || []).map(item => item.keyCode).filter(Boolean))]
    }
    for (const group of groups) for (const channel of channels) {
      const scope = { ...baseParams, statMonth: month, channel, ...(group ? { customerGroup: group } : {}) }
      const scopeName = `${cls}/${group || '-组'}/${channel || '-渠道'}`
      const cards = await save(`${scopeName}/${month}/kpi`, '/overview/kpi', scope)
      for (const metricCode of [...new Set((cards || []).map(card => card.metricCode).filter(Boolean))]) {
        await save(`${scopeName}/${metricCode}/trend`, '/overview/trend', { ...scope, metricCode })
      }
    }
    console.log(`Captured ${cls}: ${cases.length} cases so far`)
  }
  return { formatVersion: 1, cases }
}
async function main() {
  if (mode === 'capture') {
    if (fs.existsSync(file)) throw new Error(`Refusing to overwrite: ${file}`)
    const result = await capture()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
    console.log(`Saved ${result.cases.length} cases to ${file}`)
    return
  }
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (snapshot.formatVersion !== 1 || !Array.isArray(snapshot.cases)) throw new Error('Invalid snapshot')
  let failures = 0
  let checked = 0
  const months = snapshot.cases.filter(test => test.endpoint === '/overview/kpi').map(test => test.params.statMonth).filter(Boolean).sort()
  const currentMonth = months[months.length - 1]
  for (const test of snapshot.cases) {
    if (currentOnly && test.endpoint === '/overview/kpi' && test.params.statMonth !== currentMonth) continue
    try {
      const actual = await request(test.endpoint, test.params)
      checked++
      let expected = test.data
      let compared = actual
      if (currentOnly && test.endpoint === '/overview/trend') {
        const last = value => ({ unit: value && value.unit, month: value && value.months && value.months.slice(-1)[0], value: value && value.values && value.values.slice(-1)[0], qoq: value && value.qoq && value.qoq.slice(-1)[0] })
        expected = last(expected)
        compared = last(compared)
      }
      if (JSON.stringify(compared) !== JSON.stringify(expected)) { failures++; if (failures <= 30) console.error(`${test.name}: differs`) }
    } catch (error) { failures++; if (failures <= 30) console.error(`${test.name}: ${error.message}`) }
  }
  console.log(`Compared ${checked} cases; ${failures} differ`)
  if (failures) process.exitCode = 1
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
