// Local-only import. Source workbook stays intact; backup and normalized records are exported.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const mysql = require('mysql2/promise')
const input = path.resolve(process.argv[2] || 'outputs/leave-import-20261023/source.json')
const apply = process.argv.includes('--apply')
const simulate = process.argv.includes('--simulate-history')
const preserveHistory = process.argv.includes('--preserve-history')
const addBaseline = process.argv.includes('--add-january-baseline')
const keepDaily = process.argv.includes('--keep-daily')
assert(!(simulate && preserveHistory), 'Choose either simulation or history preservation')
const out = path.dirname(input)
const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const database = 'strategy_review_active_class_local'
const round = (v) => v == null ? null : Math.round((Number(v) + Number.EPSILON) * 100) / 100
const pct = (a, b) => a == null || b == null || b === 0 ? null : round(a / b * 100)
const keyOf = (row, keys) => JSON.stringify(keys.map(k => row[k]))
const group = (rows, keys) => {
  const map = new Map()
  for (const r of rows) { const key = keyOf(r, keys); if (!map.has(key)) map.set(key, []); map.get(key).push(r) }
  return [...map.values()]
}
function integers(rows, field) {
  const values = rows.map(r => Number(r[field]))
  assert(values.every(v => Number.isFinite(v) && v >= 0), `Invalid ${field}`)
  const floors = values.map(Math.floor)
  let remaining = Math.round(values.reduce((a, b) => a + b, 0)) - floors.reduce((a, b) => a + b, 0)
  const order = values.map((v, i) => ({i, frac:v - floors[i]})).sort((a,b) => b.frac-a.frac || a.i-b.i)
  for (let i=0; i<remaining; i++) floors[order[i].i]++
  rows.forEach((r,i)=> { r[field]=floors[i] })
}
const additive = ['original_cust','push_count','usage_count','reach_count','target_conv_num','product_conv_num','expected_income','actual_income','reject_count']
function metrics(rows) {
  const m = {strategy_count:new Set(rows.map(r=>r.strategy_id)).size}
  for (const k of additive) m[k] = rows.some(r=>r[k]==null) ? null : round(rows.reduce((a,r)=>a+Number(r[k]),0))
  m.usage_rate=pct(m.usage_count,m.push_count); m.reach_rate=pct(m.reach_count,m.usage_count)
  m.target_conv_rate=pct(m.target_conv_num,m.reach_count); m.product_conv_rate=pct(m.product_conv_num,m.reach_count)
  m.reject_rate=pct(m.reject_count,m.push_count)
  return m
}
const labels={strategy_count:'策略数',original_cust:'客群',push_count:'推送量',usage_count:'使用量',reach_count:'触达量',target_conv_num:'目标转化量',product_conv_num:'全产品转化量',usage_rate:'使用率',reach_rate:'触达率',target_conv_rate:'目标转化率',product_conv_rate:'全产品转化率',expected_income:'预期收入',actual_income:'收入',reject_count:'拒绝量',reject_rate:'拒绝率'}
function comparisons(m, previous) {
  const result={...m}
  for (const k of Object.keys(labels)) result[k+'_qoq']=!previous || m[k]==null || previous[k]==null ? null : k.endsWith('_rate') ? round(m[k]-previous[k]) : pct(m[k]-previous[k],previous[k])
  return result
}
function partialComparisons(m, previous, currentDays, previousDays) {
  const result=comparisons(m,previous)
  if(!previous||!currentDays||!previousDays)return result
  for(const k of Object.keys(labels))if(k!=='strategy_count'&&!k.endsWith('_rate'))
    result[k+'_qoq']=m[k]==null||previous[k]==null?null:pct(m[k]*previousDays/currentDays-previous[k],previous[k])
  return result
}
function partialChange(current, previous, currentDays, previousDays) {
  return current==null||previous==null||previous===0?null:pct(current*previousDays/currentDays-previous,previous)
}
const previousMonth = month => {const [y,m]=month.split('-').map(Number); const d=new Date(Date.UTC(y,m-2,1)); return d.toISOString().slice(0,7)}
async function main(){
  const c=await mysql.createConnection({host:'127.0.0.1',port:3306,user:process.env.SR_DB_USER||'root',password:process.env.SR_DB_PASSWORD||'123456',database,dateStrings:true,charset:'utf8mb4'})
  let transaction=false
  try {
    const ids=source.strategies.map(r=>r.strategy_code)
    assert.equal(new Set(ids).size,10)
    const [oldStrategies]=await c.query("SELECT * FROM t_sr_strategy WHERE tab_type='active' AND strategy_class='离' AND is_deleted=0")
    assert(oldStrategies.every(r=>r.owner==='本地联调'||ids.includes(r.strategy_code)),'Non-sample leave strategies exist; refusing replacement')
    const oldIds=oldStrategies.map(r=>r.strategy_code).filter(id=>!ids.includes(id))
    const mappings={channels:[],businesses:[],reasons:[]}
    const [channels]=await c.query('SELECT * FROM t_sr_dim_channel WHERE is_deleted=0')
    const newChannels=[]
    function channel(name){
      let row=channels.find(r=>r.key_name===name && String(r.tab_type||'').split(',').includes('active'))
      if(!row){let n=1;while(channels.some(r=>r.key_code===`ACH${String(n).padStart(4,'0')}`))n++
        row={key_code:`ACH${String(n).padStart(4,'0')}`,key_name:name,tab_type:'active',status:1,sort_no:100,is_deleted:0};channels.push(row);newChannels.push(row)}
      if(!mappings.channels.some(r=>r.name===name))mappings.channels.push({name,code:row.key_code})
      return row.key_code
    }
    const [bizExisting]=await c.query('SELECT DISTINCT biz_code code,biz_name name FROM t_sr_strategy_biz_capacity WHERE is_deleted=0 AND biz_code IS NOT NULL')
    const [reasonExisting]=await c.query('SELECT DISTINCT reason_code code,reason_name name FROM t_sr_strategy_reject_reason WHERE is_deleted=0 AND reason_code IS NOT NULL')
    function code(name,type){const mapping=mappings[type];let row=mapping.find(r=>r.name===name);if(row)return row.code
      const existing=type==='businesses'?bizExisting:reasonExisting;const matches=existing.filter(r=>r.name===name)
      const unique=[...new Set(matches.map(r=>r.code))];assert(unique.length<=1,`Ambiguous existing code for ${name}`)
      let code=unique[0]; if(!code){let n=1;const prefix=type==='businesses'?'BIZ':'RSN';do{code=prefix+String(n++).padStart(6,'0')}while(existing.some(r=>r.code===code)||mapping.some(r=>r.code===code))}
      mapping.push({name,code});return code
    }
    const common={tab_type:'active',city_id:'999',county_id:null,is_deleted:0}
    const masters=source.strategies.map(r=>({...r,channel:channel(r.channel),tab_type:'active',customer_group:null,iteration:r.iteration==null?null:Number(r.iteration),is_deleted:0}))
    const masterById=new Map(masters.map(r=>[r.strategy_code,r]))
    let sourceCutoffDay=null
    const execution=source.execution.map(r=>{
      assert.equal(r.period_type,'月','Only month inputs are supported; never invent daily facts')
      const match=String(r.stat_date).match(/(\d{4})年(\d{1,2})月截至(\d{1,2})日/);assert(match,'Unrecognized source cutoff')
      const month=`${match[1]}-${match[2].padStart(2,'0')}`
      sourceCutoffDay=Number(match[3])
      assert(masterById.has(r.strategy_code))
      return {...common,strategy_id:r.strategy_code,strategy_name:masterById.get(r.strategy_code).strategy_name,strategy_class:'离',channel:channel(r.channel),big_category:r.big_category,small_category:r.small_category,stat_month:month+'-01',strategy_count:1,original_cust:null,push_count:r.push_count,usage_count:r.usage_count,reach_count:r.reach_count,target_conv_num:r.target_conv_num,expected_income:round(r.actual_income),actual_income:round(r.actual_income),reject_count:null}
    })
    for(const k of ['push_count','usage_count','reach_count','target_conv_num'])integers(execution,k)
    for(const r of execution){r.product_conv_num=r.target_conv_num;Object.assign(r,comparisons(metrics([r]),null))}
    const month=execution[0].stat_month.slice(0,7);assert(execution.every(r=>r.stat_month===month+'-01'))
    const sourceMonthDays=sourceCutoffDay||1
    const previousMonthDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,0)).getUTCDate()
    const sourceCalendarDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate()
    const isPartialSourceMonth=sourceMonthDays<sourceCalendarDays
    const details=source.details.map(r=>({...r,item_code:code(r.item_name,r.detail_type==='业务产能'?'businesses':'reasons')}))
    for(const rows of group(details,['detail_type']))integers(rows,'item_count')
    const businesses=details.filter(r=>r.detail_type==='业务产能').map(r=>({...common,strategy_id:r.strategy_code,stat_date:month+'-01',biz_code:r.item_code,biz_name:r.item_name,count:r.item_count,mom_ratio:null,yoy_ratio:null}))
    const reasons=[]
    for(const rows of group(details.filter(r=>r.detail_type==='拒绝原因'),['strategy_code'])){
      const total=rows.reduce((a,r)=>a+r.item_count,0)
      rows.forEach((r,i)=>reasons.push({strategy_id:r.strategy_code,stat_month:month+'-01',city_id:'999',county_id:null,is_deleted:0,reason_code:r.item_code,reason_name:r.item_name,reject_count:r.item_count,reject_ratio:pct(r.item_count,total),sort_no:i+1,color:['#3b82f6','#5ac4d1','#a78bfa','#f6bd60','#94a3b8'][i%5]}))
    }
    let simulationManifest=null
    if(simulate){
      const history=require('./leave-history-simulation.cjs').simulateHistory(execution,businesses,reasons,{sourceCutoffDay:sourceMonthDays,previousMonthDays})
      const manifestPath=path.resolve(__dirname,'../src/views/strategyReview/active/leaveSimulation.json')
      const priorManifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{}
      simulationManifest={...priorManifest,...history.manifest,sourceFile:path.basename(source.source),sourceSha256:source.sha256}
      execution.push(...history.execution);businesses.push(...history.businesses);reasons.push(...history.reasons)
    }
    if(preserveHistory){
      simulationManifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../src/views/strategyReview/active/leaveSimulation.json'),'utf8'))
      const [history]=await c.query("SELECT * FROM t_sr_strategy_period_summary_ap WHERE tab_type='active' AND strategy_class='离' AND city_id='999' AND strategy_id IN (?) AND stat_month < ? AND is_deleted=0",[ids,month+'-01'])
      const [historyBiz]=await c.query("SELECT * FROM t_sr_strategy_biz_capacity WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?) AND stat_date < ? AND is_deleted=0",[ids,month+'-01'])
      const [historyReasons]=await c.query("SELECT * FROM t_sr_strategy_reject_reason WHERE city_id='999' AND strategy_id IN (?) AND stat_month < ? AND is_deleted=0",[ids,month+'-01'])
      assert.equal(history.filter(r=>r.stat_month>='2026-01-01').length,90,'Expected nine months of ten historical strategies')
      execution.push(...history);businesses.push(...historyBiz);reasons.push(...historyReasons)
      Object.assign(simulationManifest,{sourceFile:path.basename(source.source),sourceSha256:source.sha256})
    }
    if(addBaseline){
      assert(preserveHistory||simulate,'Baseline requires simulated or preserved monthly history')
      if(!execution.some(r=>r.stat_month==='2025-12-01')){
        const baseline=require('./leave-january-baseline.cjs').januaryBaseline(execution,businesses,reasons)
        execution.push(...baseline.execution);businesses.push(...baseline.businesses);reasons.push(...baseline.reasons)
      }
      Object.assign(simulationManifest,{baselineMonth:'2025-12',baselineSimulated:true})
    }
    if(simulate||preserveHistory){
      for(const rows of group(execution,['strategy_id'])){
        rows.sort((a,b)=>a.stat_month.localeCompare(b.stat_month))
        let previous=null
        for(const r of rows){const prior=previous&&previous.stat_month.slice(0,7)===previousMonth(r.stat_month.slice(0,7))?metrics([previous]):null;const currentMonth=r.stat_month.slice(0,7);Object.assign(r,isPartialSourceMonth&&currentMonth===month?partialComparisons(metrics([r]),prior,sourceMonthDays,previousMonthDays):comparisons(metrics([r]),prior));previous=r}
      }
      for(const rows of group(businesses,['strategy_id','biz_code'])){
        rows.sort((a,b)=>a.stat_date.localeCompare(b.stat_date));let previous=null
        for(const r of rows){const adjacent=previous&&previous.stat_date.slice(0,7)===previousMonth(r.stat_date.slice(0,7));r.mom_ratio=adjacent?(isPartialSourceMonth&&r.stat_date.slice(0,7)===month?partialChange(r.count,previous.count,sourceMonthDays,previousMonthDays):pct(r.count-previous.count,previous.count)):null;previous=r}
      }
    }
    const tables=['t_sr_strategy','t_sr_strategy_period_summary_ap','t_sr_strategy_daily_ap','t_sr_strategy_biz_capacity','t_sr_strategy_reject_reason','t_sr_kpi_summary','t_sr_channel_summary_ap','t_sr_channel_monthly_capacity_ap','t_sr_channel_biz_capacity_ap','t_sr_dim_channel']
    const backup={createdAt:new Date().toISOString(),database,source:source.source,sourceSha256:source.sha256,tables:{}}
    for(const t of tables){const [rows]=await c.query('SELECT * FROM ??',[t]);backup.tables[t]=rows}
    const oldFacts=backup.tables.t_sr_strategy_period_summary_ap.filter(r=>r.tab_type==='active'&&r.city_id==='999'&&!r.is_deleted&&r.strategy_id!=='999'&&r.channel!=='全部'&&r.big_category!=='全部'&&r.small_category!=='全部'&&r.strategy_class!=='离'&&!ids.includes(r.strategy_id))
    const facts=[...oldFacts,...execution]
    const kpis=[],summaries=[],capacities=[],categories=[]
    for(const cls of ['离','全部']){
      const scoped=facts.filter(r=>cls==='全部'||r.strategy_class===cls)
      const monthGroups=group(scoped,['stat_month']).sort((a,b)=>a[0].stat_month.localeCompare(b[0].stat_month))
      const history=new Map()
      for(const rows of monthGroups){
        const statMonth=rows[0].stat_month.slice(0,7)
        const total=metrics(rows),prev=history.get(previousMonth(statMonth));history.set(statMonth,total)
        const diff=isPartialSourceMonth&&statMonth===month?partialComparisons(total,prev,sourceMonthDays,previousMonthDays):comparisons(total,prev)
        Object.entries(labels).forEach(([metric_code,metric_name],i)=>kpis.push({...common,strategy_class:cls,stat_month:statMonth,metric_code,metric_name,value:total[metric_code],qoq:diff[metric_code+'_qoq'],yoy:null,unit:metric_code.endsWith('_rate')?'%':metric_code.includes('income')?'元':metric_code==='strategy_count'?'个':metric_code==='original_cust'?'人':'次',sort_no:i+1}))
        const channelGroups=group(rows,['channel']);
        for(const channelRows of [...channelGroups,rows]){
          const ch=channelRows===rows?'全部':channelRows[0].channel
          const previousRows=scoped.filter(r=>r.stat_month.slice(0,7)===previousMonth(statMonth)&&(ch==='全部'||r.channel===ch))
          const channelPrevious=previousRows.length?metrics(previousRows):null
          const agg=isPartialSourceMonth&&statMonth===month?partialComparisons(metrics(channelRows),channelPrevious,sourceMonthDays,previousMonthDays):comparisons(metrics(channelRows),channelPrevious)
          summaries.push({...common,strategy_class:cls,stat_month:statMonth+'-01',channel:ch,...agg})
          for(const catRows of [...group(channelRows,['big_category','small_category']),channelRows]){
            const allCategories=catRows===channelRows
            const big=allCategories?'全部':catRows[0].big_category, small=allCategories?'全部':catRows[0].small_category
            const prior=previousRows.filter(r=>allCategories||(r.big_category===big&&r.small_category===small))
            const categoryPrevious=prior.length?metrics(prior):null
            const cat=isPartialSourceMonth&&statMonth===month?partialComparisons(metrics(catRows),categoryPrevious,sourceMonthDays,previousMonthDays):comparisons(metrics(catRows),categoryPrevious)
            categories.push({...common,strategy_class:cls,strategy_id:'999',strategy_name:'分类汇总',channel:ch,big_category:big,small_category:small,stat_month:statMonth+'-01',...cat})
            capacities.push({...common,strategy_class:cls,channel:ch,big_category:big,small_category:small,stat_month:statMonth+'-01',capacity:cat.product_conv_num,qoq:cat.product_conv_num_qoq})
          }
        }
      }
    }
    const channelBusinesses=[]
    // Keep other classes' existing business sources; replace only imported leave data and rebuild all-class rows.
    const existingBiz=backup.tables.t_sr_channel_biz_capacity_ap.filter(r=>r.tab_type==='active'&&r.city_id==='999'&&!r.is_deleted&&!['离','全部'].includes(r.strategy_class))
    const leaveBiz=businesses.map(b=>{const e=execution.find(r=>r.strategy_id===b.strategy_id&&r.stat_month===b.stat_date);return {...common,strategy_class:'离',stat_month:b.stat_date,channel:e.channel,big_category:e.big_category,small_category:e.small_category,biz_name:b.biz_name,capacity:b.count,qoq:null}})
    const baseBiz=[...existingBiz,...leaveBiz]
    for(const cls of ['离','全部'])for(const rows of group(baseBiz.filter(r=>cls==='全部'||r.strategy_class===cls),['stat_month','channel','big_category','small_category','biz_name'])){
      const r=rows[0];channelBusinesses.push({...common,strategy_class:cls,stat_month:r.stat_month,channel:r.channel,big_category:r.big_category,small_category:r.small_category,biz_name:r.biz_name,capacity:rows.reduce((a,b)=>a+Number(b.capacity),0),qoq:null})
    }
    const prepared={rules:{city_id:'999',county_id:null,cutoff:'2026-10-21',rounding:'largest remainder; preserves rounded group totals',original_cust:null,reject_count:null,product_conv_num:'target_conv_num',expected_income:'actual_income',noSyntheticHistory:!(simulate||preserveHistory),preserveHistory},simulationManifest,mappings,masters,execution,businesses,reasons}
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'normalized.json'),JSON.stringify(prepared,null,2))
    if(!apply){console.log(JSON.stringify({dryRun:true,strategies:masters.length,monthly:execution.length,businesses:businesses.length,reasons:reasons.length,mappings}));return}
    const backupPath=path.join(out,`database-backup-${Date.now()}.json`);fs.writeFileSync(backupPath,JSON.stringify(backup,null,2))
    const columns={}
    async function insert(t,rows){if(!rows.length)return;if(!columns[t]){const [cols]=await c.query('SHOW COLUMNS FROM ??',[t]);columns[t]=new Set(cols.map(r=>r.Field))}const keys=Object.keys(rows[0]).filter(k=>columns[t].has(k)&&k!=='id');for(let i=0;i<rows.length;i+=300)await c.query('INSERT INTO ?? (??) VALUES ?',[t,keys,rows.slice(i,i+300).map(r=>keys.map(k=>r[k]??null))])}
    await c.beginTransaction();transaction=true
    for(const channel of newChannels)await insert('t_sr_dim_channel',[channel])
    if(oldIds.length)await c.query("UPDATE t_sr_strategy SET is_deleted=1 WHERE tab_type='active' AND strategy_code IN (?) AND owner='本地联调'",[oldIds])
    for(const master of masters){const [existing]=await c.query('SELECT id FROM t_sr_strategy WHERE strategy_code=? AND tab_type=\'active\'',[master.strategy_code]);assert(existing.length<=1);if(existing.length)await c.query('UPDATE t_sr_strategy SET ? WHERE id=?',[master,existing[0].id]);else await insert('t_sr_strategy',[master])}
    const affected=[...ids,...oldIds]
    await c.query("UPDATE t_sr_strategy_period_summary_ap SET is_deleted=1 WHERE tab_type='active' AND city_id='999' AND (strategy_class='离' OR strategy_id IN (?) OR (strategy_id='999' AND strategy_class='全部'))",[affected])
    if(!keepDaily)await c.query("UPDATE t_sr_strategy_daily_ap SET is_deleted=1 WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?)",[affected])
    await c.query("UPDATE t_sr_strategy_biz_capacity SET is_deleted=1 WHERE tab_type='active' AND city_id='999' AND strategy_id IN (?)",[affected])
    await c.query("UPDATE t_sr_strategy_reject_reason SET is_deleted=1 WHERE city_id='999' AND strategy_id IN (?)",[affected])
    for(const t of ['t_sr_kpi_summary','t_sr_channel_summary_ap','t_sr_channel_monthly_capacity_ap','t_sr_channel_biz_capacity_ap'])await c.query("UPDATE ?? SET is_deleted=1 WHERE tab_type='active' AND city_id='999' AND strategy_class IN ('离','全部')",[t])
    await insert('t_sr_strategy_period_summary_ap',[...execution,...categories]);await insert('t_sr_strategy_biz_capacity',businesses);await insert('t_sr_strategy_reject_reason',reasons)
    await insert('t_sr_kpi_summary',kpis);await insert('t_sr_channel_summary_ap',summaries);await insert('t_sr_channel_monthly_capacity_ap',capacities);await insert('t_sr_channel_biz_capacity_ap',channelBusinesses)
    const [check]=await c.query("SELECT COUNT(*) n,SUM(push_count) push,SUM(product_conv_num) conversion,SUM(expected_income) expected,SUM(actual_income) actual,COUNT(original_cust) original,COUNT(reject_count) rejected FROM t_sr_strategy_period_summary_ap WHERE tab_type='active' AND strategy_class='离' AND city_id='999' AND strategy_id!='999' AND stat_month='2026-10-01' AND is_deleted=0")
    const october=metrics(execution.filter(r=>r.stat_month===month+'-01'))
    assert.equal(Number(check[0].n),10);assert.equal(Number(check[0].push),october.push_count);assert.equal(Number(check[0].conversion),october.product_conv_num);assert.equal(Number(check[0].original),0);assert.equal(Number(check[0].rejected),0);assert.equal(check[0].expected,check[0].actual)
    await c.commit();transaction=false
    if(simulationManifest)fs.writeFileSync(path.resolve(__dirname,'../src/views/strategyReview/active/leaveSimulation.json'),JSON.stringify(simulationManifest,null,2))
    const result={database,month,cutoff:'2026-10-21',cityId:'999',countyId:null,strategies:10,monthly:execution.length,businesses:businesses.length,reasons:reasons.length,simulationManifest,newChannels,mappings,totals:check[0],backupPath}
    fs.writeFileSync(path.join(out,'import-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
  }catch(e){if(transaction)await c.rollback();throw e}finally{await c.end()}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
