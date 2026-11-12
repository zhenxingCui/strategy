<template>
  <section class="section detail-section">
    <h2 class="section-title">策略执行明细</h2>
    <div class="split split--m4">
      <div class="card">
        <review-table
          ref="strategyTable"
          title="策略执行情况"
          tools
          :reverse-change-colors="isDowngrade"
          :exporting="exportingStrategies"
          sortable
          :sort-state="sort"
          :columns="columns"
          :rows="strategies"
          :state="panels.list"
          :page="page"
          :total="total"
          :active-id="selected.strategyId"
          @retry="loadList"
          @page="changePage"
          @sort="changeSort"
          @export-all="exportAllStrategies"
          @strategy="selectStrategy"
        >
          <div slot="filters" class="toolbar">
            <select v-model="draftBigCategory" class="select" aria-label="策略大类" :disabled="panels.categoryOptions && panels.categoryOptions.loading" @change="draftSmallCategory = ''">
              <option value="">全部策略大类</option>
              <option v-for="name in bigCategories" :key="name" :value="name">{{ name }}</option>
            </select>
            <select v-model="draftSmallCategory" class="select" aria-label="策略小类" :disabled="panels.categoryOptions && panels.categoryOptions.loading">
              <option value="">全部策略小类</option>
              <option v-for="name in smallCategories" :key="name" :value="name">{{ name }}</option>
            </select>
            <input
              v-model="draftName"
              class="input"
              type="search"
              placeholder="请输入策略名称"
              aria-label="策略名称"
              @keyup.enter="search"
            />
            <button class="btn btn-primary" @click="search">搜索</button
            ><button class="btn" @click="resetSearch">重置</button>
            <span v-if="panels.categoryOptions && panels.categoryOptions.error" role="alert">
              分类选项加载失败，<button class="btn-link" @click="loadCategoryOptions">重试</button>
            </span>
          </div>
        </review-table>
      </div>
      <div class="detail-grid" :class="{ 'detail-grid--without-biz': hideBusinessCapacity }">
        <div class="card">
          <div class="sub-title">策略详情</div>
          <review-state
            :state="panels.info"
            :empty="!selected.strategyId"
            empty-text="请选择左侧策略"
            @retry="loadInfo"
          >
            <dl class="detail-list">
              <dt>策略名称</dt>
              <dd>{{ info.strategyName || info.name || selected.strategyName || selected.name || selected.strategyCode || '—' }}</dd>
              <dt>所属渠道</dt>
              <dd>{{ info.channelName || selected.channelName || info.channel || selected.channel || '—' }}</dd>
              <dt>策略级别</dt>
              <dd>{{ info.level || '—' }}</dd>
              <dt>客群口径</dt>
              <dd>{{ info.caliber || '—' }}</dd>
            </dl>
          </review-state>
        </div>
        <div class="card chart-card">
          <div class="sub-title">策略产能</div>
          <p v-if="query.tabType === 'passive'" class="muted simulation-note">{{ passiveNote }}</p>
          <review-state
            :state="panels.trend"
            :empty="!visibleTrend.months.length"
            :empty-text="selected.strategyId ? '暂无策略产能' : '请选择左侧策略'"
            @retry="loadTrend"
            ><e-chart :option="trendOption" height="210px"
          /></review-state>
        </div>
        <div class="card chart-card">
          <div class="sub-title">策略拒绝原因</div>
          <review-state
            :state="panels.reject"
            :empty="!reasons.length"
            :empty-text="selected.strategyId ? '暂无拒绝原因数据' : '请选择左侧策略'"
            @retry="loadReject"
            ><e-chart :option="rejectOption" height="210px"
          /></review-state>
        </div>
        <div v-if="!hideBusinessCapacity" class="card">
          <review-table
            title="业务产能明细"
            :reverse-change-colors="isDowngrade"
            :columns="bizColumns"
            :rows="biz"
            :state="panels.biz"
            :page="bizPage"
            :total="bizTotal"
            :page-size="10"
            :empty-text="selected.strategyId ? '暂无业务产能数据' : '请选择左侧策略'"
            @page="changeBizPage"
            @retry="loadBiz"
          />
        </div>
      </div>
    </div>
    <div class="card daily-card">
      <review-table
        ref="dailyTable"
        title="执行明细（分日）"
        tools
        :reverse-change-colors="isDowngrade"
        :exporting="exportingDaily"
        :columns="dailyColumns"
        :rows="daily"
        :state="panels.daily"
        :page="dailyPage"
        :page-size="10"
        :total="dailyTotal"
        :empty-text="selected.strategyId ? '当前月份暂无执行明细' : '请选择上方策略'"
        @page="changeDailyPage"
        @export-all="exportAllDaily"
        @retry="loadDaily"
      >
        <div slot="filters" class="toolbar daily-toolbar">
          <div class="seg">
            <button class="seg-btn" aria-pressed="true">策略执行情况（分日）</button>
          </div>
          <span class="spacer" /><span class="muted selected-name">{{
            selected.strategyName || selected.name || selected.strategyCode || '未选择策略'
          }}</span>
        </div>
      </review-table>
    </div>
  </section>
