const assert=require('node:assert/strict')
const round=n=>Math.round(n*100)/100
function factor(key){let h=2166136261;for(const ch of key)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return 0.97+0.03*h/4294967295}
function januaryBaseline(execution,businesses,reasons){
 const january=execution.filter(r=>r.stat_month==='2026-01-01');assert.equal(january.length,10)
 const rows=[],biz=[],why=[]
 for(const jan of january){
  const f=factor(jan.strategy_id),row={...jan,stat_month:'2025-12-01'}
  for(const k of ['push_count','usage_count','reach_count','target_conv_num','product_conv_num'])row[k]=Math.round(jan[k]*f)
  for(const k of ['expected_income','actual_income'])row[k]=jan[k]==null?null:round(Number(jan[k])*f)
  rows.push(row)
  for(const r of businesses.filter(r=>r.strategy_id===jan.strategy_id&&r.stat_date==='2026-01-01'))biz.push({...r,stat_date:'2025-12-01',mom_ratio:null,yoy_ratio:null})
  const rr=reasons.filter(r=>r.strategy_id===jan.strategy_id&&r.stat_month==='2026-01-01').map(r=>({...r,stat_month:'2025-12-01'}))
  const total=rr.reduce((a,r)=>a+r.reject_count,0)
  for(const r of rr){r.reject_ratio=total?round(r.reject_count/total*100):null;why.push(r)}
 }
 return {execution:rows,businesses:biz,reasons:why}
}
module.exports={januaryBaseline}
