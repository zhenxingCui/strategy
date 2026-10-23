// 默认只读。--write-checks 仅用于本地联调库，创建的验证规则会在 finally 中删除。
const assert = require('node:assert/strict')
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const writes = process.argv.includes('--write-checks')
if (writes && !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('写入检查仅允许本地服务')
const userId = `active-verify-${Date.now()}`
const defaults = { tabType: 'active', cityId: '001', userId, strategyClass: process.env.SR_VERIFY_STRATEGY_CLASS || '全部' }
let checks = 0
async function api(endpoint, params = {}) {
  const response = await fetch(base + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...defaults, ...params }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await response.json()
  assert.equal(response.status, 200, `${endpoint}: HTTP ${response.status}`)
  assert.equal(body.status, 'SUCCESS', `${endpoint}: ${body.message}`)
  checks++
  return body.data
}
async function main() {
  const latest = await api('/latestDate')
  const statMonth = latest.slice(0, 7)
  const scope = { statMonth }
  const monthEnd = statMonth + '-' + new Date(Number(statMonth.slice(0, 4)), Number(statMonth.slice(5)), 0).getDate()
  const channels = await api('/dim', { type: '触点渠道' })
  assert.ok(channels.length >= 2)
  const channel = channels[0].keyCode
  const kpis = await api('/overview/kpi', scope)
  const list = await api('/touchpoint/strategyList', {
    ...scope,
    pageNum: 1,
    pageSize: 5,
    sortField: 'productConvNum',
    sortDir: 'desc',
  })
  assert.equal(list.list.length, Math.min(list.total, 5))
  assert.ok(list.list.every((row) => row.strategyId !== '999'))
  if (defaults.strategyClass !== '全部') assert.ok(list.list.every(row => row.strategyClass === defaults.strategyClass))
  assert.equal(kpis.find((row) => row.metricCode === 'strategy_count').value, list.total)
  const trend = await api('/overview/trend', { ...scope, metricCode: kpis[0].metricCode })
  assert.ok(trend.months.length > 1 && trend.months.length <= 12)
  const channelKpis = await api('/overview/kpi', { ...scope, channel })
  const channelList = await api('/touchpoint/strategyList', { ...scope, channel, pageSize: 500 })
  assert.ok(channelList.total > 0 && channelList.total < list.total)
  assert.ok(channelList.list.every((row) => row.channel === channel))
  assert.equal(channelKpis.find((row) => row.metricCode === 'strategy_count').value, channelList.total)
  assert.equal(
    channelKpis.find((row) => row.metricCode === 'push_count').value,
    channelList.list.reduce((sum, row) => sum + row.pushCount, 0),
  )
  await api('/overview/trend', { ...scope, channel, metricCode: 'push_count' })
  const page2 = await api('/touchpoint/strategyList', {
    ...scope,
    pageNum: 2,
    pageSize: 5,
    sortField: 'productConvNum',
    sortDir: 'desc',
  })
  assert.ok(!page2.list.some((row) => list.list.some((first) => first.strategyId === row.strategyId)))
  const category = await api('/touchpoint/categorySummary', scope)
  assert.ok(category.list.length)
  const capacity = await api('/touchpoint/channelCapacityTrend', scope)
  assert.ok(capacity.length && capacity.every((row) => row.month.slice(0, 7) <= statMonth))
  const previous = new Date(Number(statMonth.slice(0, 4)), Number(statMonth.slice(5)) - 3, 1)
  const historicalMonth = previous.getFullYear() + '-' + String(previous.getMonth() + 1).padStart(2, '0')
  const historical = await api('/touchpoint/channelCapacityTrend', { statMonth: historicalMonth })
  assert.ok(historical.length && historical.every((row) => row.month.slice(0, 7) <= historicalMonth))
  assert.ok((await api('/touchpoint/channelBizCapacity', scope)).length)
  const strategyId = channelList.list[0].strategyId
  const detailScope = { ...scope, strategyId }
  const info = await api('/execution/strategyInfo', detailScope)
  assert.equal(info.strategyId, strategyId)
  assert.ok(info.level && info.caliber && info.createTime)
  assert.ok((await api('/execution/capacityTrend', detailScope)).months.length)
  assert.ok((await api('/execution/bizCapacity', detailScope)).list.length)
  const daily = await api('/execution/dailyDetail', {
    ...detailScope,
    startDate: statMonth + '-01',
    endDate: monthEnd,
    pageSize: 10,
  })
  assert.ok(daily.total > 10 && daily.list.every((row) => row.date.startsWith(statMonth)))
  assert.ok((await api('/execution/rejectReason', detailScope)).reasons.length)
  const rules = await api('/warning/ruleList', { ...scope, pageSize: 5 })
  assert.ok(rules.total > 5 && rules.list[0].conditions.length)
  const liveRule = rules.list.find((rule) => rule.status === '生效中')
  assert.ok(liveRule)
  await api('/warning/ruleDetail', { id: liveRule.id })
  const hits = await api('/warning/hitStrategyList', { ...scope, ruleId: liveRule.id, channel, pageSize: 500 })
  assert.ok(hits.list.every((row) => row.channel === channel && row.strategyId !== '999'))
  const dims = await api('/dim', { type: '策略名称', keyword: info.name })
  assert.ok(dims.some((row) => row.keyCode === strategyId))
  if (writes) {
    const payload = {
      ...scope,
      ruleName: `联调验证-${Date.now()}`,
      startDate: statMonth + '-01',
      endDate: '2099-12-31',
      dataStartDate: statMonth + '-01',
      dataEndDate: monthEnd,
      channels: [channel],
      strategies: [strategyId],
      logic: 'or',
      conditions: [
        { metricCode: 'push_count', metricName: '推送量', operator: 'lt', threshold: 1e9, unit: '次' },
        { metricCode: 'product_conv_num', metricName: '全产品转化量', operator: 'gt', threshold: 0, unit: '次' },
      ],
    }
    let id
    try {
      id = await api('/warning/ruleCreate', payload)
      assert.ok(id)
      const saved = await api('/warning/ruleDetail', { id })
      assert.deepEqual(saved.strategies, [strategyId])
      assert.equal(saved.conditions.length, 2)
      const onlyOne = await api('/warning/hitStrategyList', { ...scope, ruleId: id, pageSize: 500 })
      assert.equal(onlyOne.total, 1)
      assert.equal(
        (await api('/warning/hitStrategyList', { ...scope, ruleId: id, channel: channels[1].keyCode })).total,
        0,
        'OR 条件不得绕过触点限制',
      )
      assert.equal(
        (await api('/warning/hitStrategyList', { ...scope, ruleId: id, cityId: 'other-city' })).total,
        0,
        'OR 条件不得绕过地区限制',
      )
      await api('/warning/toggleFollow', { ruleId: String(id), strategyIds: [strategyId], followed: true })
      assert.equal((await api('/warning/hitStrategyList', { ...scope, ruleId: id, favorite: '1' })).total, 1)
      assert.equal(
        (await api('/warning/hitStrategyList', { ...scope, ruleId: id, favorite: '1', userId: 'another-local-user' }))
          .total,
        0,
      )
      await api('/warning/ruleUpdate', { ...payload, id, ruleName: payload.ruleName + '-已编辑' })
      assert.equal((await api('/warning/ruleDetail', { id })).conditions.length, 2)
      await api('/warning/ruleUpdateStatus', { id, status: '已停用' })
      assert.equal((await api('/warning/hitStrategyList', { ...scope, ruleId: id })).total, 0)
      await api('/warning/ruleUpdateStatus', { id, status: '生效中' })
      await api('/favorite/add', { strategyIds: [strategyId] })
      assert.ok((await api('/favorite/list', { pageSize: 500 })).list.some((row) => row.strategyId === strategyId))
    } finally {
      await api('/warning/toggleFollow', { ruleId: String(id || ''), strategyIds: [strategyId], followed: false })
      await api('/favorite/remove', { strategyIds: [strategyId] })
      if (id) await api('/warning/ruleDelete', { id })
    }
  }
  console.log(
    JSON.stringify(
      {
        passed: true,
        checks,
        statMonth,
        strategyClass: defaults.strategyClass,
        strategies: list.total,
        rules: rules.total,
        mode: writes ? 'read-and-write' : 'read-only',
      },
      null,
      2,
    ),
  )
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
