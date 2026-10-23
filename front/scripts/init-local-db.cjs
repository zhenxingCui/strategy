/* 本地联调数据：新建独立数据库，拒绝覆盖已有库；不依赖前端模拟数据。 */
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const keyAudienceNames = [
  '高价值客户专属权益推荐', '校园客群流量升级', '家庭主账户融合经营', '银龄客户关怀服务',
  '商旅客群漫游权益推荐', '高流量客群套餐优化', '合约到期重点客户续约', '宽带高潜客群提速推荐',
]
const activeClasses = ['升接', '稳', '降拆', '离', '重点客群']
const customerGroups = ['高价值客群', '校园客群', '家庭客群', '银龄客群', '高价值客群', '校园客群', '高价值客群', '家庭客群']

const database = process.env.SR_DB_NAME || 'strategy_review_active_class_local'
if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database)) throw new Error('数据库名仅支持字母、数字和下划线')
const refreshExisting = process.env.SR_REFRESH_LOCAL_DB === '1'
if (refreshExisting && database !== 'strategy_review_active_class_local') {
  throw new Error('刷新模式仅允许更新 strategy_review_active_class_local，避免误改其他数据库')
}
const now = new Date()
const seedMonth =
  process.env.SR_SEED_MONTH ||
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' })
    .format(now)
    .replace('/', '-')