</template>
<script>
import { Message } from 'element-ui'
import {
  getStrategyCategoryOptions,
  getStrategyList,
  getStrategyInfo,
  getStrategyCapacityTrend,
  getStrategyBizCapacity,
  getStrategyDailyDetail,
  getStrategyRejectReason,
} from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewState from './ReviewState.vue'
import ReviewTable from './ReviewTable.vue'
import { listOf, percentText, strategyColumns, controlStrategyColumns, strategyBizColumns, categoryLabelColumns, barLineOption, monthRange, panelRequests, recentMonthRows } from './reviewData'
import { passiveDataNote } from './simulationTrend'

function dailyDisplayRange(month) {
  return monthRange(month)
}
import { fetchAllPagedRows } from './fetchAllPagedRows'

function defaultStrategySort(query) {
  return query.tabType === 'active' && ['升接', '稳'].includes(query.strategyClass)
    ? { sortField: 'usageCount', sortDir: 'desc' }
    : {}
}

export default {
  name: 'StockDetail',
  components: { EChart, ReviewState, ReviewTable },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true } },
  data() {
    return {
      strategies: [],
      total: 0,
      page: 1,
      exportingStrategies: false,
      exportingDaily: false,
      selected: {},
      info: {},
      trend: {},
      reasons: [],
      biz: [],
      bizTotal: 0,
      bizPage: 1,
      daily: [],
      dailyTotal: 0,
      dailyPage: 1,
      dailyRange: dailyDisplayRange(this.query.statMonth),
      draftName: '',
      strategyName: '',
      categoryRows: [],
      draftBigCategory: '',
      draftSmallCategory: '',
      bigCategory: '',
      smallCategory: '',
      sort: defaultStrategySort(this.query),
    }
  },
  computed: {
    isDowngrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === '降拆'
    },
    hideBusinessCapacity() {
      return this.query.tabType === 'active' && ['降拆', '离'].includes(this.query.strategyClass)
    },
    columns() {
      const columns = this.query.tabType === 'control'
        ? controlStrategyColumns
        : strategyColumns.filter((column) => column.prop !== 'strategyClass')
      const labeledColumns = categoryLabelColumns(columns, this.query)
      const channel = String(this.query.channel || '').replace(/[\s-]/g, '')
      const hideLobbyMetrics = this.query.tabType === 'active' && (
        (this.query.strategyClass === '升接' && channel.includes('营业厅')) ||
        (this.query.strategyClass === '稳' && (channel.includes('营业厅') || channel.includes('线下')))
      )
      const visibleColumns = hideLobbyMetrics
        ? labeledColumns.filter((column) => !['usageCount', 'usageRate', 'reachCount'].includes(column.prop))
        : labeledColumns
      if (this.query.tabType === 'active' && ['升接', '稳', '重点客群'].includes(this.query.strategyClass)) {
        return [...visibleColumns, { prop: 'actualIncome', label: '收入(元)' }]
      }
      return visibleColumns
    },
    bizColumns() {
      return this.query.tabType === 'control'
        ? strategyBizColumns.map(c => c.prop === 'count' ? { ...c, label: '转化量' } : c)
        : categoryLabelColumns(strategyBizColumns, this.query)
    },
    bigCategories() {
      return [...new Set(this.categoryRows.map((row) => row.bigCategory).filter(Boolean))]
    },
    smallCategories() {
      return [
        ...new Set(
          this.categoryRows
            .filter((row) => !this.draftBigCategory || row.bigCategory === this.draftBigCategory)
            .map((row) => row.smallCategory)
            .filter(Boolean),
        ),
      ]
    },
    dailyColumns() {
      const columns = this.columns
        .filter(column => this.query.tabType !== 'control' || column.prop !== 'income')
        .map((column) => ({ ...column, link: false }))
      return [{ prop: 'date', label: '日期', text: true }, ...columns.filter((column) => column.prop !== 'date')]
    },
    visibleTrend() {
      const trend = this.trend
      const rows = recentMonthRows((trend.months || []).map((month, index) => ({
        month,
        capacity: (trend.capacity || [])[index],
        qoq: (trend.qoq || [])[index],
      })), this.query.statMonth)
      return {
        ...trend,
        months: rows.map(row => row.month),
        capacity: rows.map(row => row.capacity),
        qoq: rows.map(row => row.qoq),
      }
    },
    trendOption() {
      const trend = this.visibleTrend
      const metricName = this.query.tabType === 'active' && ['升接', '稳', '降拆'].includes(this.query.strategyClass)
        ? '成功量'
        : '产能'
      return barLineOption(trend.months, trend.capacity, trend.qoq, metricName, trend.unit || '', {
        integerBarLabels: true,
      })
    },
    passiveNote() {
      return passiveDataNote(this.query)
    },
    rejectOption() {
      return {
        color: ['#3b82f6', '#5ac4d1', '#94a3b8', '#a78bfa', '#f6bd60', '#6ee7b7'],
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params) =>
            `${params.name}<br/>${params.data.ratio == null ? params.percent : params.data.ratio}%`,
        },
        series: [
          {
            type: 'pie',
            radius: ['34%', '57%'],
            center: ['50%', '52%'],
            avoidLabelOverlap: true,
            label: {
              color: '#86909c',
              fontSize: 10,
              formatter: (params) => {
                const name = params.name.length > 6 ? params.name.slice(0, 6) + '…' : params.name
                return `${name} ${percentText(params.data.ratio == null ? params.percent : params.data.ratio)}`
              },
            },
            labelLine: { length: 8, length2: 5 },
            data: this.reasons.map((r) => ({
              name: r.reasonName,
              value: r.rejectCount == null ? r.ratio : r.rejectCount,
              ratio: r.ratio,
              itemStyle: r.color ? { color: r.color } : undefined,
            })),
          },
        ],
      }
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.page = 1
        this.sort = defaultStrategySort(this.query)
        this.dailyRange = dailyDisplayRange(this.query.statMonth)
        this.resetCategoryFilters()
        this.clearDetails()
        this.loadList()
        this.loadCategoryOptions()
      },
    },
  },
  created() {
    this.loadList()
    this.loadCategoryOptions()
  },
  methods: {
    params(extra = {}) {
      return { ...this.query, strategyId: this.selected.strategyId, channel: this.selected.channel || null, ...extra }
    },
    clearDetails() {
      for (const key of ['info', 'trend', 'reject', 'biz', 'daily']) {
        this.requestVersions[key] = (this.requestVersions[key] || 0) + 1
        this.$set(this.panels, key, {})
      }
      this.selected = {}
      this.info = {}
      this.trend = {}
      this.reasons = []
      this.biz = []
      this.bizTotal = 0
      this.daily = []
      this.dailyTotal = 0
    },
    resetCategoryFilters() {
      this.draftBigCategory = ''
      this.draftSmallCategory = ''
      this.bigCategory = ''
      this.smallCategory = ''
    },
    loadCategoryOptions() {
      this.categoryRows = []
      return this.request(
        'categoryOptions',
        () => getStrategyCategoryOptions({ ...this.query, bigCategory: '', smallCategory: '' }),
        (result) => {
          this.categoryRows = listOf(result)
        },
      )
    },
    loadList() {
      return this.request(
        'list',
        () => getStrategyList(this.strategyListParams(this.page, 10)),
        (result) => {
          this.strategies = listOf(result)
          this.total = Number(result && result.total) || 0
          const lastPage = Math.max(1, Math.ceil(this.total / 10))
          if (this.page > lastPage) {
            this.page = lastPage
            this.$nextTick(() => this.loadList())
            return
          }
          if (!this.selected.strategyId && this.strategies.length) this.selectStrategy(this.strategies[0])
        },
      )
    },
    strategyListParams(pageNum, pageSize) {
      return {
        ...this.query,
        strategyName: this.strategyName,
        bigCategory: this.bigCategory || null,
        smallCategory: this.smallCategory || null,
        pageNum,
        pageSize,
        ...this.sort,
      }
    },
    async exportAllStrategies() {
      if (this.exportingStrategies || !this.total) return
      this.exportingStrategies = true
      const pageSize = 500
      const params = this.strategyListParams(1, pageSize)
      try {
        const rows = await fetchAllPagedRows(
          (pageNum, requestedPageSize) => getStrategyList({ ...params, pageNum, pageSize: requestedPageSize }),
          this.total,
          pageSize,
        )
        if (this.$refs.strategyTable) this.$refs.strategyTable.exportRows(rows)
      } catch (error) {
        if (error && error.message === '导出数据未完整加载，请重试') {
          Message.error(error.message)
        }
      } finally {
        this.exportingStrategies = false
      }
    },
    async exportAllDaily() {
      if (this.exportingDaily || !this.selected.strategyId || !this.dailyTotal) return
      this.exportingDaily = true
      const pageSize = 500
      const params = this.params({ startDate: this.dailyRange[0], endDate: this.dailyRange[1] })
      try {
        const rows = await fetchAllPagedRows(
          (pageNum, requestedPageSize) => getStrategyDailyDetail({ ...params, pageNum, pageSize: requestedPageSize }),
          this.dailyTotal,
          pageSize,
        )
        if (this.$refs.dailyTable) this.$refs.dailyTable.exportRows(rows)
      } catch (error) {
        if (error && error.message === '导出数据未完整加载，请重试') {
          Message.error(error.message)
        }
      } finally {
        this.exportingDaily = false
      }
    },
    selectStrategy(row) {
      if (!row.strategyId) return
      this.clearDetails()
      this.selected = row
      this.bizPage = 1
      this.dailyPage = 1
      this.loadInfo()
      this.loadTrend()
      this.loadReject()
      this.loadBiz()
      this.loadDaily()
    },
    search() {
      this.strategyName = this.draftName.trim()
      this.bigCategory = this.draftBigCategory
      this.smallCategory = this.draftSmallCategory
      this.page = 1
      this.clearDetails()
      this.loadList()
    },
    resetSearch() {
      this.draftName = ''
      this.resetCategoryFilters()
      this.search()
    },
    changePage(page) {
      this.page = page
      this.loadList()
    },
    changeSort(sort) {
      this.sort = sort
      this.page = 1
      this.loadList()
    },
    loadInfo() {
      if (this.selected.strategyId)
        return this.request(
          'info',
          () => getStrategyInfo(this.params()),
          (result) => {
            this.info = result || {}
          },
        )
    },
    loadTrend() {
      if (this.selected.strategyId)
        return this.request(
          'trend',
          () => getStrategyCapacityTrend(this.params(
            {
              ...(this.query.tabType === 'active' && ['升接', '稳'].includes(this.query.strategyClass)
                ? { bigCategory: this.selected.bigCategory, smallCategory: this.selected.smallCategory }
                : {}),
              ...(this.query.tabType === 'active' && this.query.strategyClass === '降拆'
                ? { metricCode: 'reachCount' }
                : {}),
            },
          )),
          (result) => {
            this.trend = result || {}
          },
        )
    },
    loadReject() {
      if (this.selected.strategyId)
        return this.request(
          'reject',
          () => getStrategyRejectReason(this.params()),
          (result) => {
            this.reasons = (result && result.reasons) || []
          },
        )
    },
    loadBiz() {
      if (this.hideBusinessCapacity) return
      if (this.selected.strategyId)
        return this.request(
          'biz',
          () => getStrategyBizCapacity(this.params({ pageNum: this.bizPage, pageSize: 10 })),
          (result) => {
            this.biz = listOf(result)
            this.bizTotal = Number(result && result.total) || 0
          },
        )
    },
    loadDaily() {
      if (!this.selected.strategyId) return
      return this.request(
        'daily',
        () =>
          getStrategyDailyDetail(
            this.params({
              startDate: this.dailyRange[0],
              endDate: this.dailyRange[1],
              pageNum: this.dailyPage,
              pageSize: 10,
            }),
          ),
        (result) => {
          this.daily = listOf(result)
          this.dailyTotal = Number(result && result.total) || 0
        },
      )
    },
    changeBizPage(page) {
      this.bizPage = page
      this.loadBiz()
    },
    changeDailyPage(page) {
      this.dailyPage = page
      this.loadDaily()
    },
  },
}
</script>
