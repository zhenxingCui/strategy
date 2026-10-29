// Copy four legacy manual-trend tables while preserving scope and publication state.
// Default is read-only inspection; --apply requires an empty target table name.
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')
const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const apply = process.argv.includes('--apply')
const sources = [
  { table: 't_sr_upgrade_stable_monthly_trend_manual', scope: 'category', classColumn: true, strategy: false, customer: false, category: true },
  { table: 't_sr_key_audience_monthly_trend_manual', scope: 'category', classColumn: false, strategy: false, customer: true, category: true },
  { table: 't_sr_upgrade_stable_strategy_monthly_trend_manual', scope: 'strategy', classColumn: true, strategy: true, customer: false, category: true },
  { table: 't_sr_key_audience_strategy_monthly_trend_manual', scope: 'strategy', classColumn: false, strategy: true, customer: false, category: false },
]
const common = ['stat_month', 'channel', 'city_id', 'county_id', 'metric_code', 'metric_value', 'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark', 'created_by', 'updated_by', 'create_time', 'update_time']

async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', multipleStatements: true, supportBigNumbers: true, bigNumberStrings: true })
  try {
    const [tables] = await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [TARGET])
    const names = new Set(tables.map(row => row.TABLE_NAME))
    if (!names.has('sr_strategy')) throw new Error('Identity migration must complete first')
    if (apply && names.has('sr_manual_trend')) throw new Error('Target table already exists; refusing to overwrite')
    for (const source of sources) {
      const [columns] = await c.query('SHOW COLUMNS FROM ??.??', [SOURCE, source.table])
      const expected = new Set(['id', ...common, ...(source.classColumn ? ['strategy_class'] : []), ...(source.strategy ? ['strategy_id'] : []), ...(source.customer ? ['customer_group'] : []), ...(source.category ? ['big_category', 'small_category'] : [])])
      const actual = new Set(columns.map(column => column.Field))
      const missing = [...expected].filter(name => !actual.has(name))
      const extra = [...actual].filter(name => !expected.has(name))
      if (missing.length || extra.length) throw new Error(`${source.table}: schema mismatch; missing=${missing.join(',')}; extra=${extra.join(',')}`)
      const [counts] = await c.query('SELECT COUNT(*) n FROM ??.??', [SOURCE, source.table])
      console.log(`${source.table}: ${counts[0].n} rows`)
    }
    if (!apply) return
    const ddl = fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/refactor/V002__manual_trend.sql'), 'utf8')
    await c.query('USE ??', [TARGET])
    await c.query(ddl)
    await c.beginTransaction()
    for (const source of sources) {
      const cls = source.classColumn ? 'x.strategy_class' : "'重点客群'"
      const strategy = source.strategy ? 'x.strategy_id' : 'NULL'
      const customer = source.customer ? 'x.customer_group' : 'NULL'
      const big = source.category ? 'x.big_category' : 'NULL'
      const small = source.category ? 'x.small_category' : 'NULL'
      const refs = source.strategy ? `LEFT JOIN ${c.escapeId(TARGET)}.sr_strategy s ON s.strategy_code=x.strategy_id AND s.strategy_class=${cls}` : ''
      const ref = source.strategy ? 's.id' : 'NULL'
      const where = source.classColumn ? "WHERE x.strategy_class IN ('升接','稳')" : ''
      const sql = `INSERT INTO ${c.escapeId(TARGET)}.sr_manual_trend (legacy_table,legacy_id,scope_type,strategy_class,strategy_code,strategy_ref,customer_group,big_category,small_category,${common.map(name => c.escapeId(name)).join(',')}) SELECT ?,x.id,?,${cls},${strategy},${ref},${customer},${big},${small},${common.map(name => `x.${c.escapeId(name)}`).join(',')} FROM ${c.escapeId(SOURCE)}.${c.escapeId(source.table)} x ${refs} ${where}`
      await c.query(sql, [source.table, source.scope])
    }
    await c.commit()
    console.log('Manual trends staged; the application remains connected to the original database.')
  } catch (error) { try { await c.rollback() } catch (_) {} throw error } finally { await c.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
