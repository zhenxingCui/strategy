// Independently verify the local source-to-target strategy identity migration.
const mysql = require('mysql2/promise')
const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const masters = ['t_sr_strategy', 't_sr_strategy_special', 't_sr_strategy_key_audience']
const fields = ['strategy_code', 'strategy_name', 'customer_group', 'channel', 'strategy_level', 'caliber', 'iteration', 'owner', 'status', 'city_id', 'county_id', 'start_date', 'end_date', 'create_time', 'update_time', 'create_by', 'update_by', 'is_deleted']
function same(left, right) {
  if (left == null || right == null) return left == null && right == null
  return String(left) === String(right)
}

async function main() {
  const conn = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true })
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    let checked = 0
    let mapped = 0
    let unresolved = 0
    const failures = []
    for (const table of masters) {
      const [rows] = await conn.query('SELECT * FROM ??.?? WHERE tab_type = ?', [SOURCE, table, 'active'])
      const [maps] = await conn.query('SELECT m.*, s.* FROM ??.sr_legacy_strategy_map m LEFT JOIN ??.sr_strategy s ON s.id = m.strategy_id WHERE m.legacy_table = ?', [TARGET, TARGET, table])
      const byId = new Map(maps.map(row => [String(row.legacy_id), row]))
      if (maps.length !== rows.length) failures.push(`${table}: source ${rows.length}, maps ${maps.length}`)
      for (const source of rows) {
        checked++
        const target = byId.get(String(source.id))
        if (!target) { failures.push(`${table}/${source.id}: missing mapping`); continue }
        const original = typeof target.original_data === 'string' ? JSON.parse(target.original_data) : target.original_data
        for (const [field, value] of Object.entries(source)) {
          if (!same(original[field], value)) failures.push(`${table}/${source.id}: original ${field} differs`)
        }
        if (!target.strategy_id) { unresolved++; if (!target.reason) failures.push(`${table}/${source.id}: missing unresolved reason`); continue }
        mapped++
        for (const field of fields) {
          if (!same(target[field], source[field])) failures.push(`${table}/${source.id}: ${field} differs`)
        }
        if (source.strategy_class && source.strategy_class !== target.strategy_class) failures.push(`${table}/${source.id}: class differs`)
      }
    }
    const [[counts]] = await conn.query('SELECT (SELECT COUNT(*) FROM ??.sr_strategy) AS strategies, (SELECT COUNT(*) FROM ??.sr_legacy_strategy_map) AS maps', [TARGET, TARGET])
    if (Number(counts.strategies) !== mapped || Number(counts.maps) !== checked) failures.push('Target totals do not match source mappings')
    await conn.commit()
    console.log(JSON.stringify({ checked, mapped, unresolved, failures: failures.length }, null, 2))
    failures.slice(0, 20).forEach(failure => console.error(failure))
    if (failures.length) process.exitCode = 1
  } finally { await conn.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
