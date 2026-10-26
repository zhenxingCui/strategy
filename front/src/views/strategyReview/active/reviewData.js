// 正式页面仅使用 strategyReview API；不加载原型的 data/*.js。
export function listOf(value) {
  return Array.isArray(value) ? value : value && Array.isArray(value.list) ? value.list : []
}

export function numberText(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(value)
}

export function oneDecimalText(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n)
    ? n.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : String(value)
}

export function percentText(value) {
  return value === null || value === undefined || value === '' ? '—' : `${numberText(value)}%`
}

function ratioText(numerator, denominator) {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined || denominator === '') return '—'
  const top = Number(numerator)
  const bottom = Number(denominator)
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? percentText((top / bottom) * 100) : '—'
}

// 柱状图只保留有月份且实际有数值的记录；数值 0 是有效数据，空值不占月份位置。
export function chartRows(months = [], values = [], comparison = []) {
  const monthList = Array.isArray(months) ? months : []
  const valueList = Array.isArray(values) ? values : []
  const compareList = Array.isArray(comparison) ? comparison : []
  return monthList.reduce(
    (result, month, index) => {
      const value = valueList[index]
      const hasValue = value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))
      if (month === null || month === undefined || String(month).trim() === '' || !hasValue) return result
      result.months.push(month)
      result.values.push(value)
      const compare = compareList[index]
      result.comparison.push(
        compare === null || compare === undefined || String(compare).trim() === '' || !Number.isFinite(Number(compare))
          ? null
          : compare,
      )
      return result
    },
    { months: [], values: [], comparison: [] },
  )
}

function parseYearMonth(value) {
  const raw = String(value == null ? '' : value).trim()
  const fullDate = raw.match(/^(\d{4})[-/.年]?(\d{1,2})(?:月)?/)
  if (fullDate) {
    const month = Number(fullDate[2])
    return month >= 1 && month <= 12 ? { year: Number(fullDate[1]), month } : null
  }
  const monthOnly = raw.match(/^(\d{1,2})月?$/)
  if (monthOnly) {
    const month = Number(monthOnly[1])
    return month >= 1 && month <= 12 ? { month } : null
  }
  return null
}

// Strategy overview charts show the current calendar year's months only.
// Month-only labels (for example, "1月") are anchored to the query month so
// a rolling 12-month series crossing January can be assigned to the right year.
export function currentYearChartRows(months = [], values = [], comparison = [], statMonth = '') {
  const points = chartRows(months, values, comparison)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const reference = parseYearMonth(statMonth) || { year: currentYear, month: currentMonth }
  const startKey = currentYear * 100 + 1
  const endKey = currentYear * 100 + currentMonth

  return points.months.reduce((result, label, index) => {
    const parsed = parseYearMonth(label)
    if (!parsed) return result
    const year = parsed.year == null
      ? reference.year - (parsed.month > reference.month ? 1 : 0)
      : parsed.year
    const key = year * 100 + parsed.month
    if (key < startKey || key > endKey) return result
    result.months.push(label)
    result.values.push(points.values[index])
    result.comparison.push(points.comparison[index])
    return result
  }, { months: [], values: [], comparison: [] })
}

export function monthRange(month) {
  const [year, m] = month.split('-').map(Number)
  return [`${month}-01`, `${month}-${new Date(year, m, 0).getDate()}`]
}

export const metrics = [
  { prop: 'pushCount', label: '推送量' },
  { prop: 'usageCount', label: '使用量' },
  { prop: 'usageRate', label: '使用率', format: percentText },
  { prop: 'reachCount', label: '触达量' },
  { prop: 'targetConvNum', label: '成功量' },
  { prop: 'targetConvRate', label: '成功率', format: percentText },
]

export const categoryColumns = [
  { prop: 'bigCategory', label: '策略大类', text: true },
  { prop: 'smallCategory', label: '策略小类', text: true },
  { prop: 'strategyCount', label: '策略量' },
  ...metrics,
]

// 重点产品使用存量策略指标名称，保留现有接口字段以兼容历史数据。
export const controlMetrics = [
  { prop: 'consultCount', label: '推送量' },
  { prop: 'retainCount', label: '使用量' },
  { prop: 'retainRate', label: '使用率', format: percentText },
  { prop: 'dispatchCount', label: '触达量' },
  { prop: 'successCount', label: '成功量' },
  { prop: 'successRate', label: '成功率', format: percentText },
]

export const controlCategoryColumns = [
  { prop: 'bigCategory', label: '策略大类', text: true },
  { prop: 'smallCategory', label: '策略小类', text: true },
  { prop: 'strategyCount', label: '策略量' },
  ...controlMetrics,
  { prop: 'income', label: '收入(元)' },
]

