const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const DATABASE = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (DATABASE !== 'strategy_review_active_class_local') {
  throw new Error(`Refusing to initialize manual business QoQ table in non-local database: ${DATABASE}`)
}

async function main() {
  const host = process.env.SR_DB_HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing non-local MySQL host: ${host}`)
  }
  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root',
    password: process.env.SR_DB_PASSWORD || '123456',
    database: DATABASE,
    charset: 'utf8mb4',
  })
  try {
    const [identity] = await connection.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port')
    if (identity[0].db !== DATABASE || !['127.0.0.1', 'localhost', '::1'].includes(host)) {
      throw new Error('Connected database identity does not match the protected local target')
    }
    await connection.query(fs.readFileSync(
      path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_strategy_detail_biz_capacity_qoq_manual.sql'),
      'utf8',
    ))
    const [seedResult] = await connection.query(`
      INSERT IGNORE INTO t_sr_strategy_detail_biz_capacity_qoq_manual
        (tab_type, strategy_class, strategy_id, strategy_name, stat_month, biz_code, biz_name,
         city_id, county_id, manual_qoq, status, remark)
      SELECT DISTINCT
        b.tab_type,
        s.strategy_class,
        b.strategy_id,
        COALESCE(s.strategy_name, ''),
        STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d'),
        COALESCE(b.biz_code, ''),
        b.biz_name,
        COALESCE(NULLIF(b.city_id, ''), '全部'),
        COALESCE(NULLIF(b.county_id, ''), '全部'),
        NULL,
        0,
        '从逐策略业务产能明细预置；manual_qoq 待人工维护'
      FROM v_sr_strategy_biz_capacity_read b
      INNER JOIN v_sr_strategy_period_summary_ap_read s
        ON s.tab_type = b.tab_type
       AND s.strategy_id = b.strategy_id
       AND s.stat_month = STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d')
      WHERE b.tab_type = 'active'
        AND s.strategy_class IN ('升接', '稳', '重点客群')
        AND b.is_deleted = 0
        AND s.is_deleted = 0
        AND b.biz_name IS NOT NULL
        AND b.biz_name <> ''
        AND b.biz_name <> '全部'
    `)
    const [summary] = await connection.query(`
      SELECT strategy_class,
             COUNT(*) AS row_count,
             SUM(manual_qoq IS NULL) AS pending_count,
             COUNT(DISTINCT strategy_id) AS strategy_count
      FROM t_sr_strategy_detail_biz_capacity_qoq_manual
      GROUP BY strategy_class
      ORDER BY strategy_class
    `)
    console.log(JSON.stringify({
      database: DATABASE,
      table: 't_sr_strategy_detail_biz_capacity_qoq_manual',
      prefixedRows: seedResult.affectedRows,
      summary,
      manualQoq: 'NULL / 待人工维护',
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
