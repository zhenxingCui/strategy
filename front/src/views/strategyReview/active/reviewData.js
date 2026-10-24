// 正式页面仅使用 strategyReview API；不加载原型的 data/*.js。
export function listOf(value) {
  return Array.isArray(value) ? value : value && Array.isArray(value.list) ? value.list : []
}

export function numberText(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(value)
}

export function percentText(value) {
  return value === null || value === undefined || value === '' ? '—' : `${numberText(value)}%`
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

// 存量“降拆”页统一场景与咨询/挽留/派单/成功文案，字段、排序和导出取值保持原样。
export function categoryLabelColumns(columns, query) {
  if (!query || query.tabType !== 'active' || query.strategyClass !== '降拆') return columns
  const labels = {
    bigCategory: '场景大类', smallCategory: '场景小类',
    pushCount: '咨询量', usageCount: '挽留量', usageRate: '挽留率',
    reachCount: '派单量', reachRate: '派单率',
    targetConvNum: '成功量', targetConvRate: '成功率',
    capacity: '成功量', count: '成功量',
  }
  return columns.map((column) => labels[column.prop] ? { ...column, label: labels[column.prop] } : column)
}

export const channelBizColumns = [
  { prop: 'bizName', label: '业务名称', text: true },
  { prop: 'capacity', label: '产能' },
  { prop: 'qoq', label: '环比', format: percentText },
]

export const strategyBizColumns = [
  { prop: 'bizName', label: '业务名称', text: true },
  { prop: 'count', label: '产能' },
  { prop: 'momRatio', label: '环比', format: percentText },
]

export function barLineOption(months = [], values = [], qoq = [], label = '产能', unit = '') {
  const points = chartRows(months, values, qoq)
  months = points.months
  values = points.values
  qoq = points.comparison
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
        return `${months[index]}\n${label}：${numberText(values[index])}${unit}\n环比：${qoq[index] == null ? '—' : numberText(qoq[index]) + (unit === '%' ? 'pp' : '%')}`
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
        name: unit,
        axisLabel: { color: '#86909c', fontSize: 10 },
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
      { name: label, type: 'bar', data: values, barMaxWidth: 30, itemStyle: { borderRadius: [3, 3, 0, 0] } },
      {
        name: '环比',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: qoq,
        symbolSize: 5,
        smooth: false,
        connectNulls: false,
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
