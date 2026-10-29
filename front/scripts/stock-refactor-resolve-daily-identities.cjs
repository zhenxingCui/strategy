// Resolve previously unclassified masters only when all retained month/day facts
// agree on exactly one class. Default is read-only; --apply uses one transaction.
const mysql = require('mysql2/promise')
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const apply = process.argv.includes('--apply')
const fields = ['strategy_code', 'strategy_name', 'strategy_class', 'customer_group', 'channel', 'strategy_level', 'caliber', 'iteration', 'owner', 'status', 'city_id', 'county_id', 'start_date', 'end_date', 'create_time', 'update_time', 'create_by', 'update_by', 'is_deleted']

async function main() {
  const c = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true })
  try {
    await c.query('USE ??', [TARGET])
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await c.beginTransaction()
    const [candidates] = await c.query("SELECT m.legacy_table,m.legacy_id,m.original_data, f.strategy_class FROM sr_legacy_strategy_map m JOIN (SELECT strategy_id, MIN(strategy_class) strategy_class FROM (SELECT strategy_id,strategy_class FROM sr_strategy_monthly WHERE is_deleted=0 AND strategy_id IS NOT NULL AND strategy_id<>'999' UNION ALL SELECT strategy_id,strategy_class FROM sr_strategy_daily WHERE is_deleted=0 AND strategy_id IS NOT NULL AND strategy_id<>'999') facts GROUP BY strategy_id HAVING COUNT(DISTINCT strategy_class)=1) f ON f.strategy_id=m.strategy_code WHERE m.status='unresolved' AND m.reason='classification unavailable'")
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'inspect', candidates: candidates.length, classes: candidates.reduce((a, row) => { a[row.strategy_class] = (a[row.strategy_class] || 0) + 1; return a }, {}) }))
    if (!apply) { await c.rollback(); return }
    for (const candidate of candidates) {
      const original = typeof candidate.original_data === 'string' ? JSON.parse(candidate.original_data) : candidate.original_data
      const values = fields.map(field => field === 'strategy_class' ? candidate.strategy_class : original[field] == null ? null : original[field])
      const [insert] = await c.query('INSERT INTO sr_strategy (??) VALUES (?)', [fields, values])
      const [updated] = await c.query("UPDATE sr_legacy_strategy_map SET strategy_id=?, status='mapped', reason=NULL WHERE legacy_table=? AND legacy_id=? AND status='unresolved' AND reason='classification unavailable'", [insert.insertId, candidate.legacy_table, candidate.legacy_id])
      if (updated.affectedRows !== 1) throw new Error('Legacy mapping changed during resolution')
      for (const table of ['sr_strategy_monthly', 'sr_strategy_daily']) {
        await c.query("UPDATE ?? SET strategy_ref=?, row_kind='detail' WHERE strategy_id=? AND strategy_class=? AND row_kind='unresolved'", [table, insert.insertId, original.strategy_code, candidate.strategy_class])
      }
    }
    await c.commit()
    console.log('Resolved identity and fact links without changing source data.')
  } catch (error) {
    try { await c.rollback() } catch (_) {}
    throw error
  } finally { await c.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
