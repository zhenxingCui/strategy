<template>
  <section class="card">
    <div class="card-header">
      <div class="card-title">
        <span class="card-title-dot"></span>
        策略整体情况
      </div>
      <div class="card-actions">
        <el-button v-if="tabType === 'control'" type="text" icon="el-icon-download" @click="handleExport">导出</el-button>
      </div>
    </div>

    <div class="card-body">
      <!-- KPI 卡片网格 -->
      <div class="kpi-grid" v-loading="kpiLoading">
        <div
          v-for="(item, idx) in kpiData"
          :key="idx"
          class="kpi-card"
          :class="{ 'kpi-card-active': activeMetric === item.label }"
          @click="handleMetricClick(item)"
        >
          <div class="kpi-card-top">
            <span class="kpi-label">{{ item.label }}</span>
            <div class="kpi-icon">
              <i :class="iconClassMap[item.icon] || 'el-icon-data-line'" />
            </div>
          </div>
          <div class="kpi-value">
            {{ formatMetricNumber(item.value, item.metricCode) }}
            <span class="unit">{{ displayOverviewUnit(item.unit) }}</span>
          </div>
          <div class="kpi-trend">
            <div class="kpi-trend-row">
              <span class="kpi-trend-label">环比</span>
              <span class="kpi-trend-value" :class="item.trendQoQ >= 0 ? 'up' : 'down'">
                {{ item.trendQoQ >= 0 ? '+' : '-' }}{{ formatOverviewNumber(Math.abs(item.trendQoQ)) }}%
              </span>
            </div>
            <div class="kpi-trend-row">
              <span class="kpi-trend-label">同比</span>
              <span class="kpi-trend-value" :class="item.trendYoY >= 0 ? 'up' : 'down'">
                {{ item.trendYoY >= 0 ? '+' : '-' }}{{ formatOverviewNumber(Math.abs(item.trendYoY)) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 图例 -->
      <div class="chart-legend">
        <div class="chart-legend-item">
          <span class="chart-legend-dot" style="background: #3b82f6;"></span>
          {{ activeMetric }}
        </div>
        <div class="chart-legend-item">
          <span class="chart-legend-dot" style="background: #0ea5e9; border-radius: 50%;"></span>
          环比
        </div>
      </div>

      <!-- 趋势图 -->
      <e-chart :option="chartOption" height="240px" :loading="trendLoading" />
    </div>
  </section>
</template>

<script>
import EChart from '@/components/EChart.vue'
import { getOverviewKpi, getOverviewTrend } from '@/api/strategyReview'
import { getCityId, getUserId } from '@/utils/auth'
import { currentYearChartRows, integerText, oneDecimalText } from '../active/reviewData'
import { exportTableToCsv } from '../utils/csvExport'

// 默认高亮指标从 KPI 卡片第一条数据获取，不再写死

// 原型中 KPI icon 标识 → element-ui 图标类映射
const ICON_CLASS_MAP = {
  grid: 'el-icon-menu',
  send: 'el-icon-promotion',
  'user-check': 'el-icon-circle-check',
  eye: 'el-icon-view',
  trending: 'el-icon-top',
  percent: 'el-icon-coin',
  dollar: 'el-icon-money',
  'thumbs-up': 'el-icon-thumb',
  recommend: 'el-icon-star-off'
}

// 通用月份格式化函数：支持多种格式（yyyy-MM、X月、纯数字）统一转为"X月"
function formatMonthLabel (m) {
  if (m == null) return ''
  const str = String(m)
  // 已经是 "X月" 格式，直接返回
  if (str.includes('月')) return str
  // yyyy-MM 格式，取月份部分
  if (str.includes('-')) {
    const parts = str.split('-')
    const monthNum = parseInt(parts[1], 10)
    if (!isNaN(monthNum)) return monthNum + '月'
  }
  // 纯数字
  const num = parseInt(str, 10)
  if (!isNaN(num)) return num + '月'
  return str
}

export default {
  name: 'StrategyOverview',
  components: { EChart },
  props: {
    tabType: {
      type: String,
      default: 'active'
    },
    dateRange: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      iconClassMap: ICON_CLASS_MAP,
      kpiLoading: false,
      trendLoading: false,
      activeMetric: '',
      activeMetricCode: '',
      kpiData: [],
      // 趋势数据
      trendData: { months: [], values: [], qoq: [], unit: '' }
    }
  },
  computed: {
    chartOption () {
      const { months, values, qoq, unit } = this.trendData
      const points = currentYearChartRows(months, values, qoq, this.buildParams().statMonth)
      const chartMonths = points.months
      const chartValues = points.values
      const chartQoq = points.comparison
      if (!chartMonths.length) {
        return {
          title: { text: '暂无数据', left: 'center', top: 'middle', textStyle: { color: '#9ca3af', fontSize: 13, fontWeight: 400 } },
          series: []
        }
      }

      const displayUnit = this.displayOverviewUnit(unit)
      const formatVal = (val) => `${this.formatMetricNumber(val, this.activeMetricCode)}${unit === '%' ? '%' : displayUnit}`

      // 柱状图Y轴自然范围
      const maxValue = Math.max(...chartValues.map(Number))
      const barMax = (maxValue || 1) * 1.12

      // 环比Y轴：按数据实际范围自适应，上下各留25%标签余量，0必须在区间内
      // 不再用"固定0%线位置"的魔法常数，避免大环比量级下正区间被压缩、标签被裁剪
      const qoqMax = Math.max(0, ...(chartQoq.map(v => Number(v) || 0)))
      const qoqMin = Math.min(0, ...(chartQoq.map(v => Number(v) || 0)))
      const qoqPadding = Math.max(8, (qoqMax - qoqMin) * 0.25)
      const rightMax = qoqMax + qoqPadding
      const rightMin = qoqMin - qoqPadding

      // 将月份统一格式化为 "X月"
      const monthLabels = chartMonths.map(m => formatMonthLabel(m))

      return {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          textStyle: { color: '#374151', fontSize: 12 },
          formatter: (params) => {
            const idx = params[0].dataIndex
            const monthStr = chartMonths[idx] || monthLabels[idx]
            let html = `<div style="font-weight:500;margin-bottom:4px;">${monthStr}</div>`
            params.forEach(p => {
              const val = p.seriesName === '环比' ? (p.value == null ? '—' : this.formatOverviewNumber(p.value) + '%') : formatVal(p.value)
              html += `<div style="display:flex;justify-content:space-between;gap:16px;"><span>${p.marker}${p.seriesName}</span><span style="font-weight:600;">${val}</span></div>`
            })
            return html
          }
        },
        legend: { show: false },
        grid: { left: 40, right: 50, bottom: 24, top: 40, containLabel: false },
        xAxis: {
          type: 'category',
          data: monthLabels,
          axisLine: { lineStyle: { color: '#e5e7eb' } },
          axisLabel: { color: '#9ca3af', fontSize: 11, interval: 0 },
          axisTick: { show: false }
        },
        yAxis: [
          {
            type: 'value',
            name: this.activeMetric,
            nameTextStyle: { color: '#9ca3af', fontSize: 10, padding: [0, 30, 0, 0] },
            max: barMax,
            axisLine: { show: false },
            axisLabel: {
              color: '#9ca3af',
              fontSize: 10,
              formatter: (val) => this.formatMetricNumber(val, this.activeMetricCode)
            },
            splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }
          },
          {
            type: 'value',
            name: '环比',
            nameTextStyle: { color: '#9ca3af', fontSize: 10, padding: [0, 0, 0, 10] },
            axisLine: { show: false },
            axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value}%' },
            splitLine: { show: false },
            min: rightMin,
            max: rightMax
          }
        ],
        series: [
          {
            name: this.activeMetric,
            type: 'bar',
            data: chartValues,
            itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
            barWidth: '40%',
            label: {
              // 保留指标单位格式，柱顶位置和可读样式由 EChart 组件统一设置。
              formatter: (p) => formatVal(p.value)
            }
          },
          {
            name: '环比',
            type: 'line',
            yAxisIndex: 1,
            data: chartQoq,
            smooth: true,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { color: '#0ea5e9', width: 2 },
            itemStyle: { color: '#0ea5e9', borderWidth: 2, borderColor: '#fff' },
            label: {
              show: true,
              position: 'top',
              distance: 8,
              color: '#0369a1',
              fontSize: 10,
              fontWeight: 600,
              // 白色描边：标签落在蓝色柱子上时依然清晰可读
              textBorderColor: '#fff',
              textBorderWidth: 3,
              formatter: (p) => (p.value >= 0 ? '+' : '') + this.formatOverviewNumber(p.value) + '%'
            },
            // 所有环比点都显示具体数值，不因标签接近而自动隐藏。
            labelLayout: { hideOverlap: false }
          }
        ]
      }
    }
  },
  watch: {
    tabType () {
      this.activeMetric = ''
      this.activeMetricCode = ''
      this.fetchKpi()
    },
    dateRange () {
      this.fetchKpi()
      this.fetchTrend()
    },
    activeMetricCode () {
      this.fetchTrend()
    }
  },
  mounted () {
    this.fetchKpi()
  },
  methods: {
    formatOverviewNumber (value) {
      return oneDecimalText(value)
    },
    formatMetricNumber (value, metricCode) {
      return metricCode === 'strategy_count' ? integerText(value) : this.formatOverviewNumber(value)
    },
    displayOverviewUnit (unit) {
      return String(unit || '').replace(/次/g, '')
    },
    handleMetricClick (item) {
      this.activeMetric = item.label
      this.activeMetricCode = item.metricCode || this.activeMetricCode
    },
    handleExport () {
      const columns = [
        { label: '指标名称', prop: 'label' },
        { label: '当期值', formatter: (row) => row.metricCode === 'strategy_count' ? this.formatMetricNumber(row.value, row.metricCode) : row.value },
        { label: '单位', prop: 'unit' },
        { label: '环比(%)', prop: 'trendQoQ' },
        { label: '同比(%)', prop: 'trendYoY' }
      ]
      exportTableToCsv({
        columns,
        data: this.kpiData,
        filename: `策略整体情况_KPI_${this.tabType}`
      })
    },
    buildParams () {
      // statMonth 取全局日期范围起始月（yyyy-MM）
      const [startDate] = this.dateRange || []
      return {
        tabType: this.tabType,
        statMonth: (startDate || '').slice(0, 7),
        // 登录身份透传：后端按 city_id/user_id 过滤
        cityId: getCityId(),
        userId: getUserId()
      }
    },
    async fetchKpi () {
      this.kpiLoading = true
      try {
        const res = await getOverviewKpi(this.buildParams())
        let list = []
        if (Array.isArray(res)) list = res
        else if (Array.isArray(res && res.list)) list = res.list
        else if (Array.isArray(res && res.data)) list = res.data
        else if (res && typeof res === 'object' && !Array.isArray(res)) list = [res]
        this.kpiData = list
        if (list.length > 0 && !this.activeMetricCode) {
          this.activeMetric = list[0].label || ''
          this.activeMetricCode = list[0].metricCode || ''
        }
      } catch (e) {
        console.error('[StrategyOverview] getOverviewKpi error:', e)
        this.kpiData = []
      } finally {
        this.kpiLoading = false
      }
    },
    async fetchTrend () {
      // KPI 未返回或指标编码为空时不请求趋势接口，避免后端报“指标编码metricCode不能为空”
      if (!this.activeMetricCode) {
        this.trendData = { months: [], values: [], qoq: [], unit: '' }
        return
      }
      this.trendLoading = true
      try {
        const res = await getOverviewTrend({ ...this.buildParams(), metricCode: this.activeMetricCode })
        const hasMonths = res && Array.isArray(res.months) && res.months.length > 0
        const list = Array.isArray(res) ? res : null
        if (hasMonths) {
          this.trendData = res
        } else if (list && list.length > 0) {
          const sorted = [...list].reverse()
          this.trendData = {
            months: sorted.map(i => i.month || i.statMonth),
            values: sorted.map(i => i.value != null ? i.value : i.capacity),
            qoq: sorted.map(i => i.qoq),
            unit: list[0] && list[0].unit
          }
        } else {
          this.trendData = { months: [], values: [], qoq: [], unit: '' }
        }
      } catch (e) {
        console.error('[StrategyOverview] getOverviewTrend error:', e)
        this.trendData = { months: [], values: [], qoq: [], unit: '' }
      } finally {
        this.trendLoading = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../styles/index.less';

.card {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    .card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #111827;
      .card-title-dot {
        width: 3px;
        height: 12px;
        background: #2563eb;
        border-radius: 2px;
      }
    }
  }
  .card-body {
    padding: 14px 16px;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    margin-bottom: 10px;
    .kpi-card {
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      .kpi-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
        .kpi-label {
          font-size: 11px;
          color: #6b7280;
        }
        .kpi-icon {
          width: 18px;
          height: 18px;
          border-radius: 3px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
      }
      .kpi-value {
        font-size: 16px;
        font-weight: 700;
        color: #111827;
        line-height: 1.2;
        margin-bottom: 4px;
        .unit {
          font-size: 10px;
          font-weight: 400;
          color: #9ca3af;
          margin-left: 2px;
        }
      }
      .kpi-trend {
        display: flex;
        flex-direction: column;
        gap: 1px;
        .kpi-trend-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          .kpi-trend-label {
            color: #9ca3af;
          }
          .kpi-trend-value {
            font-weight: 500;
            &.up { color: #10b981; }
            &.down { color: #ef4444; }
          }
        }
      }
      &.kpi-card-active {
        border-color: #2563eb;
        background: #eff6ff;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
      }
    }
  }
  .chart-legend {
    display: flex;
    gap: 16px;
    margin-bottom: 6px;
    .chart-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #6b7280;
      .chart-legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        display: inline-block;
      }
    }
  }
}
</style>
