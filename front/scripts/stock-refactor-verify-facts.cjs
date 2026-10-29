// Compare every copied source fact field with its staged counterpart.
const mysql = require('mysql2/promise')
const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const retained = ['升接', '稳', '降拆', '离', '重点客群']
const groups = [
  { target: 'sr_strategy_monthly', sources: ['t_sr_strategy_period_summary_ap', 't_sr_strategy_period_summary_ap_special', 't_sr_strategy_period_summary_ap_key_audience'] },
  { target: 'sr_strategy_daily', sources: ['t_sr_strategy_daily_ap', 't_sr_strategy_daily_ap_special', 't_sr_strategy_daily_ap_key_audience'] },
]
async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', supportBigNumbers: true, bigNumberStrings: true })
  try {
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    let failures = 0
    for (const group of groups) {
      const [columns] = await c.query('SHOW COLUMNS FROM ??.??', [TARGET, group.target])
      const names = columns.map(column => column.Field).filter(column => !['id', 'legacy_table', 'legacy_id', 'strategy_ref', 'row_kind'].includes(column))
      for (const source of group.sources) {
        const conditions = names.map(column => {
          const original = group.target === 'sr_strategy_daily' && source === 't_sr_strategy_daily_ap' && column === 'stat_date' ? 'stat_month' : column
          return `(x.${c.escapeId(original)} <=> y.${c.escapeId(column)})`
        }).join(' AND ')
        const sql = `SELECT COUNT(*) AS source_count, SUM(y.id IS NULL) AS missing, SUM(y.id IS NOT NULL AND NOT (${conditions})) AS changed, SUM(y.id IS NOT NULL AND NOT (y.row_kind <=> CASE WHEN x.strategy_id='999' THEN 'aggregate' WHEN s.id IS NULL THEN 'unresolved' ELSE 'detail' END)) AS wrong_kind, SUM(y.id IS NOT NULL AND NOT (y.strategy_ref <=> s.id)) AS wrong_ref FROM ${c.escapeId(SOURCE)}.${c.escapeId(source)} x LEFT JOIN ${c.escapeId(TARGET)}.${c.escapeId(group.target)} y ON y.legacy_table=? AND y.legacy_id=x.id LEFT JOIN ${c.escapeId(TARGET)}.sr_strategy s ON s.strategy_code=x.strategy_id AND s.strategy_class=x.strategy_class WHERE x.tab_type=? AND x.strategy_class IN (?)`
        const [[row]] = await c.query(sql, [source, 'active', retained])
        const [[target]] = await c.query('SELECT COUNT(*) n FROM ??.?? WHERE legacy_table=?', [TARGET, group.target, source])
        const ok = Number(row.source_count) === Number(target.n) && !Number(row.missing) && !Number(row.changed) && !Number(row.wrong_kind) && !Number(row.wrong_ref)
        if (!ok) failures++
        console.log(JSON.stringify({ source, target: group.target, ...row, target_count: target.n, ok }))
      }
      const [unknown] = await c.query('SELECT legacy_table, COUNT(*) n FROM ??.?? WHERE legacy_table NOT IN (?) GROUP BY legacy_table', [TARGET, group.target, group.sources])
      if (unknown.length) { failures++; console.error('Unexpected source tables:', JSON.stringify(unknown)) }
    }
    await c.commit()
    if (failures) process.exitCode = 1
  } finally { await c.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
