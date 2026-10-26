// Read-only regression checks: category options must describe the complete strategy list.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const babel = require('@babel/core')
const compiler = require('vue-template-compiler')
const Vue = require('vue')
Vue.config.silent = true
const root = path.resolve(__dirname, '../src/views/strategyReview/active')
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const parsed = file.endsWith('.vue') ? compiler.parseComponent(source) : null
  if (parsed) assert.deepEqual(compiler.compile(parsed.template.content).errors, [])
  const code = babel.transformSync(parsed ? parsed.script.content : source, {
    babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require: key => {
    assert.ok(key in imports, `Unexpected import: ${key}`)
    return imports[key]
  } })
  return module.exports
}
const flush = () => new Promise(resolve => setImmediate(resolve))
async function componentChecks() {
  const calls = []
  const component = load('StockDetail.vue', {
    '@/api/strategyReview': {
      getStrategyCategoryOptions: query => new Promise((resolve, reject) => calls.push({ query, resolve, reject })),
      getStrategyList: async () => ({ list: [], total: 0 }),
    },
    '@/components/EChart.vue': {}, './ReviewState.vue': {}, './ReviewTable.vue': {},
    './reviewData': load('reviewData.js'), './simulationTrend': { visibleSimulationTrend: (query, trend) => trend },
  }).default
  const query = { tabType: 'active', strategyClass: '升接', statMonth: '2026-10', channel: '01', cityId: '999', countyId: '01' }
  const instance = new (Vue.extend(component))({ propsData: { query } })
  assert.deepEqual({ ...calls[0].query }, { ...query, bigCategory: '', smallCategory: '' })
  calls.shift().resolve([
    { bigCategory: '升档', smallCategory: '套餐焕新' },
    { bigCategory: '升档', smallCategory: '套餐焕新' },
    { bigCategory: '接盘', smallCategory: '到期承接' },
    { bigCategory: '家庭业务', smallCategory: '宽带' },
  ])
  await flush()
  assert.deepEqual(Array.from(instance.bigCategories), ['升档', '接盘', '家庭业务'])
  instance.draftBigCategory = '升档'
  assert.deepEqual(Array.from(instance.smallCategories), ['套餐焕新'])
  instance.draftSmallCategory = '套餐焕新'
  instance.search()
  assert.equal(instance.bigCategory, '升档')
  assert.equal(instance.smallCategory, '套餐焕新')
  instance.changePage(2)
  assert.equal(calls.length, 0, 'Pagination must not shrink dropdown options to one page')
  instance.resetSearch()
  assert.equal(instance.bigCategory, '')
  assert.equal(instance.smallCategory, '')
  instance.query = { ...query, channel: '02', statMonth: '2026-09' }
  await Vue.nextTick()
  assert.equal(instance.categoryRows.length, 0, 'Clear old scope options while loading')
  const old = calls.shift()
  instance.query = { ...query, tabType: 'control', productName: '宽带', customerGroup: '校园' }
  await Vue.nextTick()
  const current = calls.shift()
  assert.equal(current.query.productName, '宽带')
  assert.equal(current.query.customerGroup, '校园')
  current.resolve([{ bigCategory: '权益', smallCategory: '宽带' }])
  await flush()
  old.resolve([{ bigCategory: '旧分类', smallCategory: '旧小类' }])
  await flush()
  assert.deepEqual(Array.from(instance.bigCategories), ['权益'], 'Late response must not restore stale options')
  const failed = instance.loadCategoryOptions()
  calls.shift().reject(new Error('offline'))
  await failed
  assert.equal(instance.panels.categoryOptions.error, 'offline')
  assert.equal(instance.categoryRows.length, 0)
  const retry = instance.loadCategoryOptions()
  calls.shift().resolve([])
  await retry
  assert.equal(instance.panels.categoryOptions.error, '')
  assert.equal(instance.bigCategories.length, 0)
  instance.$destroy()
  console.log('PASS component: complete options, dependent small categories, search/reset, pagination, scope changes, stale responses, error/retry/empty')
}
const base = process.env.SR_API_BASE || 'http://127.0.0.1:8080/plan-svc-lj/strategyReview'
async function api(endpoint, query) {
  const response = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cityId: '999', userId: 'category-options-check', ...query }), signal: AbortSignal.timeout(20000) })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.status, 'SUCCESS', body.message)
  return body.data
}
const pair = row => JSON.stringify([row.bigCategory, row.smallCategory])
async function verifyScope(query) {
  const options = await api('/touchpoint/strategyCategoryOptions', query)
  const all = []
  let total = Infinity
  for (let pageNum = 1; all.length < total; pageNum++) {
    const page = await api('/touchpoint/strategyList', { ...query, pageNum, pageSize: 500 })
    total = page.total
    all.push(...page.list)
    assert.ok(page.list.length || total === 0, 'Pagination must advance')
  }
  assert.deepEqual(new Set(options.map(pair)), new Set(all.map(pair)), `Options differ from full list: ${JSON.stringify(query)}`)
  for (const option of options) {
    const result = await api('/touchpoint/strategyList', { ...query, ...option, pageSize: 10 })
    assert.ok(result.total > 0, `Option has no rows: ${pair(option)}`)
    assert.ok(result.list.every(row => (!option.bigCategory || row.bigCategory === option.bigCategory)
      && (!option.smallCategory || row.smallCategory === option.smallCategory)), `Wrong rows for option: ${pair(option)}`)
  }
  console.log(JSON.stringify({ query, total, categories: [...new Set(options.map(row => row.bigCategory))], pairs: options.length }))
  return all
}
async function apiChecks() {
  for (const scope of [
    ...['全部', '升接', '稳', '降拆', '离', '重点客群'].map(strategyClass => ({ tabType: 'active', strategyClass })),
    { tabType: 'passive' }, { tabType: 'control' },
  ]) {
    const latest = await api('/latestDate', scope)
    const query = { ...scope, statMonth: latest.replace(/^(\d{4})-?(\d{2}).*$/, '$1-$2') }
    const all = await verifyScope(query)
    if (all.length) {
      await verifyScope({ ...query, channel: all[0].channel })
      await verifyScope({ ...query, strategyName: all[0].strategyName })
      if (scope.tabType === 'control') await verifyScope({ ...query, productName: all[0].smallCategory })
    }
  }
  await verifyScope({ tabType: 'active', strategyClass: '升接', statMonth: '2026-09' })
  const groupScope = { tabType: 'active', strategyClass: '重点客群', statMonth: '2026-10' }
  const groups = await api('/dim', { ...groupScope, type: '客群分类' })
  assert.ok(groups.length, 'Customer group scope must contain data')
  await verifyScope({ ...groupScope, customerGroup: groups[0].keyCode })
  await verifyScope({ tabType: 'active', strategyClass: '升接', statMonth: '2026-10', cityId: 'no-data' })
  console.log('PASS API: all strategy classes/pages, complete pagination, channel/name/product/customer group/month/region scopes and every category pair')
}
componentChecks().then(() => process.argv.includes('--api') ? apiChecks() : undefined).catch(error => { console.error(error); process.exitCode = 1 })
