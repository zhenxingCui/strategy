const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '../..')
const SOURCE_DIR = process.env.BQQ_SQL_DIR || 'D:\\工作数据\\BQQData\\sql'
const HOST = process.env.SR_DB_HOST || '127.0.0.1'
const PORT = Number(process.env.SR_DB_PORT || 3306)
const USER = process.env.SR_DB_USER || 'root'
const PASSWORD = process.env.SR_DB_PASSWORD || '123456'
const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'

function logicalTableName(fileName) {
  const withoutExtension = fileName.replace(/\.txt$/i, '').replace(/\s*\(\d+\)$/, '').trim()
  const match = withoutExtension.match(/^(t_sr_[A-Za-z0-9_]+)/)
  if (!match) throw new Error(`Unrecognized source export filename: ${fileName}`)
  return match[1]
}

function parseTableFile(buffer, fileName) {
  const lines = buffer.toString('utf8').split(/\r?\n/).filter((line) => line.startsWith('|'))
  if (!lines.length) throw new Error(`${fileName} has no MySQL table output`)
  const splitRow = (line) => line.slice(1, -1).split('|').map((value) => value.trim())
  const columns = splitRow(lines[0])
  if (new Set(columns).size !== columns.length) throw new Error(`${fileName} has duplicate columns`)
  for (const column of columns) {
    if (!/^[A-Za-z0-9_]+$/.test(column)) throw new Error(`${fileName} has an unsupported column name: ${column}`)
  }
  const rows = []
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitRow(lines[index])
    if (values.length !== columns.length) {
      throw new Error(`${fileName} row ${index + 1} has ${values.length} cells; expected ${columns.length}`)
    }
    rows.push(values.map((value) => value === 'NULL' ? null : value))
  }
  return { columns, rows }
}

function safeTableName(name) {
  if (!/^t_sr_[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsafe table name: ${name}`)
  return `bqq_raw_${name}`
}

async function ensureRawTable(connection, table, columns) {
  const target = safeTableName(table)
  const definitions = columns.map((column) => `\`${column}\` LONGTEXT NULL`).join(', ')
  await connection.query(`CREATE TABLE IF NOT EXISTS \`${target}\` (${definitions}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  const [existing] = await connection.query(
    'SELECT column_name AS column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
    [target],
  )
  const existingColumns = existing.map((row) => row.column_name)
  if (JSON.stringify(existingColumns) !== JSON.stringify(columns)) {
    throw new Error(`${target} schema does not match source columns`)
  }
  return target
}

async function insertRawRows(connection, table, columns, rows) {
  if (!rows.length) return
  const target = safeTableName(table)
  const colSql = columns.map((column) => `\`${column}\``).join(', ')
  const chunkSize = 100
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const group = `(${columns.map(() => '?').join(', ')})`
    const sql = `INSERT INTO \`${target}\` (${colSql}) VALUES ${chunk.map(() => group).join(', ')}`
    await connection.query(sql, chunk.flat())
  }
}

async function main() {
  if (DATABASE !== 'strategy_review_active_class_local') throw new Error(`Refusing to modify non-local database: ${DATABASE}`)
  if (!['127.0.0.1', 'localhost', '::1'].includes(HOST)) throw new Error(`Refusing to modify non-loopback MySQL host: ${HOST}`)
  if (!fs.existsSync(SOURCE_DIR)) throw new Error(`Source directory does not exist: ${SOURCE_DIR}`)

  const files = fs.readdirSync(SOURCE_DIR)
    .map((fileName) => ({ fileName, filePath: path.join(SOURCE_DIR, fileName), table: logicalTableName(fileName) }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName))
  if (!files.length) throw new Error(`No source files found in ${SOURCE_DIR}`)

  const snapshots = new Map()
  for (const file of files) {
    const bytes = fs.readFileSync(file.filePath)
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
    const prior = snapshots.get(file.table)
    if (prior && prior.sha256 !== sha256) {
      throw new Error(`Multiple exports for ${file.table} differ; refusing to choose one`)
    }
    if (!prior) snapshots.set(file.table, { ...parseTableFile(bytes, file.fileName), sha256, fileName: file.fileName })
    file.bytes = bytes
    file.sha256 = sha256
  }

  const connection = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASSWORD, database: DATABASE,
    charset: 'utf8mb4', multipleStatements: false,
  })
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bqq_source_snapshot_file (
        file_name VARBINARY(255) NOT NULL PRIMARY KEY,
        table_name VARCHAR(128) NOT NULL,
        sha256 CHAR(64) NOT NULL,
        byte_length BIGINT UNSIGNED NOT NULL,
        content LONGBLOB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const targets = new Map()
    for (const [table, snapshot] of snapshots) {
      targets.set(table, await ensureRawTable(connection, table, snapshot.columns))
    }

    await connection.beginTransaction()
    try {
      for (const [table, snapshot] of snapshots) {
        const target = targets.get(table)
        await connection.query(`DELETE FROM \`${target}\``)
        await insertRawRows(connection, table, snapshot.columns, snapshot.rows)
      }
      for (const file of files) {
        await connection.query(
          `INSERT INTO bqq_source_snapshot_file (file_name, table_name, sha256, byte_length, content)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE table_name=VALUES(table_name), sha256=VALUES(sha256), byte_length=VALUES(byte_length), content=VALUES(content)`,
          [Buffer.from(file.fileName, 'utf8'), file.table, file.sha256, file.bytes.length, file.bytes],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const verification = []
    for (const file of files) {
      const [stored] = await connection.query(
        'SELECT table_name, sha256, byte_length, content FROM bqq_source_snapshot_file WHERE file_name = ?',
        [Buffer.from(file.fileName, 'utf8')],
      )
      const digest = crypto.createHash('sha256').update(stored[0].content).digest('hex')
      if (digest !== file.sha256 || stored[0].sha256 !== file.sha256 || Number(stored[0].byte_length) !== file.bytes.length) {
        throw new Error(`Stored source file failed checksum verification: ${file.fileName}`)
      }
      verification.push({ file: file.fileName, sha256: digest, bytes: file.bytes.length })
    }

    const rowCounts = {}
    for (const [table, snapshot] of snapshots) {
      const target = targets.get(table)
      const [[row]] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${target}\``)
      if (Number(row.row_count) !== snapshot.rows.length) throw new Error(`${target} row count verification failed`)
      rowCounts[target] = Number(row.row_count)
    }
    process.stdout.write(JSON.stringify({ database: DATABASE, exactFileCopies: verification, rawTableRows: rowCounts }, null, 2) + '\n')
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
