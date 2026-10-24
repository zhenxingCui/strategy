<template>
  <section class="section overview-section">
      <h2 class="section-title">
      策略整体情况<span class="spacer" /><span class="muted filter-note">分类：{{ categoryName }}<template v-if="isKeyAudience"> · 客群：{{ query.customerGroup || '全部客群' }}</template><template v-if="query.tabType === 'control'"> · 产品：{{ query.productName || '全部产品' }}</template> · 触点：{{ channelName }}</span>
    </h2>
    <p v-if="simulationNote" class="metric-footnote" role="note">{{ simulationNote }}</p>
    <div class="overview-body split split--m1">
      <div class="card snapshot-card">
        <div class="overview-panel-head category-seg" role="group" aria-label="策略分类">
          <button
            v-for="category in categories"
            :key="category.label"
            class="seg-btn"
            :aria-pressed="(query.strategyClass || '全部') === category.value ? 'true' : 'false'"
            @click="$emit('strategy-class', category.value)"
          >
            {{ category.label }}
          </button>
        </div>
        <review-state
          :state="panels.kpi"
          :empty="!kpis.length"
          empty-text="当前月份与触点暂无整体指标"
          @retry="loadKpis"
        >
          <div class="metric-snapshot">
            <div class="metric-col metric-col-left">
              <button
                v-for="metric in groups.left"
                :key="metric.key"
                class="metric-block metric-left"
                :class="{ active: activeMetric === code(metric) }"
                :disabled="!card(metric)"
                :title="metric.title || metric.label"
                @click="selectMetric(metric)"
              >
                <span class="metric-label">{{ metric.label }}</span>
                <span class="metric-left-bottom">
                  <strong>{{ value(metric) }}<small>{{ unit(metric) }}</small></strong>
                  <span class="metric-qoq">环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span>
                </span>
              </button>
            </div>
            <div class="metric-col metric-col-mid" :class="{ 'metric-col-mid--four': groups.mid.length === 4 }">
              <button
                v-for="metric in groups.mid"
                :key="metric.key"
                class="metric-block metric-mid"
                :class="{ active: activeMetric === code(metric) }"
                :disabled="!card(metric)"
                @click="selectMetric(metric)"
              >
                <span class="metric-orb" aria-hidden="true" /><span class="metric-mid-body"
                  ><span class="metric-label">{{ metric.label }}</span
                  ><strong
                    >{{ value(metric) }}<small>{{ unit(metric) }}</small></strong
                  ><span class="metric-qoq"
                    >环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span
                  ></span
                >
              </button>
            </div>
            <svg
              class="metric-funnel"
              viewBox="0 0 450 470"
              role="img"
              :aria-label="isDowngrade ? '咨询量、挽留量、派单量、成功量四级漏斗' : '推送量、使用量、触达量、转化量四级漏斗'"
            >
              <defs>
                <linearGradient id="active-funnel-cyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#70d5e1" /><stop offset="1" stop-color="#38c4ce" />
                </linearGradient>
                <linearGradient id="active-funnel-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#72c9f3" /><stop offset="1" stop-color="#45b3ee" />
                </linearGradient>
                <linearGradient id="active-funnel-blue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#72a8f8" /><stop offset="1" stop-color="#4385ed" />
                </linearGradient>
                <linearGradient id="active-funnel-violet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#b395f1" /><stop offset="1" stop-color="#9669e9" />
                </linearGradient>
                <filter id="active-funnel-shadow" x="-30%" y="-80%" width="160%" height="260%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>
              <ellipse cx="225" cy="430" rx="133" ry="19" fill="#73d5ed" opacity=".18" filter="url(#active-funnel-shadow)" />
              <ellipse cx="225" cy="432" rx="145" ry="22" fill="#e8f7fc" opacity=".88" />
              <ellipse cx="225" cy="432" rx="176" ry="34" fill="none" stroke="#d9efff" stroke-width="2" />
              <g v-for="(shape, index) in funnelShapes" :key="shape.label">
                <path :d="funnelPath(shape)" :fill="`url(#active-funnel-${shape.color})`" />
                <ellipse :cx="225" :cy="shape.top" :rx="shape.topWidth / 2" :ry="shape.topRy"
                  :fill="shape.cap" :stroke="shape.rim" stroke-opacity=".72" stroke-width="1.5" />
                <text x="225" :y="shape.labelY" text-anchor="middle">{{ funnel[index] && funnel[index].label }}</text>
              </g>
              <path d="M58 266v37m-8-9 8 10 8-10M392 266v37m-8-9 8 10 8-10" fill="none"
                stroke="#c6eaff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".72" />
            </svg>
            <div class="metric-col metric-col-rate">
              <button
                v-for="metric in groups.rate"
                :key="metric.key"
                class="metric-block metric-rate"
                :class="{ active: activeMetric === code(metric) }"
                :disabled="!card(metric)"
                :title="card(metric) ? metric.label : '接口尚未提供该指标'"
                @click="selectMetric(metric)"
              >
                <span class="metric-rate-content">
                  <span class="metric-rate-head">
                    <strong>{{ value(metric) }}<small>{{ unit(metric) }}</small></strong>
                    <span class="metric-label">{{ metric.label }}</span>
                  </span>
                  <span class="metric-qoq">环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span>
                </span>
              </button>
            </div>
          </div>
          <p class="metric-footnote">点击指标查看趋势；“—”表示接口未提供该指标。{{ query.tabType === 'active' ? '存量策略分类按数据源提供的归属展示。' : '当前视角仅支持全部分类。' }}</p>
        </review-state>
      </div>
      <div class="card overview-trend-card">
        <div class="overview-panel-head overview-filters">
          <label v-if="query.tabType === 'control'">
            产品切换
            <select class="select" aria-label="产品切换" :value="query.productName || ''"
              :disabled="productsLoading" @change="$emit('product', $event.target.value)">
              <option value="">全部产品</option>
              <option v-for="product in products" :key="product.keyCode" :value="product.keyCode">{{ product.keyName }}</option>
            </select>
          </label>
          <label v-if="isKeyAudience">
            客群切换
            <select class="select" aria-label="客群切换" :value="query.customerGroup || ''"
              :disabled="customerGroupsLoading" @change="$emit('customer-group', $event.target.value)">
              <option value="">全部客群</option>
              <option v-for="group in customerGroups" :key="group.keyCode" :value="group.keyCode">{{ group.keyName }}</option>
            </select>
          </label>
          <label
            >触点切换
            <select
              class="select"
              aria-label="触点切换"
              :value="query.channel"
              :disabled="channelsLoading"
              @change="$emit('channel', $event.target.value)"
            >
              <option value="">全部渠道</option>
              <option v-for="channel in channels" :key="channel.keyName" :value="channel.keyName">
                {{ channel.keyName }}
              </option>
            </select></label
          >
        </div>
        <review-state
          :state="panels.trend || panels.kpi"
          :empty="!trend.months || !trend.months.length"
          empty-text="该指标暂无历史趋势"
          @retry="loadTrend"
        >
          <e-chart :option="trendOption" height="310px" />
          <p class="metric-footnote">截至 {{ query.statMonth }}，最近 12 个有数据的月份。</p>
        </review-state>
      </div>
    </div>
  </section>
