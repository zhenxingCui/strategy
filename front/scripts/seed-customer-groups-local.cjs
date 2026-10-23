// Add the single column and assign names only to unclassified local key-audience samples.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (database !== 'strategy_review_active_class_local') throw new Error('客群样例迁移仅允许本地联调库')
const groups = ['高价值客群', '校园客群', '家庭客群', '银龄客群', '高价值客群', '校园客群', '高价值客群', '家庭客群']

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306), database,
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    multipleStatements: true, charset: 'utf8mb4',
  })
  try {
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_customer_group.sql'), 'utf8'))
    await connection.beginTransaction()
    for (const [index, name] of groups.entries()) {
      await connection.execute(`UPDATE t_sr_strategy SET customer_group=?
        WHERE strategy_code=? AND owner='本地联调' AND tab_type='active' AND strategy_class='重点客群'
        AND is_deleted=0 AND (customer_group IS NULL OR TRIM(customer_group)='')`, [name, `STR${String(index + 13).padStart(3, '0')}`])
    }
    await connection.commit()
    const [rows] = await connection.query("SELECT customer_group, COUNT(*) AS strategies FROM t_sr_strategy WHERE tab_type='active' AND strategy_class='重点客群' AND is_deleted=0 GROUP BY customer_group")
    console.log(rows)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
