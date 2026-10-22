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
        <span class="muted">策略复盘与预警</span><span class="spacer" /><label
          >数据月份
          <el-date-picker
            :value="month"
            type="month"
            size="small"
            value-format="yyyy-MM"
            placeholder="选择数据月份"
            :clearable="false"
            @input="changeMonth"
        /></label>
      </div>
      <review-state :state="panels.bootstrap" @retry="bootstrap">
        <template v-if="month">
          <div v-if="channelError" class="dimension-error" role="alert">
            触点选项加载失败，当前展示全部渠道。<button class="btn-link" @click="loadChannels">重试</button>
          </div>
          <stock-overview
            :query="query"
            :channels="channels"
            :channels-loading="channelsLoading"
            @channel="changeChannel"
            @strategy-class="changeStrategyClass"
            @month="drillMonth"
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
      strategyClass: '',
      channels: [],
      channelsLoading: false,
      channelError: false,
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
        strategyClass: this.strategyClass,
        cityId: getCityId(),
        userId: getUserId(),
      }
    },
    channelName() {
      const item = this.channels.find((c) => c.keyCode === this.channel)
      return item ? item.keyName : '全部渠道'
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
      this.strategyClass = ''
      this.selectedStrategy = null
      this.bootstrap()
      this.loadChannels()
    },
  },
  methods: {
    bootstrap() {
      return this.request(
        'bootstrap',
        () => getLatestDate({ tabType: this.tabType, cityId: getCityId(), userId: getUserId() }),
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
      this.channelsLoading = true
      try {
        this.channels = listOf(await getDim({ tabType: this.tabType, type: '触点渠道' })).filter(
          (c) => !['全部', '全部渠道'].includes(c.keyName),
        )
        this.channelError = false
      } catch (e) {
        this.channelError = true
      } finally {
        this.channelsLoading = false
      }
    },
    changeMonth(month) {
      if (!month) return
      this.month = month
      this.selectedStrategy = null
      this.$emit('dateRangeChange', monthRange(month))
    },
    changeChannel(channel) {
      this.channel = channel
      this.selectedStrategy = null
    },
    changeStrategyClass(strategyClass) {
      if (this.strategyClass === strategyClass) return
      this.strategyClass = strategyClass
      this.selectedStrategy = null
    },
    drillMonth(month) {
      this.changeMonth(month)
      this.$nextTick(() => {
        if (this.$refs.execution) this.$refs.execution.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
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
