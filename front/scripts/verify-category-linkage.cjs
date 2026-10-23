// Component regression checks with controlled API responses; no database writes.
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const babel = require('@babel/core')
const compiler = require('vue-template-compiler')
const Vue = require('vue')
Vue.config.silent = true
const root = path.resolve(__dirname, '../src/views/strategyReview/active')
function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const parsed = file.endsWith('.vue') ? compiler.parseComponent(source) : null
  if (parsed) assert.deepEqual(compiler.compile(parsed.template.content).errors, [], `${file}: template`)
  const code = babel.transformSync(parsed ? parsed.script.content : source, {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, window: { removeEventListener() {} }, require: key => {
    assert.ok(key in imports, `Unexpected import: ${key}`)
    return imports[key]
  } }, { filename: file })
  return module.exports
}
const reviewData = load('reviewData.js')
const pending = []
const calls = []
const api = Object.fromEntries(['getCategorySummary', 'getChannelCapacityTrend', 'getChannelBizCapacity'].map(name => [
  name, query => new Promise((resolve, reject) => {
    const call = { name, query: { ...query }, resolve, reject }
    calls.push(call)
    pending.push(call)
  }),
]))
const component = load('StockExecution.vue', {
  '@/api/strategyReview': api, '@/components/EChart.vue': {}, './ReviewTable.vue': {}, './ReviewState.vue': {}, './reviewData': reviewData,
}).default
const tableComponent = load('ReviewTable.vue', {
  './ReviewState.vue': {}, './reviewData': reviewData, '../utils/csvExport': {},
}).default
const first = { bigCategory: '套餐运营', smallCategory: '套餐升档' }
const second = { bigCategory: '权益运营', smallCategory: '套餐升档' }
const flush = () => new Promise(resolve => setImmediate(resolve))
async function settle() {
  pending.splice(0).forEach(call => call.resolve([]))
  await flush()
}
function checkPair(instance, big, small) {
  const pair = calls.slice(-2)
  assert.equal(pair[0].name, 'getChannelCapacityTrend')
  assert.equal(pair[1].name, 'getChannelBizCapacity')
  for (const call of pair) {
    assert.equal(call.query.bigCategory, big)
    assert.equal(call.query.smallCategory, small)
    for (const [key, value] of Object.entries(instance.query)) assert.equal(call.query[key], value)
  }
}
async function main() {
  for (const tabType of ['active', 'passive', 'control']) {
    const query = { tabType, statMonth: '2026-10', channel: '01', strategyClass: '重点客群', customerGroup: '校园', productName: '宽带', cityId: '001', userId: 'test' }
    const instance = new (Vue.extend(component))({ propsData: { query } })
    checkPair(instance, '', '')
    await settle()
    instance.categories = [first, second]
    instance.bizPage = 3
    instance.selectCategory(first)
    assert.equal(instance.bizPage, 1)
    checkPair(instance, first.bigCategory, first.smallCategory)
    const old = pending.splice(0)
    instance.selectCategory(second)
    checkPair(instance, second.bigCategory, second.smallCategory)
    pending.splice(0).forEach(call => call.resolve([{ capacity: 22 }]))
    await flush()
    old.forEach(call => call.resolve([{ capacity: 11 }]))
    await flush()
    assert.equal(instance.trend[0].capacity, 22, 'Late trend must not overwrite current selection')
    assert.equal(instance.biz[0].capacity, 22, 'Late business response must not overwrite current selection')
    assert.notEqual(instance.categoryKey(first), instance.categoryKey(second), 'Same small category in different parents')
    const count = calls.length
    instance.selectCategory(second)
    instance.page = 2
    assert.equal(calls.length, count, 'Re-click and left pagination preserve selection without duplicate requests')
    instance.draftBig = first.bigCategory
    instance.search()
    assert.equal(instance.selectedCategory, null)
    checkPair(instance, first.bigCategory, '')
    await settle()
    instance.selectCategory(first)
    await settle()
    instance.clearSelection()
    checkPair(instance, first.bigCategory, '')
    await settle()
    instance.reset()
    checkPair(instance, '', '')
    await settle()
    instance.selectCategory(first)
    await settle()
    instance.query = { ...query, channel: '02', statMonth: '2026-09' }
    await Vue.nextTick()
    assert.equal(instance.selectedCategory, null)
    assert.equal(instance.draftBig, '')
    checkPair(instance, '', '')
    await settle()
    instance.selectCategory(first)
    pending.splice(0).forEach(call => call.reject(new Error('test failure')))
    await flush()
    assert.equal(instance.panels.trend.error, 'test failure')
    instance.loadTrend()
    assert.equal(calls.at(-1).query.smallCategory, first.smallCategory, 'Retry keeps category')
    await settle()
    assert.equal(instance.trend.length, 0, 'Empty result clears old chart')
    instance.$destroy()
  }
  const table = new (Vue.extend(tableComponent))({ propsData: { rowClickable: true, getRowKey: component.methods.categoryKey } })
  let selections = 0
  table.$on('row-click', row => { assert.equal(row, first); selections++ })
  table.activateRow(first, { target: { closest: () => null } })
  table.activateRow(first, { target: { closest: () => ({}) } })
  const target = {}
  for (const key of ['Enter', ' ']) table.activateRowByKey(first, { key, target, currentTarget: target, preventDefault() {} })
  assert.equal(selections, 3, 'Mouse and keyboard work; nested controls do not select rows')
  table.rowClickable = false
  table.activateRow(first, { target: { closest: () => null } })
  assert.equal(selections, 3, 'Other tables retain existing behavior')
  table.$destroy()
  console.log('PASS: all three pages, shared filters, selection, pagination, search/reset/clear, stale responses, empty/error/retry, keyboard and template compilation')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