const [seedYear, seedM] = seedMonth.split('-').map(Number)
if (!seedYear || seedM < 1 || seedM > 12) throw new Error('SR_SEED_MONTH 应为 yyyy-MM')
const ymAt = (offset) => {
  const d = new Date(seedYear, seedM - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const round = (n) => Math.round(n * 100) / 100
const ratio = (a, b) => (b ? round((a / b) * 100) : 0)
const metricLabels = {
  strategy_count: '策略数',
  original_cust: '客群',
  push_count: '推送量',
  usage_count: '使用量',
  reach_count: '触达量',
  target_conv_num: '目标转化量',
  product_conv_num: '全产品转化量',
  usage_rate: '使用率',
  reach_rate: '触达率',
  target_conv_rate: '目标转化率',
  product_conv_rate: '全产品转化率',
  expected_income: '预期收入',
  actual_income: '收入',
}
const countFields = [
  'strategy_count',
  'original_cust',
  'push_count',
  'usage_count',
  'reach_count',
  'target_conv_num',
  'product_conv_num',
  'expected_income',
  'actual_income',
  'reject_count',
]
function aggregate(rows) {
  const out = Object.fromEntries(countFields.map((key) => [key, rows.reduce((n, row) => n + (row[key] || 0), 0)]))
  out.usage_rate = ratio(out.usage_count, out.push_count)
  out.reach_rate = ratio(out.reach_count, out.usage_count)
  out.target_conv_rate = ratio(out.target_conv_num, out.reach_count)
  out.product_conv_rate = ratio(out.product_conv_num, out.reach_count)
  out.reject_rate = ratio(out.reject_count, out.push_count)
  return out
}
function withQoq(current, previous) {
  const out = { ...current }
  for (const key of Object.keys(metricLabels).concat('reject_count', 'reject_rate')) {
    out[key + '_qoq'] = previous
      ? key.endsWith('_rate')
        ? round(current[key] - previous[key])
        : ratio(current[key] - previous[key], previous[key])
      : null
  }
  return out
}
function seededClassShuffle(size) {
  const values = Array.from({ length: size }, (_, index) => index % 4)
  let seed = 20261022
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  for (let index = values.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[values[index], values[other]] = [values[other], values[index]]
  }
  return values.map((index) => ['升接', '稳', '降拆', '离'][index])
}

function stableNoise(key, min = 0.9, max = 1.1) {
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const normalized = (hash >>> 0) / 0xffffffff
  return min + (max - min) * normalized
}

function allocateByDay(total, month, key) {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(year, monthNumber, 0).getDate()
  const weights = Array.from({ length: days }, (_, index) => {
    const day = index + 1
    const weekday = new Date(year, monthNumber - 1, day).getDay()
    const weekdayWeight = weekday === 0 ? 0.58 : weekday === 6 ? 0.76 : 1
    const campaignWeight = [5, 10, 15, 20, 25].includes(day) ? 1.2 : 1
    const monthEndWeight = day > days - 3 ? 1.15 : 1
    return weekdayWeight * campaignWeight * monthEndWeight * stableNoise(`${key}:${day}`, 0.88, 1.12)
  })
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) => (total * weight) / weightTotal)
  const allocated = exact.map(Math.floor)
  let remainder = total - allocated.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({ index, fraction: value - allocated[index] }))
    .sort((a, b) => b.fraction - a.fraction)
  for (let index = 0; index < remainder; index++) allocated[order[index].index]++
  return allocated
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.SR_DB_HOST || '127.0.0.1',
    port: Number(process.env.SR_DB_PORT || 3306),
    user: process.env.SR_DB_USER || 'root',
    password: process.env.SR_DB_PASSWORD || '123456',
    multipleStatements: true,
    charset: 'utf8mb4',
  })
  try {
    const [existing] = await connection.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [database],
    )
    if (existing.length && !refreshExisting) {
      throw new Error(`数据库 ${database} 已存在；为避免覆盖，请指定新的 SR_DB_NAME。`)
    }
    if (!existing.length) {
      const schema = fs
        .readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review.sql'), 'utf8')
        .replace(/\bstrategy_review\b/g, database)
      await connection.query(schema)
    }
    await connection.query('USE ??', [database])
    await connection.query(fs.readFileSync(path.resolve(__dirname, '../../back/src/main/resources/sql/strategy_review_add_customer_group.sql'), 'utf8'))
    if (refreshExisting) {
      const [seeded] = await connection.query(
        "SELECT COUNT(*) AS seeded_count FROM t_sr_strategy WHERE tab_type = 'active' AND owner = '本地联调' AND strategy_code LIKE 'STR%' AND is_deleted = 0",
      )
      const [other] = await connection.query(
        "SELECT COUNT(*) AS other_count FROM t_sr_strategy WHERE tab_type = 'active' AND COALESCE(owner, '') <> '本地联调' AND is_deleted = 0",
      )
      if (Number(seeded[0].seeded_count) < 12 || Number(other[0].other_count) > 0) {
        throw new Error('刷新保护已阻止：数据库不符合本地联调样例库特征，未修改任何数据。')
      }
    }
    const columnCache = {}
    async function insert(table, rows) {
      if (!rows.length) return
      if (!columnCache[table]) {
        const [cols] = await connection.query('SHOW COLUMNS FROM ??', [table])
        columnCache[table] = new Set(cols.map((col) => col.Field))
      }
      const columns = Object.keys(rows[0]).filter((key) => columnCache[table].has(key))
      for (let i = 0; i < rows.length; i += 400) {
        await connection.query('INSERT INTO ?? (??) VALUES ?', [
          table,
          columns,
          rows.slice(i, i + 400).map((row) => columns.map((key) => (row[key] == null ? null : row[key]))),
        ])
      }
    }
    await connection.beginTransaction()
    if (refreshExisting) {
      const generatedStrategyIds = Array.from({ length: 12 + keyAudienceNames.length }, (_, index) => `STR${String(index + 1).padStart(3, '0')}`)
      const deletes = [
        ['t_sr_strategy_reject_reason', 'strategy_id IN (?) AND city_id = ?', [generatedStrategyIds, '001']],
        ['t_sr_strategy_biz_capacity', 'strategy_id IN (?) AND city_id = ?', [generatedStrategyIds, '001']],
        ['t_sr_channel_biz_capacity_ap', 'tab_type = ? AND city_id = ?', ['active', '001']],
        ['t_sr_strategy_daily_ap', 'tab_type = ? AND city_id = ?', ['active', '001']],
        ['t_sr_channel_monthly_capacity_ap', 'tab_type = ? AND city_id = ?', ['active', '001']],
        ['t_sr_channel_summary_ap', 'tab_type = ? AND city_id = ?', ['active', '001']],
        ['t_sr_strategy_period_summary_ap', 'tab_type = ? AND city_id = ?', ['active', '001']],
        ['t_sr_kpi_summary', 'tab_type = ? AND city_id = ?', ['active', '001']],
      ]
      for (const [table, where, params] of deletes) {
        await connection.query(`DELETE FROM ?? WHERE ${where}`, [table, ...params])
      }
      await connection.query(
        'DELETE FROM t_sr_strategy WHERE strategy_code IN (?) AND owner = ?',
        [generatedStrategyIds, '本地联调'],
      )
    }
    const channels = ['热线-瞬时', '商机团队', '热线-外呼', '工作号服务平台'].map((name, i) => ({
      key_code: String(i + 1).padStart(2, '0'),
      key_name: name,
      tab_type: 'active',
      status: 1,
      sort_no: i + 1,
    }))
    if (!refreshExisting) {
      await insert('t_sr_dim_channel', channels)
      await insert(
        't_sr_dim_metric',
        Object.entries(metricLabels)
          .filter(([key]) => key !== 'reach_rate')
          .map(([key, name], i) => ({
            metric_code: key,
            metric_name: name,
            tab_type: 'active',
            status: 1,
            sort_no: i + 1,
          })),
      )
    }
    const names = [
      '5G套餐升档提醒',
      '流量权益推荐',
      '视频彩铃体验',
      '宽带续约关怀',
      '家庭融合推荐',
      '会员权益关怀',
      '套餐到期提醒',
      '高流量用户经营',
      '合约续订推荐',
      '亲情网拓展',
      '宽带提速推荐',
      '重点客户关怀',
      ...keyAudienceNames,
    ]
    const launchOffsets = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 0, 0, 1, 2, 3, 4, 5, 6]
    const endOffsets = [11, 11, 8, 11, 11, 9, 11, 10, 11, 11, 11, 11, ...keyAudienceNames.map(() => 11)]
    const monthlyPushBases = [72000, 128000, 54000, 91000, 67000, 145000, 48000, 112000, 83000, 59000, 101000, 76000, 86000, 113000, 98000, 62000, 74000, 132000, 89000, 105000]
    // 保留原有四类分组，重点客群使用独立策略和独立指标。
    const strategyClasses = seededClassShuffle(12).concat(keyAudienceNames.map(() => '重点客群'))
    const big = ['套餐运营', '权益运营', '增值业务', '家庭业务']
    const small = ['套餐升档', '权益领取', '彩铃体验', '宽带续约']
    const strategies = names.map((name, i) => ({
      strategy_code: `STR${String(i + 1).padStart(3, '0')}`,
      strategy_name: name,
      tab_type: 'active',
      strategy_class: strategyClasses[i],
      customer_group: i >= 12 ? customerGroups[i - 12] : null,
      channel: channels[i % 4].key_code,
      strategy_level: ['省级', '市级', '网格级'][i % 3],
      caliber: `近三个月符合${small[i % 4]}条件且允许营销触达的客户（本地联调样例）`,
      iteration: (i % 4) + 1,
      owner: '本地联调',
      status: endOffsets[i] < 11 ? '已结束' : '生效中',
      start_date: ymAt(launchOffsets[i] - 11) + '-01',
      end_date: ymAt(endOffsets[i] - 11) + '-28',
      create_time: ymAt(launchOffsets[i] - 11) + '-01 09:00:00',
      big_category: big[i % 4],
      small_category: small[i % 4],
    }))
    await insert('t_sr_strategy', strategies)
    const common = { tab_type: 'active', strategy_class: '全部', city_id: '001', is_deleted: 0 }
    const periods = []
    const channelRows = []
    const categoryRows = []
    const kpis = []
    const capacities = []
    const daily = []
    let previousTotal = null
    const previousClassTotal = {}
    const previousStrategy = {}
    const previousChannel = {}
    for (let index = 0; index < 12; index++) {
      const month = ymAt(index - 11)
      const monthNumber = Number(month.slice(5, 7))
      const seasonalFactor = {
        1: 0.91, 2: 0.76, 3: 1.03, 4: 0.98, 5: 1.01, 6: 1.07,
        7: 1.02, 8: 0.97, 9: 1.04, 10: 1.08, 11: 1.12, 12: 1.2,
      }[monthNumber]
      const monthly = strategies.flatMap((s, i) => {
        if (index < launchOffsets[i] || index > endOffsets[i]) return []
        const noise = stableNoise(`${s.strategy_code}:${month}`, 0.88, 1.14)
        const trendFactor = 1 + index * 0.006
        const classRates = {
          升接: { usage: 0.54, reach: 0.72, target: 0.092, product: 0.146 },
          稳: { usage: 0.49, reach: 0.76, target: 0.078, product: 0.128 },
          降拆: { usage: 0.45, reach: 0.68, target: 0.071, product: 0.112 },
          离: { usage: 0.39, reach: 0.63, target: 0.058, product: 0.094 },
          重点客群: { usage: 0.61, reach: 0.79, target: 0.108, product: 0.172 },
        }[s.strategy_class]
        const push = Math.round(monthlyPushBases[i] * seasonalFactor * trendFactor * noise)
        const originalCust = Math.round(push * stableNoise(`${s.strategy_code}:${month}:audience`, 1.04, 1.28))
        const usage = Math.round(push * classRates.usage * stableNoise(`${s.strategy_code}:${month}:usage`, 0.9, 1.1))
        const reach = Math.round(usage * classRates.reach * stableNoise(`${s.strategy_code}:${month}:reach`, 0.9, 1.1))
        const target = Math.round(reach * classRates.target * stableNoise(`${s.strategy_code}:${month}:target`, 0.8, 1.2))
        const product = Math.round(reach * classRates.product * stableNoise(`${s.strategy_code}:${month}:product`, 0.82, 1.18))
        const averageIncome = stableNoise(`${s.strategy_code}:income`, 72, 198)
        const expectedIncome = Math.round(product * averageIncome)
        const actualIncome = Math.round(expectedIncome * stableNoise(`${s.strategy_code}:${month}:realization`, 0.76, 1.04))
        const row = {
          ...common,
          strategy_id: s.strategy_code,
          strategy_name: s.strategy_name,
          strategy_class: s.strategy_class,
          channel: s.channel,
          big_category: s.big_category,
          small_category: s.small_category,
          stat_month: month + '-01',
          strategy_count: 1,
          original_cust: originalCust,
          push_count: push,
          usage_count: usage,
          reach_count: reach,
          target_conv_num: target,
          product_conv_num: product,
          expected_income: expectedIncome,
          actual_income: actualIncome,
          reject_count: Math.round(push * stableNoise(`${s.strategy_code}:${month}:reject`, 0.025, 0.105)),
        }
        const metrics = aggregate([row])
        Object.assign(row, withQoq(metrics, previousStrategy[s.strategy_code]))
        previousStrategy[s.strategy_code] = metrics
        return row
      })
      periods.push(...monthly)
      const total = aggregate(monthly)
      Object.entries(metricLabels).forEach(([code, name], i) =>
        kpis.push({
          ...common,
          stat_month: month,
          metric_code: code,
          metric_name: name,
          value: total[code],
          unit: code.endsWith('_rate')
            ? '%'
            : code.includes('income')
              ? '元'
              : code === 'strategy_count'
                ? '个'
                : code === 'original_cust'
                  ? '人'
                  : '次',
          qoq: withQoq(total, previousTotal)[code + '_qoq'],
          sort_no: i + 1,
        }),
      )
      previousTotal = total
      for (const channel of channels.concat({ key_code: '全部' })) {
        const rows = monthly.filter((row) => channel.key_code === '全部' || row.channel === channel.key_code)
        const sum = aggregate(rows)
        channelRows.push({
          ...common,
          stat_month: month + '-01',
          channel: channel.key_code,
          ...withQoq(sum, previousChannel[channel.key_code]),
        })
        previousChannel[channel.key_code] = sum
        capacities.push({
          ...common,
          stat_month: month + '-01',
          channel: channel.key_code,
          big_category: '全部',
          small_category: '全部',
          capacity: sum.product_conv_num,
          qoq: channelRows[channelRows.length - 1].product_conv_num_qoq,
        })
        for (const strategyClass of activeClasses) {
          const classRows = rows.filter((row) => row.strategy_class === strategyClass)
          if (!classRows.length) continue
          const classSum = aggregate(classRows)
          const classKey = `${channel.key_code}|${strategyClass}`
          const classChannelRow = {
            ...common,
            stat_month: month + '-01',
            channel: channel.key_code,
            strategy_class: strategyClass,
            ...withQoq(classSum, previousChannel[classKey]),
          }
          channelRows.push(classChannelRow)
          previousChannel[classKey] = classSum
          capacities.push({
            ...common,
            stat_month: month + '-01',
            channel: channel.key_code,
            strategy_class: strategyClass,
            big_category: '全部',
            small_category: '全部',
            capacity: classSum.product_conv_num,
            qoq: classChannelRow.product_conv_num_qoq,
          })
        }
        for (const category of big) {
          const matching = rows.filter((row) => row.big_category === category)
          if (!matching.length) continue
          categoryRows.push({
            ...common,
            strategy_id: '999',
            strategy_name: '分类汇总',
            channel: channel.key_code,
            big_category: category,
            small_category: matching[0].small_category,
            stat_month: month + '-01',
            ...aggregate(matching),
          })
        }
      }
      categoryRows.push({
        ...common,
        strategy_id: '999',
        strategy_name: '分类汇总',
        channel: '全部',
        big_category: '全部',
        small_category: '全部',
        stat_month: month + '-01',
        ...total,
      })
      for (const strategyClass of activeClasses) {
        const matchingClass = monthly.filter((row) => row.strategy_class === strategyClass)
        const classTotal = aggregate(matchingClass)
        const classQoq = withQoq(classTotal, previousClassTotal[strategyClass])
        Object.entries(metricLabels).forEach(([code, name], i) =>
          kpis.push({
            ...common,
            strategy_class: strategyClass,
            stat_month: month,
            metric_code: code,
            metric_name: name,
            value: classTotal[code],
            unit: code.endsWith('_rate')
              ? '%'
              : code.includes('income')
                ? '元'
                : code === 'strategy_count'
                  ? '个'
                  : code === 'original_cust'
                    ? '人'
                    : '次',
            qoq: classQoq[code + '_qoq'],
            sort_no: i + 1,
          }),
        )
        previousClassTotal[strategyClass] = classTotal
        for (const channel of channels.concat({ key_code: '全部' })) {
          const classChannelRows = matchingClass.filter(
            (row) => channel.key_code === '全部' || row.channel === channel.key_code,
          )
          if (!classChannelRows.length) continue
          const classSum = aggregate(classChannelRows)
          for (const category of big) {
            const categoryRowsForClass = classChannelRows.filter((row) => row.big_category === category)
            if (!categoryRowsForClass.length) continue
            categoryRows.push({
              ...common,
              strategy_class: strategyClass,
              strategy_id: '999',
              strategy_name: '分类汇总',
              channel: channel.key_code,
              big_category: category,
              small_category: categoryRowsForClass[0].small_category,
              stat_month: month + '-01',
              ...aggregate(categoryRowsForClass),
            })
          }
          if (channel.key_code === '全部') {
            categoryRows.push({
              ...common,
              strategy_class: strategyClass,
              strategy_id: '999',
              strategy_name: '分类汇总',
              channel: '全部',
              big_category: '全部',
              small_category: '全部',
              stat_month: month + '-01',
              ...classSum,
            })
          }
        }
      }
      const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
      for (const row of monthly) {
        const dailyAllocations = Object.fromEntries(
          countFields.map((key) => [key, allocateByDay(row[key], month, `${row.strategy_id}:${key}`)]),
        )
        for (let day = 1; day <= days; day++) {
          const r = { ...row, stat_date: `${month}-${String(day).padStart(2, '0')}` }
          for (const key of countFields) r[key] = dailyAllocations[key][day - 1]
          Object.assign(r, aggregate([r]))
          daily.push(r)
        }
      }
    }
    await insert('t_sr_strategy_period_summary_ap', periods.concat(categoryRows))
    await insert('t_sr_kpi_summary', kpis)
    await insert('t_sr_channel_summary_ap', channelRows)
    await insert('t_sr_channel_monthly_capacity_ap', capacities)
    await insert('t_sr_strategy_daily_ap', daily)
    const latest = periods.filter((row) => row.stat_month.startsWith(seedMonth))
    const bizRows = []
    const channelBiz = []
    const reasons = []
    const businessNames = ['套餐焕新', '会员权益', '流量包', '家庭融合', '宽带提速', '合约续订']
    const rejectReasonNames = ['暂无业务需求', '资费超出预期', '现有套餐满足使用', '希望稍后联系', '其他原因']
    for (const row of latest) {
      const businessWeights = businessNames.map((_, i) =>
        stableNoise(`${row.strategy_id}:${businessNames[i]}`, [0.16, 0.1, 0.18, 0.14, 0.13, 0.11][i], [0.3, 0.24, 0.29, 0.25, 0.24, 0.22][i]),
      )
      const businessWeightTotal = businessWeights.reduce((sum, weight) => sum + weight, 0)
      const businessCapacities = businessWeights.map((weight) => Math.floor((row.product_conv_num * weight) / businessWeightTotal))
      let businessRemainder = row.product_conv_num - businessCapacities.reduce((sum, value) => sum + value, 0)
      for (let i = 0; businessRemainder > 0; i++, businessRemainder--) businessCapacities[i % businessCapacities.length]++
      for (let i = 0; i < businessNames.length; i++) {
        bizRows.push({
          ...common,
          strategy_id: row.strategy_id,
          stat_date: seedMonth + '-01',
          biz_code: 'B' + i,
          biz_name: businessNames[i],
          count: businessCapacities[i],
          mom_ratio: round(stableNoise(`${row.strategy_id}:${businessNames[i]}:mom`, -12, 18)),
          yoy_ratio: null,
        })
      }
      channelBiz.push({
        ...common,
        stat_month: seedMonth + '-01',
        channel: row.channel,
        strategy_class: row.strategy_class,
        big_category: row.big_category,
        small_category: row.small_category,
        biz_name: row.strategy_name,
        capacity: row.product_conv_num,
        qoq: row.product_conv_num_qoq,
      })
      const classRejectWeights = {
        升接: [0.27, 0.24, 0.19, 0.18, 0.12],
        稳: [0.22, 0.16, 0.32, 0.18, 0.12],
        降拆: [0.31, 0.21, 0.2, 0.16, 0.12],
        离: [0.36, 0.25, 0.11, 0.17, 0.11],
        重点客群: [0.21, 0.23, 0.26, 0.19, 0.11],
      }[row.strategy_class]
      const reasonWeights = classRejectWeights.map((weight, i) => weight * stableNoise(`${row.strategy_id}:reason:${i}`, 0.82, 1.18))
      const reasonWeightTotal = reasonWeights.reduce((sum, weight) => sum + weight, 0)
      const reasonCounts = reasonWeights.map((weight) => Math.floor((row.reject_count * weight) / reasonWeightTotal))
      let reasonRemainder = row.reject_count - reasonCounts.reduce((sum, value) => sum + value, 0)
      for (let i = 0; reasonRemainder > 0; i++, reasonRemainder--) reasonCounts[i % reasonCounts.length]++
      for (let i = 0; i < rejectReasonNames.length; i++)
        reasons.push({
          ...common,
          strategy_id: row.strategy_id,
          stat_month: seedMonth + '-01',
          reason_code: 'R' + i,
          reason_name: rejectReasonNames[i],
          reject_count: reasonCounts[i],
          reject_ratio: ratio(reasonCounts[i], row.reject_count),
          sort_no: i,
        })
    }
    await insert('t_sr_strategy_biz_capacity', bizRows)
    await insert('t_sr_channel_biz_capacity_ap', channelBiz.concat(channelBiz.map(row => ({ ...row, strategy_class: '全部' }))))
    await insert('t_sr_strategy_reject_reason', reasons)
    let ruleCount = null
    if (!refreshExisting) {
      const rules = Array.from({ length: 7 }, (_, i) => ({
        id: i + 1,
        rule_name: [
          '推送量偏低预警',
          '使用率监控',
          '目标转化率监控',
          '收入偏低预警',
          '触达量监控',
          '历史规则示例',
          '暂停规则示例',
        ][i],
        rule_desc: '本地 MySQL 联调样例规则',
        tab_type: 'active',
        status: i === 6 ? '已停用' : '生效中',
        start_date: ymAt(-1) + '-01',
        end_date: ymAt(i === 5 ? -1 : 2) + '-28',
        data_start_date: ymAt(-11) + '-01',
        data_end_date: seedMonth + '-28',
        channels: '',
        strategies: '',
        logic: 'and',
        create_by: 'local-review',
        creator: '本地联调',
        create_time: `${seedMonth}-${String(20 - i).padStart(2, '0')} 10:00:00`,
        is_deleted: 0,
      }))
      await insert('t_sr_warning_rule', rules)
      const ruleMetrics = [
        'push_count',
        'usage_rate',
        'target_conv_rate',
        'actual_income',
        'reach_count',
        'push_count',
        'push_count',
      ]
      const thresholds = [95000, 46, 9, 240000, 30000, 50000, 50000]
      await insert(
        't_sr_warning_rule_condition',
        rules.map((r, i) => ({
          rule_id: r.id,
          metric_code: ruleMetrics[i],
          metric_name: metricLabels[ruleMetrics[i]],
          operator: 'lt',
          threshold: thresholds[i],
          unit: ruleMetrics[i].endsWith('_rate') ? '%' : '',
          sort_no: 1,
          is_deleted: 0,
        })),
      )
      ruleCount = rules.length
    }
    await connection.commit()
    console.log(
      JSON.stringify(
        {
          database,
          month: seedMonth,
          cityId: '001',
          strategies: strategies.length,
          monthlyDetails: periods.length,
          dailyDetails: daily.length,
          rules: ruleCount,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
