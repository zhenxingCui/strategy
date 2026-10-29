// Independently compare migrated manual values, dimensions, status and lineage.
const mysql = require('mysql2/promise')
const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const sources = [
  { table: 't_sr_upgrade_stable_monthly_trend_manual', scope: 'category', classColumn: true, strategy: false, customer: false, category: true },
  { table: 't_sr_key_audience_monthly_trend_manual', scope: 'category', classColumn: false, strategy: false, customer: true, category: true },
  { table: 't_sr_upgrade_stable_strategy_monthly_trend_manual', scope: 'strategy', classColumn: true, strategy: true, customer: false, category: true },
  { table: 't_sr_key_audience_strategy_monthly_trend_manual', scope: 'strategy', classColumn: false, strategy: true, customer: false, category: false },
]
const common = ['stat_month', 'channel', 'city_id', 'county_id', 'metric_code', 'metric_value', 'manual_qoq', 'qoq_unit', 'scope_hash', 'status', 'source_batch', 'remark', 'created_by', 'updated_by', 'create_time', 'update_time']
async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', supportBigNumbers: true, bigNumberStrings: true })
  try {
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    let failures = 0
    for (const source of sources) {
      const conditions = common.map(field => `(x.${c.escapeId(field)} <=> y.${c.escapeId(field)})`)
      conditions.push(`(y.strategy_class <=> ${source.classColumn ? 'x.strategy_class' : "'重点客群'"})`)
      conditions.push(`(y.strategy_code <=> ${source.strategy ? 'x.strategy_id' : 'NULL'})`)
      conditions.push(`(y.customer_group <=> ${source.customer ? 'x.customer_group' : 'NULL'})`)
      conditions.push(`(y.big_category <=> ${source.category ? 'x.big_category' : 'NULL'})`)
      conditions.push(`(y.small_category <=> ${source.category ? 'x.small_category' : 'NULL'})`)
      conditions.push(`(y.scope_type <=> ${c.escape(source.scope)})`)
      conditions.push(`(y.strategy_ref <=> ${source.strategy ? 's.id' : 'NULL'})`)
      const ref = source.strategy ? `LEFT JOIN ${c.escapeId(TARGET)}.sr_strategy s ON s.strategy_code=x.strategy_id AND s.strategy_class=y.strategy_class` : ''
      const where = source.classColumn ? "WHERE x.strategy_class IN ('升接','稳')" : ''
      const sql = `SELECT COUNT(*) source_count, SUM(y.id IS NULL) missing, SUM(y.id IS NOT NULL AND NOT (${conditions.join(' AND ')})) changed FROM ${c.escapeId(SOURCE)}.${c.escapeId(source.table)} x LEFT JOIN ${c.escapeId(TARGET)}.sr_manual_trend y ON y.legacy_table=? AND y.legacy_id=x.id ${ref} ${where}`
      const [[row]] = await c.query(sql, [source.table])
      const [[target]] = await c.query('SELECT COUNT(*) n FROM ??.sr_manual_trend WHERE legacy_table=?', [TARGET, source.table])
      const ok = Number(row.source_count) === Number(target.n) && !Number(row.missing) && !Number(row.changed)
      if (!ok) failures++
      console.log(JSON.stringify({ source: source.table, ...row, target_count: target.n, ok }))
    }
    const [unknown] = await c.query('SELECT legacy_table,COUNT(*) n FROM ??.sr_manual_trend WHERE legacy_table NOT IN (?) GROUP BY legacy_table', [TARGET, sources.map(source => source.table)])
    if (unknown.length) { failures++; console.error('Unexpected source tables:', JSON.stringify(unknown)) }
    await c.commit()
    if (failures) process.exitCode = 1
  } finally { await c.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
