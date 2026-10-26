<template>
  <section class="section overview-section">
      <h2 class="section-title">
      策略整体情况<span class="spacer" /><span class="muted filter-note">分类：{{ categoryName }}<template v-if="isKeyAudience"> · 客群：{{ query.customerGroup || '零低流量客户' }}</template><template v-if="query.tabType === 'control'"> · 产品：{{ query.productName || '全部产品' }}</template> · 触点：{{ channelName }}</span>
    </h2>
    <div class="overview-body split split--m1">
      <div class="card snapshot-card">
        <div class="overview-panel-head category-seg" role="group" aria-label="策略分类">
          <button
            v-for="category in categories"
            :key="category.label"
            class="seg-btn"
            :aria-pressed="(query.strategyClass || (query.tabType === 'active' ? '升接' : '全部')) === category.value ? 'true' : 'false'"
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
                :disabled="metric.key === 'strategy_count' || !card(metric)"
                :title="metric.title || metric.label"
                @click="selectMetric(metric)"
              >
                <span class="metric-label">{{ metric.label }}</span>
                <span class="metric-left-bottom">
                  <strong>{{ value(metric) }}<small>{{ unit(metric) }}</small></strong>
                  <span v-if="metric.key !== 'strategy_count'" class="metric-qoq">环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span>
                </span>
              </button>
            </div>
            <div
              class="metric-col metric-col-mid"
              :class="{
                'metric-col-mid--four': groups.mid.length === 4,
                'metric-col-mid--three': groups.mid.length === 3,
                'metric-col-mid--two': groups.mid.length === 2,
              }"
            >
              <button
                v-for="metric in groups.mid"
                :key="metric.key"
                class="metric-block metric-mid"
                :class="{ active: activeMetric === code(metric), 'metric-block--static': isKeyAudience && metric.key === 'original_cust' }"
                :disabled="metric.key === 'strategy_count' || (isKeyAudience && metric.key === 'original_cust') || !card(metric)"
                @click="selectMetric(metric)"
              >
                <span class="metric-orb" aria-hidden="true" /><span class="metric-mid-body"
                  :class="{ 'metric-mid-body--audience-count': isKeyAudience && metric.key === 'original_cust' }"
                  ><span class="metric-label">{{ metric.label }}</span
                  ><strong
                    >{{ value(metric) }}<small>{{ unit(metric) }}</small></strong
                  ><span v-if="metric.key !== 'strategy_count' && metric.key !== 'original_cust'" class="metric-qoq"
                    >环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span
                  ></span
                >
              </button>
            </div>
            <svg
              class="metric-funnel"
              viewBox="0 0 450 470"
              role="img"
              :aria-label="funnel.map((metric) => metric.label).join('、') + '漏斗'"
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
              <g v-for="(shape, index) in visibleFunnelShapes" :key="index">
                <path :d="funnelPath(shape)" :fill="`url(#active-funnel-${shape.color})`" />
                <ellipse :cx="225" :cy="shape.top" :rx="shape.topWidth / 2" :ry="shape.topRy"
                  :fill="shape.cap" :stroke="shape.rim" stroke-opacity=".72" stroke-width="1.5" />
                <text x="225" :y="shape.labelY" text-anchor="middle">{{ funnel[index] && funnel[index].label }}</text>
              </g>
              <path d="M58 266v37m-8-9 8 10 8-10M392 266v37m-8-9 8 10 8-10" fill="none"
                stroke="#c6eaff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".72" />
            </svg>
            <div class="metric-col metric-col-rate">
              <div
                v-for="metric in groups.rate"
                :key="metric.key"
                class="metric-block metric-rate"
                :title="card(metric) ? metric.label : '接口尚未提供该指标'"
              >
                <span class="metric-rate-content">
                  <span class="metric-rate-head">
                    <strong>{{ value(metric) }}<small>{{ unit(metric) }}</small></strong>
                    <span class="metric-label">{{ metric.label }}</span>
                  </span>
                  <span class="metric-qoq">环比 <em :class="direction(metric)">{{ qoq(metric) }}</em></span>
                </span>
              </div>
            </div>
          </div>
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
            <select class="select" aria-label="客群切换" :value="query.customerGroup || '零低流量客户'"
              :disabled="customerGroupsLoading" @change="$emit('customer-group', $event.target.value)">
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
              <option v-if="!isDowngrade" value="">全部渠道</option>
              <option v-for="channel in channels" :key="channel.keyName" :value="channel.keyName">
                {{ channel.keyName }}
              </option>
            </select></label
          >
        </div>
        <review-state
          :state="panels.trend || panels.kpi"
          :empty="!currentYearTrend.months.length"
          empty-text="该指标暂无历史趋势"
          @retry="loadTrend"
        >
          <e-chart :option="trendOption" height="310px" />
        </review-state>
      </div>
    </div>
  </section>
