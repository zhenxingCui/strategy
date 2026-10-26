<template>
  <div class="active-review" :class="{ 'theme-dark': dark }">
    <header class="app-bar">
      <nav class="app-nav" aria-label="主导航">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :aria-current="tab.key === tabType ? 'page' : null"
          @click="$emit('tabChange', tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>
      <span class="spacer" /><button
        class="icon-btn"
        :aria-label="dark ? '切换浅色主题' : '切换深色主题'"
        @click="toggleTheme"
      >
        <i :class="dark ? 'el-icon-sunny' : 'el-icon-moon'" />
      </button>
    </header>
    <main ref="main" class="page-main">
      <div class="page-head">
        <h1>{{ pageTitle }}</h1>
        <span class="muted">策略复盘与预警</span>
        <span class="spacer" />
        <span v-if="month" class="data-month">数据月份 {{ month }}</span>
      </div>
      <review-state :state="panels.bootstrap" @retry="bootstrap">
        <template v-if="month">
          <div v-if="channelError" class="dimension-error" role="alert">
            触点选项加载失败，当前按“{{ channelName }}”渠道查询。<button class="btn-link" @click="loadChannels">重试</button>
          </div>
          <div v-if="customerGroupsError && strategyClass === '重点客群'" class="dimension-error" role="alert">
            客群选项加载失败，当前展示零低流量客户。<button class="btn-link" @click="loadCustomerGroups">重试</button>
          </div>
          <div v-if="productsError && tabType === 'control'" class="dimension-error" role="alert">
            产品选项加载失败，当前展示全部产品。<button class="btn-link" @click="loadProducts">重试</button>
          </div>
          <stock-overview
            :query="query"
            :channels="channels"
            :channels-loading="channelsLoading"
            :customer-groups="customerGroups"
            :customer-groups-loading="customerGroupsLoading"
            :products="products"
            :products-loading="productsLoading"
            @product="changeProduct"
            @customer-group="changeCustomerGroup"
            @channel="changeChannel"
            @strategy-class="changeStrategyClass"
          />
          <stock-execution ref="execution" :query="query" :channel-name="channelName" />
          <stock-warning :query="query" :channels="channels" @strategy="selectStrategy" />
          <stock-detail ref="detail" :query="query" :external-strategy="selectedStrategy" />
        </template>
      </review-state>
    </main>
  </div>
</template>
<script>
import { getDim, getLatestDate } from '@/api/strategyReview'
import { getCityId, getUserId, touchActivity } from '@/utils/auth'
import ReviewState from './ReviewState.vue'
import StockOverview from './StockOverview.vue'
import StockExecution from './StockExecution.vue'
import StockWarning from './StockWarning.vue'
import StockDetail from './StockDetail.vue'
import { listOf, monthRange, panelRequests } from './reviewData'

