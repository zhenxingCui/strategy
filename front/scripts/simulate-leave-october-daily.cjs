// Simulate October 1-21 only. Integer counts and cents reconcile to every source monthly row.
const fs=require('node:fs')
const path=require('node:path')
const assert=require('node:assert/strict')
const mysql=require('mysql2/promise')
const apply=process.argv.includes('--apply')
const sourceIndex=process.argv.indexOf('--source')
const source=sourceIndex>=0?JSON.parse(fs.readFileSync(process.argv[sourceIndex+1],'utf8')):null
const out=sourceIndex>=0?path.dirname(path.resolve(process.argv[sourceIndex+1])):path.resolve(__dirname,'../../outputs/leave-import-20261023')
const round=n=>Math.round((n+Number.EPSILON)*100)/100
const pct=(n,d)=>n==null||!d?null:round(n/d*100)
function noise(key){let n=2166136261;for(const ch of key)n=Math.imul(n^ch.charCodeAt(0),16777619)>>>0;return 0.86+0.28*n/4294967295}
function allocate(total,weights){
 assert(Number.isSafeInteger(total)&&total>=0)
 const sum=weights.reduce((a,b)=>a+b,0),exact=weights.map(w=>total*w/sum),result=exact.map(Math.floor)
 const rest=total-result.reduce((a,b)=>a+b,0),order=exact.map((v,i)=>({i,f:v-result[i]})).sort((a,b)=>b.f-a.f||a.i-b.i)
 for(let i=0;i<rest;i++)result[order[i].i]++
 return result
}
function allocateBounded(total,weights,caps){
 assert(Number.isSafeInteger(total)&&total>=0)
 assert.equal(weights.length,caps.length)
 assert(caps.every(Number.isSafeInteger)&&caps.every(v=>v>=0))
 assert(total<=caps.reduce((a,b)=>a+b,0),'Monthly count exceeds the daily parent totals')
 const result=Array(caps.length).fill(0),remainingCaps=caps.slice()
 let remaining=total
 while(remaining>0){
  const open=remainingCaps.map((cap,i)=>({cap,i})).filter(x=>x.cap>0)
  assert(open.length,'No daily capacity left')
  const weightTotal=open.reduce((sum,x)=>sum+Math.max(0,Number(weights[x.i])||0),0)
  const exact=open.map(x=>({i:x.i,value:remaining*(weightTotal?Math.max(0,Number(weights[x.i])||0):x.cap)/(weightTotal||open.reduce((sum,y)=>sum+y.cap,0))}))
  const saturated=exact.filter(x=>x.value>=remainingCaps[x.i]-1e-10)
  if(saturated.length){for(const x of saturated){result[x.i]+=remainingCaps[x.i];remaining-=remainingCaps[x.i];remainingCaps[x.i]=0}continue}
  let assigned=0
  for(const x of exact){const n=Math.min(remainingCaps[x.i],Math.floor(x.value));result[x.i]+=n;remainingCaps[x.i]-=n;assigned+=n}
  remaining-=assigned
  const order=exact.map(x=>({i:x.i,f:x.value-Math.floor(x.value)})).sort((a,b)=>b.f-a.f||a.i-b.i)
  for(const x of order){if(!remaining)break;if(remainingCaps[x.i]>0){result[x.i]++;remainingCaps[x.i]--;remaining--}}
 }
 return result
}
async function main(){
 const c=await mysql.createConnection({host:'127.0.0.1',user:process.env.SR_DB_USER||'root',password:process.env.SR_DB_PASSWORD||'123456',database:'strategy_review_active_class_local',dateStrings:true})
 let tx=false
 try{
  const [monthly]=await c.query("SELECT * FROM t_sr_strategy_period_summary_ap_special WHERE tab_type='active' AND strategy_class='离' AND city_id='999' AND stat_month='2026-10-01' AND is_deleted=0 AND strategy_id!='999' ORDER BY strategy_id")
  assert.equal(monthly.length,10);assert(monthly.every(r=>/^lw_10\d\d$/.test(r.strategy_id)))
  const ids=monthly.map(r=>r.strategy_id),daily=[]
  const countFields=['push_count','usage_count','reach_count','target_conv_num','product_conv_num']
  const moneyFields=['expected_income','actual_income']
  for(const base of monthly){
   const weights=Array.from({length:21},(_,i)=>{
    const dow=new Date(Date.UTC(2026,9,i+1)).getUTCDay()
    return (dow===0||dow===6?0.78:1.08)*noise(`leave-daily-v1:${base.strategy_id}:${i+1}`)
   })
   const categoryRules=source&&source.dailyRules&&source.dailyRules.categories[base.big_category]
   if(source)assert(categoryRules,`Missing Excel daily rules for ${base.big_category}`)
   const dayWeights=k=>categoryRules?categoryRules[k==='product_conv_num'?'target_conv_num':k]:weights
   const split={push_count:allocate(Number(base.push_count),dayWeights('push_count'))}
   split.usage_count=allocateBounded(Number(base.usage_count),dayWeights('usage_count'),split.push_count)
   split.reach_count=allocateBounded(Number(base.reach_count),dayWeights('reach_count'),split.usage_count)
   split.target_conv_num=allocateBounded(Number(base.target_conv_num),dayWeights('target_conv_num'),split.reach_count)
   split.product_conv_num=split.target_conv_num.slice()
   for(const k of moneyFields)split[k]=base[k]==null?null:allocate(Math.round(Number(base[k])*100),split.target_conv_num)
   for(let i=0;i<21;i++){
    const row={tab_type:'active',strategy_class:'离',strategy_id:base.strategy_id,strategy_name:base.strategy_name,channel:base.channel,big_category:base.big_category,small_category:base.small_category,city_id:'999',county_id:null,is_deleted:0,stat_month:`2026-10-${String(i+1).padStart(2,'0')}`,original_cust:null,reject_count:null,reject_rate:null}
    for(const k of countFields)row[k]=split[k][i]
    for(const k of moneyFields)row[k]=split[k]==null?null:split[k][i]/100
    row.usage_rate=pct(row.usage_count,row.push_count)
    row.target_conv_rate=pct(row.target_conv_num,row.reach_count)
    row.product_conv_rate=pct(row.product_conv_num,row.reach_count)
    assert.equal(row.product_conv_num,row.target_conv_num);assert.equal(row.expected_income,row.actual_income)
    assert(row.usage_count<=row.push_count,`Daily usage exceeds push ${base.strategy_id}/${i+1}`)
    assert(row.reach_count<=row.usage_count,`Daily reach exceeds usage ${base.strategy_id}/${i+1}`)
    assert(row.target_conv_num<=row.reach_count&&row.product_conv_num<=row.reach_count,`Daily conversion exceeds reach ${base.strategy_id}/${i+1}`)
    daily.push(row)
   }
   const rows=daily.filter(r=>r.strategy_id===base.strategy_id)
   for(const k of countFields)assert.equal(rows.reduce((a,r)=>a+r[k],0),Number(base[k]))
   for(const k of moneyFields)assert.equal(rows.reduce((a,r)=>a+Math.round(r[k]*100),0),Math.round(Number(base[k])*100))
  }
  assert.equal(daily.length,210)
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'simulated-october-daily.json'),JSON.stringify({startDate:'2026-10-01',endDate:'2026-10-21',simulated:true,method:source?'Excel category daily ratios used as weights; bounded largest-remainder allocation enforces daily usage<=push, reach<=usage, and conversion<=reach while preserving every monthly total.':'Deterministic weekday weights and bounded largest-remainder allocation; monthly source measures unchanged.',sourceSha256:source&&source.sha256,rows:daily},null,2))
  if(!apply){console.log(JSON.stringify({dryRun:true,strategies:10,days:21,rows:210,monthlyReconciliation:true}));return}
  await c.beginTransaction();tx=true
  const [old]=await c.query("SELECT * FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN '2026-10-01' AND '2026-10-31' FOR UPDATE",[ids])
  const backupPath=path.join(out,`daily-backup-${Date.now()}.json`)
  fs.writeFileSync(backupPath,JSON.stringify({database:'strategy_review_active_class_local',table:'t_sr_strategy_daily_ap_special',rows:old,monthlyBefore:monthly},null,2))
  await c.query("DELETE FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN '2026-10-01' AND '2026-10-31'",[ids])
  const keys=Object.keys(daily[0]);await c.query('INSERT INTO t_sr_strategy_daily_ap_special (??) VALUES ?',[keys,daily.map(r=>keys.map(k=>r[k]))])
  const [totals]=await c.query("SELECT strategy_id,COUNT(*) n,MIN(stat_month) first_date,MAX(stat_month) last_date,SUM(push_count) push_count,SUM(usage_count) usage_count,SUM(reach_count) reach_count,SUM(target_conv_num) target_conv_num,SUM(product_conv_num) product_conv_num,SUM(expected_income) expected_income,SUM(actual_income) actual_income,COUNT(original_cust) original,COUNT(reject_count) rejected FROM t_sr_strategy_daily_ap_special WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?) AND stat_month BETWEEN '2026-10-01' AND '2026-10-31' AND is_deleted=0 GROUP BY strategy_id",[ids])
  assert.equal(totals.length,10)
  for(const total of totals){const base=monthly.find(r=>r.strategy_id===total.strategy_id);assert.equal(Number(total.n),21);assert.equal(total.first_date,'2026-10-01');assert.equal(total.last_date,'2026-10-21');assert.equal(total.original,0);assert.equal(total.rejected,0);for(const k of [...countFields,...moneyFields])assert.equal(Number(total[k]),Number(base[k]),`${total.strategy_id}:${k}`)}
  await c.commit();tx=false
  const manifestPath=path.resolve(__dirname,'../src/views/strategyReview/active/leaveSimulation.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
  Object.assign(manifest,{dailyStartDate:'2026-10-01',dailyEndDate:'2026-10-21',dailyStrategyIds:ids})
  if(source)Object.assign(manifest,{dailyRuleSource:'Excel分日展示',dailyRuleSourceSha256:source.sha256})
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2))
  const result={strategies:10,daysPerStrategy:21,rows:210,startDate:'2026-10-01',endDate:'2026-10-21',monthlyReconciliation:true,backupPath}
  fs.writeFileSync(path.join(out,'daily-import-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 }catch(e){if(tx)await c.rollback();throw e}finally{await c.end()}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
