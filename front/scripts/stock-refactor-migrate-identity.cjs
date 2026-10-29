// Creates an isolated local target containing a first-pass strategy identity map.
// Default is read-only inspection; --apply requires an existing source dump.
const fs = require('node:fs')
const path = require('node:path')
const mysql = require('mysql2/promise')

const SOURCE = 'strategy_review_active_class_local'
const TARGET = 'strategy_review_refactor_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error('Only loopback MySQL is allowed')
const apply = process.argv.includes('--apply')
const backupArg = process.argv.find(arg => arg.startsWith('--backup='))
const allowed = new Set(['升接', '稳', '降拆', '离', '重点客群'])
const masterTables = ['t_sr_strategy', 't_sr_strategy_special', 't_sr_strategy_key_audience']
const factTables = ['t_sr_strategy_period_summary_ap', 't_sr_strategy_period_summary_ap_special', 't_sr_strategy_period_summary_ap_key_audience']
const fields = ['strategy_code', 'strategy_name', 'strategy_class', 'customer_group', 'channel', 'strategy_level', 'caliber', 'iteration', 'owner', 'status', 'city_id', 'county_id', 'start_date', 'end_date', 'create_time', 'update_time', 'create_by', 'update_by', 'is_deleted']

async function main() {
  if (apply) {
    const backup = backupArg && path.resolve(backupArg.slice('--backup='.length))
    if (!backup || !fs.existsSync(backup) || fs.statSync(backup).size < 1024) throw new Error('--apply requires an existing nonempty --backup=<source SQL dump>')
    const head = Buffer.alloc(8192)
    const fd = fs.openSync(backup, 'r')
    let bytes
    try { bytes = fs.readSync(fd, head, 0, head.length, 0) } finally { fs.closeSync(fd) }
    if (!head.subarray(0, bytes).toString('utf8').includes(`Database: ${SOURCE}`)) throw new Error('Backup header does not identify the expected source database')
  }
  const conn = await mysql.createConnection({ host: HOST, port: Number(process.env.SR_DB_PORT || 3306), user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, multipleStatements: true })
  try {
    const [databases] = await conn.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?, ?)', [SOURCE, TARGET])
    if (!databases.some(row => row.SCHEMA_NAME === SOURCE)) throw new Error('Source local database does not exist')
    if (apply && databases.some(row => row.SCHEMA_NAME === TARGET)) throw new Error('Target already exists; refusing to overwrite')
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    const candidates = new Map()
    for (const table of factTables) {
      const [rows] = await conn.query('SELECT DISTINCT strategy_id, strategy_class FROM ??.?? WHERE tab_type = ? AND is_deleted = 0 AND strategy_id IS NOT NULL AND strategy_id != ? AND strategy_class IN (?)', [SOURCE, table, 'active', '999', [...allowed]])
      for (const row of rows) {
        if (!candidates.has(row.strategy_id)) candidates.set(row.strategy_id, new Set())
        candidates.get(row.strategy_id).add(row.strategy_class)
      }
    }
    const records = []
    for (const table of masterTables) {
      const [rows] = await conn.query('SELECT * FROM ??.?? WHERE tab_type = ?', [SOURCE, table, 'active'])
      for (const row of rows) {
        const options = [...(candidates.get(row.strategy_code) || [])]
        let cls = allowed.has(row.strategy_class) ? row.strategy_class : null
        let reason = null
        if (row.is_deleted) reason = 'legacy logical deletion'
        else if (!row.strategy_code || !row.strategy_code.trim()) reason = 'missing strategy code'
        else if (row.strategy_class && !cls) reason = 'outside retained classes'
        else if (options.length > 1 || (cls && options.length && !options.includes(cls))) reason = 'conflicting fact classifications'
        else if (!cls && options.length === 1) cls = options[0]
        else if (!cls) reason = 'classification unavailable'
        records.push({ table, row, cls, reason })
      }
    }
    const eligible = records.filter(record => !record.reason)
    const seen = new Map()
    for (const record of eligible) {
      if (seen.has(record.row.strategy_code)) throw new Error(`Duplicate eligible strategy code ${record.row.strategy_code}; inspect before migration`)
      seen.set(record.row.strategy_code, record)
    }
    await conn.commit()
    const counts = records.reduce((result, record) => { const key = record.reason || `mapped:${record.cls}`; result[key] = (result[key] || 0) + 1; return result }, {})
    console.log(JSON.stringify({ source: SOURCE, target: TARGET, mode: apply ? 'apply' : 'inspect', total: records.length, counts }, null, 2))
    if (!apply) return
    await conn.query('CREATE DATABASE ?? DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci', [TARGET])
    await conn.query('USE ??', [TARGET])
    const ddl = fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/refactor/V001__strategy_identity.sql'), 'utf8')
    await conn.query(ddl)
    await conn.beginTransaction()
    for (const record of records) {
      let newId = null
      if (!record.reason) {
        const values = fields.map(field => field === 'strategy_class' ? record.cls : record.row[field] == null ? null : record.row[field])
        const [result] = await conn.query('INSERT INTO sr_strategy (??) VALUES (?)', [fields, values])
        newId = result.insertId
      }
      await conn.query('INSERT INTO sr_legacy_strategy_map (legacy_table, legacy_id, strategy_id, strategy_code, status, reason, original_data) VALUES (?, ?, ?, ?, ?, ?, ?)', [record.table, record.row.id, newId, record.row.strategy_code, record.reason ? 'unresolved' : 'mapped', record.reason, JSON.stringify(record.row)])
    }
    await conn.commit()
    console.log('Identity migration complete; the application has not been switched to the target database.')
  } catch (error) {
    try { await conn.rollback() } catch (_) {}
    throw error
  } finally { await conn.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
