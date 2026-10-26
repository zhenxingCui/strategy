// Create and seed the manual business-capacity QoQ tables in the local integration DB only.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (database !== 'strategy_review_active_class_local') {
  throw new Error('人工环比演示数据仅允许写入 strategy_review_active_class_local')
}

async function main() {
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`人工环比演示数据仅允许写入本地 MySQL：${host}`)
  }
  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.SR_DB_PORT || 3306),
    database,
    user: process.env.SR_DB_USER || 'root',
    password: process.env.SR_DB_PASSWORD || '123456',
    multipleStatements: true,
    charset: 'utf8mb4',
  })

  try {
    const [[identity]] = await connection.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    if (identity.db !== database || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error('连接的数据库身份与受保护的本地目标不一致')
    }
    await connection.query(fs.readFileSync(
      path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_biz_capacity_qoq_manual.sql'),
      'utf8',
    ))
    await connection.query(fs.readFileSync(
      path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_seed_biz_capacity_qoq_manual.sql'),
      'utf8',
    ))
    await connection.query(fs.readFileSync(
      path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_strategy_detail_biz_capacity_qoq_manual.sql'),
      'utf8',
    ))
    await connection.query(fs.readFileSync(
      path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_seed_passive_business_qoq_manual.sql'),
      'utf8',
    ))
    const [rows] = await connection.query(`
      SELECT tab_type, strategy_class, COUNT(*) AS rows_count,
             SUM(manual_qoq IS NOT NULL) AS value_count,
             MIN(manual_qoq) AS min_qoq, MAX(manual_qoq) AS max_qoq
      FROM t_sr_strategy_biz_capacity_qoq_manual
      WHERE status = 1
      GROUP BY tab_type, strategy_class
      ORDER BY tab_type, strategy_class
    `)
    const [detailRows] = await connection.query(`
      SELECT tab_type, strategy_class, COUNT(*) AS rows_count,
             SUM(manual_qoq IS NOT NULL) AS value_count,
             COUNT(DISTINCT strategy_id) AS strategy_count
      FROM t_sr_strategy_detail_biz_capacity_qoq_manual
      WHERE status = 1
      GROUP BY tab_type, strategy_class
      ORDER BY tab_type, strategy_class
    `)
    console.log(JSON.stringify({ database, host: identity.host, seeded: rows, strategyDetail: detailRows }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
