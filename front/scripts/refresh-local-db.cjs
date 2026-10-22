const targetDatabase = 'strategy_review_active_class_local'
if (process.env.SR_DB_NAME && process.env.SR_DB_NAME !== targetDatabase) {
  throw new Error(`刷新脚本只允许更新 ${targetDatabase}，当前 SR_DB_NAME 指向其他数据库。`)
}

process.env.SR_DB_NAME = targetDatabase
process.env.SR_REFRESH_LOCAL_DB = '1'
require('./init-local-db.cjs')
