// Compare API results against independent strategy facts. Temporary favorites/rule are cleaned in finally.
const assert = require('assert/strict')
const mysql = require('mysql2/promise')
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (database !== 'strategy_review_active_class_local' || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
  throw new Error('产品验证仅支持本地联调库及本地API')
}
const userId = `product-verify-${Date.now()}`
let checks = 0
let ruleId
let ids = []
async function api(route, params = {}) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabType: 'control', strategyClass: '全部', cityId: '001', userId, ...params }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.status, 'SUCCESS', `${route}: ${body.message}`)
  checks++
  return body.data
}
const round = value => Math.round((value + Number.EPSILON) * 100) / 100
const pct = (a, b) => b ? round(a / b * 100) : null
function metrics(rows) {
  const values = { strategy_count: new Set(rows.map(row => row.strategy_id)).size }
  for (const field of ['consult_count', 'retain_count', 'dispatch_count', 'success_count', 'income']) values[field] = rows.reduce((sum, row) => sum + Number(row[field]), 0)
  for (const [name, numerator, denominator] of [['retain_rate', 'retain_count', 'consult_count'], ['success_rate', 'success_count', 'dispatch_count']]) values[name] = pct(values[numerator], values[denominator])
  return values
}
async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    database, dateStrings: true,
  })
  try {
    const latest = (await api('/latestDate')).slice(0, 7)
    const [year, month] = latest.split('-').map(Number)
    const previousDate = new Date(year, month - 2, 1)
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
    const groups = await api('/dim', { type: '产品名称' })
    assert.ok(groups.length >= 5)
    assert.ok(groups.every(group => group.keyCode === group.keyName && group.keyName.trim() === group.keyName))
    const [facts] = await connection.query(`SELECT p.*, s.product_name FROM t_sr_strategy_period_summary_ctrl p
      JOIN t_sr_strategy s ON s.strategy_code=p.strategy_id AND s.tab_type='control' AND s.is_deleted=0
      WHERE p.city_id='001' AND p.is_deleted=0 AND p.strategy_id!='999'`)
    const channels = ['', ...(await api('/dim', { type: '触点渠道' })).map(channel => channel.keyCode)]
    for (const group of groups) {
      for (const channel of channels) {
        const scope = { statMonth: latest, productName: group.keyCode, channel }
        const selected = facts.filter(row => row.product_name === group.keyCode && (!channel || row.channel === channel))
        const current = selected.filter(row => row.stat_month.startsWith(latest))
        const previous = selected.filter(row => row.stat_month.startsWith(previousMonth))
        const expected = metrics(current), prior = metrics(previous)
        const cards = await api('/overview/kpi', scope)
        assert.equal(cards.length > 0, current.length > 0)
        for (const card of cards) {
          assert.equal(card.value, expected[card.metricCode], `${group.keyCode}/${channel}/${card.metricCode}`)
          const qoq = !previous.length ? null : card.unit === '%' ? round(expected[card.metricCode] - prior[card.metricCode]) : pct(expected[card.metricCode] - prior[card.metricCode], prior[card.metricCode])
          assert.equal(card.trendQoQ, qoq, `${group.keyCode}/${channel}/${card.metricCode} qoq`)
        }
        const list = await api('/touchpoint/strategyList', { ...scope, pageSize: 1 })
        assert.equal(list.total, current.length)
        assert.ok(list.list.every(row => current.some(fact => fact.strategy_id === row.strategyId)))
        if (current.length) assert.equal(list.calculate.successCount, expected.success_count)
        const categories = await api('/touchpoint/categorySummary', scope)
        assert.equal(categories.list.reduce((sum, row) => sum + row.successCount, 0), expected.success_count)
        const summaries = await api('/touchpoint/channelSummary', scope)
        assert.equal(summaries.list.reduce((sum, row) => sum + row.successCount, 0), expected.success_count)
        const business = await api('/touchpoint/channelBizCapacity', scope)
        assert.equal(business.reduce((sum, row) => sum + row.capacity, 0), expected.success_count)
        for (const metricCode of ['success_count', 'retain_rate', 'success_rate']) {
          const trend = await api('/overview/trend', { ...scope, metricCode })
          assert.ok(trend.months.length <= 12)
          if (current.length) assert.equal(trend.values.at(-1), expected[metricCode])
        }
        const capacity = await api('/touchpoint/channelCapacityTrend', scope)
        assert.ok(capacity.length <= 6 && capacity.every(row => row.month <= latest))
        if (current.length) assert.equal(capacity.at(-1).capacity, expected.success_count)
      }
    }
    const group = groups.find(group => [latest, previousMonth].every(month => facts.some(row => row.product_name === group.keyCode && row.stat_month.startsWith(month)))).keyCode
    const scope = { statMonth: latest, productName: group }
    assert.deepEqual(await api('/overview/kpi', { ...scope, productName: ` ${group} ` }), await api('/overview/kpi', scope))
    for (const tabType of ['active', 'passive']) {
      const other = { statMonth: latest, tabType, strategyClass: tabType === 'active' ? '升接' : '全部' }
      assert.deepEqual(await api('/overview/kpi', { ...other, productName: group }), await api('/overview/kpi', other))
    }
    assert.deepEqual(await api('/overview/kpi', { ...scope, productName: "不存在' OR 1=1 --" }), [])
    assert.equal((await api('/touchpoint/strategyList', { ...scope, cityId: 'other-city' })).total, 0)
    assert.deepEqual(await api('/overview/kpi', { ...scope, countyId: 'other-county' }), [])
    assert.deepEqual(await api('/overview/kpi', { ...scope, statMonth: '2000-01' }), [])
    const historical = await api('/overview/kpi', { ...scope, statMonth: previousMonth })
    assert.equal(historical.find(card => card.metricCode === 'success_count').value, metrics(facts.filter(row => row.product_name === group && row.stat_month.startsWith(previousMonth))).success_count)
    const all = await api('/touchpoint/strategyList', { statMonth: latest, pageSize: 500 })
    ids = all.list.map(row => row.strategyId)
    await api('/favorite/add', { strategyIds: ids })
    const favorites = await api('/favorite/list', { ...scope, pageSize: 500 })
    assert.ok(favorites.total > 0)
    assert.ok(favorites.list.every(row => facts.some(fact => fact.strategy_id === row.strategyId && fact.product_name === group)))
    ruleId = await api('/warning/ruleCreate', {
      ruleName: userId, startDate: '2000-01-01', endDate: '2099-12-31', dataStartDate: latest + '-01', dataEndDate: latest + '-28',
      channels: [], strategies: [], logic: 'or', conditions: [{ metricCode: 'consult_count', metricName: '咨询量', operator: 'gt', threshold: 0, unit: '次' }],
    })
    const hits = await api('/warning/hitStrategyList', { ...scope, ruleId, pageSize: 500 })
    assert.equal(hits.total, facts.filter(row => row.product_name === group && row.stat_month.startsWith(latest)).length)
    assert.ok(hits.list.every(row => facts.some(fact => fact.strategy_id === row.strategyId && fact.product_name === group)))
    assert.equal((await api('/warning/hitStrategyList', { ...scope, ruleId, channel: 'unknown' })).total, 0)
    const id = hits.list[0].strategyId
    assert.equal((await api('/execution/strategyInfo', { ...scope, strategyId: id })).strategyId, id)
    assert.ok((await api('/execution/dailyDetail', { ...scope, strategyId: id, startDate: latest + '-01', endDate: latest + '-28' })).total > 0)
    // Unassigned strategies remain in all-products results, but leave the named product.
    const sample = facts.find(row => row.stat_month.startsWith(latest) && row.product_name && row.product_name.trim())
    assert.ok(sample)
    const [master] = await connection.execute("SELECT product_name FROM t_sr_strategy WHERE strategy_code=? AND tab_type='control'", [sample.strategy_id])
    const originalName = master[0].product_name
    const beforeAll = await api('/overview/kpi', { statMonth: latest })
    try {
      await connection.execute("UPDATE t_sr_strategy SET product_name=NULL WHERE strategy_code=? AND tab_type='control'", [sample.strategy_id])
      assert.deepEqual(await api('/overview/kpi', { statMonth: latest }), beforeAll)
      assert.ok((await api('/touchpoint/strategyList', { statMonth: latest, pageSize: 500 })).list.some(row => row.strategyId === sample.strategy_id))
      assert.ok(!(await api('/touchpoint/strategyList', { statMonth: latest, productName: originalName, pageSize: 500 })).list.some(row => row.strategyId === sample.strategy_id))
      assert.ok(!(await api('/dim', { type: '产品名称' })).some(row => !row.keyName.trim()))
    } finally {
      await connection.execute("UPDATE t_sr_strategy SET product_name=? WHERE strategy_code=? AND tab_type='control'", [originalName, sample.strategy_id])
    }
    console.log(`PASS: ${checks} API checks; all product/channel combinations, weighted rates, exact monthly QoQ, paging totals, business/category/channel consistency, historical/empty/region cases, favorites and warning isolation`)
  } finally {
    try {
      if (ruleId) await api('/warning/ruleDelete', { id: ruleId })
      if (ids.length) await api('/favorite/remove', { strategyIds: ids })
    } finally { await connection.end() }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
