const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const dataDir=path.resolve(process.argv[2]||'outputs/leave-import-20261023')
const base='http://127.0.0.1:8080/plan-svc-lj/strategyReview'
const defaults={tabType:'active',strategyClass:'离',cityId:'999',statMonth:'2026-10',userId:'local-review'}
const results=[]
async function api(endpoint,params={}){const r=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...defaults,...params}),signal:AbortSignal.timeout(15000)});const j=await r.json();assert.equal(r.status,200);assert.equal(j.status,'SUCCESS',endpoint+':'+j.message);results.push(endpoint);return j.data}
function verifySimulatedMoM(normalized){
 const bounds={min:-2,max:5},current=m=>/^2026-0[1-9]$/.test(m)
 let checked=0
 const compare=(previous,value,label)=>{if(previous==null||value==null)return;const q=previous===0?(value===0?0:Infinity):(value-previous)/previous*100;checked++;assert(q>=bounds.min-1e-8&&q<=bounds.max+1e-8,`${label} MoM ${q}% outside -2%..5%`)}
 const checkRows=(rows,key,date,fields,label)=>{const groups=new Map();for(const r of rows){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}for(const [k,rs]of groups){rs.sort((a,b)=>date(a).localeCompare(date(b)));for(let i=1;i<rs.length;i++){const a=rs[i-1],b=rs[i],month=date(b).slice(0,7);if(!current(month))continue;assert.equal(date(a).slice(0,7),previousMonth(month),`${label}/${k} month gap`);for(const f of fields)compare(a[f],b[f],`${label}/${k}/${month}/${f}`)}}}
 const previousMonth=m=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-2,1)).toISOString().slice(0,7)}
 const fields=['push_count','usage_count','reach_count','target_conv_num','product_conv_num','expected_income','actual_income']
 checkRows(normalized.execution,r=>r.strategy_id,r=>r.stat_month,fields,'strategy')
 checkRows(normalized.businesses,r=>`${r.strategy_id}|${r.biz_code}`,r=>r.stat_date,['count'],'business')
 checkRows(normalized.reasons,r=>`${r.strategy_id}|${r.reason_code}`,r=>r.stat_month,['reject_count'],'reason')
 for(const metric of fields){const sums=new Map();for(const r of normalized.execution){const m=r.stat_month.slice(0,7);if(!sums.has(m))sums.set(m,[]);sums.get(m).push(r[metric])}for(let n=1;n<=9;n++){const m=`2026-${String(n).padStart(2,'0')}`,p=previousMonth(m),a=sums.get(p)||[],b=sums.get(m)||[];compare(a.some(v=>v==null)?null:a.reduce((s,v)=>s+Number(v),0),b.some(v=>v==null)?null:b.reduce((s,v)=>s+Number(v),0),`aggregate/${m}/${metric}`)}}
 const rateFields={usage_rate:['usage_count','push_count'],reach_rate:['reach_count','usage_count'],target_conv_rate:['target_conv_num','reach_count'],product_conv_rate:['product_conv_num','reach_count']}
 for(const id of [...new Set(normalized.execution.map(r=>r.strategy_id)),'ALL'])for(const [rate,[num,den]]of Object.entries(rateFields)){let previous=null;for(const month of ['2025-12',...Array.from({length:9},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`)]){const rows=normalized.execution.filter(r=>r.stat_month.startsWith(month)&&(id==='ALL'||r.strategy_id===id));const value=rows.length&&rows.every(r=>r[num]!=null&&r[den]!=null)?(rows.reduce((s,r)=>s+Number(r[num]),0)/rows.reduce((s,r)=>s+Number(r[den]),0)*100):null;if(current(month)&&previous!=null&&value!=null){const delta=value-previous;checked++;assert(delta>=bounds.min-1e-8&&delta<=bounds.max+1e-8,`${id}/${month}/${rate} change ${delta}pp outside -2pp..5pp`)}previous=value}}
 return checked
}
async function main(){
 const imported=JSON.parse(fs.readFileSync(path.join(dataDir,'import-result.json'),'utf8'))
 const source=JSON.parse(fs.readFileSync(path.join(dataDir,'source.json'),'utf8'))
 const expected={}
 for(const k of ['push_count','usage_count','reach_count','target_conv_num'])expected[k]=Math.round(source.execution.reduce((a,r)=>a+Number(r[k]),0))
 const expectedReachRate=Math.round(expected.reach_count/expected.usage_count*10000)/100
 const simulated=!!imported.simulationManifest
 const baseline=!!(imported.simulationManifest&&imported.simulationManifest.baselineMonth)
 const normalized=JSON.parse(fs.readFileSync(path.join(dataDir,'normalized.json'),'utf8'))
 const momChecks=simulated?verifySimulatedMoM(normalized):0
 const dailySimulated=!!JSON.parse(fs.readFileSync('front/src/views/strategyReview/active/leaveSimulation.json','utf8')).dailyStartDate
 const channels=await api('/dim',{type:'触点渠道'});assert.deepEqual(channels,[{keyCode:'ACH0001',keyName:'市级'}])
 assert.deepEqual(await api('/dim',{type:'触点渠道',statMonth:'2025-11'}),[])
 assert.deepEqual(await api('/dim',{type:'触点渠道',cityId:'999'}),[{keyCode:'ACH0001',keyName:'市级'}])
 const otherChannels=await api('/dim',{type:'触点渠道',strategyClass:'升接'});assert(otherChannels.length>0);assert(otherChannels.every(r=>r.keyCode!=='ACH0001'))
 const allChannels=await api('/dim',{type:'触点渠道',strategyClass:'全部'});assert(allChannels.length>1);assert(allChannels.some(r=>r.keyCode==='ACH0001'))
 const kpi=await api('/overview/kpi');const get=k=>kpi.find(r=>r.metricCode===k).value
 assert.equal(get('strategy_count'),10);assert.equal(get('push_count'),expected.push_count);assert.equal(get('usage_count'),expected.usage_count);assert.equal(get('reach_count'),expected.reach_count);assert.equal(get('product_conv_num'),expected.target_conv_num);assert.equal(get('original_cust'),null);assert.equal(get('reject_count'),null);assert.equal(get('actual_income'),get('expected_income'))
 if(source.execution.every(r=>r.actual_income==null))assert.equal(get('actual_income'),null)
 const list=await api('/touchpoint/strategyList',{pageSize:20,pageNum:1});assert.equal(list.total,10);assert.equal(list.list.length,10);assert(list.list.every(r=>r.strategyId.startsWith('lw_')&&r.channelName==='市级'&&r.originalCust===null&&r.rejectCount===null&&r.productConvNum===r.targetConvNum&&r.expectedIncome===r.actualIncome));assert.equal(list.calculate.pushCount,expected.push_count)
 if(imported.simulationManifest&&imported.simulationManifest.partialMonthQoQ){
  const cutoff=Number(imported.simulationManifest.sourceCutoff.slice(-2)),previousDays=new Date(2026,9,0).getDate()
  const previousKpi=await api('/overview/kpi',{statMonth:'2026-09'}),byCode=new Map(previousKpi.map(r=>[r.metricCode,r]))
  for(const code of ['push_count','usage_count','reach_count','product_conv_num']){const current=kpi.find(r=>r.metricCode===code),previous=byCode.get(code);const expectedQoq=Math.round(((current.value*previousDays/cutoff-previous.value)/previous.value)*10000)/100;assert.equal(current.trendQoQ,expectedQoq,`${code} partial-month comparable QoQ`);assert(expectedQoq>=-2&&expectedQoq<=5)}
  const september=await api('/touchpoint/strategyList',{statMonth:'2026-09',pageSize:20,pageNum:1}),previousById=new Map(september.list.map(r=>[r.strategyId,r]))
  for(const current of list.list){const previous=previousById.get(current.strategyId);for(const [field,qoq]of [['pushCount','pushCountQoQ'],['usageCount','usageCountQoQ'],['reachCount','reachCountQoQ'],['productConvNum','productConvNumQoQ']]){const expectedQoq=Math.round(((current[field]*previousDays/cutoff-previous[field])/previous[field])*10000)/100;assert.equal(current[qoq],expectedQoq,`${current.strategyId}/${field} partial-month comparable QoQ`);assert(current[qoq]>=-2&&current[qoq]<=5)}}
 }
 const channel=await api('/touchpoint/channelSummary');assert.equal(channel.list.length,1);assert.equal(channel.calculate.pushCount,expected.push_count)
 const categories=await api('/touchpoint/categorySummary');assert.equal(categories.list.length,2);assert.equal(categories.list.reduce((a,r)=>a+r.productConvNum,0),expected.target_conv_num)
 const trend=await api('/overview/trend',{metricCode:'product_conv_num'});assert.equal(trend.months.length,simulated?(baseline?11:10):1);assert.equal(trend.values[trend.values.length-1],expected.target_conv_num)
 if(imported.simulationManifest&&imported.simulationManifest.partialMonthQoQ){assert.equal(trend.qoq[trend.qoq.length-1],kpi.find(r=>r.metricCode==='product_conv_num').trendQoQ)}
 const capacity=await api('/touchpoint/channelCapacityTrend');assert.equal(capacity.length,simulated?6:1);assert.equal(capacity[capacity.length-1].capacity,expected.target_conv_num)
 const biz=await api('/touchpoint/channelBizCapacity');assert.equal(biz.length,12);assert.equal(biz.reduce((a,r)=>a+r.capacity,0),17337)
 const chKpi=await api('/overview/kpi',{channel:'ACH0001'});assert.equal(chKpi.find(r=>r.metricCode==='push_count').value,expected.push_count)
 const channelReachRate=chKpi.find(r=>r.metricCode==='reach_rate');assert(channelReachRate);assert.equal(channelReachRate.value,expectedReachRate);assert.equal(channelReachRate.value,get('reach_rate'));assert.equal(channelReachRate.trendQoQ,kpi.find(r=>r.metricCode==='reach_rate').trendQoQ)
 const channelReachTrend=await api('/overview/trend',{channel:'ACH0001',metricCode:'reach_rate'});assert.equal(channelReachTrend.values.length,simulated?(baseline?11:10):1);assert.equal(channelReachTrend.values[channelReachTrend.values.length-1],expectedReachRate);assert.equal(channelReachTrend.qoq[0],null);assert.equal(channelReachTrend.unit,'%')
 const id='lw_1001';const info=await api('/execution/strategyInfo',{strategyId:id});assert.equal(info.strategyCode,id)
 const detail=await api('/execution/bizCapacity',{strategyId:id,pageNum:1,pageSize:20});assert.equal(detail.total,6);assert(detail.list.every(r=>r.bizCode.startsWith('BIZ')))
 const reasons=await api('/execution/rejectReason',{strategyId:id});assert.equal(reasons.reasons.length,5);assert.equal(reasons.rejectCount,null);assert(reasons.reasons.every(r=>r.reasonCode.startsWith('RSN')));assert(Math.abs(reasons.reasons.reduce((a,r)=>a+r.ratio,0)-100)<0.03)
 const daily=await api('/execution/dailyDetail',{strategyId:id,startDate:'2026-10-01',endDate:'2026-10-31',pageNum:1,pageSize:100});assert.equal(daily.total,dailySimulated?21:0)
 if(dailySimulated){
  for(const monthly of list.list){
   const rows=await api('/execution/dailyDetail',{strategyId:monthly.strategyId,startDate:'2026-10-01',endDate:'2026-10-31',pageNum:1,pageSize:100})
   assert.equal(rows.total,21);assert.equal(rows.list.length,21)
   assert.equal(new Set(rows.list.map(r=>r.date)).size,21)
   assert(rows.list.every(r=>r.date>='2026-10-01'&&r.date<='2026-10-21'&&r.originalCust===null&&r.rejectCount===null&&r.productConvNum===r.targetConvNum&&r.actualIncome===r.expectedIncome&&r.usageCount<=r.pushCount&&r.reachCount<=r.usageCount&&r.targetConvNum<=r.reachCount&&r.productConvNum<=r.reachCount))
   for(const key of ['pushCount','usageCount','reachCount','targetConvNum','productConvNum'])assert.equal(rows.list.reduce((a,r)=>a+r[key],0),monthly[key])
   for(const key of ['expectedIncome','actualIncome']){
    if(monthly[key]==null)assert(rows.list.every(r=>r[key]===null))
    else assert.equal(rows.list.reduce((a,r)=>a+Math.round(r[key]*100),0),Math.round(monthly[key]*100))
   }
   for(const row of rows.list){
    assert(row.usageRate<=100&&row.targetConvRate<=100&&row.productConvRate<=100,`${monthly.strategyId}/${row.date} rate exceeds 100%`)
    if(row.reachRate!=null)assert(row.reachRate<=100,`${monthly.strategyId}/${row.date} reach rate exceeds 100%`)
   }
  }
  const future=await api('/execution/dailyDetail',{strategyId:id,startDate:'2026-10-22',endDate:'2026-10-31',pageNum:1,pageSize:10});assert.equal(future.total,0)
  const firstWeek=await api('/execution/dailyDetail',{strategyId:id,startDate:'2026-10-01',endDate:'2026-10-07',pageNum:1,pageSize:10});assert.equal(firstWeek.total,7)
  const page1=await api('/execution/dailyDetail',{strategyId:id,startDate:'2026-10-01',endDate:'2026-10-21',pageNum:1,pageSize:10})
  const page2=await api('/execution/dailyDetail',{strategyId:id,startDate:'2026-10-01',endDate:'2026-10-21',pageNum:2,pageSize:10});assert.equal(page1.list.length,10);assert.equal(page2.list.length,10);assert(page2.list.every(r=>!page1.list.some(p=>p.date===r.date)))
 }
 const shanghaiMonth=value=>new Date(new Date(value).getTime()+8*60*60*1000).toISOString().slice(0,7)
 const before=JSON.parse(fs.readFileSync(imported.backupPath,'utf8')).tables.t_sr_strategy_period_summary_ap.filter(r=>r.tab_type==='active'&&r.city_id==='001'&&!r.is_deleted&&shanghaiMonth(r.stat_month)==='2026-10'&&r.strategy_class!=='离'&&r.strategy_id!=='999'&&r.channel!=='全部'&&r.big_category!=='全部'&&r.small_category!=='全部')
 const all=await api('/touchpoint/strategyList',{strategyClass:'全部',pageSize:100,pageNum:1});assert.equal(all.total,before.length+10);assert.equal(all.list.filter(r=>r.strategyClass==='离').length,10)
 for(const cls of ['升接','稳','降拆','重点客群']){const rows=await api('/touchpoint/strategyList',{strategyClass:cls,pageSize:100,pageNum:1});assert(rows.total>0);assert(rows.list.every(r=>!r.strategyId.startsWith('lw_')))}
 if(simulated){
  const expectedCodes=list.list.map(r=>r.strategyId).sort()
  for(let m=1;m<=9;m++){
   const statMonth=`2026-${String(m).padStart(2,'0')}`
   const historical=await api('/touchpoint/strategyList',{statMonth,pageNum:1,pageSize:20})
   assert.equal(historical.total,10);assert.deepEqual(historical.list.map(r=>r.strategyId).sort(),expectedCodes)
   assert(historical.list.every(r=>r.originalCust===null&&r.rejectCount===null&&r.productConvNum===r.targetConvNum&&r.expectedIncome===r.actualIncome&&r.productConvNum<=r.reachCount&&r.reachCount<=r.usageCount&&r.usageCount<=r.pushCount))
   const k=await api('/overview/kpi',{statMonth});assert.equal(k.find(r=>r.metricCode==='strategy_count').value,10)
   assert.equal(k.find(r=>r.metricCode==='product_conv_num').value,historical.list.reduce((a,r)=>a+r.productConvNum,0))
  }
 }
 if(baseline){
  const jan=await api('/overview/kpi',{statMonth:'2026-01'}),dec=await api('/overview/kpi',{statMonth:'2025-12'})
  for(const card of jan){const prior=dec.find(r=>r.metricCode===card.metricCode);assert(prior)
   if(card.value==null||prior.value==null||(!card.metricCode.endsWith('_rate')&&prior.value===0))assert.equal(card.trendQoQ,null)
   else{const value=card.metricCode.endsWith('_rate')?card.value-prior.value:(card.value-prior.value)/prior.value*100;assert.equal(card.trendQoQ,Math.round((value+Number.EPSILON)*100)/100)}
  }
  const janRows=await api('/touchpoint/strategyList',{statMonth:'2026-01',pageNum:1,pageSize:20});assert.equal(janRows.total,10);assert(janRows.list.every(r=>r.pushCountQoQ!=null&&r.productConvNumQoQ!=null))
  const janChannel=await api('/overview/kpi',{statMonth:'2026-01',channel:'ACH0001'});assert.equal(janChannel.find(r=>r.metricCode==='reach_rate').trendQoQ,jan.find(r=>r.metricCode==='reach_rate').trendQoQ)
 }
 const report={passed:true,requests:results.length,momBoundChecks:momChecks,momRange:'-2%..5%',totals:{strategies:10,push:expected.push_count,usage:expected.usage_count,reach:expected.reach_count,conversion:expected.target_conv_num,income:get('actual_income'),businessCapacity:17337},excelDailyRulesVerified:!!source.dailyRules,endpoints:results}
 fs.writeFileSync(path.join(dataDir,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
