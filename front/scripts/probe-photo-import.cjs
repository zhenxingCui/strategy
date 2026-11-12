// Isolated, one-off experiment. It creates a new database and never modifies the source database.
const mysql = require('mysql2/promise')
const fs = require('fs')
const [file, db] = process.argv.slice(2)
if (!file || !/^strategy_review_photo_trial_[a-z0-9_]+$/.test(db || '')) throw Error('Usage: node probe-photo-import.cjs source.json strategy_review_photo_trial_<suffix>')
const src = 'strategy_review_active_class_local'
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const number = v => v === null || v === undefined || v === '' ? null : Number(v)
const fields = { original_cust:'ORIG_CUSTOMER_CNT', push_count:'PUSH_CNT', usage_count:'USAGE_CNT', reach_count:'REACH_CNT', target_conv_num:'TARGET_PRODUCT_CONV_CNT', product_conv_num:'ALL_PRODUCT_CONV_CNT', expected_income:'THEO_INCOME', actual_income:'REAL_INCOME' }
const rates = { usage_rate:'USAGE_RATE', target_conv_rate:'TARGET_PRODUCT_CONV_RATE', product_conv_rate:'ALL_PRODUCT_CONV_RATE' }
const key = r => [r.CITY_ID,r.COUNTY_ID,r.UNIT_ID,r.CHANNEL,r.STRATEGY_TYPE,r.BIG_CATEGORY,r.SMALL_CATEGORY,r.STRATEGY_ID].join('|')
async function main () {
 const c = await mysql.createConnection({host:'127.0.0.1',user:process.env.SR_DB_USER||'root',password:process.env.SR_DB_PASSWORD||'123456',multipleStatements:false,charset:'utf8mb4',dateStrings:true})
 const [[exists]] = await c.query('SELECT COUNT(*) n FROM information_schema.schemata WHERE schema_name=?',[db]); if (exists.n) throw Error('Target database already exists; refusing to overwrite')
 await c.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
 const [objects] = await c.query('SELECT TABLE_NAME n,TABLE_TYPE t FROM information_schema.tables WHERE table_schema=?',[src])
 for (const o of objects.filter(x=>x.t==='BASE TABLE')) await c.query(`CREATE TABLE \`${db}\`.\`${o.n}\` LIKE \`${src}\`.\`${o.n}\``)
 // View definitions may depend on other views. Retry in dependency order.
 let pending = objects.filter(x=>x.t==='VIEW'); let last = []
 while (pending.length) { let next=[]; for (const o of pending) { try {const [q]=await c.query(`SHOW CREATE VIEW \`${src}\`.\`${o.n}\``); let sql=q[0]['Create View'].replace(/DEFINER=`[^`]+`@`[^`]+`/i,'').replaceAll('`'+src+'`.','`'+db+'`.'); await c.query(`USE \`${db}\``); await c.query(sql)} catch(e){next.push(o);last.push(o.n+': '+e.message)} } if(next.length===pending.length) throw Error('Cannot clone views: '+last.slice(-next.length).join('; ')); pending=next }
 await c.query(`USE \`${db}\``)
 await c.query('CREATE TABLE photo_source_staging (row_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, source_sha256 CHAR(64) NOT NULL, source_row JSON NOT NULL)')
 await c.query('CREATE TABLE photo_snapshot_audit (strategy_id VARCHAR(64), strategy_class VARCHAR(64), stat_month DATE, snapshot_date DATE, channel VARCHAR(64), source_sha256 CHAR(64))')
 await c.beginTransaction()
 try {
  for (const r of data.rows) await c.query('INSERT INTO photo_source_staging(source_sha256,source_row) VALUES (?,?)',[data.sha256,JSON.stringify(r)])
  await c.query("INSERT INTO t_sr_dim_channel (key_code,key_name,tab_type,status,sort_no,is_deleted) VALUES ('02','商机团队','active',1,1,0)")
  const strategies=new Map(), monthly=new Map(), days=[]
  for (const r of data.rows) { if (r.CHANNEL !== '商机团队' || !['升接','稳'].includes(r.STRATEGY_TYPE) || !['mon','day'].includes(r.PERIOD_TYPE)) throw Error('Unexpected source dimension'); strategies.set(String(r.STRATEGY_ID),r); if(r.PERIOD_TYPE==='day') days.push(r); else {const k=key(r)+'|'+String(r.OP_TIME).slice(0,7); if(!monthly.has(k)||String(monthly.get(k).OP_TIME)<String(r.OP_TIME)) monthly.set(k,r)} }
  async function insert(table,obj) {await c.query('INSERT INTO ?? SET ?', [table,obj])}
  for (const r of strategies.values()) await insert('t_sr_strategy',{strategy_code:String(r.STRATEGY_ID),strategy_name:r.STRATEGY_NAME,tab_type:'active',strategy_class:r.STRATEGY_TYPE,channel:'02',city_id:'999',county_id:null,is_deleted:0})
  const now=new Date(); let id=0
  function fact(r,month) {let o={id:++id,strategy_id:String(r.STRATEGY_ID),strategy_code:String(r.STRATEGY_ID),strategy_name:r.STRATEGY_NAME,tab_type:'active',strategy_class:r.STRATEGY_TYPE,channel:'02',big_category:r.BIG_CATEGORY,small_category:r.SMALL_CATEGORY,stat_month:month?String(r.OP_TIME).slice(0,7)+'-01':r.OP_TIME,city_id:'999',county_id:null,create_time:now,update_time:now,is_deleted:0,reject_rate:null,reject_count:null}; for(const [k,v] of Object.entries(fields))o[k]=number(r[v]); for(const [k,v] of Object.entries(rates))o[k]=number(r[v])===null?null:number(r[v])*100; return o}
  for(const r of days) await insert('t_sr_strategy_daily_ap',fact(r,false))
  for(const r of monthly.values()) {let o=fact(r,true);o.strategy_count=1; for(const f of [...Object.keys(fields),...Object.keys(rates),'reject_rate']) for(const suffix of ['qoq','yoy']) o[f+'_'+suffix]=null; await insert('t_sr_strategy_period_summary_ap',o); await insert('photo_snapshot_audit',{strategy_id:String(r.STRATEGY_ID),strategy_class:r.STRATEGY_TYPE,stat_month:o.stat_month,snapshot_date:r.OP_TIME,channel:'02',source_sha256:data.sha256}) }
  // The current API reads precomputed category and all-channel rows, identified by strategy_id 999.
  const groups=new Map(); for(const r of monthly.values()){let m=String(r.OP_TIME).slice(0,7)+'-01'; for(const cls of [r.STRATEGY_TYPE,'全部']) for(const ch of ['02','全部']) for(const [big,small] of [[r.BIG_CATEGORY,r.SMALL_CATEGORY],['全部','全部']]) {let k=[m,cls,ch,big,small].join('|'); let g=groups.get(k)||{m,cls,ch,big,small,rows:[]};g.rows.push(r);groups.set(k,g)}}
  function sum(rows,field){const vals=rows.map(r=>number(r[field])).filter(v=>v!==null);return vals.length?vals.reduce((a,b)=>a+b,0):null}
  function aggregate(g){const o={};for(const [k,v] of Object.entries(fields))o[k]=sum(g.rows,v);for(const [name,num,den] of [['usage_rate','usage_count','push_count'],['target_conv_rate','target_conv_num','reach_count'],['product_conv_rate','product_conv_num','reach_count']])o[name]=o[den] ? o[num]*100/o[den] : null; return o}
  for(const g of groups.values()) {let vals=aggregate(g);let o={id:++id,strategy_id:'999',strategy_code:'999',strategy_name:'分类汇总',strategy_count:new Set(g.rows.map(r=>r.STRATEGY_ID)).size,tab_type:'active',strategy_class:g.cls,channel:g.ch,big_category:g.big,small_category:g.small,stat_month:g.m,city_id:'999',county_id:null,create_time:now,update_time:now,is_deleted:0,reject_rate:null,reject_count:null,...vals}; for(const f of [...Object.keys(fields),...Object.keys(rates),'reject_rate']) for(const suffix of ['qoq','yoy'])o[f+'_'+suffix]=null; await insert('t_sr_strategy_period_summary_ap',o); await insert('t_sr_channel_monthly_capacity_ap',{tab_type:'active',channel:g.ch,strategy_class:g.cls,big_category:g.big,small_category:g.small,stat_month:g.m.slice(0,7),capacity:vals.product_conv_num,qoq:null,yoy:null,city_id:'999',county_id:null,create_time:now,update_time:now,is_deleted:0}) }
  // Only compute full-month comparisons where every source snapshot reaches month end.
  const [complete] = await c.query('SELECT stat_month FROM photo_snapshot_audit GROUP BY stat_month HAVING MIN(snapshot_date=LAST_DAY(snapshot_date))=1')
  const full = new Set(complete.map(r=>r.stat_month))
  for(const m of full) {const d=new Date(m+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);const prev=d.toISOString().slice(0,10);if(!full.has(prev))continue; const counts=Object.keys(fields).map(f=>`a.${f}_qoq=ROUND((a.${f}-b.${f})*100/NULLIF(b.${f},0),2)`);const rateChanges=Object.keys(rates).map(f=>`a.${f}_qoq=ROUND(a.${f}-b.${f},2)`);await c.query(`UPDATE t_sr_strategy_period_summary_ap a JOIN t_sr_strategy_period_summary_ap b ON b.stat_month=? AND a.strategy_id=b.strategy_id AND a.strategy_class=b.strategy_class AND a.channel=b.channel AND a.big_category=b.big_category AND a.small_category=b.small_category SET ${[...counts,...rateChanges].join(',')} WHERE a.stat_month=?`,[prev,m]) }
  await c.commit(); console.log(JSON.stringify({database:db,sha256:data.sha256,rows:data.rows.length,strategies:strategies.size,daily:days.length,monthly:monthly.size,capacity:groups.size,views:objects.filter(x=>x.t==='VIEW').length}))
 } catch(e) {await c.rollback(); throw e} finally {await c.end()}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1})
