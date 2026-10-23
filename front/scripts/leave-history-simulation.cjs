// Fixed ten-strategy retrospective demo; never change the October source measures.
const assert = require('node:assert/strict')
const round = n => Math.round((n + Number.EPSILON) * 100) / 100
const pct = (n,d) => d ? round(n/d*100) : null
function noise(key, lo, hi) {
  let hash=2166136261
  for(const ch of key) hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0
  return lo+(hi-lo)*(hash/4294967295)
}
function allocate(total, weights) {
  const sum=weights.reduce((a,b)=>a+b,0)
  const exact=weights.map(v=>sum?total*v/sum:0),result=exact.map(Math.floor)
  let left=total-result.reduce((a,b)=>a+b,0)
  const order=exact.map((v,i)=>({i,f:v-result[i]})).sort((a,b)=>b.f-a.f||a.i-b.i)
  for(let i=0;i<left;i++)result[order[i%order.length].i]++
  return result
}
function boundedCount(previous, factor) {
  const lower=Math.ceil(previous*0.98-1e-10),upper=Math.floor(previous*1.05+1e-10)
  return Math.max(lower,Math.min(upper,Math.round(previous*factor)))
}
function simulateHistory(baseExecution, baseBusinesses, baseReasons, options={}) {
  assert.equal(baseExecution.length,10)
  assert(baseExecution.every(r=>r.stat_month==='2026-10-01'))
  const execution=[],businesses=[],reasons=[],factors=new Map(),growths=new Map(),lastBiz=new Map(),lastReason=new Map()
  // Anchor September to October's daily average so the partial source month has a fair comparator.
  for(const base of baseExecution){
    for(let m=2;m<=9;m++)growths.set(`${base.strategy_id}:2026-${String(m).padStart(2,'0')}`,noise(`leave-history-v3:${base.strategy_id}:2026-${String(m).padStart(2,'0')}:mom`,0.985,1.045))
    const comparableDayRatio=(options.previousMonthDays||30)/(options.sourceCutoffDay||21)
    let factor=comparableDayRatio/noise(`leave-history-v3:${base.strategy_id}:source-comparable-mom`,1.015,1.045)
    factors.set(`${base.strategy_id}:2026-09`,factor)
    for(let m=8;m>=1;m--){const next=`2026-${String(m+1).padStart(2,'0')}`;factor/=growths.get(`${base.strategy_id}:${next}`);factors.set(`${base.strategy_id}:2026-${String(m).padStart(2,'0')}`,factor)}
  }
  for(let m=1;m<=9;m++) {
    const month=`2026-${String(m).padStart(2,'0')}`
    for(const base of baseExecution) {
      const factor=factors.get(`${base.strategy_id}:${month}`)
      const push=Math.max(1,Math.round(base.push_count*factor))
      const usage=Math.round(base.usage_count*factor)
      const reach=Math.round(base.reach_count*factor)
      const conversion=Math.round(base.target_conv_num*factor)
      const income=base.actual_income==null?null:round(base.actual_income*factor)
      const row={...base,stat_month:month+'-01',push_count:push,usage_count:usage,reach_count:reach,target_conv_num:conversion,product_conv_num:conversion,expected_income:income,actual_income:income,original_cust:null,reject_count:null,reject_rate:null}
      execution.push(row)
      const biz=baseBusinesses.filter(r=>r.strategy_id===base.strategy_id)
      const prevFactor=m>1?factors.get(`${base.strategy_id}:2026-${String(m-1).padStart(2,'0')}`):null
      const bizCounts=biz.map(r=>{const key=`${r.strategy_id}:${r.biz_code}`;const prev=lastBiz.get(key);return prev==null?Math.round(r.count*factor):boundedCount(prev,factor/prevFactor)})
      biz.forEach((r,i)=>{const key=`${r.strategy_id}:${r.biz_code}`;lastBiz.set(key,bizCounts[i]);businesses.push({...r,stat_date:month+'-01',count:bizCounts[i],mom_ratio:null,yoy_ratio:null})})
      const reason=baseReasons.filter(r=>r.strategy_id===base.strategy_id)
      const counts=reason.map(r=>{const key=`${r.strategy_id}:${r.reason_code}`;const prev=lastReason.get(key);return prev==null?Math.round(r.reject_count*factor):boundedCount(prev,factor/prevFactor)})
      const reasonTotal=counts.reduce((a,b)=>a+b,0)
      reason.forEach((r,i)=>{const key=`${r.strategy_id}:${r.reason_code}`;lastReason.set(key,counts[i]);reasons.push({...r,stat_month:month+'-01',reject_count:counts[i],reject_ratio:pct(counts[i],reasonTotal)})})
    }
  }
  assert.equal(execution.length,90);assert.equal(businesses.length,540);assert.equal(reasons.length,450)
  return {execution,businesses,reasons,manifest:{tabType:'active',strategyClass:'离',cityId:'999',startMonth:'2026-01',endMonth:'2026-09',sourceMonth:'2026-10',sourceCutoff:'2026-10-21',strategiesPerMonth:10,monthlyMoMRange:'-2%..5%',partialMonthQoQ:'daily-average comparable',method:'Fixed ten strategy codes, deterministic v3 simulation; adjacent simulated month measures stay within -1.5%..4.5%, and the last simulated month aligns to the source month daily average.'}}
}
module.exports={simulateHistory}
