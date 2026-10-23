const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const SOURCE_DIR = path.resolve(
  valueAfter('--source-dir') || process.env.BQQ_SQL_DIR || 'D:\\工作数据\\BQQData\\sql',
)
const APPLY = process.argv.includes('--apply')

const TABLES = [
  't_sr_strategy',
  't_sr_strategy_period_summary_ap',
  't_sr_strategy_daily_ap',
  't_sr_channel_summary_ap',
  't_sr_channel_monthly_capacity_ap',
  't_sr_channel_biz_capacity_ap',
  't_sr_strategy_biz_capacity',
  't_sr_kpi_summary',
  't_sr_strategy_reject_reason',
]

const EXPECTED_COLUMN_COUNTS = {
  t_sr_strategy: 22,
  t_sr_strategy_period_summary_ap: 53,
  t_sr_strategy_daily_ap: 28,
  t_sr_channel_summary_ap: 46,
  t_sr_channel_monthly_capacity_ap: 15,
  t_sr_channel_biz_capacity_ap: 15,
  t_sr_strategy_biz_capacity: 14,
  t_sr_kpi_summary: 17,
  t_sr_strategy_reject_reason: 14,
}

const EXTRA_COLUMNS = {
  t_sr_strategy: {
    city_id: 'VARCHAR(64) DEFAULT NULL',
    county_id: 'VARCHAR(64) DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
    create_by: 'VARCHAR(64) DEFAULT NULL',
    update_by: 'VARCHAR(64) DEFAULT NULL',
  },
  t_sr_strategy_period_summary_ap: {
    strategy_code: 'VARCHAR(64) DEFAULT NULL',
    original_cust_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    push_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    usage_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    usage_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    reach_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    target_conv_num_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    target_conv_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    product_conv_num_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    product_conv_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    expected_income_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    actual_income_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    reject_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_strategy_daily_ap: {
    strategy_code: 'VARCHAR(64) DEFAULT NULL',
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_channel_summary_ap: {
    strategy_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    original_cust_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    push_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    usage_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    usage_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    reach_count_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    target_conv_num_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    target_conv_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    product_conv_num_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    product_conv_rate_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    expected_income_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    actual_income_yoy: 'DECIMAL(14,4) DEFAULT NULL',
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_channel_monthly_capacity_ap: {
    yoy: 'DECIMAL(14,4) DEFAULT NULL',
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_channel_biz_capacity_ap: {
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_strategy_biz_capacity: {
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_kpi_summary: {
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
  t_sr_strategy_reject_reason: {
    create_time: 'DATETIME DEFAULT NULL',
    update_time: 'DATETIME DEFAULT NULL',
  },
}

const FILES = {
  t_sr_strategy: 't_sr_strategy',
  t_sr_strategy_period_summary_ap: 't_sr_strategy_period_summary_ap',
  t_sr_strategy_daily_ap: 't_sr_strategy_daily_ap',
  t_sr_channel_summary_ap: 't_sr_channel_summary_ap',
  t_sr_channel_monthly_capacity_ap: 't_sr_channel_monthly_capacity_ap',
  t_sr_channel_biz_capacity_ap: 't_sr_channel_biz_capacity_ap',
  t_sr_strategy_biz_capacity: 't_sr_strategy_biz_capacity',
  t_sr_kpi_summary: 't_sr_kpi_summary',
  t_sr_strategy_reject_reason: 't_sr_strategy_reject_reason',
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

function normalizeFileName(name) {
  return name.replace(/\s+\.(txt)$/i, '.$1').toLowerCase()
}

function parseTableFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const tableLines = lines.filter((line) => line.startsWith('|'))
  if (!tableLines.length) throw new Error(`${path.basename(filePath)} has no MySQL table output`)

  const splitRow = (line) => line.slice(1, -1).split('|').map((value) => value.trim())
  const columns = splitRow(tableLines[0])
  if (new Set(columns).size !== columns.length) throw new Error(`${path.basename(filePath)} has duplicate columns`)

  const rows = []
  for (let index = 1; index < tableLines.length; index += 1) {
    const values = splitRow(tableLines[index])
    if (values.length !== columns.length) {
      throw new Error(`${path.basename(filePath)} row ${index + 1} has ${values.length} cells; expected ${columns.length}`)
    }
    rows.push(Object.fromEntries(columns.map((column, cell) => [column, values[cell] === 'NULL' ? null : values[cell]])))
  }
  return { columns, rows }
}

function selectSourceFile(files, table) {
  const expected = `${table}.txt`.toLowerCase()
  const exact = files.find((file) => normalizeFileName(file.name) === table.toLowerCase() || normalizeFileName(file.name) === expected)
  if (exact) return exact
  return files.find((file) => normalizeFileName(file.name).startsWith(`${table.toLowerCase()}(`))
}

function readSource() {
  if (!fs.existsSync(SOURCE_DIR)) throw new Error(`Source directory does not exist: ${SOURCE_DIR}`)
  const files = fs.readdirSync(SOURCE_DIR).map((name) => ({ name, path: path.join(SOURCE_DIR, name) }))
  const source = new Map()
  const periodCandidates = files.filter((file) => normalizeFileName(file.name).startsWith('t_sr_strategy_period_summary_ap'))
  if (periodCandidates.length > 1) {
    const hashes = new Set(periodCandidates.map((file) => crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex')))
    if (hashes.size !== 1) throw new Error('Duplicate period-summary exports differ; choose the intended source explicitly')
  }

  for (const table of TABLES) {
    const file = selectSourceFile(files, FILES[table])
    if (!file) throw new Error(`Missing export for ${table}`)
    const parsed = parseTableFile(file.path)
    if (parsed.columns.length !== EXPECTED_COLUMN_COUNTS[table]) {
      throw new Error(`${file.name} has ${parsed.columns.length} columns; expected ${EXPECTED_COLUMN_COUNTS[table]}`)
    }
    source.set(table, { ...parsed, file: file.name })
  }
  return source
}

function normalizeMonth(value) {
  if (!value) return null
  const compact = String(value).replace(/[^0-9]/g, '')
  if (compact.length >= 6) return `${compact.slice(0, 4)}-${compact.slice(4, 6)}`
  throw new Error(`Unsupported month value: ${value}`)
}

function normalizeValue(table, column, value) {
  if (value == null) return null
  if (column === 'stat_month') {
    const month = normalizeMonth(value)
    return table === 't_sr_kpi_summary' ? month : `${month}-01`
  }
  return value
}

function snapshotMonth(source) {
  const months = new Set()
  for (const { columns, rows } of source.values()) {
    const column = columns.includes('stat_month') ? 'stat_month' : (columns.includes('stat_date') ? 'stat_date' : null)
    if (!column) continue
    for (const row of rows) {
      const value = row[column]
      if (value) months.add(normalizeMonth(value))
    }
  }
  if (months.size !== 1) throw new Error(`Expected one source month across the 9 exports; found ${[...months].join(', ')}`)
  return [...months][0]
}

function ensureLocalTarget() {
  if (DATABASE !== 'strategy_review_active_class_local') throw new Error(`Refusing to modify non-local database: ${DATABASE}`)
  if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error(`Refusing to modify non-loopback MySQL host: ${HOST}`)
}

function createBackup() {
  const backupDir = path.join(ROOT, 'outputs', 'local-db-adapt-20261024')
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDir, `pre-adapt-${stamp}.sql`)
  const result = spawnSync('mysqldump', [
    '--single-transaction', '--routines', '--events', '--triggers', '--quick',
    '--default-character-set=utf8mb4', '-h', HOST, '-P', String(PORT), '-u', USER,
    `--result-file=${backupPath}`, DATABASE,
  ], {
    env: { ...process.env, MYSQL_PWD: PASSWORD },
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`mysqldump failed (${result.status}): ${result.stderr || ''}`)
  const { size } = fs.statSync(backupPath)
  if (size < 1024) throw new Error(`Database backup is unexpectedly small: ${size} bytes`)
  return backupPath
}

async function ensureColumns(connection) {
  for (const [table, columns] of Object.entries(EXTRA_COLUMNS)) {
    const [existing] = await connection.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
      [table],
    )
    const existingNames = new Set(existing.map((row) => row.COLUMN_NAME || row.column_name))
    for (const [column, definition] of Object.entries(columns)) {
      if (existingNames.has(column)) continue
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
      existingNames.add(column)
      process.stdout.write(`Added ${table}.${column}\n`)
    }
  }
}

async function sourceColumnGaps(connection, source) {
  const gaps = {}
  for (const [table, { columns }] of source) {
    const [existing] = await connection.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
      [table],
    )
    const existingNames = new Set(existing.map((row) => row.COLUMN_NAME || row.column_name))
    const missing = columns.filter((column) => column !== 'id' && !existingNames.has(column))
    if (missing.length) gaps[table] = missing
  }
  return gaps
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  return [`${month}-01`, `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`]
}

async function plannedDeleteCounts(connection, month) {
  const [monthStart, nextMonth] = monthBounds(month)
  const checks = [
    ['t_sr_strategy', 'tab_type = \'active\'', []],
    ['t_sr_strategy_period_summary_ap', 'tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['t_sr_strategy_daily_ap', 'tab_type = \'active\' AND stat_date >= ? AND stat_date < ?', [monthStart, nextMonth]],
    ['t_sr_channel_summary_ap', 'tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['t_sr_channel_monthly_capacity_ap', 'tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['t_sr_channel_biz_capacity_ap', 'tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['t_sr_strategy_biz_capacity', 'tab_type = \'active\' AND stat_date >= ? AND stat_date < ?', [monthStart, nextMonth]],
    ['t_sr_kpi_summary', 'tab_type = \'active\' AND REPLACE(stat_month, \'-\', \'\') = ?', [month.replace('-', '')]],
    ['t_sr_strategy_reject_reason', 'stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
  ]
  const result = {}
  for (const [table, where, params] of checks) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${table}\` WHERE ${where}`, params)
    result[table] = Number(rows[0].row_count)
  }
  return result
}

async function deleteSnapshot(connection, month) {
  const [monthStart, nextMonth] = monthBounds(month)
  const commands = [
    ['DELETE FROM t_sr_strategy WHERE tab_type = \'active\'', []],
    ['DELETE FROM t_sr_strategy_period_summary_ap WHERE tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_strategy_daily_ap WHERE tab_type = \'active\' AND stat_date >= ? AND stat_date < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_channel_summary_ap WHERE tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_channel_monthly_capacity_ap WHERE tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_channel_biz_capacity_ap WHERE tab_type = \'active\' AND stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_strategy_biz_capacity WHERE tab_type = \'active\' AND stat_date >= ? AND stat_date < ?', [monthStart, nextMonth]],
    ['DELETE FROM t_sr_kpi_summary WHERE tab_type = \'active\' AND REPLACE(stat_month, \'-\', \'\') = ?', [month.replace('-', '')]],
    ['DELETE FROM t_sr_strategy_reject_reason WHERE stat_month >= ? AND stat_month < ?', [monthStart, nextMonth]],
  ]
  for (const [sql, params] of commands) await connection.query(sql, params)
}

async function insertRows(connection, table, sourceRows, columns) {
  const insertColumns = columns.filter((column) => column !== 'id')
  const columnSql = insertColumns.map((column) => `\`${column}\``).join(', ')
  const rowSize = 250
  let inserted = 0
  for (let start = 0; start < sourceRows.length; start += rowSize) {
    const rows = sourceRows.slice(start, start + rowSize)
    const valueGroup = `(${insertColumns.map(() => '?').join(', ')})`
    const sql = `INSERT INTO \`${table}\` (${columnSql}) VALUES ${rows.map(() => valueGroup).join(', ')}`
    const values = rows.flatMap((row) => insertColumns.map((column) => normalizeValue(table, column, row[column])))
    const [result] = await connection.query(sql, values)
    inserted += result.affectedRows
  }
  return inserted
}

async function main() {
  ensureLocalTarget()
  const source = readSource()
  const month = snapshotMonth(source)
  const strategyCodes = [...new Set(source.get('t_sr_strategy').rows.map((row) => row.strategy_code).filter(Boolean))]
  if (strategyCodes.length !== source.get('t_sr_strategy').rows.length) {
    throw new Error('The strategy export has missing or duplicate strategy codes')
  }
  const byTable = [...source].map(([table, info]) => `${table}: ${info.rows.length} rows from ${info.file}`).join('\n')
  process.stdout.write(`Source snapshot: ${month}\n${byTable}\n`)

  const connection = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE, dateStrings: true, charset: 'utf8mb4' })
  try {
    const [databaseRows] = await connection.query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version')
    if (databaseRows[0].database_name !== DATABASE) throw new Error(`Connected to unexpected database ${databaseRows[0].database_name}`)
    if (APPLY) {
      const backup = createBackup()
      process.stdout.write(`Full backup: ${backup}\n`)
      await ensureColumns(connection)
    }
    const gaps = await sourceColumnGaps(connection, source)
    if (APPLY && Object.keys(gaps).length) throw new Error(`Database is still missing source columns: ${JSON.stringify(gaps)}`)
    if (!APPLY) process.stdout.write(`Columns to add: ${JSON.stringify(gaps)}\n`)

    const deletionCounts = await plannedDeleteCounts(connection, month)
    process.stdout.write(`Current rows in replacement scope: ${JSON.stringify(deletionCounts)}\n`)
    if (!APPLY) {
      process.stdout.write('Dry run only. Re-run with --apply to back up the database, add missing columns, and import the snapshot.\n')
      return
    }

    await connection.beginTransaction()
    try {
      await deleteSnapshot(connection, month)
      const insertedCounts = {}
      for (const [table, info] of source) {
        insertedCounts[table] = await insertRows(connection, table, info.rows, info.columns)
        if (insertedCounts[table] !== info.rows.length) {
          throw new Error(`${table}: inserted ${insertedCounts[table]} rows; expected ${info.rows.length}`)
        }
      }
      await connection.commit()
      process.stdout.write(`Imported rows: ${JSON.stringify(insertedCounts)}\n`)
      process.stdout.write(`Completed local ${month} snapshot adaptation.\n`)
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