</template>
<script>
import { getOverviewKpi, getOverviewTrend } from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewState from './ReviewState.vue'
import { listOf, oneDecimalText, barLineOption, panelRequests, downgradeChannelMetrics, currentYearChartRows, isOnlineInboundReview } from './reviewData'
import { visibleSimulationTrend } from './simulationTrend'

const item = (key, label, title) => ({ key, label, title })
const KEY_AUDIENCE_COUNTS = Object.freeze({
  拆弹客户: 1049338,
  超套客户: 4920897,
  老旧资费客户: 1795272,
  零低流量客户: 30390413,
  异网分流客户: 25070711,
  低价套餐客户: 28685025,
})

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
      activeMetricTabType: '',
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
    isKeyAudience() {
      return this.query.tabType === 'active' && this.query.strategyClass === '重点客群'
    },
    isStable() {
      return this.query.tabType === 'active' && this.query.strategyClass === '稳'
    },
    isOnlineInbound() {
      return isOnlineInboundReview(this.query)
    },
    isUpgrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === '升接'
    },
    categories() {
      return this.query.tabType === 'active'
        ? [
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
    isLeave() {
      return this.query.tabType === 'active' && this.query.strategyClass === '离'
    },
    downgradeMetrics() {
      return downgradeChannelMetrics(this.query.channel)
    },
    groups() {
      if (this.query.tabType === 'control') {
        return {
          left: [item('strategy_count', '策略数'), item('success_count', '产能', '产能采用转化量'), item('income', '收入')],
          mid: [item('strategy_count', '策略数'), item('consult_count', '推送量'), item('retain_count', '使用量'), item('dispatch_count', '触达量'), item('success_count', '转化量')],
          rate: [item('retain_rate', '使用率'), item('reach_rate', '触达率'), item('success_rate', '转化率')],
        }
      }
      const labels = this.isOnlineInbound
        ? { push: '呼入量', usage: '可推荐量', reach: '推荐量', usageRate: '可推荐率', reachRate: '推荐率' }
        : { push: '推送量', usage: '使用量', reach: '触达量', usageRate: '使用率', reachRate: '触达率' }
      return {
        left: this.isDowngrade || this.isLeave || this.isStable
          ? [
              item('strategy_count', '策略数'),
              item(
                this.isDowngrade ? (this.downgradeMetrics.capacity || 'product_conv_num') : 'product_conv_num',
                '产能',
                this.isDowngrade || this.isLeave ? '产能采用成功量' : '产能采用全产品转化量',
              ),
            ]
          : [item('strategy_count', '策略数'), item('product_conv_num', '产能', '产能采用全产品转化量'), item('actual_income', '收入')],
        mid: this.isDowngrade
          ? this.downgradeMetrics.funnel.map((metric) => item(metric.key, metric.label))
          : this.isKeyAudience
            ? [item('original_cust', '客群'), item('push_count', labels.push), item('usage_count', labels.usage), item('reach_count', labels.reach), item('product_conv_num', '转化量')]
            : [item('push_count', labels.push), item('usage_count', labels.usage), item('reach_count', labels.reach), item('product_conv_num', '转化量')],
        rate: this.isDowngrade
          ? this.downgradeMetrics.rates.map((metric) => item(metric.key, metric.label))
          : [item('usage_rate', labels.usageRate), item('reach_rate', labels.reachRate), item('product_conv_rate', '转化率')],
      }
    },
    categoryName() {
      const defaultCategory = this.query.tabType === 'active' ? '升接' : '全部'
      const item = this.categories.find((category) => category.value === (this.query.strategyClass || defaultCategory))
      return item ? item.label : defaultCategory
    },
    channelName() {
      const c = this.channels.find((c) => c.keyName === this.query.channel)
      return c ? c.keyName : (this.query.channel || (this.isDowngrade ? '整体' : '全部渠道'))
    },
    funnel() {
      return this.groups.mid.filter((metric) => metric.key !== 'original_cust')
    },
    visibleFunnelShapes() {
      const count = this.funnel.length
      if (count >= 4) return this.funnelShapes
      if (!count) return []

      const widthStops = count === 3 ? [400, 320, 230, 146] : [400, 270, 146]
      const top = 74
      const bottom = 418
      const segmentHeight = (bottom - top) / count
      return Array.from({ length: count }, (_, index) => {
        const shape = this.funnelShapes[Math.round(index * (this.funnelShapes.length - 1) / (count - 1))]
        const segmentTop = top + segmentHeight * index
        const segmentBottom = top + segmentHeight * (index + 1)
        return {
          ...shape,
          top: segmentTop,
          bottom: segmentBottom,
          topWidth: widthStops[index],
          bottomWidth: widthStops[index + 1],
          topRy: index === 0 ? 30 : 20,
          bottomRy: index === count - 1 ? 18 : 20,
          labelY: (segmentTop + segmentBottom) / 2 + 10,
        }
      })
    },
    activeCard() {
      return this.kpis.find((k) => k.metricCode === this.activeMetric) || {}
    },
    currentYearTrend() {
      const trend = this.isKeyAudience ? this.trend : visibleSimulationTrend(this.query, this.trend)
      const points = currentYearChartRows(trend.months, trend.values, trend.qoq, this.query.statMonth)
      return { ...trend, months: points.months, values: points.values, qoq: points.comparison }
    },
    trendOption() {
      const metric = this.isDowngrade || this.isOnlineInbound
        ? this.groups.mid.concat(this.groups.rate, this.groups.left).find((item) => item.key === this.activeMetric)
        : null
      const trend = this.currentYearTrend
      return barLineOption(
        trend.months,
        trend.values,
        trend.qoq,
        (metric && metric.label) || this.activeCard.label || '指标',
        this.trend.unit || this.activeCard.unit || '',
        { scaleByTenThousand: true, fractionDigits: 1, omitTimesUnit: true },
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
      const rawValue = this.isKeyAudience && metric.key === 'original_cust'
        ? this.keyAudienceCount()
        : (this.card(metric) || {}).value
      return this.usesMyriadUnit(metric) && rawValue !== null && rawValue !== undefined && rawValue !== ''
        ? oneDecimalText(Number(rawValue) / 10000)
        : oneDecimalText(rawValue)
    },
    keyAudienceCount() {
      return KEY_AUDIENCE_COUNTS[this.query.customerGroup || '零低流量客户'] || KEY_AUDIENCE_COUNTS['零低流量客户']
    },
    unit(metric) {
      const rawUnit = this.isKeyAudience && metric.key === 'original_cust'
        ? ((this.card(metric) || {}).unit || '人')
        : ((this.card(metric) || {}).unit || '')
      const displayUnit = !rawUnit || !this.usesMyriadUnit(metric)
        ? rawUnit
        : rawUnit === '元' ? '万元' : `万${rawUnit}`
      return displayUnit.replace(/次/g, '')
    },
    usesMyriadUnit(metric) {
      const rawUnit = (this.card(metric) || {}).unit || (metric.key === 'original_cust' ? '人' : '')
      return metric.key !== 'strategy_count' && rawUnit !== '%' && !rawUnit.startsWith('万')
    },
    qoq(metric) {
      const card = this.card(metric) || {}
      return card.unit === '%' && card.trendQoQ != null
        ? `${oneDecimalText(card.trendQoQ)}pp`
        : card.trendQoQ == null ? '—' : `${oneDecimalText(card.trendQoQ)}%`
    },
    direction(metric) {
      const n = (this.card(metric) || {}).trendQoQ
      if (n == null) return ''
      const value = Number(n)
      return value < 0 ? 'up' : value > 0 ? 'down' : ''
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
          const visibleCodes = this.groups.left.concat(this.groups.mid, this.groups.rate)
            .filter((metric) => !(this.isKeyAudience && metric.key === 'original_cust'))
            .map((metric) => metric.key)
          const selectedMetricExists = visibleCodes.includes(this.activeMetric) && this.kpis.some((k) => k.metricCode === this.activeMetric)
          if (this.activeMetricTabType !== this.query.tabType || !selectedMetricExists) {
            const capacityCode = this.groups.left.find((metric) => metric.label === '产能')?.key
            this.activeMetric = (capacityCode && this.kpis.some((k) => k.metricCode === capacityCode) ? capacityCode : '') ||
              visibleCodes.find((code) => code !== 'strategy_count' && this.kpis.some((k) => k.metricCode === code)) || ''
          }
          this.activeMetricTabType = this.query.tabType
          this.loadTrend()
        },
      ).then(() => {
        if (this.panels.kpi.error) this.$set(this.panels, 'trend', { loading: false, error: this.panels.kpi.error })
      })
    },
    selectMetric(metric) {
      if (!this.card(metric) || (this.isKeyAudience && metric.key === 'original_cust')) return
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
