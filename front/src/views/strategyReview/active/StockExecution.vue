<template>
  <section class="section">
    <h2 class="section-title">策略执行情况</h2>
    <div class="execution-scope" role="status" aria-live="polite">
      <span>当前联动：{{ scopeLabel }}</span>
      <button v-if="selectedCategory" class="btn-link" @click="clearSelection">× 清除选择</button>
    </div>
    <div class="split split--m2" :class="{ 'split--without-biz': hideBusinessCapacity }">
      <div class="card">
        <review-table
          title="策略分类执行情况"
          tools
          :reverse-change-colors="isDowngrade"
          :columns="columns"
          :rows="pagedCategories"
          :export-data="filteredCategories"
          :page="page"
          :page-size="10"
          :total="filteredCategories.length"
          :state="panels.category"
          row-clickable
          :get-row-key="categoryKey"
          :active-row-key="selectedCategory ? categoryKey(selectedCategory) : ''"
          @row-click="selectCategory"
          @page="page = $event"
          @retry="loadCategories"
        >
          <div slot="filters" class="toolbar">
            <select v-model="draftBig" class="select" :aria-label="categoryBigLabel" @change="draftSmall = ''">
              <option value="">全部{{ categoryPrefix }}大类</option>
              <option v-for="name in bigCategories" :key="name">{{ name }}</option>
            </select>
            <select v-model="draftSmall" class="select" :aria-label="categorySmallLabel">
              <option value="">全部{{ categoryPrefix }}小类</option>
              <option v-for="name in smallCategories" :key="name">{{ name }}</option>
            </select>
            <button class="btn btn-primary" @click="search">搜索</button
            ><button class="btn" @click="reset">重置</button>
          </div>
        </review-table>
      </div>
      <div class="card chart-card">
        <div class="sub-title">
          产能趋势<span class="spacer" /><span class="muted">{{ trendChannelName }}</span>
        </div>
        <review-state :state="panels.trend" :empty="!trend.length" @retry="loadTrend"
          ><e-chart :option="trendOption" height="285px"
        /></review-state>
      </div>
      <div v-if="!hideBusinessCapacity" class="card">
        <review-table
          title="业务产能明细"
          :reverse-change-colors="isDowngrade"
          :columns="bizColumns"
          :rows="biz.slice((bizPage - 1) * 10, bizPage * 10)"
          :page="bizPage"
          :page-size="10"
          :total="biz.length"
          :state="panels.biz"
          @page="bizPage = $event"
          @retry="loadBiz"
        />
      </div>
    </div>
  </section>
</template>
<script>
import { getCategorySummary, getChannelCapacityTrend, getChannelBizCapacity } from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewTable from './ReviewTable.vue'
import ReviewState from './ReviewState.vue'
import { listOf, categoryColumns, controlCategoryColumns, channelBizColumns, categoryLabelColumns, barLineOption, panelRequests, recentMonthRows } from './reviewData'

