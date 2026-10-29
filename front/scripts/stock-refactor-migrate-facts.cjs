// Move retained class facts into isolated, lineage-preserving local tables.
// Default is read-only inspection; --apply never replaces existing target tables.
const mysql = require('mysql2/promise')
const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const apply = process.argv.includes('--apply')
const groups = [
  { target: 'sr_strategy_monthly', template: 't_sr_strategy_period_summary_ap', sources: ['t_sr_strategy_period_summary_ap', 't_sr_strategy_period_summary_ap_special', 't_sr_strategy_period_summary_ap_key_audience'] },
  { target: 'sr_strategy_daily', template: 't_sr_strategy_daily_ap_special', sources: ['t_sr_strategy_daily_ap', 't_sr_strategy_daily_ap_special', 't_sr_strategy_daily_ap_key_audience'] },
]
const retained = ['升接', '稳', '降拆', '离', '重点客群']

async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', multipleStatements: true, supportBigNumbers: true, bigNumberStrings: true })
  try {
    const [targets] = await c.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [TARGET])
    const targetNames = new Set(targets.map(row => row.TABLE_NAME))
    if (!targetNames.has('sr_strategy') || !targetNames.has('sr_legacy_strategy_map')) throw new Error('Identity migration must complete first')
    if (apply && groups.some(group => targetNames.has(group.target))) throw new Error('Target fact tables already exist; refusing to overwrite')
    const report = []
    for (const group of groups) {
      const [templateColumns] = await c.query('SHOW COLUMNS FROM ??.??', [SOURCE, group.template])
      const expected = new Set(templateColumns.map(column => column.Field))
      for (const source of group.sources) {
        const [sourceColumns] = await c.query('SHOW COLUMNS FROM ??.??', [SOURCE, source])
        const actual = new Set(sourceColumns.map(column => group.target === 'sr_strategy_daily' && source === 't_sr_strategy_daily_ap' && column.Field === 'stat_month' ? 'stat_date' : column.Field))
        const missing = [...expected].filter(column => !actual.has(column))
        const extra = [...actual].filter(column => !expected.has(column))
        if (missing.length || extra.length) throw new Error(`${source}: schema mismatch; missing=${missing.join(',')}; extra=${extra.join(',')}`)
        const [rows] = await c.query('SELECT x.strategy_class, COUNT(*) AS rows_count, SUM(x.strategy_id = ?) AS aggregate_count, SUM((x.strategy_id IS NULL OR x.strategy_id <> ?) AND s.id IS NULL) AS unresolved_count FROM ??.?? x LEFT JOIN ??.sr_strategy s ON s.strategy_code=x.strategy_id AND s.strategy_class=x.strategy_class WHERE x.tab_type=? AND x.strategy_class IN (?) GROUP BY x.strategy_class', ['999', '999', SOURCE, source, TARGET, 'active', retained])
        report.push({ source, classes: rows })
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'inspect', report }, null, 2))
    if (!apply) return
    for (const group of groups) {
      await c.query('CREATE TABLE ??.?? LIKE ??.??', [TARGET, group.target, SOURCE, group.template])
      await c.query('ALTER TABLE ??.?? ADD COLUMN legacy_table VARCHAR(64) NOT NULL, ADD COLUMN legacy_id BIGINT NOT NULL, ADD COLUMN strategy_ref BIGINT DEFAULT NULL, ADD COLUMN row_kind VARCHAR(16) NOT NULL, ADD UNIQUE KEY uk_legacy_fact (legacy_table, legacy_id), ADD KEY idx_strategy_ref (strategy_ref)', [TARGET, group.target])
    }
    await c.beginTransaction()
    for (const group of groups) {
      const [targetColumns] = await c.query('SHOW COLUMNS FROM ??.??', [TARGET, group.target])
      const columns = targetColumns.map(column => column.Field).filter(column => !['id', 'legacy_table', 'legacy_id', 'strategy_ref', 'row_kind'].includes(column))
      for (const source of group.sources) {
        const [sourceColumns] = await c.query('SHOW COLUMNS FROM ??.??', [SOURCE, source])
        const available = new Set(sourceColumns.map(column => column.Field))
        const sourceFields = columns.map(column => group.target === 'sr_strategy_daily' && source === 't_sr_strategy_daily_ap' && column === 'stat_date' ? 'stat_month' : column)
        const missing = sourceFields.filter(column => !available.has(column))
        if (missing.length) throw new Error(`${source}: missing columns ${missing.join(', ')}`)
        const columnSql = columns.map(column => c.escapeId(column)).join(', ')
        const selectSql = sourceFields.map(column => `x.${c.escapeId(column)}`).join(', ')
        const sql = `INSERT INTO ${c.escapeId(TARGET)}.${c.escapeId(group.target)} (${columnSql}, legacy_table, legacy_id, strategy_ref, row_kind) SELECT ${selectSql}, ?, x.id, s.id, CASE WHEN x.strategy_id = '999' THEN 'aggregate' WHEN s.id IS NULL THEN 'unresolved' ELSE 'detail' END FROM ${c.escapeId(SOURCE)}.${c.escapeId(source)} x LEFT JOIN ${c.escapeId(TARGET)}.sr_strategy s ON s.strategy_code=x.strategy_id AND s.strategy_class=x.strategy_class WHERE x.tab_type=? AND x.strategy_class IN (?)`
        await c.query(sql, [source, 'active', retained])
      }
    }
    await c.commit()
    console.log('Fact staging complete; source and application connection unchanged.')
  } catch (error) {
    try { await c.rollback() } catch (_) {}
    throw error
  } finally { await c.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