</template>
<script>
import { getOverviewKpi, getOverviewTrend } from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewState from './ReviewState.vue'
import { listOf, numberText, percentText, barLineOption, panelRequests } from './reviewData'
import leaveSimulation from './leaveSimulation.json'
import customerGroupSimulation from './customerGroupSimulation.json'
import incrementalSimulation from './incrementalSimulation.json'
import declineSimulation from './declineSimulation.json'
import { visibleSimulationTrend } from './simulationTrend'

const item = (key, label, title) => ({ key, label, title })
export default {
  name: 'StockOverview',
  components: { EChart, ReviewState },
  mixins: [panelRequests],
  props: {
    query: { type: Object, required: true },
    channels: { type: Array, default: () => [] },
    channelsLoading: Boolean,
    customerGroups: { type: Array, default: () => [] },
    customerGroupsLoading: Boolean,
    products: { type: Array, default: () => [] },
    productsLoading: Boolean,
  },
  data() {
    return {
      kpis: [],
      activeMetric: '',
      trend: {},
      funnelShapes: [
        { top: 74, bottom: 178, topWidth: 400, bottomWidth: 306, topRy: 30, bottomRy: 22, color: 'cyan', cap: '#b5eef4', rim: '#78d2de', labelY: 143 },
        { top: 178, bottom: 271, topWidth: 306, bottomWidth: 232, topRy: 22, bottomRy: 20, color: 'sky', cap: '#82d0f4', rim: '#54b7e8', labelY: 235 },
        { top: 271, bottom: 353, topWidth: 232, bottomWidth: 180, topRy: 20, bottomRy: 19, color: 'blue', cap: '#83b5fc', rim: '#578fe9', labelY: 318 },
        { top: 353, bottom: 418, topWidth: 180, bottomWidth: 146, topRy: 19, bottomRy: 18, color: 'violet', cap: '#b79af4', rim: '#9a78e8', labelY: 408 },
      ],
    }
  },
  computed: {
    simulationNote() {
      if (this.query.tabType === incrementalSimulation.tabType && this.query.cityId === incrementalSimulation.cityId &&
          this.query.statMonth >= incrementalSimulation.startMonth && this.query.statMonth <= incrementalSimulation.sourceMonth) {
        return `增量策略：${incrementalSimulation.startMonth.slice(5)}—${incrementalSimulation.endMonth.slice(5)}月为固定${incrementalSimulation.strategiesPerMonth}条策略的模拟月度历史；${incrementalSimulation.sourceMonth.slice(5)}月为业务部门Excel数据（截至${incrementalSimulation.sourceCutoff.slice(5)}）。${incrementalSimulation.baselineMonth.slice(5)}月为模拟环比基期。来源月环比按截至日与上月日均比较，柱形仍展示月累计量；${incrementalSimulation.dailyStartDate.slice(5)}—${incrementalSimulation.dailyEndDate.slice(5)}日数据为按权重拆分的模拟日数据。模拟结果仅供演示。`
      }
      if (this.query.tabType === customerGroupSimulation.tabType && this.query.cityId === customerGroupSimulation.cityId &&
          this.query.strategyClass === customerGroupSimulation.strategyClass &&
          (!this.query.customerGroup || this.query.customerGroup === customerGroupSimulation.customerGroup) &&
          this.query.statMonth >= customerGroupSimulation.startMonth && this.query.statMonth <= customerGroupSimulation.sourceMonth) {
        return `重点客群“拆弹客户”：2026年1—9月为模拟月度历史，10月为业务部门Excel数据（截至10月23日）。柱形展示9月全月与10月1—23日累计值；10月环比按10月1—23日与9月1—23日同期累计值计算。9月同期及10月日明细为按月度总量模拟的逐日分布，环比仅供演示。`
      }
      if (this.query.tabType === declineSimulation.tabType && this.query.cityId === declineSimulation.cityId &&
          this.query.strategyClass === declineSimulation.strategyClass &&
          this.query.statMonth >= declineSimulation.startMonth && this.query.statMonth <= declineSimulation.sourceMonth) {
        return `“降拆”策略：${declineSimulation.startMonth.slice(5)}—${declineSimulation.endMonth.slice(5)}月为固定${declineSimulation.strategiesPerMonth}条策略的模拟月度历史；${declineSimulation.sourceMonth.slice(5)}月保留Excel月度原值，按${declineSimulation.sourceCutoff.slice(5)}展示。${declineSimulation.baselineMonth ? `${declineSimulation.baselineMonth.slice(5)}月为模拟环比基期。` : ''}${declineSimulation.dailyStartDate.slice(5)}—${declineSimulation.dailyEndDate.slice(5)}为按固定工作日/周末权重拆分的模拟日数据，各策略日合计保持Excel月值。${declineSimulation.missingReachRows}条派单量为空，${declineSimulation.successOverReachRows}条成功量大于派单量，均按来源月原值保留。来源月环比按截至日与上月日均比较，模拟结果仅供演示。`
      }
      if (this.query.tabType !== leaveSimulation.tabType || this.query.cityId !== leaveSimulation.cityId ||
          !['离', '全部'].includes(this.query.strategyClass || '全部') ||
          this.query.statMonth < leaveSimulation.startMonth || this.query.statMonth > leaveSimulation.sourceMonth) return ''
      return `“离”策略：2026年1—9月为模拟历史，每月固定同一组10条策略；10月为Excel数据（截至10月21日）。${leaveSimulation.baselineMonth ? '1月环比使用2025年12月模拟基期。' : ''}10月环比按截至日的日均与9月全月日均比较，柱形展示各月累计量，因此10月累计量低于9月是正常的。模拟环比仅供演示。`
    },
    isKeyAudience() {
      return this.query.tabType === 'active' && this.query.strategyClass === '重点客群'
    },
    categories() {
      return this.query.tabType === 'active'
        ? [
            { label: '全部', value: '全部' },
            { label: '升接', value: '升接' },
            { label: '稳', value: '稳' },
            { label: '降拆', value: '降拆' },
            { label: '离', value: '离' },
            { label: '重点客群', value: '重点客群' },
          ]
        : [{ label: '全部', value: '全部' }]
    },
    isDowngrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === '降拆'
    },
    groups() {
      if (this.query.tabType === 'control') {
        return {
          left: [item('strategy_count', '策略数'), item('success_count', '产能', '产能采用转化量'), item('income', '收入')],
          mid: [item('strategy_count', '策略数'), item('consult_count', '推送量'), item('retain_count', '使用量'), item('dispatch_count', '触达量'), item('success_count', '转化量')],
          rate: [item('retain_rate', '使用率'), item('reach_rate', '触达率'), item('success_rate', '转化率')],
        }
      }
      return {
        left: [item('strategy_count', '策略数'), item('product_conv_num', '产能', '产能采用全产品转化量'), item('actual_income', '收入')],
        mid: this.isDowngrade
          ? [item('push_count', '咨询量'), item('usage_count', '挽留量'), item('reach_count', '派单量'), item('product_conv_num', '成功量')]
          : this.isKeyAudience
            ? [item('original_cust', '客群'), item('push_count', '推送量'), item('usage_count', '使用量'), item('reach_count', '触达量'), item('product_conv_num', '转化量')]
            : [item('push_count', '推送量'), item('usage_count', '使用量'), item('reach_count', '触达量'), item('product_conv_num', '转化量')],
        rate: this.isDowngrade
          ? [item('usage_rate', '挽留率'), item('reach_rate', '派单率'), item('product_conv_rate', '成功率')]
          : [item('usage_rate', '使用率'), item('reach_rate', '触达率'), item('product_conv_rate', '转化率')],
      }
    },
    categoryName() {
      const item = this.categories.find((category) => category.value === (this.query.strategyClass || '全部'))
      return item ? item.label : '全部'
    },
    channelName() {
      const c = this.channels.find((c) => c.keyName === this.query.channel)
      return c ? c.keyName : '全部渠道'
    },
    funnel() {
      return this.groups.mid.filter((metric) => metric.key !== 'original_cust')
    },
    activeCard() {
      return this.kpis.find((k) => k.metricCode === this.activeMetric) || {}
    },
    trendOption() {
      const metric = this.isDowngrade
        ? this.groups.mid.concat(this.groups.rate, this.groups.left).find((item) => item.key === this.activeMetric)
        : null
      const trend = visibleSimulationTrend(this.query, this.trend)
      return barLineOption(
        trend.months,
        trend.values,
        trend.qoq,
        (metric && metric.label) || this.activeCard.label || '指标',
        this.trend.unit || this.activeCard.unit || '',
      )
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.loadKpis()
      },
    },
  },
  created() {
    this.loadKpis()
  },
  methods: {
    code(metric) {
      return metric.key
    },
    card(metric) {
      return this.kpis.find((k) => k.metricCode === this.code(metric))
    },
    value(metric) {
      return numberText((this.card(metric) || {}).value)
    },
    unit(metric) {
      return (this.card(metric) || {}).unit || ''
    },
    qoq(metric) {
      const card = this.card(metric) || {}
      return card.unit === '%' && card.trendQoQ != null ? `${numberText(card.trendQoQ)}pp` : percentText(card.trendQoQ)
    },
    direction(metric) {
      const n = (this.card(metric) || {}).trendQoQ
      return n == null ? '' : Number(n) < 0 ? 'down' : 'up'
    },
    funnelPath(shape) {
      const leftTop = 225 - shape.topWidth / 2
      const rightTop = 225 + shape.topWidth / 2
      const leftBottom = 225 - shape.bottomWidth / 2
      const rightBottom = 225 + shape.bottomWidth / 2
      return `M${leftTop} ${shape.top} Q225 ${shape.top + shape.topRy * 1.5} ${rightTop} ${shape.top} L${rightBottom} ${shape.bottom} Q225 ${shape.bottom + shape.bottomRy * 1.35} ${leftBottom} ${shape.bottom} Z`
    },
    loadKpis() {
      this.requestVersions.trend = (this.requestVersions.trend || 0) + 1
      this.trend = {}
      this.$set(this.panels, 'trend', { loading: true, error: '' })
      return this.request(
        'kpi',
        () => getOverviewKpi(this.query),
        (result) => {
          this.kpis = listOf(result)
          const visibleCodes = this.groups.left.concat(this.groups.mid, this.groups.rate).map((metric) => metric.key)
          if (!visibleCodes.includes(this.activeMetric) || !this.kpis.some((k) => k.metricCode === this.activeMetric)) {
            this.activeMetric = visibleCodes.find((code) => this.kpis.some((k) => k.metricCode === code)) || ''
          }
          this.loadTrend()
        },
      ).then(() => {
        if (this.panels.kpi.error) this.$set(this.panels, 'trend', { loading: false, error: this.panels.kpi.error })
      })
    },
    selectMetric(metric) {
      if (!this.card(metric)) return
      this.activeMetric = this.code(metric)
      this.loadTrend()
    },
    loadTrend() {
      if (!this.activeMetric) {
        this.$set(this.panels, 'trend', {})
        return
      }
      return this.request(
        'trend',
        () => getOverviewTrend({ ...this.query, metricCode: this.activeMetric }),
        (result) => {
          this.trend = result || {}
        },
      )
    },
  },
}
</script>
