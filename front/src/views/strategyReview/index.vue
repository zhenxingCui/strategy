<template>
  <div>
    <active-review
      v-if="['active', 'passive', 'control'].includes(activeTab)"
      :tab-type="activeTab"
      @tabChange="handleTabChange"
      @dateRangeChange="handleDateRangeChange"
    />
    <div v-else class="strategy-review-page">
    <app-header
      :active-tab="activeTab"
      :date-range="dateRange"
      @tabChange="handleTabChange"
      @dateRangeChange="handleDateRangeChange"
    />

    <main class="main-content">
      <!-- 懒挂载：滚动到可视区附近才渲染，避免低配机器首屏一次渲染全部巨型组件 -->
      <section v-lazy-mount="{ cb: () => mountSection('overview') }">
        <strategy-overview v-if="mountedSections.overview" :tab-type="activeTab" :date-range="dateRange" />
      </section>

      <section v-lazy-mount="{ cb: () => mountSection('touchpoint') }">
        <touchpoint-execution
          v-if="mountedSections.touchpoint"
          :tab-type="activeTab"
          :date-range="dateRange"
          :active-strategy="currentStrategy"
          :fav-strategies="favStrategies[activeTab] || []"
          @strategyClick="handleStrategyClick"
          @favAdd="handleFavAdd"
        />
      </section>

      <section v-lazy-mount="{ cb: () => mountSection('detail') }">
        <execution-detail
          v-if="mountedSections.detail"
          :tab-type="activeTab"
          :date-range="dateRange"
          :active-strategy="currentStrategy"
        />
      </section>

      <section v-lazy-mount="{ cb: () => mountSection('warning') }">
        <auto-warning
          v-if="mountedSections.warning"
          :tab-type="activeTab"
          :stat-month="statMonth"
          @strategyClick="handleStrategyClick"
        />
      </section>
    </main>
    </div>
  </div>
</template>

<script>
import AppHeader from './components/AppHeader.vue'
import ActiveReview from './active/ActiveReview.vue'
import StrategyOverview from './components/StrategyOverview.vue'
import TouchpointExecution from './components/TouchpointExecution.vue'
import ExecutionDetail from './components/ExecutionDetail.vue'
import AutoWarning from './components/AutoWarning.vue'
import { getLatestDate } from '@/api/strategyReview'
import { getCityId, getUserId } from '@/utils/auth'

export default {
  name: 'strategyReview',
  components: {
    ActiveReview,
    AppHeader,
    StrategyOverview,
    TouchpointExecution,
    ExecutionDetail,
    AutoWarning
  },
  // 懒挂载指令：进入可视区（提前 400px 预渲染）才执行回调，避免首屏一次渲染全部巨型组件
  directives: {
    lazyMount: {
      inserted (el, binding) {
        const cb = binding.value && binding.value.cb
        if (!cb) return
        if (typeof IntersectionObserver === 'undefined') {
          cb()
          return
        }
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              cb()
              io.disconnect()
            }
          })
        }, { rootMargin: '400px 0px' })
        io.observe(el)
        el.__lazyIo__ = io
      },
      unbind (el) {
        if (el.__lazyIo__) el.__lazyIo__.disconnect()
      }
    }
  },
  data () {
    return {
      // tab：active 主动 / passive 被动 / control 控损
      activeTab: 'active',
      // 日期范围 [startDate, endDate]（YYYY-MM-DD），分日明细接口使用
      dateRange: [],
      // 按 tab 隔离的策略联动状态：{ active: { strategyId, name, channel }, passive: {...}, control: {...} }
      strategyStateMap: {},
      // 按 tab 隔离的收藏策略列表
      favStrategies: { active: [], passive: [], control: [] },
      // 各区块是否已挂载（懒挂载状态）
      mountedSections: { overview: false, touchpoint: false, detail: false, warning: false }
    }
  },
  computed: {
    currentStrategy () {
      return this.strategyStateMap[this.activeTab] || { strategyId: null, name: null, channel: null }
    },
    statMonth () {
      if (this.dateRange && this.dateRange.length > 0) {
        return this.dateRange[0].substring(0, 7)
      }
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
  },
  created () {
    this.initDateRangeFromUrl()
    if (this.activeTab === 'active') return
    // 优先从后端获取最新数据日期，失败时使用本地默认范围
    this.fetchLatestDate().then(() => {
      // 首屏第一个区块立即渲染
      this.mountSection('overview')
    }).catch(() => {
      this.dateRange = this.getDefaultDateRange()
      this.mountSection('overview')
    })
  },
  methods: {
    mountSection (key) {
      if (this.mountedSections[key]) return
      this.$set(this.mountedSections, key, true)
    },
    // 支持 URL ?tab=passive 直达
    initDateRangeFromUrl () {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (['active', 'passive', 'control'].includes(tab)) {
        this.activeTab = tab
      }
    },
    getDefaultDateRange () {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      return [`${y}-${m}-01`, `${y}-${m}-${day}`]
    },
    // 从后端获取最新数据日期，设置为当月范围
    async fetchLatestDate () {
      try {
        const res = await getLatestDate({ tabType: 'active', cityId: getCityId(), userId: getUserId() })
        const latestDate = typeof res === 'string' ? res : (Array.isArray(res) ? res[0] : (res && res.data))
        if (latestDate && typeof latestDate === 'string') {
          // latestDate 格式为 yyyy-MM-01，提取年月
          const ym = latestDate.substring(0, 7)
          // 计算该月最后一天
          const [y, m] = ym.split('-').map(Number)
          const lastDay = new Date(y, m, 0).getDate()
          this.dateRange = [`${ym}-01`, `${ym}-${String(lastDay).padStart(2, '0')}`]
        } else {
          this.dateRange = this.getDefaultDateRange()
        }
      } catch (e) {
        this.dateRange = this.getDefaultDateRange()
      }
    },
    handleTabChange (tab) {
      if (tab === this.activeTab) return
      // 先清空新 tab 的策略联动状态，确保 currentStrategy 变化触发子组件重新加载
      this.$set(this.strategyStateMap, tab, { strategyId: null, name: null, channel: null })
      this.activeTab = tab
      // tab 切换回到顶部
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    handleDateRangeChange (range) {
      this.dateRange = range
    },
    handleStrategyClick ({ strategyId, name, channel, auto }) {
      this.$set(this.strategyStateMap, this.activeTab, { strategyId: strategyId || null, name: name || null, channel: channel || null, auto: !!auto })
    },
    handleFavAdd (strategies) {
      const tab = this.activeTab
      const existing = this.favStrategies[tab] || []
      const existingKeys = new Set(existing.map(s => s.id))
      const added = strategies.filter(s => !existingKeys.has(s.id))
      this.$set(this.favStrategies, tab, [...existing, ...added])
    },
    handleFavRemove (strategies) {
      const tab = this.activeTab
      const list = this.favStrategies[tab] || []
      const removeIds = new Set((strategies || []).map(s => s.id))
      this.$set(this.favStrategies, tab, list.filter(s => !removeIds.has(s.id)))
    }
  }
}
</script>

<style lang="less" scoped>
.strategy-review-page {
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background: #f5f6fa;
  .main-content {
    box-sizing: border-box;
    padding: 10px 14px 20px;
    // 懒挂载区块占位高度：未挂载时保留滚动空间，挂载后由内容自然撑开
    > section {
      min-height: 320px;
    }
  }
}
</style>
