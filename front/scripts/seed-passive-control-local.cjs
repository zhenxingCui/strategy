/*
 * Add realistic passive/control samples to the existing local MySQL database.
 * This script never creates or drops tables and never rewrites active samples.
 */
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')
const productForStrategy = require('./control-product-names.cjs')

const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
const CITY = '001'
const PASS_MARK = 'LOCAL_PASSIVE_SEED'
const CTRL_MARK = 'LOCAL_CONTROL_SEED'
const PASS_OWNER = '本地联调-增量样例'
const CTRL_OWNER = '本地联调-重点产品样例'
const RULE_CREATOR = 'local-passive-control-seed-v1'
const CHANNELS = {
  passive: [
    ['PCH01', '掌厅专区'], ['PCH02', '短信触达'], ['PCH03', '外呼服务'],
    ['PCH04', '在线客服'], ['PCH05', '线下营业厅'], ['PCH06', '企业微信'],
  ],
  control: [
    ['CCH01', '客户来电'], ['CCH02', '在线咨询'], ['CCH03', '网格走访'],
    ['CCH04', '营业厅受理'], ['CCH05', '服务回访'], ['CCH06', '线上自助'],
  ],
}
const PASS_KPIS = [
  ['strategy_count', '策略数', '个'], ['original_cust', '客群', '人'], ['push_count', '推送量', '次'],
  ['usage_count', '使用量', '次'], ['usage_rate', '使用率', '%'], ['reach_count', '触达量', '次'],
  ['reach_rate', '触达率', '%'], ['target_conv_num', '目标转化量', '次'],
  ['target_conv_rate', '目标转化率', '%'], ['product_conv_num', '全产品转化量', '次'],
  ['product_conv_rate', '全产品转化率', '%'], ['expected_income', '预期收入', '元'],
  ['actual_income', '收入', '元'], ['reject_rate', '拒绝率', '%'],
]
const CTRL_KPIS = [
  ['strategy_count', '策略数', '个'], ['consult_count', '咨询量', '次'], ['retain_count', '挽留量', '次'],
  ['retain_rate', '挽留率', '%'], ['dispatch_count', '派单量', '单'], ['success_count', '成功量', '单'],
  ['success_rate', '成功率', '%'], ['income', '收入', '元'],
]
const PASS_CATEGORIES = [
  ['套餐运营', '套餐升级'], ['权益运营', '会员权益'], ['家庭业务', '融合发展'],
  ['宽带业务', '宽带提速'], ['增值业务', '数字产品'], ['客户经营', '续约挽留'],
]
const CTRL_CATEGORIES = [
  ['套餐保有', '高价值客户保有'], ['宽带挽留', '宽带续约挽留'], ['服务修复', '投诉客户修复'],
  ['权益保障', '权益流失挽留'], ['融合经营', '家庭业务保有'], ['风险预防', '离网风险干预'],
]
const PASS_NAMES = [
  '新客首月权益触达', '高流量用户加油包推荐', '套餐余量提醒与升档', '视频会员权益激活',
  '宽带提速权益推荐', '家庭共享套餐推荐', '合约到期续订提醒', '沉默客户权益唤醒',
  '流量月包场景推荐', '亲情网成员拓展', '云盘会员体验邀约', '校园用户开学权益推荐',
  '夜间流量包定向推荐', '融合套餐补差推荐', '节假日出行流量推荐', '老客户专属权益触达',
  '高频客服用户服务包推荐', '新装宽带增值权益推荐', '影音偏好会员推荐', '国际漫游权益提醒',
  '账单波动套餐优化建议', '大流量用户融合推荐', '家庭副卡拓展邀约', '到期客户优惠续约',
  '云游戏权益体验邀请', '视频彩铃体验转化', '智能组网服务推荐', '低活跃用户关怀触达',
  '线上缴费权益推荐', '老年客户关怀套餐推荐', '短期出行流量包推荐', '高价值客户专属礼包',
  '宽带到期续费提醒', '家庭云存储权益推荐', '高频视频用户权益推荐', '新入网客户服务引导',
]
const CTRL_NAMES = [
  '高价值客户离网预警挽留', '宽带到期续约关怀', '连续投诉客户专属回访', '套餐资费异议挽留',
  '低活跃客户服务修复', '融合业务退订风险挽留', '欠费停机客户复机挽留', '合约到期客户保有',
  '服务质量不满客户回访', '高流失风险客户经理跟进', '宽带故障客户体验修复', '权益到期客户续享挽留',
  '多次咨询客户专席服务', '携转意向客户定向挽留', '家庭主账户变更风险处理', '低满意度客户二次回访',
  '长期未使用客户唤回', '套餐降档意向客户保有', '账单异常客户解释关怀', '网格重点客户上门挽留',
  '宽带拆机意向客户挽留', '副卡集中退订风险干预', '节假日服务保障客户回访', '高投诉倾向客户优先处理',
  '新装未激活客户引导', '携转失败客户服务补救', '权益领取失败客户补偿', '关键业务中断客户恢复',
  '家庭融合拆分风险挽留', '客户经理重点保有名单',
]
const PASS_BUSINESSES = ['套餐升级', '流量包', '会员权益', '宽带提速', '家庭融合', '合约续订']
const CTRL_BUSINESSES = ['套餐保有', '宽带续约', '投诉修复', '权益续享', '融合保有', '复机办理']
const MONTH_SEASON = [0.94, 0.78, 1.02, 0.97, 1.01, 1.06, 1.03, 0.98, 1.04, 1.09, 1.14, 1.21]
const RATE_METRICS = new Set(['usage_rate', 'reach_rate', 'target_conv_rate', 'product_conv_rate', 'reject_rate', 'retain_rate', 'success_rate'])
const round = (n, digits = 2) => Number(Number(n || 0).toFixed(digits))
const pct = (n, d) => (d ? round((n / d) * 100) : 0)
const monthString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const shiftMonth = (month, offset) => {
  const [year, m] = month.split('-').map(Number)
  return monthString(new Date(year, m - 1 + offset, 1))
}
let randomState = 0x57a7e9
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
  return randomState / 0x100000000
}
const between = (min, max) => min + random() * (max - min)
const intBetween = (min, max) => Math.round(between(min, max))
function qoq(current, previous, key) {
  if (!previous || previous[key] == null) return null
  return RATE_METRICS.has(key) ? round(current[key] - previous[key]) : (previous[key] ? round(((current[key] - previous[key]) / previous[key]) * 100) : null)
}
function splitByDay(total, month, salt) {
  const [year, m] = month.split('-').map(Number)
  const days = new Date(year, m, 0).getDate()
  const weights = Array.from({ length: days }, (_, i) => {
    const day = i + 1
    const weekday = new Date(year, m - 1, day).getDay()
    return (weekday === 0 ? 0.56 : weekday === 6 ? 0.74 : 1) *
      ([5, 10, 15, 20, 25].includes(day) ? 1.18 : 1) *
      (day > days - 3 ? 1.12 : 1) * between(0.88, 1.12) * (1 + (salt % 7) * 0.002)
  })
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => total * w / totalWeight)
  const values = exact.map(Math.floor)
  let remain = total - values.reduce((a, b) => a + b, 0)
  exact.map((v, i) => [i, v - values[i]]).sort((a, b) => b[1] - a[1]).slice(0, remain).forEach(([i]) => values[i]++)
  return values
}
function sum(rows, field) { return rows.reduce((value, row) => value + Number(row[field] || 0), 0) }
function apMetrics(rows) {
  const m = {}
  for (const key of ['strategy_count', 'original_cust', 'push_count', 'usage_count', 'reach_count', 'target_conv_num', 'product_conv_num', 'expected_income', 'actual_income', 'reject_count']) m[key] = sum(rows, key)
  m.usage_rate = pct(m.usage_count, m.push_count)
  m.reach_rate = pct(m.reach_count, m.usage_count)
  m.target_conv_rate = pct(m.target_conv_num, m.reach_count)
  m.product_conv_rate = pct(m.product_conv_num, m.reach_count)
  m.reject_rate = pct(m.reject_count, m.push_count)
  return m
}
function ctrlMetrics(rows) {
  const m = {}
  for (const key of ['strategy_count', 'consult_count', 'retain_count', 'dispatch_count', 'success_count', 'income']) m[key] = sum(rows, key)
  m.retain_rate = pct(m.retain_count, m.consult_count)
  m.success_rate = pct(m.success_count, m.dispatch_count)
  return m
}
function withQoq(m, prior) {
  const out = { ...m }
  Object.keys(m).forEach((key) => { out[`${key}_qoq`] = qoq(m, prior, key) })
  return out
}
function apBase({ type = 'passive', month, channel, big, small, id, name, metrics, prior, marker = PASS_MARK }) {
  return {
    tab_type: type, strategy_class: '全部', strategy_id: id, strategy_name: name, channel,
    big_category: big, small_category: small, stat_month: `${month}-01`, ...withQoq(metrics, prior),
    city_id: CITY, county_id: marker, is_deleted: 0,
  }
}
function ctrlBase({ month, channel, big, small, id, code, name, metrics, prior }) {
  return {
    strategy_id: id, strategy_code: code || id, strategy_name: name, channel, big_category: big,
    small_category: small, stat_month: `${month}-01`, ...withQoq(metrics, prior),
    city_id: CITY, county_id: CTRL_MARK, is_deleted: 0,
  }
}
async function main() {
  if (database !== 'strategy_review_active_class_local') throw new Error('仅允许写入 strategy_review_active_class_local，本脚本不会操作其他数据库。')
  const currentMonth = process.env.SR_SEED_MONTH || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date()).replace('/', '-')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(currentMonth)) throw new Error('SR_SEED_MONTH 格式必须是 yyyy-MM')
  const startMonth = shiftMonth(currentMonth, -11)
  const conn = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1', port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root', password: process.env.SR_DB_PASSWORD || '123456',
    database, charset: 'utf8mb4', multipleStatements: true,
  })
  try {
    const [[schema]] = await conn.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [database])
    if (!schema) throw new Error(`数据库 ${database} 不存在`)
    const [[active]] = await conn.query("SELECT COUNT(*) AS n FROM t_sr_strategy WHERE tab_type='active' AND owner='本地联调' AND is_deleted=0")
    const [[foreignActive]] = await conn.query("SELECT COUNT(*) AS n FROM t_sr_strategy WHERE tab_type='active' AND COALESCE(owner,'')<>'本地联调' AND is_deleted=0")
    if (Number(active.n) < 12 || Number(foreignActive.n) > 0) throw new Error('保护检查未通过：目标库不符合本地存量联调样例特征，未写入数据。')
    await conn.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_product_name.sql'), 'utf8'))

    const [bizColumns] = await conn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_sr_strategy_biz_capacity' AND COLUMN_NAME='tab_type'", [database])
    if (!bizColumns.length) await conn.query("ALTER TABLE t_sr_strategy_biz_capacity ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT '策略类型：active/passive/control' AFTER id")
    const [indexRows] = await conn.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='t_sr_strategy_biz_capacity' AND INDEX_NAME='idx_sbc_tab_strategy_date'", [database])
    if (!indexRows.length) await conn.query('ALTER TABLE t_sr_strategy_biz_capacity ADD INDEX idx_sbc_tab_strategy_date (tab_type, strategy_id, stat_date)')
    await conn.query("UPDATE t_sr_strategy_biz_capacity b LEFT JOIN t_sr_strategy s ON s.strategy_code=b.strategy_id SET b.tab_type=COALESCE(s.tab_type,'active') WHERE b.tab_type IS NULL OR b.tab_type=''")

    const passCodes = PASS_NAMES.map((_, i) => `PAS${String(i + 1).padStart(3, '0')}`)
    const ctrlCodes = CTRL_NAMES.map((_, i) => `CTL${String(i + 1).padStart(3, '0')}`)
    const [conflicts] = await conn.query('SELECT strategy_code, tab_type, owner FROM t_sr_strategy WHERE strategy_code IN (?) AND NOT (owner IN (?,?) AND strategy_code LIKE "PAS%" OR owner IN (?,?) AND strategy_code LIKE "CTL%")', [passCodes.concat(ctrlCodes), PASS_OWNER, PASS_OWNER, CTRL_OWNER, CTRL_OWNER])
    if (conflicts.length) throw new Error(`策略编码已被其他数据使用，拒绝覆盖：${conflicts.map((x) => x.strategy_code).join(', ')}`)

    // 只在标记数据范围内重跑；若库里有非本脚本的两类数据则停止，避免混合重复汇总。
    const checks = [
      ["SELECT COUNT(*) n FROM t_sr_strategy_period_summary_ap WHERE tab_type='passive' AND city_id=? AND (county_id IS NULL OR county_id<>?)", [CITY, PASS_MARK]],
      ["SELECT COUNT(*) n FROM t_sr_kpi_summary WHERE tab_type='passive' AND city_id=? AND (county_id IS NULL OR county_id<>?)", [CITY, PASS_MARK]],
      ["SELECT COUNT(*) n FROM t_sr_strategy_period_summary_ctrl WHERE city_id=? AND (county_id IS NULL OR county_id<>?)", [CITY, CTRL_MARK]],
      ["SELECT COUNT(*) n FROM t_sr_kpi_summary WHERE tab_type='control' AND city_id=? AND (county_id IS NULL OR county_id<>?)", [CITY, CTRL_MARK]],
    ]
    for (const [sql, args] of checks) {
      const [[row]] = await conn.query(sql, args)
      if (Number(row.n)) throw new Error('发现非本脚本生成的增量/重点产品样例数据；为避免叠加或覆盖，请先核对本地库。')
    }

    await conn.beginTransaction()
    try {
      const [rulesToRemove] = await conn.query('SELECT id FROM t_sr_warning_rule WHERE create_by=?', [RULE_CREATOR])
      const ruleIds = rulesToRemove.map((r) => r.id)
      if (ruleIds.length) {
        await conn.query('DELETE FROM t_sr_warning_rule_condition WHERE rule_id IN (?)', [ruleIds])
        await conn.query('DELETE FROM t_sr_warning_hit WHERE rule_id IN (?)', [ruleIds])
      }
      await conn.query('DELETE FROM t_sr_warning_rule WHERE create_by=?', [RULE_CREATOR])
      await conn.query('DELETE FROM t_sr_strategy_biz_capacity WHERE county_id IN (?,?)', [PASS_MARK, CTRL_MARK])
      await conn.query('DELETE FROM t_sr_strategy_reject_reason WHERE county_id IN (?,?)', [PASS_MARK, CTRL_MARK])
      await conn.query('DELETE FROM t_sr_strategy_daily_ap WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_channel_biz_capacity_ap WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_channel_monthly_capacity_ap WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_channel_summary_ap WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_strategy_period_summary_ap WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_kpi_summary WHERE tab_type=? AND county_id=?', ['passive', PASS_MARK])
      await conn.query('DELETE FROM t_sr_strategy_daily_ctrl WHERE county_id=?', [CTRL_MARK])
      await conn.query('DELETE FROM t_sr_channel_biz_capacity_ctrl WHERE county_id=?', [CTRL_MARK])
      await conn.query('DELETE FROM t_sr_channel_monthly_capacity_ctrl WHERE county_id=?', [CTRL_MARK])
      await conn.query('DELETE FROM t_sr_channel_summary_ctrl WHERE county_id=?', [CTRL_MARK])
      await conn.query('DELETE FROM t_sr_strategy_period_summary_ctrl WHERE county_id=?', [CTRL_MARK])
      await conn.query('DELETE FROM t_sr_kpi_summary WHERE tab_type=? AND county_id=?', ['control', CTRL_MARK])
      await conn.query('DELETE FROM t_sr_strategy WHERE owner IN (?,?)', [PASS_OWNER, CTRL_OWNER])

      const columns = new Map()
      async function insert(table, rows) {
        if (!rows.length) return
        if (!columns.has(table)) {
          const [cols] = await conn.query('SHOW COLUMNS FROM ??', [table])
          columns.set(table, new Set(cols.map((c) => c.Field)))
        }
        const names = Object.keys(rows[0]).filter((key) => columns.get(table).has(key))
        for (let i = 0; i < rows.length; i += 400) {
          await conn.query('INSERT INTO ?? (??) VALUES ?', [table, names, rows.slice(i, i + 400).map((row) => names.map((key) => row[key] == null ? null : row[key]))])
        }
      }
      async function insertRows(table, rows) { for (let i = 0; i < rows.length; i += 400) await insert(table, rows.slice(i, i + 400)) }
      const dims = []
      for (const type of ['passive', 'control']) {
        for (const [index, [code, name]] of CHANNELS[type].entries()) dims.push({ key_code: code, key_name: name, tab_type: type, status: 1, sort_no: index + 1, is_deleted: 0 })
      }
      await insertRows('t_sr_dim_channel', dims)
      const metricNames = Object.fromEntries([...PASS_KPIS, ...CTRL_KPIS].map(([code, name]) => [code, name]))
      const metricRows = []
      for (const type of ['passive', 'control']) {
        const list = type === 'passive' ? PASS_KPIS : CTRL_KPIS
        for (const [index, [code, name]] of list.entries()) {
          const [[found]] = await conn.query('SELECT COUNT(*) AS n FROM t_sr_dim_metric WHERE metric_code=? AND FIND_IN_SET(?,tab_type)>0 AND is_deleted=0', [code, type])
          if (!Number(found.n)) metricRows.push({ metric_code: code, metric_name: name, tab_type: type, status: 1, sort_no: index + 1, is_deleted: 0 })
        }
      }
      await insertRows('t_sr_dim_metric', metricRows)

      const passStrategies = PASS_NAMES.map((name, i) => ({
        strategy_code: passCodes[i], strategy_name: name, tab_type: 'passive', strategy_class: '全部',
        product_name: null,
        channel: CHANNELS.passive[i % CHANNELS.passive.length][0], strategy_level: ['省级', '市级', '区县级'][i % 3],
        caliber: `近三个月符合${PASS_CATEGORIES[i % PASS_CATEGORIES.length][1]}条件且处于可触达状态的目标客户`,
        iteration: 1 + (i % 6), owner: PASS_OWNER, status: '生效中',
        start_date: `${shiftMonth(startMonth, i % 6)}-01`, end_date: `${shiftMonth(startMonth, Math.min(11, i % 6 + 5 + (i % 4)))}-28`,
        create_time: `${shiftMonth(startMonth, i % 6)}-01 09:00:00`, is_deleted: 0,
      }))
      const ctrlStrategies = CTRL_NAMES.map((name, i) => ({
        strategy_code: ctrlCodes[i], strategy_name: name, tab_type: 'control', strategy_class: '全部',
        product_name: productForStrategy(name),
        channel: CHANNELS.control[i % CHANNELS.control.length][0], strategy_level: ['省级', '市级', '区县级'][i % 3],
        caliber: `结合服务记录、业务到期和客户风险评分触发${CTRL_CATEGORIES[i % CTRL_CATEGORIES.length][1]}流程`,
        iteration: 1 + (i % 5), owner: CTRL_OWNER, status: '生效中',
        start_date: `${shiftMonth(startMonth, i % 5)}-01`, end_date: `${shiftMonth(startMonth, Math.min(11, i % 5 + 6 + (i % 3)))}-28`,
        create_time: `${shiftMonth(startMonth, i % 5)}-01 09:00:00`, is_deleted: 0,
      }))
      await insertRows('t_sr_strategy', passStrategies.concat(ctrlStrategies))

      const passPeriods = [], passChannelSummary = [], passMonthlyCapacity = [], passChannelBiz = [], passKpis = [], passDaily = [], passCategories = [], passBiz = [], rejectRows = []
      const ctrlPeriods = [], ctrlChannelSummary = [], ctrlMonthlyCapacity = [], ctrlChannelBiz = [], ctrlKpis = [], ctrlDaily = [], ctrlCategories = [], ctrlBiz = []
      const passPriorStrategy = new Map(), passPriorChannel = new Map(), ctrlPriorStrategy = new Map(), ctrlPriorChannel = new Map()
      const monthStrings = Array.from({ length: 12 }, (_, i) => shiftMonth(startMonth, i))
      for (let mi = 0; mi < monthStrings.length; mi++) {
        const month = monthStrings[mi]
        const season = MONTH_SEASON[Number(month.slice(5, 7)) - 1]
        const passiveRows = []
        passStrategies.forEach((s, i) => {
          const start = i % 6
          const end = Math.min(11, start + 5 + (i % 4))
          if (mi < start || mi > end) return
          const channel = s.channel
          const [big, small] = PASS_CATEGORIES[i % PASS_CATEGORIES.length]
          const noise = between(0.86, 1.16)
          const push = Math.round(intBetween(22000, 148000) * season * noise * (1 + Math.min(mi - start, 5) * between(0.005, 0.025)))
          const original = Math.round(push * between(1.08, 1.34))
          const usageRate = between(0.36, 0.72) - (i % 6 === 5 ? 0.08 : 0)
          const usage = Math.round(push * usageRate)
          const reach = Math.round(usage * between(0.57, 0.91))
          const target = Math.round(reach * between(0.055, 0.14))
          const product = Math.round(reach * between(0.07, 0.2))
          const expected = Math.round(product * between(82, 285))
          const actual = Math.round(expected * between(0.72, 1.08))
          const rejected = Math.round(push * between(0.018, 0.092))
          const metrics = { strategy_count: 1, original_cust: original, push_count: push, usage_count: usage, usage_rate: pct(usage, push), reach_count: reach, reach_rate: pct(reach, usage), target_conv_num: target, target_conv_rate: pct(target, reach), product_conv_num: product, product_conv_rate: pct(product, reach), expected_income: expected, actual_income: actual, reject_count: rejected, reject_rate: pct(rejected, push) }
          const prior = passPriorStrategy.get(s.strategy_code)
          const row = apBase({ month, channel, big, small, id: s.strategy_code, name: s.strategy_name, metrics, prior })
          passiveRows.push(row); passPeriods.push(row); passPriorStrategy.set(s.strategy_code, metrics)
          const dayFields = { original_cust: original, push_count: push, usage_count: usage, reach_count: reach, target_conv_num: target, product_conv_num: product, expected_income: expected, actual_income: actual, reject_count: rejected }
          const daily = Object.fromEntries(Object.entries(dayFields).map(([key, value]) => [key, splitByDay(value, month, i + mi)]))
          const [year, mm] = month.split('-').map(Number); const days = new Date(year, mm, 0).getDate()
          for (let day = 1; day <= days; day++) {
            const d = Object.fromEntries(Object.entries(daily).map(([key, values]) => [key, values[day - 1]]))
            passDaily.push({ tab_type: 'passive', strategy_class: '全部', strategy_id: s.strategy_code, stat_date: `${month}-${String(day).padStart(2, '0')}`, channel, big_category: big, small_category: small, strategy_name: s.strategy_name, ...d, usage_rate: pct(d.usage_count, d.push_count), reach_rate: pct(d.reach_count, d.usage_count), target_conv_rate: pct(d.target_conv_num, d.reach_count), product_conv_rate: pct(d.product_conv_num, d.reach_count), reject_rate: pct(d.reject_count, d.push_count), city_id: CITY, county_id: PASS_MARK, is_deleted: 0 })
          }
          const bizSplit = splitTotal(product, PASS_BUSINESSES.length)
          PASS_BUSINESSES.forEach((bizName, bi) => passBiz.push({ tab_type: 'passive', strategy_id: s.strategy_code, stat_date: `${month}-01`, biz_code: `PB${String(bi + 1).padStart(2, '0')}`, biz_name: bizName, count: bizSplit[bi], mom_ratio: between(-18, 24), yoy_ratio: null, city_id: CITY, county_id: PASS_MARK, is_deleted: 0 }))
          const reasons = ['暂无办理需求', '资费与预期不符', '现有产品已满足需求', '希望稍后联系', '触达失败或号码无效']
          splitTotal(rejected, reasons.length).forEach((count, ri) => rejectRows.push({ strategy_id: s.strategy_code, stat_month: `${month}-01`, reason_code: `PR${ri + 1}`, reason_name: reasons[ri], reject_count: count, reject_ratio: pct(count, rejected), color: ['#3b82f6', '#5ac4d1', '#a78bfa', '#f6bd60', '#94a3b8'][ri], sort_no: ri + 1, city_id: CITY, county_id: PASS_MARK, is_deleted: 0 }))
        })
        const passiveTotal = apMetrics(passiveRows)
        const priorTotal = mi ? apMetrics(passPeriods.filter((r) => r.stat_month === `${monthStrings[mi - 1]}-01` && r.strategy_id !== '999')) : null
        for (const [index, [code, label, unit]] of PASS_KPIS.entries()) passKpis.push({ tab_type: 'passive', strategy_class: '全部', metric_code: code, metric_name: label, value: passiveTotal[code], unit, qoq: qoq(passiveTotal, priorTotal, code), yoy: null, icon: 'trend', sort_no: index + 1, stat_month: month, city_id: CITY, county_id: PASS_MARK, is_deleted: 0 })
        for (const [channelCode] of CHANNELS.passive) {
          const rows = passiveRows.filter((r) => r.channel === channelCode)
          if (!rows.length) continue
          const metrics = apMetrics(rows)
          const key = channelCode; const prior = passPriorChannel.get(key)
          passChannelSummary.push({ tab_type: 'passive', strategy_class: '全部', stat_month: `${month}-01`, channel: channelCode, ...withQoq(metrics, prior), city_id: CITY, county_id: PASS_MARK, is_deleted: 0 })
          passPriorChannel.set(key, metrics)
          const capacity = metrics.product_conv_num
          passMonthlyCapacity.push({ tab_type: 'passive', strategy_class: '全部', stat_month: `${month}-01`, channel: channelCode, big_category: '全部', small_category: '全部', capacity, qoq: qoq(metrics, prior, 'product_conv_num'), city_id: CITY, county_id: PASS_MARK, is_deleted: 0 })
          for (const [big, small] of PASS_CATEGORIES) {
            const group = rows.filter((r) => r.big_category === big)
            if (!group.length) continue
            const grouped = apMetrics(group)
            passCategories.push(apBase({ month, channel: channelCode, big, small, id: '999', name: '分类汇总', metrics: grouped, prior: null }))
          }
          PASS_BUSINESSES.forEach((bizName, bi) => {
            const cap = Math.round(capacity * between(0.06, 0.25) / 1.1)
            passChannelBiz.push({ tab_type: 'passive', strategy_class: '全部', stat_month: `${month}-01`, channel: channelCode, big_category: PASS_CATEGORIES[bi % PASS_CATEGORIES.length][0], small_category: PASS_CATEGORIES[bi % PASS_CATEGORIES.length][1], biz_name: bizName, capacity: cap, qoq: between(-15, 20), city_id: CITY, county_id: PASS_MARK, is_deleted: 0 })
          })
        }

        const controlRows = []
        ctrlStrategies.forEach((s, i) => {
          const start = i % 5
          const end = Math.min(11, start + 6 + (i % 3))
          if (mi < start || mi > end) return
          const [big, small] = CTRL_CATEGORIES[i % CTRL_CATEGORIES.length]
          const consult = Math.round(intBetween(1400, 16800) * season * between(0.82, 1.2))
          const retainRate = between(0.24, 0.69)
          const retain = Math.round(consult * retainRate)
          const dispatch = Math.round(retain * between(0.35, 0.88))
          const successRate = between(0.38, 0.86)
          const success = Math.round(dispatch * successRate)
          const income = Math.round(success * between(35, 420))
          const metrics = { strategy_count: 1, consult_count: consult, retain_count: retain, retain_rate: pct(retain, consult), dispatch_count: dispatch, success_count: success, success_rate: pct(success, dispatch), income }
          const prior = ctrlPriorStrategy.get(s.strategy_code)
          const row = ctrlBase({ month, channel: s.channel, big, small, id: s.strategy_code, code: s.strategy_code, name: s.strategy_name, metrics, prior })
          controlRows.push(row); ctrlPeriods.push(row); ctrlPriorStrategy.set(s.strategy_code, metrics)
          const dailyFields = { consult_count: consult, retain_count: retain, dispatch_count: dispatch, success_count: success }
          const daily = Object.fromEntries(Object.entries(dailyFields).map(([key, value]) => [key, splitByDay(value, month, i + mi)]))
          const [year, mm] = month.split('-').map(Number); const days = new Date(year, mm, 0).getDate()
          for (let day = 1; day <= days; day++) {
            const d = Object.fromEntries(Object.entries(daily).map(([key, values]) => [key, values[day - 1]]))
            ctrlDaily.push({ strategy_id: s.strategy_code, stat_date: `${month}-${String(day).padStart(2, '0')}`, channel: s.channel, big_category: big, small_category: small, strategy_name: s.strategy_name, ...d, retain_rate: pct(d.retain_count, d.consult_count), success_rate: pct(d.success_count, d.dispatch_count), city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
          }
          splitTotal(success, CTRL_BUSINESSES.length).forEach((count, bi) => ctrlBiz.push({ tab_type: 'control', strategy_id: s.strategy_code, stat_date: `${month}-01`, biz_code: `CB${String(bi + 1).padStart(2, '0')}`, biz_name: CTRL_BUSINESSES[bi], count, mom_ratio: between(-20, 26), yoy_ratio: null, city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 }))
          const reasons = ['当前套餐仍满足需求', '优惠力度不足', '计划后续办理', '希望先解决服务问题', '已通过其他渠道办理']
          const lost = Math.max(0, consult - retain)
          splitTotal(lost, reasons.length).forEach((count, ri) => rejectRows.push({ strategy_id: s.strategy_code, stat_month: `${month}-01`, reason_code: `CR${ri + 1}`, reason_name: reasons[ri], reject_count: count, reject_ratio: pct(count, lost), color: ['#3b82f6', '#5ac4d1', '#a78bfa', '#f6bd60', '#94a3b8'][ri], sort_no: ri + 1, city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 }))
        })
        const total = ctrlMetrics(controlRows)
        const ctrlPriorTotal = mi ? ctrlMetrics(ctrlPeriods.filter((r) => r.stat_month === `${monthStrings[mi - 1]}-01` && r.strategy_id !== '999')) : null
        for (const [index, [code, label, unit]] of CTRL_KPIS.entries()) ctrlKpis.push({ tab_type: 'control', strategy_class: '全部', metric_code: code, metric_name: label, value: total[code], unit, qoq: qoq(total, ctrlPriorTotal, code), yoy: null, icon: 'trend', sort_no: index + 1, stat_month: month, city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
        const allSuccessPrior = mi ? ctrlPriorChannel.get('全部') : null
        ctrlMonthlyCapacity.push({ stat_month: `${month}-01`, channel: '全部', big_category: '全部', small_category: '全部', capacity: total.success_count, qoq: qoq(total, ctrlPriorTotal, 'success_count'), city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
        for (const [channelCode] of CHANNELS.control) {
          const rows = controlRows.filter((r) => r.channel === channelCode)
          if (!rows.length) continue
          const metrics = ctrlMetrics(rows)
          const prior = ctrlPriorChannel.get(channelCode)
          ctrlChannelSummary.push({ stat_month: `${month}-01`, channel: channelCode, ...withQoq(metrics, prior), city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
          ctrlPriorChannel.set(channelCode, metrics)
          ctrlMonthlyCapacity.push({ stat_month: `${month}-01`, channel: channelCode, big_category: '全部', small_category: '全部', capacity: metrics.success_count, qoq: qoq(metrics, prior, 'success_count'), city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
          for (const [big, small] of CTRL_CATEGORIES) {
            const group = rows.filter((r) => r.big_category === big)
            if (!group.length) continue
            ctrlCategories.push(ctrlBase({ month, channel: channelCode, big, small, id: '999', name: '场景汇总', metrics: ctrlMetrics(group), prior: null }))
          }
          CTRL_BUSINESSES.forEach((bizName, bi) => {
            const capacity = Math.round(metrics.success_count * between(0.08, 0.25) / 1.0)
            ctrlChannelBiz.push({ stat_month: `${month}-01`, channel: channelCode, big_category: CTRL_CATEGORIES[bi % CTRL_CATEGORIES.length][0], small_category: CTRL_CATEGORIES[bi % CTRL_CATEGORIES.length][1], biz_name: bizName, capacity, qoq: between(-18, 24), city_id: CITY, county_id: CTRL_MARK, is_deleted: 0 })
          })
        }
      }
      passPeriods.push(...passCategories)
      ctrlPeriods.push(...ctrlCategories)
      await insertRows('t_sr_strategy_period_summary_ap', passPeriods)
      await insertRows('t_sr_kpi_summary', passKpis.concat(ctrlKpis))
      await insertRows('t_sr_channel_summary_ap', passChannelSummary)
      await insertRows('t_sr_channel_monthly_capacity_ap', passMonthlyCapacity)
      await insertRows('t_sr_channel_biz_capacity_ap', passChannelBiz)
      await insertRows('t_sr_strategy_daily_ap', passDaily)
      await insertRows('t_sr_strategy_biz_capacity', passBiz.concat(ctrlBiz))
      await insertRows('t_sr_strategy_period_summary_ctrl', ctrlPeriods)
      await insertRows('t_sr_channel_summary_ctrl', ctrlChannelSummary)
      await insertRows('t_sr_channel_monthly_capacity_ctrl', ctrlMonthlyCapacity)
      await insertRows('t_sr_channel_biz_capacity_ctrl', ctrlChannelBiz)
      await insertRows('t_sr_strategy_daily_ctrl', ctrlDaily)
      await insertRows('t_sr_strategy_reject_reason', rejectRows)
      await seedRules(conn, startMonth, currentMonth)
      await conn.commit()
      console.log(JSON.stringify({ database, months: `${startMonth}..${currentMonth}`, passiveStrategies: passStrategies.length, controlStrategies: ctrlStrategies.length, passiveMonthlyFacts: passPeriods.length, controlMonthlyFacts: ctrlPeriods.length, passiveDailyRows: passDaily.length, controlDailyRows: ctrlDaily.length, strategyBizRows: passBiz.length + ctrlBiz.length, warningRules: 8, tablesCreated: 0 }, null, 2))
    } catch (error) {
      await conn.rollback()
      throw error
    }
  } finally {
    await conn.end()
  }
}
function splitTotal(total, pieces) {
  const weights = Array.from({ length: pieces }, () => between(0.5, 1.5))
  const exact = weights.map((weight) => total * weight / weights.reduce((a, b) => a + b, 0))
  const result = exact.map(Math.floor)
  let remain = total - result.reduce((a, b) => a + b, 0)
  exact.map((value, index) => [index, value - result[index]]).sort((a, b) => b[1] - a[1]).slice(0, remain).forEach(([index]) => result[index]++)
  return result
}
async function seedRules(conn, startMonth, currentMonth) {
  const definitions = [
    { type: 'passive', name: '增量策略使用率偏低', metric: 'usage_rate', label: '使用率', threshold: 40, unit: '%', operator: 'lt' },
    { type: 'passive', name: '增量策略转化量预警', metric: 'product_conv_num', label: '全产品转化量', threshold: 3000, unit: '次', operator: 'lt' },
    { type: 'passive', name: '增量策略收入波动关注', metric: 'actual_income', label: '收入', threshold: 250000, unit: '元', operator: 'lt' },
    { type: 'passive', name: '增量策略历史规则示例', metric: 'reach_count', label: '触达量', threshold: 12000, unit: '次', operator: 'lt', status: '已过期', end: -2 },
    { type: 'control', name: '重点产品挽留率偏低', metric: 'retain_rate', label: '挽留率', threshold: 38, unit: '%', operator: 'lt' },
    { type: 'control', name: '重点产品成功率预警', metric: 'success_rate', label: '成功率', threshold: 55, unit: '%', operator: 'lt' },
    { type: 'control', name: '重点产品收入关注', metric: 'income', label: '收入', threshold: 70000, unit: '元', operator: 'lt' },
    { type: 'control', name: '重点产品停用规则示例', metric: 'consult_count', label: '咨询量', threshold: 5000, unit: '次', operator: 'lt', status: '已停用' },
  ]
  for (const [index, rule] of definitions.entries()) {
    const startDate = `${shiftMonth(startMonth, -1)}-01`
    const endDate = rule.end != null ? `${shiftMonth(currentMonth, rule.end)}-28` : `${shiftMonth(currentMonth, 12)}-28`
    const [result] = await conn.query(
      'INSERT INTO t_sr_warning_rule (rule_name,rule_desc,tab_type,status,start_date,end_date,data_start_date,data_end_date,channels,strategies,logic,create_by,creator,create_time,is_deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),0)',
      [rule.name, '本地联调样例规则（用于验证规则筛选与命中策略）', rule.type, rule.status || '生效中', startDate, endDate, `${startMonth}-01`, `${currentMonth}-28`, '', '', 'and', RULE_CREATOR, '本地联调',],
    )
    await conn.query(
      'INSERT INTO t_sr_warning_rule_condition (rule_id,metric_code,metric_name,operator,threshold,unit,sort_no,create_time,is_deleted) VALUES (?,?,?,?,?,?,1,NOW(),0)',
      [result.insertId, rule.metric, rule.label, rule.operator, rule.threshold, rule.unit],
    )
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