export default {
  name: 'ActiveReview',
  components: { ReviewState, StockOverview, StockExecution, StockWarning, StockDetail },
  mixins: [panelRequests],
  props: { tabType: { type: String, default: 'active' } },
  data() {
    return {
      month: '',
      channel: '',
      strategyClass: this.tabType === 'active' ? '升接' : '',
      customerGroup: '',
      customerGroups: [],
      customerGroupsLoading: false,
      customerGroupsError: false,
      customerGroupsRequestVersion: 0,
      productName: '',
      products: [],
      productsLoading: false,
      productsError: false,
      productsRequestVersion: 0,
      channels: [],
      channelsLoading: false,
      channelError: false,
      channelsRequestVersion: 0,
      selectedStrategy: null,
      dark: false,
      tabs: [
        { key: 'active', label: '存量策略' },
        { key: 'passive', label: '增量策略' },
        { key: 'control', label: '重点产品' },
      ],
    }
  },
  computed: {
    pageTitle() {
      return { active: '存量策略', passive: '增量策略', control: '重点产品' }[this.tabType] || '策略复盘'
    },
    query() {
      return {
        tabType: this.tabType,
        statMonth: this.month,
        channel: this.channel,
        strategyClass: this.tabType === 'active' ? (this.strategyClass || '升接') : '全部',
        customerGroup: this.tabType === 'active' && this.strategyClass === '重点客群' ? (this.customerGroup || '零低流量客户') : '',
        productName: this.tabType === 'control' ? (this.productName || '') : '',
        cityId: getCityId(),
        userId: getUserId(),
      }
    },
    channelName() {
      const item = this.channels.find((c) => c.keyName === this.channel)
      return item ? item.keyName : (this.channel || (this.tabType === 'active' && this.strategyClass === '降拆' ? '整体' : '全部渠道'))
    },
  },
  created() {
    try {
      this.dark = localStorage.getItem('sr_active_theme') === 'dark'
    } catch (e) {
      /* 存储不可用时使用浅色主题 */
    }
    this.bootstrap()
    this.loadChannels()
    this.loadCustomerGroups()
    this.loadProducts()
  },
  mounted() {
    this.$el.addEventListener('click', touchActivity)
    this.$el.addEventListener('keydown', touchActivity)
  },
  beforeDestroy() {
    this.$el.removeEventListener('click', touchActivity)
    this.$el.removeEventListener('keydown', touchActivity)
  },
  watch: {
    tabType() {
      this.month = ''
      this.channel = ''
      this.strategyClass = this.tabType === 'active' ? '升接' : ''
      this.customerGroup = ''
      this.productName = ''
      this.selectedStrategy = null
      this.bootstrap()
      this.loadChannels()
      this.loadCustomerGroups()
      this.loadProducts()
    },
  },
  methods: {
    async loadProducts() {
      const version = ++this.productsRequestVersion
      this.products = []
      this.productsError = false
      this.productsLoading = false
      if (this.tabType !== 'control') return
      this.productsLoading = true
      try {
        const result = await getDim({ tabType: 'control', type: '产品名称' })
        if (version !== this.productsRequestVersion) return
        this.products = listOf(result)
      } catch (e) {
        if (version === this.productsRequestVersion) this.productsError = true
      } finally {
        if (version === this.productsRequestVersion) this.productsLoading = false
      }
    },
    changeProduct(productName) {
      if (this.productName === productName) return
      this.productName = productName
      this.selectedStrategy = null
    },
    async loadCustomerGroups() {
      const version = ++this.customerGroupsRequestVersion
      const requestType = this.tabType
      this.customerGroups = []
      this.customerGroupsError = false
      this.customerGroupsLoading = false
      if (requestType !== 'active') return
      this.customerGroupsLoading = true
      try {
        const result = await getDim({ tabType: requestType, type: '客群分类' })
        if (version !== this.customerGroupsRequestVersion) return
        this.customerGroups = listOf(result)
      } catch (e) {
        if (version === this.customerGroupsRequestVersion) this.customerGroupsError = true
      } finally {
        if (version === this.customerGroupsRequestVersion) this.customerGroupsLoading = false
      }
    },
    changeCustomerGroup(customerGroup) {
      if (this.customerGroup === customerGroup) return
      this.customerGroup = customerGroup
      this.selectedStrategy = null
      this.loadChannels()
    },
    bootstrap() {
      return this.request(
        'bootstrap',
        () => getLatestDate({
          tabType: this.tabType,
          strategyClass: this.tabType === 'active' ? (this.strategyClass || '升接') : '全部',
          cityId: getCityId(),
          userId: getUserId(),
        }),
        (result) => {
          const raw = typeof result === 'string' ? result : Array.isArray(result) ? result[0] : result && result.data
          const compact = typeof raw === 'string' ? raw.replace(/-/g, '') : ''
          if (!/^\d{6}/.test(compact) || Number(compact.slice(4, 6)) < 1 || Number(compact.slice(4, 6)) > 12)
            throw new Error('最新数据月份格式不正确，请检查接口返回')
          this.changeMonth(`${compact.slice(0, 4)}-${compact.slice(4, 6)}`)
        },
      )
    },
    async loadChannels() {
      const version = ++this.channelsRequestVersion
      this.channelsLoading = true
      try {
        const result = await getDim({ ...this.query, type: '触点渠道' })
        if (version !== this.channelsRequestVersion) return
        this.channels = listOf(result).filter(
          (c) => !['全部', '全部渠道'].includes(c.keyName),
        )
        if (this.channel && !this.channels.some((c) => c.keyName === this.channel)) {
          this.channel = this.tabType === 'active' && this.strategyClass === '降拆' ? '整体' : ''
          this.selectedStrategy = null
        }
        this.channelError = false
      } catch (e) {
        if (version === this.channelsRequestVersion) {
          this.channels = []
          if (!(this.tabType === 'active' && this.strategyClass === '降拆')) this.channel = ''
          this.channelError = true
        }
      } finally {
        if (version === this.channelsRequestVersion) this.channelsLoading = false
      }
    },
    changeMonth(month) {
      if (!month) return
      this.month = month
      this.selectedStrategy = null
      this.$emit('dateRangeChange', monthRange(month))
      this.loadChannels()
    },
    changeChannel(channel) {
      this.channel = channel
      this.selectedStrategy = null
    },
    changeStrategyClass(strategyClass) {
      if (this.strategyClass === strategyClass) return
      const previousStrategyClass = this.strategyClass
      this.strategyClass = strategyClass
      if (this.tabType === 'active' && strategyClass === '降拆') {
        // “整体”是降拆数据中的真实渠道，需要按该渠道查询。
        this.channel = '整体'
      } else if (this.tabType === 'active' && previousStrategyClass === '降拆' && this.channel === '整体') {
        this.channel = ''
      }
      this.customerGroup = strategyClass === '重点客群' ? '零低流量客户' : ''
      this.selectedStrategy = null
      this.loadChannels()
    },
    selectStrategy(row) {
      this.selectedStrategy = { ...row }
      this.$nextTick(() => {
        if (this.$refs.detail) this.$refs.detail.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    toggleTheme() {
      this.dark = !this.dark
      try {
        localStorage.setItem('sr_active_theme', this.dark ? 'dark' : 'light')
      } catch (e) {
        /* 存储不可用不影响主题切换 */
      }
    },
  },
}
</script>
<style lang="less">
@import './active-review.less';
</style>
