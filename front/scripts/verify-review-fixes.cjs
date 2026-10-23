/* Local regression checks. No DDL; temporary rows are scoped to a unique test user and removed in finally. */
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const mysql = require('mysql2/promise')
const babel = require('@babel/core')

const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const apiRoot = 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const userId = `codex-review-${Date.now()}`
const strategyId = `${userId}-strategy`
const ruleIds = []

async function post(route, data) {
  const response = await fetch(`${apiRoot}/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabType: 'active', userId, cityId: '999', ...data }),
  })
  const body = await response.json()
  assert.equal(body.status, 'SUCCESS', `${route}: ${body.message}`)
  return body.data
}

async function checkApi() {
  assert.equal(database, 'strategy_review_active_class_local', 'Only the local development database is allowed')
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, database,
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', dateStrings: true,
  })
  try {
    const [[dates]] = await conn.query("SELECT CURDATE() AS today, DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AS later")
    const latest = await post('latestDate', {})
    const month = latest.slice(0, 7)
    await conn.execute(`INSERT INTO t_sr_strategy_period_summary_ap
      (tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month,
       strategy_count, push_count, product_conv_num, city_id, is_deleted)
      VALUES ('active', ?, ?, '01', '回归验证', '临时策略', ?, 1, 1, 1, '999', 0)`,
    [strategyId, strategyId, `${month}-01`])
    const payload = {
      startDate: dates.today, endDate: dates.later, dataStartDate: `${month}-01`, dataEndDate: `${month}-28`,
      strategies: [strategyId], conditions: [{ metricCode: 'push_count', metricName: '推送量', operator: 'gte', threshold: 0 }],
    }
    for (let n = 0; n < 2; n++) {
      ruleIds.push(String(await post('warning/ruleCreate', { ...payload, ruleName: `${userId}-${n}` })))
    }
    const toggle = (index, followed) => post('warning/toggleFollow', { ruleId: ruleIds[index], strategyIds: [strategyId], followed })
    const focused = (index) => post('warning/hitStrategyList', { ruleId: ruleIds[index], statMonth: month, favorite: '1' })
    const manual = () => post('favorite/list', { statMonth: month, manualOnly: true })

    await toggle(0, true)
    await toggle(0, false)
    await toggle(0, true)
    assert.equal((await focused(0)).total, 1, 'Re-follow after soft deletion must succeed')
    await toggle(1, true)
    await toggle(1, true)
    assert.equal((await focused(0)).total, 1, 'Following rule B must preserve rule A')
    assert.equal((await focused(1)).total, 1)
    await toggle(0, false)
    assert.equal((await focused(0)).total, 0)
    assert.equal((await focused(1)).total, 1, 'Unfollowing A must preserve B')

    await post('favorite/add', { strategyIds: [strategyId] })
    assert.equal((await manual()).total, 1)
    const filtered = await post('favorite/list', { statMonth: month, manualOnly: true, strategyName: userId, channel: '01' })
    assert.equal(filtered.list.length, 1)
    assert.equal(filtered.total, 1)
    await toggle(0, true)
    await toggle(1, false)
    await toggle(0, false)
    assert.equal((await manual()).total, 1, 'Unfollowing every rule must preserve manual favorite')
    await toggle(0, true)
    await post('favorite/remove', { strategyIds: [strategyId] })
    assert.equal((await manual()).total, 0, 'Cancel favorite must remove it from the manual list')
    assert.equal((await focused(0)).total, 1, 'Cancel manual favorite must preserve rule follow')
    await toggle(0, false)
    await toggle(0, true)
    assert.equal((await focused(0)).total, 1)
    const fullLinks = Array.from({ length: 13 }, (_, i) => String(1000 + i)).join(',')
    assert.equal(fullLinks.length, 64)
    await conn.execute('UPDATE t_sr_favorite SET rule_id=? WHERE user_id=? AND strategy_id=?', [fullLinks, userId, strategyId])
    await assert.rejects(() => toggle(1, true), /存储容量/)
    const [[unchanged]] = await conn.execute('SELECT rule_id FROM t_sr_favorite WHERE user_id=? AND strategy_id=?', [userId, strategyId])
    assert.equal(unchanged.rule_id, fullLinks, 'Capacity failure must roll back rather than truncate existing links')
    const controlId = `${strategyId}-ctrl`
    await conn.execute(`INSERT INTO t_sr_strategy_period_summary_ctrl
      (strategy_id, strategy_code, strategy_name, channel, big_category, small_category, stat_month, city_id, is_deleted)
      VALUES (?, ?, ?, 'CCH02', '回归验证', '临时策略', ?, '999', 0)`, [controlId, controlId, controlId, `${month}-01`])
    await post('favorite/add', { tabType: 'control', strategyIds: [controlId] })
    const controlList = await post('favorite/list', { tabType: 'control', statMonth: month, manualOnly: true })
    assert.equal(controlList.total, 1)
    assert.equal(controlList.list[0].strategyCode, controlId)
    await post('favorite/remove', { tabType: 'control', strategyIds: [controlId] })
    assert.equal((await post('favorite/list', { tabType: 'control', statMonth: month, manualOnly: true })).total, 0)
    console.log('PASS API: re-follow, multiple rules, idempotency, manual favorites/filter/cancel, capacity guard and rollback')
  } finally {
    await conn.execute('DELETE FROM t_sr_favorite WHERE user_id=?', [userId])
    if (ruleIds.length) {
      const marks = ruleIds.map(() => '?').join(',')
      await conn.execute(`DELETE FROM t_sr_warning_rule_condition WHERE rule_id IN (${marks})`, ruleIds)
      await conn.execute(`DELETE FROM t_sr_warning_rule WHERE create_by=? AND id IN (${marks})`, [userId, ...ruleIds])
    }
    await conn.execute('DELETE FROM t_sr_strategy_period_summary_ap WHERE strategy_id=? AND strategy_name=?', [strategyId, strategyId])
    await conn.execute('DELETE FROM t_sr_strategy_period_summary_ctrl WHERE strategy_id=? AND strategy_name=?', [`${strategyId}-ctrl`, `${strategyId}-ctrl`])
    await conn.end()
  }
}

function loadModule(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative)
  let source = fs.readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = require('vue-template-compiler').parseComponent(source).script.content
  const code = babel.transformSync(source, {
    filename, configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => mocks[id] || {}, console, Set, Number, Date })
  return module.exports
}

async function checkFrontend() {
  const data = loadModule('src/views/strategyReview/active/reviewData.js')
  assert.equal(data.strategyColumns.find(c => c.prop === 'strategyName').link, true)
  const entry = loadModule('src/views/strategyReview/active/ActiveReview.vue', {
    './reviewData': data, '@/utils/auth': { getCityId: () => '999', getUserId: () => userId },
  }).default
  assert.equal(entry.computed.query.call({ tabType: 'control' }).tabType, 'control')
  const signature = columns => JSON.stringify(columns.map(c => ({ prop: c.prop, label: c.label, link: !!c.link })))
  for (const name of ['StockOverview', 'StockExecution', 'StockDetail', 'StockWarning']) {
    const component = loadModule(`src/views/strategyReview/active/${name}.vue`, { './reviewData': data }).default
    const contexts = ['passive', 'control'].map(tabType => ({ query: { tabType, strategyClass: '' }, isDowngrade: false }))
    if (name === 'StockOverview') {
      const groups = contexts.map(ctx => component.computed.groups.call(ctx))
      assert.equal(groups[0].left.length, groups[1].left.length)
      assert.equal(groups[0].mid.length, groups[1].mid.length)
      assert.equal(groups[1].left[0].key, 'strategy_count')
      assert.equal(groups[1].mid[1].key, 'consult_count', 'Control must retain its own metric codes')
    } else {
      const columns = contexts.map(ctx => component.computed.columns.call(ctx))
      const prefix = name === 'StockWarning' ? 5 : 3
      assert.equal(signature(columns[0].slice(0, prefix)), signature(columns[1].slice(0, prefix)), `${name}: shared layout/identity columns`)
      assert.ok(columns[1].some(c => c.prop === 'consultCount'))
      assert.ok(!columns[1].some(c => c.prop === 'pushCount'), 'Never relabel control counts as growth metrics')
      if (name === 'StockDetail') {
        assert.equal(columns[1].find(c => c.prop === 'strategyName').link, true)
        assert.equal(columns[1].find(c => c.prop === 'strategyName').format(null, { strategyCode: 'CTL001' }), 'CTL001')
      }
    }
  }
  let complete
  const component = loadModule('src/views/strategyReview/active/StockWarning.vue', {
    './reviewData': data,
    '@/api/strategyReview': { getWarningHitStrategyList: () => new Promise(resolve => { complete = resolve }) },
  }).default
  const deferred = []
  const ctx = {
    hits: [], hitPage: 2, hitTotal: 12, selection: [], selectedRule: { id: 1 }, query: {}, focused: false,
    request: async (key, fetcher, apply) => apply(await fetcher()),
    $nextTick: fn => deferred.push(fn), loadHits: () => {},
  }
  const first = component.methods.loadHits.call(ctx)
  assert.equal(ctx.hitTotal, 12, 'Loading page 2 must retain total and page')
  complete({ list: [{ strategyId: 'second-page' }], total: 12 })
  await first
  assert.equal(ctx.hitPage, 2)
  assert.equal(ctx.hits[0].strategyId, 'second-page')
  const shrunk = component.methods.loadHits.call(ctx)
  complete({ list: [], total: 5 })
  await shrunk
  assert.equal(ctx.hitPage, 1, 'Removing the last item on page 2 must return to page 1')
  assert.equal(deferred.length, 1, 'The corrected page must be reloaded')
  console.log('PASS frontend: shared layout with control interface/metrics retained, strategy links, pagination and last-page correction')
}

async function checkControlApi() {
  const tabType = 'control'
  const month = (await post('latestDate', { tabType })).slice(0, 7)
  const request = { tabType, statMonth: month, pageSize: 100 }
  const list = await post('touchpoint/strategyList', request)
  assert.ok(list.total > 0)
  const row = list.list[0]
  assert.ok(row.strategyName && row.consultCount > 0 && row.successCount > 0)
  assert.equal(row.pushCount, null, 'Control API must continue to return control metrics')
  const kpis = await post('overview/kpi', request)
  for (const code of ['strategy_count', 'consult_count', 'retain_count', 'dispatch_count', 'success_count', 'income']) {
    assert.ok(kpis.some(k => k.metricCode === code && k.value > 0), `Control KPI ${code}`)
  }
  const trend = await post('overview/trend', { ...request, metricCode: 'consult_count' })
  assert.ok(trend.months.length > 1)
  const channelKpis = await post('overview/kpi', { ...request, channel: row.channel })
  assert.ok(channelKpis.some(k => k.metricCode === 'strategy_count' && k.value > 0))
  assert.ok(channelKpis.some(k => k.metricCode === 'success_count' && k.value > 0))
  const [year, mon] = month.split('-').map(Number)
  const detail = { ...request, strategyId: row.strategyId, startDate: `${month}-01`, endDate: `${month}-${new Date(year, mon, 0).getDate()}` }
  const daily = await post('execution/dailyDetail', detail)
  assert.ok(daily.list.length >= 28)
  assert.equal(daily.list.reduce((n, day) => n + day.consultCount, 0), row.consultCount)
  assert.equal(daily.list.reduce((n, day) => n + day.successCount, 0), row.successCount)
  assert.ok((await post('execution/strategyInfo', detail)).strategyName)
  assert.ok((await post('execution/bizCapacity', detail)).total > 0)
  const rules = await post('warning/ruleList', { ...request, status: '生效中' })
  assert.ok(rules.total > 0)
  for (const rule of rules.list) {
    const hit = await post('warning/hitStrategyList', { ...request, ruleId: rule.id })
    if (hit.list.length) assert.ok(hit.list[0].consultCount > 0)
  }
  console.log('PASS control API: original control data, KPI/trend/channel, detail/daily totals, business and warning queries')
}

;(async () => { await checkFrontend(); await checkApi(); await checkControlApi() })().catch(error => { console.error(error); process.exitCode = 1 })
