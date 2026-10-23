// Remove only retired, local seed leave rows. Snapshot every deleted row first.
const fs=require('node:fs')
const path=require('node:path')
const assert=require('node:assert/strict')
const mysql=require('mysql2/promise')
async function main(){
 const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.SR_DB_USER||'root',password:process.env.SR_DB_PASSWORD||'123456',database:'strategy_review_active_class_local',dateStrings:true})
 let tx=false
 try{
  const [tests]=await c.query("SELECT * FROM t_sr_strategy WHERE tab_type='active' AND strategy_class='离' AND owner='本地联调' AND strategy_code LIKE 'STR%' AND is_deleted=1")
  const ids=tests.map(r=>r.strategy_code)
  const targets=[]
  if(ids.length){
   targets.push(['t_sr_strategy',"tab_type='active' AND strategy_class='离' AND owner='本地联调' AND strategy_code IN (?)",[ids]])
   for(const table of ['t_sr_strategy_period_summary_ap','t_sr_strategy_daily_ap','t_sr_strategy_biz_capacity'])targets.push([table,"tab_type='active' AND city_id='999' AND strategy_id IN (?)",[ids]])
   targets.push(['t_sr_strategy_reject_reason',"city_id='999' AND strategy_id IN (?)",[ids]])
  }
  for(const table of ['t_sr_strategy_period_summary_ap','t_sr_strategy_daily_ap','t_sr_kpi_summary','t_sr_channel_summary_ap','t_sr_channel_monthly_capacity_ap','t_sr_channel_biz_capacity_ap'])targets.push([table,"tab_type='active' AND city_id='999' AND strategy_class='离' AND is_deleted=1",[]])
  await c.beginTransaction();tx=true
  const snapshot={database:'strategy_review_active_class_local',createdAt:new Date().toISOString(),testStrategyIds:ids,targets:[]}
  for(const [table,where,params]of targets){const [rows]=await c.query(`SELECT * FROM ?? WHERE ${where} FOR UPDATE`,[table,...params]);snapshot.targets.push({table,where,rows})}
  const dir=path.resolve('outputs/leave-import-20261023');fs.mkdirSync(dir,{recursive:true})
  const backupPath=path.join(dir,`test-cleanup-backup-${Date.now()}.json`);fs.writeFileSync(backupPath,JSON.stringify(snapshot,null,2))
  const removed={}
  for(const [table,where,params]of targets){const [r]=await c.query(`DELETE FROM ?? WHERE ${where}`,[table,...params]);removed[table]=(removed[table]||0)+r.affectedRows}
  const [rows]=await c.query("SELECT strategy_code FROM t_sr_strategy WHERE tab_type='active' AND strategy_class='离' AND is_deleted=0")
  assert.equal(rows.length,10);assert(rows.every(r=>/^lw_10\d\d$/.test(r.strategy_code)))
  const [facts]=await c.query("SELECT COUNT(*) n,SUM(push_count) push,SUM(product_conv_num) conversion FROM t_sr_strategy_period_summary_ap WHERE tab_type='active' AND strategy_class='离' AND city_id='999' AND strategy_id!='999' AND is_deleted=0")
  assert.equal(Number(facts[0].n),10);assert.equal(Number(facts[0].push),94810);assert.equal(Number(facts[0].conversion),77933)
  await c.commit();tx=false
  const result={removed,testStrategyIds:ids,remainingExcelStrategies:rows.length,backupPath};fs.writeFileSync(path.join(dir,'test-cleanup-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 }catch(e){if(tx)await c.rollback();throw e}finally{await c.end()}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
