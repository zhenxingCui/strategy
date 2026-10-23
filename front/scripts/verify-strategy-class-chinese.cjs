// Regression checks use connection-local temporary tables; existing data is untouched.
const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const mysql = require('mysql2/promise')
const babel = require('@babel/core')

function load(relative) {
  const filename = path.resolve(__dirname, '..', relative)
  let source = fs.readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = require('vue-template-compiler').parseComponent(source).script.content
  const code = babel.transformSync(source, {
    filename, configFile: false, babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ getCityId: () => '001', getUserId: () => 'test' }), console, Number, Date })
  return module.exports
}

function frontend() {
  const data = load('src/views/strategyReview/active/reviewData.js')
  const format = data.strategyColumns.find(c => c.prop === 'strategyClass').format
  for (const value of ['全部', '升接', '稳', '降拆', '离', '重点客群']) assert.equal(format(value), value)
  const entry = load('src/views/strategyReview/active/ActiveReview.vue').default
  for (const tabType of ['active', 'passive', 'control']) {
    assert.equal(entry.computed.query.call({ tabType, productName: '宽带' }).productName, tabType === 'control' ? '宽带' : '')
  }
  const productSwitching = { productName: '宽带', selectedStrategy: { strategyId: 'old' } }
  entry.methods.changeProduct.call(productSwitching, '移动套餐')
  assert.equal(productSwitching.productName, '移动套餐')
  assert.equal(productSwitching.selectedStrategy, null)
  const tabSwitching = { productName: '宽带', bootstrap() {}, loadChannels() {}, loadCustomerGroups() {}, loadProducts() {} }
  entry.watch.tabType.call(tabSwitching)
  assert.equal(tabSwitching.productName, '')
  for (const [tabType, strategyClass, expected] of [['active', '重点客群', '高价值客群'], ['active', '升接', ''], ['passive', '重点客群', ''], ['control', '重点客群', '']]) {
    assert.equal(entry.computed.query.call({ tabType, strategyClass, customerGroup: '高价值客群' }).customerGroup, expected)
  }
  const switching = { strategyClass: '重点客群', customerGroup: '高价值客群', selectedStrategy: { strategyId: 'old' } }
  entry.methods.changeStrategyClass.call(switching, '升接')
  assert.equal(switching.customerGroup, '')
  assert.equal(switching.selectedStrategy, null)
  entry.methods.changeCustomerGroup.call(switching, '家庭客群')
  assert.equal(switching.customerGroup, '家庭客群')
  for (const strategyClass of ['', '全部', '升接', '稳', '降拆', '离', '重点客群']) {
    assert.equal(entry.computed.query.call({ tabType: 'active', strategyClass }).strategyClass, strategyClass || '全部')
    assert.equal(entry.computed.query.call({ tabType: 'passive', strategyClass }).strategyClass, '全部')
  }
  for (const name of ['StockOverview', 'StockExecution']) {
    const component = load(`src/views/strategyReview/active/${name}.vue`).default
    for (const strategyClass of ['全部', '升接', '稳', '降拆', '离', '重点客群']) {
      assert.equal(component.computed.isDowngrade.call({ query: { tabType: 'active', strategyClass } }), strategyClass === '降拆')
    }
    assert.equal(component.computed.isDowngrade.call({ query: { tabType: 'passive', strategyClass: '降拆' } }), false)
    if (name === 'StockOverview') {
      assert.equal(component.computed.isKeyAudience.call({ query: { tabType: 'active', strategyClass: '重点客群' } }), true)
      assert.equal(component.computed.isKeyAudience.call({ query: { tabType: 'active', strategyClass: '升接' } }), false)
      const categories = component.computed.categories.call({ query: { tabType: 'active' } })
      assert.equal(categories.map(c => c.value).join(','), '全部,升接,稳,降拆,离,重点客群')
      const groups = strategyClass => component.computed.groups.call({ query: { tabType: 'active', strategyClass }, isDowngrade: false })
      assert.equal(JSON.stringify(groups('重点客群')), JSON.stringify(groups('升接')))
    }
  }
  const columns = [{ prop: 'bigCategory', label: '策略大类' }]
  assert.equal(data.categoryLabelColumns(columns, { tabType: 'active', strategyClass: '降拆' })[0].label, '场景大类')
  console.log('PASS frontend: Chinese categories, display, default total, downgrade behavior')
}

async function migration() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1', port: 3306,
    database: process.env.SR_DB_NAME || 'strategy_review_active_class_local',
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    charset: 'utf8mb4',
  })
  try {
    const summary = ['t_sr_kpi_summary', 't_sr_channel_summary_ap', 't_sr_channel_monthly_capacity_ap', 't_sr_channel_biz_capacity_ap']
    const tables = ['t_sr_strategy', ...summary, 't_sr_strategy_period_summary_ap', 't_sr_strategy_daily_ap']
    const classes = ['UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN', null, '全部', '升接']
    const expected = ['升接', '稳', '降拆', '离', null, '全部', '升接']
    for (const table of tables) {
      await connection.query(`CREATE TEMPORARY TABLE \`${table}\` (id INT AUTO_INCREMENT PRIMARY KEY, tab_type VARCHAR(32), strategy_class VARCHAR(16), strategy_id VARCHAR(64), value INT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      for (const tab of ['active', 'passive', 'control']) {
        for (const [i, value] of classes.entries()) {
          await connection.execute(`INSERT INTO \`${table}\` (tab_type,strategy_class,strategy_id,value) VALUES (?,?,?,?)`, [tab, value, 'real', i + 1])
        }
      }
      await connection.execute(`INSERT INTO \`${table}\` (tab_type,strategy_class,strategy_id,value) VALUES ('active',NULL,'999',99)`)
    }
    const sql = fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_strategy_class_chinese.sql'), 'utf8')
    const nonActiveSql = fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_non_active_class_all.sql'), 'utf8')
    const statements = (sql + '\n' + nonActiveSql).replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
    // Execute twice to verify idempotence as well as the mapping and scope.
    for (let run = 0; run < 2; run++) {
      for (const statement of statements) await connection.query(statement)
      for (const table of tables) {
        const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id`)
        assert.equal(rows.length, 22)
        rows.forEach((row, i) => {
          const index = i % classes.length
          let value = row.tab_type === 'active' ? expected[index] : (classes[index] === null ? '全部' : classes[index])
          if (i === 21) value = summary.includes(table) || table === 't_sr_strategy_period_summary_ap' ? '全部' : null
          else if (row.tab_type === 'active' && index === 4 && summary.includes(table)) value = '全部'
          assert.equal(row.strategy_class, value, `${table} row ${i}, run ${run}`)
          assert.equal(row.value, i === 21 ? 99 : index + 1)
        })
      }
    }
    console.log('PASS MySQL migration: four mappings, totals, unclassified details, non-active NULL-to-total, unchanged rows/metrics, repeat execution')
  } finally {
    await connection.end()
  }
}

;(async () => { frontend(); await migration() })().catch(error => { console.error(error); process.exitCode = 1 })