export const controlStrategyColumns = [
  { prop: 'bigCategory', label: '策略大类', text: true },
  { prop: 'smallCategory', label: '策略小类', text: true },
  { prop: 'strategyName', label: '策略名称', text: true, link: true,
    format: (value, row) => value || row.name || row.strategyCode || '—' },
  ...controlMetrics,
  { prop: 'income', label: '收入(元)' },
]

export const strategyColumns = [
  {
    prop: 'strategyClass',
    label: '策略分类',
    text: true,
    format: (value) => ({ 全部: '全部', 升接: '升接', 稳: '稳', 降拆: '降拆', 离: '离', 重点客群: '重点客群' })[value] || '—',
  },
  { prop: 'bigCategory', label: '策略大类', text: true },
  { prop: 'smallCategory', label: '策略小类', text: true },
  { prop: 'strategyName', label: '策略名称', text: true, link: true },
  ...metrics,
]

const downgradeMetricSets = {
  overall: {
    funnel: [
      { key: 'push_count', label: '咨询量' },
      { key: 'reach_count', label: '成功量' },
    ],
    rates: [{ key: 'reach_rate', label: '成功率' }],
    capacity: 'reach_count',
    tableProps: ['pushCount', 'reachCount', 'reachRate'],
  },
  provinceOnline: {
    funnel: [
      { key: 'push_count', label: '咨询量' },
      { key: 'reach_count', label: '成功量' },
      { key: 'target_conv_num', label: '派单量' },
    ],
    rates: [
      { key: 'reach_rate', label: '成功率' },
      { key: 'target_conv_rate', label: '派单率' },
    ],
    capacity: 'reach_count',
    tableProps: ['pushCount', 'reachCount', 'reachRate', 'targetConvNum', 'dispatchRate'],
  },
  cityService: {
    funnel: [
      { key: 'push_count', label: '接单量' },
      { key: 'reach_count', label: '成功量' },
      { key: 'target_conv_num', label: '派单量' },
    ],
    rates: [
      { key: 'reach_rate', label: '成功率' },
      { key: 'target_conv_rate', label: '派单率' },
    ],
    capacity: 'reach_count',
    tableProps: ['pushCount', 'reachCount', 'reachRate', 'targetConvNum', 'dispatchRate'],
  },
  gridFace: {
    funnel: [
      { key: 'push_count', label: '接单量' },
      { key: 'reach_count', label: '成功量' },
    ],
    rates: [{ key: 'reach_rate', label: '成功率' }],
    capacity: 'reach_count',
    tableProps: ['pushCount', 'reachCount', 'reachRate'],
  },
  gridHall: {
    funnel: [
      { key: 'push_count', label: '咨询量' },
      { key: 'reach_count', label: '成功量' },
    ],
    rates: [{ key: 'reach_rate', label: '成功率' }],
    capacity: 'reach_count',
    tableProps: ['pushCount', 'reachCount', 'reachRate'],
  },
}

export function downgradeChannelMetrics(channel) {
  const normalized = String(channel || '整体').replace(/[-\s]/g, '')
  if (normalized === '省级在线') return downgradeMetricSets.provinceOnline
  if (normalized === '市级营服') return downgradeMetricSets.cityService
  if (normalized === '网格面客') return downgradeMetricSets.gridFace
  if (normalized === '网格到厅') return downgradeMetricSets.gridHall
  return downgradeMetricSets.overall
}

// 存量“降拆”页按渠道显示咨询/接单/派单/成功指标，并使用统一比率口径。
export function categoryLabelColumns(columns, query) {
  if (!query || query.tabType !== 'active') return columns
  // All stock views display product conversions as successful quantity/rate.
  if (query.strategyClass !== '降拆') {
    return columns.map((column) => {
      if (column.prop === 'targetConvNum') return { ...column, prop: 'productConvNum' }
      if (column.prop === 'targetConvRate') return { ...column, prop: 'productConvRate' }
      return column
    })
  }
  const metricSet = downgradeChannelMetrics(query.channel)
  const labels = {
    bigCategory: '场景大类', smallCategory: '场景小类',
    pushCount: metricSet.funnel.find((metric) => metric.key === 'push_count')?.label || '咨询量',
    usageCount: metricSet.funnel.find((metric) => metric.key === 'usage_count')?.label || '接单量',
    reachCount: '成功量', reachRate: '成功率',
    targetConvNum: '派单量', targetConvRate: '派单率', dispatchRate: '派单率',
    capacity: '成功量', count: '成功量',
  }
  const metricProps = new Set(['pushCount', 'usageCount', 'usageRate', 'reachCount', 'reachRate', 'targetConvNum', 'targetConvRate', 'productConvNum', 'productConvRate', 'dispatchRate'])
  const result = []
  let metricsAdded = false
  columns.forEach((column) => {
    if (metricProps.has(column.prop)) {
      if (!metricsAdded) {
        metricSet.tableProps.forEach((prop) => {
          const spec = { prop, label: labels[prop] || prop }
          if (prop === 'reachRate') spec.format = (_, row) => ratioText(row.reachCount, row.pushCount)
          if (prop === 'dispatchRate') spec.format = (_, row) => ratioText(row.targetConvNum, row.pushCount)
          result.push(spec)
        })
        metricsAdded = true
      }
      return
    }
    if (labels[column.prop]) result.push({ ...column, label: labels[column.prop] })
    else result.push(column)
  })
  return result
}

