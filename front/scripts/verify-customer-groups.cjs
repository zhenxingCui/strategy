// Compare API results against independent strategy facts. Temporary favorites/rule are cleaned in finally.
const assert = require('assert/strict')
const mysql = require('mysql2/promise')
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const userId = `customer-group-verify-${Date.now()}`
let checks = 0
let ruleId
let ids = []
async function api(route, params = {}) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabType: 'active', strategyClass: '重点客群', cityId: '999', userId, ...params }),
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
  for (const field of ['original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'expected_income', 'actual_income', 'reject_count']) values[field] = rows.reduce((sum, row) => sum + Number(row[field]), 0)
  for (const [name, numerator, denominator] of [['usage_rate', 'usage_count', 'push_count'], ['reach_rate', 'reach_count', 'usage_count'], ['target_conv_rate', 'target_conv_num', 'reach_count'], ['product_conv_rate', 'product_conv_num', 'reach_count'], ['reject_rate', 'reject_count', 'push_count']]) values[name] = pct(values[numerator], values[denominator])
  return values
}
async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    database: process.env.SR_DB_NAME || 'strategy_review_active_class_local', dateStrings: true,
  })
  try {
    const latest = (await api('/latestDate')).slice(0, 7)
    const [year, month] = latest.split('-').map(Number)
    const previousDate = new Date(year, month - 2, 1)
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`
    const groups = await api('/dim', { type: '客群分类' })
    assert.ok(groups.length >= 4)
    assert.ok(groups.every(group => group.keyCode === group.keyName && group.keyName.trim() === group.keyName))
    const [facts] = await connection.query(`SELECT p.*, s.customer_group FROM t_sr_strategy_period_summary_ap_key_audience p
      JOIN t_sr_strategy_key_audience s ON s.strategy_code=p.strategy_id AND s.tab_type=p.tab_type AND s.is_deleted=0
      WHERE p.tab_type='active' AND p.strategy_class='重点客群' AND p.city_id='999' AND p.is_deleted=0 AND p.strategy_id!='999'`)
    const channels = ['', ...(await api('/dim', { type: '触点渠道' })).map(channel => channel.keyCode)]
    for (const group of groups) {
      for (const channel of channels) {
        const scope = { statMonth: latest, customerGroup: group.keyCode, channel }
        const selected = facts.filter(row => row.customer_group === group.keyCode && (!channel || row.channel === channel))
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
        if (current.length) assert.equal(list.calculate.productConvNum, expected.product_conv_num)
        const categories = await api('/touchpoint/categorySummary', scope)
        assert.equal(categories.list.reduce((sum, row) => sum + row.productConvNum, 0), expected.product_conv_num)
        const summaries = await api('/touchpoint/channelSummary', scope)
        assert.equal(summaries.list.reduce((sum, row) => sum + row.productConvNum, 0), expected.product_conv_num)
        const business = await api('/touchpoint/channelBizCapacity', scope)
        assert.equal(business.reduce((sum, row) => sum + row.capacity, 0), expected.product_conv_num)
        for (const metricCode of ['product_conv_num', 'usage_rate', 'reach_rate']) {
          const trend = await api('/overview/trend', { ...scope, metricCode })
          assert.ok(trend.months.length <= 12)
          if (current.length) assert.equal(trend.values.at(-1), expected[metricCode])
        }
        const capacity = await api('/touchpoint/channelCapacityTrend', scope)
        assert.ok(capacity.length <= 6 && capacity.every(row => row.month <= latest))
        if (current.length) assert.equal(capacity.at(-1).capacity, expected.product_conv_num)
      }
    }
    const group = groups[0].keyCode
    const scope = { statMonth: latest, customerGroup: group }
    assert.deepEqual(await api('/overview/kpi', { ...scope, customerGroup: ` ${group} ` }), await api('/overview/kpi', scope))
    for (const tabType of ['active', 'passive', 'control']) {
      const other = { statMonth: latest, tabType, strategyClass: tabType === 'active' ? '升接' : '全部' }
      assert.deepEqual(await api('/overview/kpi', { ...other, customerGroup: group }), await api('/overview/kpi', other))
    }
    assert.deepEqual(await api('/overview/kpi', { ...scope, customerGroup: "不存在' OR 1=1 --" }), [])
    assert.equal((await api('/touchpoint/strategyList', { ...scope, cityId: 'other-city' })).total, 0)
    assert.deepEqual(await api('/overview/kpi', { ...scope, countyId: 'other-county' }), [])
    assert.deepEqual(await api('/overview/kpi', { ...scope, statMonth: '2000-01' }), [])
    const historical = await api('/overview/kpi', { ...scope, statMonth: previousMonth })
    assert.equal(historical.find(card => card.metricCode === 'product_conv_num').value, metrics(facts.filter(row => row.customer_group === group && row.stat_month.startsWith(previousMonth))).product_conv_num)
    const all = await api('/touchpoint/strategyList', { statMonth: latest, pageSize: 500 })
    ids = all.list.map(row => row.strategyId)
    await api('/favorite/add', { strategyIds: ids })
    const favorites = await api('/favorite/list', { ...scope, pageSize: 500 })
    assert.ok(favorites.total > 0)
    assert.ok(favorites.list.every(row => facts.some(fact => fact.strategy_id === row.strategyId && fact.customer_group === group)))
    ruleId = await api('/warning/ruleCreate', {
      ruleName: userId, startDate: '2000-01-01', endDate: '2099-12-31', dataStartDate: latest + '-01', dataEndDate: latest + '-28',
      channels: [], strategies: [], logic: 'or', conditions: [{ metricCode: 'push_count', metricName: '推送量', operator: 'gt', threshold: 0, unit: '次' }],
    })
    const hits = await api('/warning/hitStrategyList', { ...scope, ruleId, pageSize: 500 })
    assert.equal(hits.total, facts.filter(row => row.customer_group === group && row.stat_month.startsWith(latest)).length)
    assert.ok(hits.list.every(row => facts.some(fact => fact.strategy_id === row.strategyId && fact.customer_group === group)))
    assert.equal((await api('/warning/hitStrategyList', { ...scope, ruleId, channel: 'unknown' })).total, 0)
    const id = hits.list[0].strategyId
    assert.equal((await api('/execution/strategyInfo', { ...scope, strategyId: id })).strategyId, id)
    assert.ok((await api('/execution/dailyDetail', { ...scope, strategyId: id, startDate: latest + '-01', endDate: latest + '-28' })).total > 0)
    console.log(`PASS: ${checks} API checks; all group/channel combinations, weighted rates, exact monthly QoQ, paging totals, business/category/channel consistency, historical/empty/region cases, favorites and warning isolation`)
  } finally {
    try {
      if (ruleId) await api('/warning/ruleDelete', { id: ruleId })
      if (ids.length) await api('/favorite/remove', { strategyIds: ids })
    } finally { await connection.end() }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
