// Migrate the single column and fill only unassigned local control strategy samples.
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const productForStrategy = require('./control-product-names.cjs')
const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (database !== 'strategy_review_active_class_local') throw new Error('产品样例迁移仅允许本地联调库')

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306), database,
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    multipleStatements: true, charset: 'utf8mb4',
  })
  try {
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_product_name.sql'), 'utf8'))
    await connection.beginTransaction()
    const [samples] = await connection.query(`SELECT id, strategy_name FROM t_sr_strategy
      WHERE tab_type='control' AND owner='本地联调-重点产品样例' AND strategy_code REGEXP '^CTL[0-9]{3}$'
      AND is_deleted=0 AND (product_name IS NULL OR TRIM(product_name)='')`)
    for (const strategy of samples) {
      await connection.execute('UPDATE t_sr_strategy SET product_name=? WHERE id=?', [productForStrategy(strategy.strategy_name), strategy.id])
    }
    await connection.commit()
    const [rows] = await connection.query("SELECT product_name, COUNT(*) AS strategies FROM t_sr_strategy WHERE tab_type='control' AND is_deleted=0 GROUP BY product_name")
    console.log(rows)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { await connection.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