export const channelBizColumns = [
  { prop: 'bizName', label: '业务名称', text: true },
  { prop: 'capacity', label: '产能' },
]

export const strategyBizColumns = [
  { prop: 'bizName', label: '业务名称', text: true },
  { prop: 'count', label: '产能' },
]

export function barLineOption(months = [], values = [], qoq = [], label = '产能', unit = '', options = {}) {
  const points = chartRows(months, values, qoq)
  months = points.months
  values = points.values
  qoq = points.comparison
  const scaleByTenThousand = options.scaleByTenThousand && unit !== '%' && !String(unit).startsWith('万')
  if (scaleByTenThousand) {
    values = values.map((value) => Number(value) / 10000)
    unit = unit === '元' ? '万元' : `万${unit}`
  }
  const displayUnit = options.omitTimesUnit ? String(unit).replace(/次/g, '') : unit
  const formatValue = options.fractionDigits === 1 ? oneDecimalText : numberText
  if (!months.length) {
    return {
      title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#86909c', fontSize: 12, fontWeight: 400 } },
      series: [],
    }
  }
  return {
    color: ['#3b82f6', '#0ea5e9'],
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      formatter: (params) => {
        const index = params[0].dataIndex
        return `${months[index]}\n${label}：${formatValue(values[index])}${displayUnit}\n环比：${qoq[index] == null ? '—' : formatValue(qoq[index]) + (displayUnit === '%' ? 'pp' : '%')}`
      },
    },
    legend: { data: [label, '环比'], top: 0, textStyle: { color: '#86909c', fontSize: 11 } },
    // 环比线独占上方区域，避免与柱形重叠；保留柱图坐标系，仅隐藏折线百分比轴。
    grid: [
      { left: 50, right: 48, top: '44%', bottom: 28 },
      { left: 50, right: 48, top: 36, height: '23%' },
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    xAxis: [
      {
        type: 'category',
        data: months,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dce3ec' } },
        axisLabel: { color: '#86909c', fontSize: 10 },
      },
      { type: 'category', data: months, gridIndex: 1, show: false, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
    ],
    yAxis: [
      {
        type: 'value',
        name: displayUnit,
        axisLabel: { color: '#86909c', fontSize: 10, formatter: (value) => formatValue(value) },
        splitLine: { lineStyle: { color: '#eef1f5', type: 'dashed' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        position: 'right',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: label,
        type: 'bar',
        data: values,
        barMaxWidth: 30,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        ...(options.fractionDigits === 1
          ? { label: { formatter: (p) => p.value == null ? '' : formatValue(p.value) } }
          : {}),
      },
      {
        name: '环比',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: qoq,
        symbolSize: 5,
        smooth: false,
        connectNulls: false,
        label: {
          formatter: (p) => p.value == null ? '' : formatValue(p.value) + (displayUnit === '%' ? 'pp' : '%'),
        },
      },
    ],
  }
}

// 每个请求区域独立维护 loading/error，并忽略筛选切换前的迟到响应。
export const panelRequests = {
  data() {
    return { panels: {} }
  },
  created() {
    this.requestVersions = {}
    this.requestsDisposed = false
  },
  beforeDestroy() {
    this.requestsDisposed = true
  },
  methods: {
    async request(key, fetcher, apply) {
      const version = (this.requestVersions[key] || 0) + 1
      this.requestVersions[key] = version
      this.$set(this.panels, key, { loading: true, error: '' })
      try {
        const result = await fetcher()
        if (this.requestsDisposed || version !== this.requestVersions[key]) return
        apply(result)
        this.$set(this.panels, key, { loading: false, error: '' })
        return result
      } catch (error) {
        if (!this.requestsDisposed && version === this.requestVersions[key]) {
          this.$set(this.panels, key, { loading: false, error: error.message || '数据加载失败' })
        }
      }
    },
  },
}
