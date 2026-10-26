// Read-only API regression: compare category history against existing monthly facts.
const assert = require('node:assert/strict')
const mysql = require('mysql2/promise')
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
async function api(endpoint, query) {
  const response = await fetch(`${base}/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query), signal: AbortSignal.timeout(15000),
  })
  const body = await response.json()
  assert.equal(body.status, 'SUCCESS', `${endpoint}: ${body.message}`)
  return body.data
}
async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, database: process.env.SR_DB_NAME || 'strategy_review_active_class_local',
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
  })
  let checks = 0
  try {
    for (const tabType of ['active', 'passive', 'control']) {
      const query = { tabType, cityId: '999', userId: 'category-trend-readonly', strategyClass: '全部' }
      query.statMonth = (await api('latestDate', query)).slice(0, 7)
      const category = (await api('touchpoint/categorySummary', query)).list[0]
      assert.ok(category, `${tabType}: category required`)
      const channels = await api('dim', { ...query, type: '触点渠道' })
      const scenarios = [
        { ...query, bigCategory: category.bigCategory, smallCategory: category.smallCategory },
        { ...query, bigCategory: category.bigCategory },
        { ...query, bigCategory: category.bigCategory, smallCategory: category.smallCategory, channel: channels[0].keyCode },
        { ...query, bigCategory: category.bigCategory, smallCategory: category.smallCategory, statMonth: `${query.statMonth.slice(0, 4)}-08` },
      ]
      if (tabType === 'active') scenarios.push({ ...scenarios[0], strategyClass: '稳' })
      if (tabType !== 'passive') {
        const type = tabType === 'active' ? '客群分类' : '产品名称'
        const dimensions = await api('dim', { ...query, type })
        for (const dim of dimensions) {
          const extra = tabType === 'active' ? { strategyClass: '重点客群', customerGroup: dim.keyCode } : { productName: dim.keyCode }
          const scoped = { ...query, ...extra }
          const row = (await api('touchpoint/categorySummary', scoped)).list[0]
          if (row) scenarios.push({ ...scoped, bigCategory: row.bigCategory, smallCategory: row.smallCategory })
        }
      }
      for (const scope of scenarios) {
        const where = ["is_deleted=0", "strategy_id!='999'", "channel!='全部'", "big_category!='全部'", "small_category!='全部'",
          "city_id=?", "stat_month>=DATE_SUB(CONCAT(?,'-01'),INTERVAL 12 MONTH)", "stat_month<DATE_ADD(CONCAT(?,'-01'),INTERVAL 1 MONTH)"]
        const params = [scope.cityId, scope.statMonth, scope.statMonth]
        if (tabType !== 'control') { where.push('tab_type=?'); params.push(tabType) }
        for (const [field, column] of [['bigCategory', 'big_category'], ['smallCategory', 'small_category'], ['channel', 'channel'], ['strategyClass', 'strategy_class']]) {
          if (scope[field] && scope[field] !== '全部') { where.push(`${column}=?`); params.push(scope[field]) }
        }
        if (scope.customerGroup) {
          where.push('strategy_id IN (SELECT strategy_code FROM v_sr_strategy_read WHERE tab_type=? AND is_deleted=0 AND customer_group=?)')
          params.push(tabType, scope.customerGroup)
        } else if (scope.productName) {
          where.push('small_category=?')
          params.push(scope.productName)
        }
        const table = tabType === 'control' ? 't_sr_strategy_period_summary_ctrl' : 'v_sr_strategy_period_summary_ap_read'
        const metric = 'product_conv_num'
        const [facts] = await conn.execute(`SELECT DATE_FORMAT(stat_month,'%Y-%m') month,SUM(${metric}) capacity FROM ${table} WHERE ${where.join(' AND ')} GROUP BY stat_month ORDER BY stat_month`, params)
        const expected = facts.slice(-6)
        const actual = await api('touchpoint/channelCapacityTrend', scope)
        assert.equal(actual.length, expected.length, JSON.stringify(scope))
        for (let i = 0; i < actual.length; i++) {
          assert.equal(actual[i].month.slice(0, 7), expected[i].month)
          assert.equal(Number(actual[i].capacity), Number(expected[i].capacity))
          const month = new Date(`${expected[i].month}-01T00:00:00Z`)
          month.setUTCMonth(month.getUTCMonth() - 1)
          const previous = facts.find(row => row.month === month.toISOString().slice(0, 7))
          const qoq = previous && Number(previous.capacity) !== 0
            ? Math.round((Number(expected[i].capacity) - Number(previous.capacity)) / Number(previous.capacity) * 10000) / 100 : null
          assert.equal(actual[i].qoq, qoq)
        }
        checks++
      }
      assert.ok((await api('touchpoint/channelCapacityTrend', query)).length, 'Unselected trend still available')
      const empty = await api('touchpoint/channelCapacityTrend', { ...query, bigCategory: '__nonexistent_category__' })
      assert.equal(empty.length, 0, 'Missing categories must not return all-category totals')
      console.log(`PASS ${tabType}: category trend values and previous-month comparisons match monthly facts`)
    }
    console.log(`PASS ${checks} category/channel/month/class scopes; no database writes`)
  } finally { await conn.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
