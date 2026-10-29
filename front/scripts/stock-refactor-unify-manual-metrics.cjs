// Consolidate six legacy manual trend / QoQ tables into t_sr_manual_metric.
// Default is read-only inspection. --apply copies once; --sync refreshes the unified copy after a legacy seeder runs.
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

const DATABASE = 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const apply = process.argv.includes('--apply')
const sync = process.argv.includes('--sync')

const rows = (table, fields) => ({ table, fields })
const sharedTrend = (type, classExpr, strategyExpr, customerExpr, bigExpr, smallExpr) => ({
  record_type: `'${type}'`,
  tab_type: `'active'`,
  strategy_class: classExpr,
  strategy_id: strategyExpr,
  strategy_name: 'NULL',
  customer_group: customerExpr,
  stat_month: 'x.stat_month',
  channel: 'x.channel',
  big_category: bigExpr,
  small_category: smallExpr,
  city_id: 'x.city_id',
  county_id: 'x.county_id',
  biz_code: `''`,
  biz_name: `''`,
  metric_code: 'x.metric_code',
  metric_value: 'x.metric_value',
  manual_qoq: 'x.manual_qoq',
  qoq_unit: 'x.qoq_unit',
  scope_hash: 'x.scope_hash',
  status: 'x.status',
  source_batch: 'x.source_batch',
  remark: 'x.remark',
  created_by: 'x.created_by',
  updated_by: 'x.updated_by',
  create_time: 'x.create_time',
  update_time: 'x.update_time',
})

const sources = [
  rows('t_sr_upgrade_stable_monthly_trend_manual', sharedTrend('category_trend', 'x.strategy_class', 'NULL', 'NULL', 'x.big_category', 'x.small_category')),
  rows('t_sr_key_audience_monthly_trend_manual', sharedTrend('category_trend', `'重点客群'`, 'NULL', 'x.customer_group', 'x.big_category', 'x.small_category')),
  rows('t_sr_upgrade_stable_strategy_monthly_trend_manual', sharedTrend('strategy_trend', 'x.strategy_class', 'x.strategy_id', 'NULL', 'x.big_category', 'x.small_category')),
  rows('t_sr_key_audience_strategy_monthly_trend_manual', sharedTrend('strategy_trend', `'重点客群'`, 'x.strategy_id', 'NULL', `'全部'`, `'全部'`)),
  rows('t_sr_strategy_biz_capacity_qoq_manual', {
    record_type: `'business_qoq'`, tab_type: 'x.tab_type', strategy_class: 'x.strategy_class',
    strategy_id: 'NULL', strategy_name: 'NULL', customer_group: 'x.customer_group',
    stat_month: 'x.stat_month', channel: 'x.channel', big_category: 'x.big_category', small_category: 'x.small_category',
    city_id: 'x.city_id', county_id: 'x.county_id', biz_code: `''`, biz_name: 'x.biz_name',
    metric_code: `'manual_qoq'`, metric_value: 'NULL', manual_qoq: 'x.manual_qoq', qoq_unit: `'percent'`,
    scope_hash: "SHA2(JSON_ARRAY(x.tab_type,x.strategy_class,x.customer_group,x.channel,x.big_category,x.small_category,x.city_id,x.county_id,x.biz_name),256)",
    status: 'x.status', source_batch: 'NULL', remark: 'x.remark', created_by: 'x.created_by', updated_by: 'x.updated_by',
    create_time: 'x.create_time', update_time: 'x.update_time',
  }),
  rows('t_sr_strategy_detail_biz_capacity_qoq_manual', {
    record_type: `'strategy_business_qoq'`, tab_type: 'x.tab_type', strategy_class: 'x.strategy_class',
    strategy_id: 'x.strategy_id', strategy_name: 'x.strategy_name', customer_group: 'NULL',
    stat_month: 'x.stat_month', channel: `'全部'`, big_category: `'全部'`, small_category: `'全部'`,
    city_id: 'x.city_id', county_id: 'x.county_id', biz_code: 'x.biz_code', biz_name: 'x.biz_name',
    metric_code: `'manual_qoq'`, metric_value: 'NULL', manual_qoq: 'x.manual_qoq', qoq_unit: `'percent'`,
    scope_hash: "SHA2(JSON_ARRAY(x.tab_type,x.strategy_class,x.strategy_id,x.biz_code,x.biz_name,x.city_id,x.county_id),256)",
    status: 'x.status', source_batch: 'NULL', remark: 'x.remark', created_by: 'x.created_by', updated_by: 'x.updated_by',
    create_time: 'x.create_time', update_time: 'x.update_time',
  }),
]

const targetColumns = ['record_type', 'tab_type', 'strategy_class', 'strategy_id', 'strategy_name', 'customer_group',
  'stat_month', 'channel', 'big_category', 'small_category', 'city_id', 'county_id', 'biz_code', 'biz_name',
  'metric_code', 'metric_value', 'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark',
  'created_by', 'updated_by', 'create_time', 'update_time']