export default {
  name: 'StockExecution',
  components: { EChart, ReviewTable, ReviewState },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true }, channelName: { type: String, default: '全部渠道' } },
  data() {
    return {
      categories: [],
      trend: [],
      biz: [],
      page: 1,
      bizPage: 1,
      draftBig: '',
      draftSmall: '',
      big: '',
      small: '',
      selectedCategory: null,
    }
  },
  computed: {
    capacityQuery() {
      return {
        ...this.query,
        bigCategory: this.selectedCategory ? this.selectedCategory.bigCategory : this.big,
        smallCategory: this.selectedCategory ? this.selectedCategory.smallCategory : this.small,
      }
    },
    trendChannelName() {
      return this.channelName
    },
    scopeLabel() {
      const { bigCategory, smallCategory } = this.capacityQuery
      const category = [bigCategory, smallCategory].filter(Boolean).join(' / ') || `全部${this.categoryPrefix}分类`
      return `${this.channelName} / ${category}`
    },
    columns() {
      const columns = categoryLabelColumns(this.query.tabType === 'control' ? controlCategoryColumns : categoryColumns, this.query)
      const channel = String(this.query.channel || '').replace(/[\s-]/g, '')
      const hideLobbyMetrics = this.query.tabType === 'active' && (
        (this.query.strategyClass === '升接' && channel.includes('营业厅')) ||
        (this.query.strategyClass === '稳' && (channel.includes('营业厅') || channel.includes('线下')))
      )
      const visibleColumns = hideLobbyMetrics
        ? columns.filter((column) => !['usageCount', 'usageRate', 'reachCount'].includes(column.prop))
        : columns
      if (this.query.tabType === 'active' && ['升接', '稳', '重点客群'].includes(this.query.strategyClass)) {
        return [...visibleColumns, { prop: 'actualIncome', label: '收入(元)' }]
      }
      return visibleColumns
    },
    isDowngrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === '降拆'
    },
    hideBusinessCapacity() {
      return this.query.tabType === 'active' && ['降拆', '离'].includes(this.query.strategyClass)
    },
    categoryPrefix() {
      return this.isDowngrade ? '场景' : '策略'
    },
    categoryBigLabel() {
      return `${this.categoryPrefix}大类`
    },
    categorySmallLabel() {
      return `${this.categoryPrefix}小类`
    },
    bizColumns() {
      return this.query.tabType === 'control'
        ? channelBizColumns.map(c => c.prop === 'capacity' ? { ...c, label: '转化量' } : c)
        : categoryLabelColumns(channelBizColumns, this.query)
    },
    bigCategories() {
      return [...new Set(this.categories.map((r) => r.bigCategory).filter(Boolean))]
    },
    smallCategories() {
      return [
        ...new Set(
          this.categories
            .filter((r) => !this.draftBig || r.bigCategory === this.draftBig)
            .map((r) => r.smallCategory)
            .filter(Boolean),
        ),
      ]
    },
    filteredCategories() {
      return this.categories.filter(
        (r) => (!this.big || r.bigCategory === this.big) && (!this.small || r.smallCategory === this.small),
      )
    },
    pagedCategories() {
      return this.filteredCategories.slice((this.page - 1) * 10, this.page * 10)
    },
    trendOption() {
      const rows = recentMonthRows(this.trend, this.query.statMonth)
      const sourceTrend = {
        months: rows.map((r) => r.monthLabel || r.month),
        capacity: rows.map((r) => r.capacity),
        qoq: rows.map((r) => r.qoq),
      }
      const trend = sourceTrend
      const qoq = [...(trend.qoq || [])]
      return barLineOption(trend.months, trend.capacity, qoq, '成功量', '', {
        integerBarLabels: true,
      })
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.resetFilters()
        this.load()
      },
    },
  },
  created() {
    this.load()
  },
  methods: {
    load() {
      this.loadCategories()
      this.loadCapacity()
    },
    loadCapacity() {
      this.bizPage = 1
      this.trend = []
      this.biz = []
      this.loadTrend()
      this.loadBiz()
    },
    categoryKey(row) {
      return JSON.stringify([row.bigCategory || '', row.smallCategory || ''])
    },
    selectCategory(row) {
      if (this.selectedCategory && this.categoryKey(row) === this.categoryKey(this.selectedCategory)) return
      this.selectedCategory = { bigCategory: row.bigCategory || '', smallCategory: row.smallCategory || '' }
      this.loadCapacity()
    },
    clearSelection() {
      this.selectedCategory = null
      this.loadCapacity()
    },
    loadCategories() {
      return this.request(
        'category',
        () => getCategorySummary(this.query),
        (result) => {
          this.categories = listOf(result)
          this.page = 1
          if (!this.selectedCategory && this.filteredCategories.length) {
            this.selectCategory(this.filteredCategories[0])
          }
        },
      )
    },
    loadTrend() {
      return this.request(
        'trend',
        () => getChannelCapacityTrend(this.capacityQuery),
        (result) => {
          this.trend = listOf(result)
        },
      )
    },
    loadBiz() {
      if (this.hideBusinessCapacity) return
      return this.request(
        'biz',
        () => getChannelBizCapacity(this.capacityQuery),
        (result) => {
          this.biz = listOf(result)
          this.bizPage = 1
        },
      )
    },
    search() {
      this.big = this.draftBig
      this.small = this.draftSmall
      this.page = 1
      this.selectedCategory = null
      if (this.filteredCategories.length) this.selectCategory(this.filteredCategories[0])
      else this.loadCapacity()
    },
    reset() {
      this.resetFilters()
      if (this.filteredCategories.length) this.selectCategory(this.filteredCategories[0])
      else this.loadCapacity()
    },
    resetFilters() {
      this.selectedCategory = null
      this.big = ''
      this.small = ''
      this.draftBig = ''
      this.draftSmall = ''
      this.page = 1
    },
  },
}
</script>
<style scoped>
.execution-scope {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: -4px 0 12px;
  font-size: 13px;
}
</style>