async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    supportBigNumbers: true, bigNumberStrings: true, multipleStatements: true })
  try {
    const [[identity]] = await c.query('SELECT DATABASE() AS selected_db, @@hostname AS host, @@port AS port')
    if (identity.selected_db !== null || !['127.0.0.1', 'localhost', '::1'].includes(HOST)) {
      throw new Error('Migration connection must be local with no implicit database selected')
    }
    const [tableRows] = await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [DATABASE])
    const present = new Set(tableRows.map(row => row.TABLE_NAME))
    for (const source of sources) if (!present.has(source.table)) throw new Error(`Missing source table ${source.table}`)
    const [[targetExists]] = await c.query('SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [DATABASE, 't_sr_manual_metric'])
    console.log(JSON.stringify({ database: DATABASE, host: identity.host, mode: sync ? 'sync' : apply ? 'apply' : 'inspect', unifiedTableExists: Number(targetExists.n) === 1 }))
    for (const source of sources) {
      const [[count]] = await c.query(`SELECT COUNT(*) AS n FROM ${c.escapeId(DATABASE)}.${c.escapeId(source.table)}`)
      console.log(`${source.table}: ${count.n}`)
    }
    if (!apply && !sync) return

    await c.query('USE ??', [DATABASE])
    const ddl = fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_unify_manual_metric.sql'), 'utf8')
    await c.query(ddl)
    const [[scopeIndex]] = await c.query(`
      SELECT COUNT(*) n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_sr_manual_metric' AND INDEX_NAME='uk_manual_metric_scope'
    `, [DATABASE])
    if (Number(scopeIndex.n)) await c.query('ALTER TABLE t_sr_manual_metric DROP INDEX uk_manual_metric_scope')
    const [[lookupIndex]] = await c.query(`
      SELECT COUNT(*) n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_sr_manual_metric' AND INDEX_NAME='idx_manual_metric_scope'
    `, [DATABASE])
    if (!Number(lookupIndex.n)) await c.query('ALTER TABLE t_sr_manual_metric ADD INDEX idx_manual_metric_scope (record_type, stat_month, strategy_class, metric_code, scope_hash)')
    await c.beginTransaction()
    try {
      for (const source of sources) {
        const selectFields = Object.values(source.fields)
        const columns = ['legacy_table', 'legacy_id', ...targetColumns]
        const select = ['?', 'x.id', ...selectFields]
        const updates = targetColumns.map(name => `${c.escapeId(name)}=VALUES(${c.escapeId(name)})`).join(',')
        const insert = `INSERT INTO ${c.escapeId(DATABASE)}.t_sr_manual_metric (${columns.map(name => c.escapeId(name)).join(',')}) ` +
          `SELECT ${select.join(',')} FROM ${c.escapeId(DATABASE)}.${c.escapeId(source.table)} x ` +
          `ON DUPLICATE KEY UPDATE ${updates}`
        await c.query(insert, [source.table])
        await c.query(
          `DELETE FROM ${c.escapeId(DATABASE)}.t_sr_manual_metric WHERE legacy_table=? ` +
          `AND legacy_id NOT IN (SELECT id FROM ${c.escapeId(DATABASE)}.${c.escapeId(source.table)})`, [source.table])
      }
      await c.commit()
    } catch (error) {
      await c.rollback()
      throw error
    }

    let failures = 0
    for (const source of sources) {
      const checks = Object.entries(source.fields).map(([field, expression]) => `(y.${c.escapeId(field)} <=> ${expression})`)
      const [[counts]] = await c.query(
        `SELECT COUNT(*) source_count, SUM(y.id IS NULL) missing, ` +
        `SUM(y.id IS NOT NULL AND NOT (${checks.join(' AND ')})) changed ` +
        `FROM ${c.escapeId(DATABASE)}.${c.escapeId(source.table)} x ` +
        `LEFT JOIN ${c.escapeId(DATABASE)}.t_sr_manual_metric y ` +
        `ON y.legacy_table=? AND y.legacy_id=x.id`, [source.table])
      const [[targetCount]] = await c.query(
        'SELECT COUNT(*) n FROM ??.t_sr_manual_metric WHERE legacy_table=?', [DATABASE, source.table])
      const ok = Number(counts.source_count) === Number(targetCount.n) && Number(counts.missing || 0) === 0 && Number(counts.changed || 0) === 0
      if (!ok) failures++
      console.log(JSON.stringify({ source: source.table, ...counts, target_count: targetCount.n, ok }))
    }
    const [[total]] = await c.query('SELECT COUNT(*) n FROM ??.t_sr_manual_metric', [DATABASE])
    console.log(JSON.stringify({ unified_rows: total.n, sources: sources.length, verified: failures === 0 }))
    if (failures) process.exitCode = 1
  } finally { await c.end() }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
