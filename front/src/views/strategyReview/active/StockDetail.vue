<template>
  <section class="section detail-section">
    <h2 class="section-title">策略执行明细</h2>
    <div class="split split--m4">
      <div class="card">
        <review-table
          :title="favoritesOnly ? '我的收藏策略' : '策略执行情况（逐策略）'"
          tools
          selectable
          :sortable="!favoritesOnly"
          :columns="columns"
          :rows="strategies"
          :state="panels.list"
          :page="page"
          :total="total"
          :active-id="selected.strategyId"
          @retry="loadList"
          @page="changePage"
          @sort="changeSort"
          @selection="selection = $event"
          @strategy="selectStrategy"
        >
          <button slot="actions" class="btn" :disabled="!selection.length || saving || !!(panels.list && panels.list.loading)" @click="favorite">
            <i class="el-icon-star-off" />{{ favoritesOnly ? '取消收藏选中' : '收藏选中' }}
          </button>
          <div slot="filters" class="toolbar">
            <button class="seg-btn" :aria-pressed="!favoritesOnly ? 'true' : 'false'" :disabled="saving" @click="setFavoritesOnly(false)">全部策略</button>
            <button class="seg-btn" :aria-pressed="favoritesOnly ? 'true' : 'false'" :disabled="saving" @click="setFavoritesOnly(true)">我的收藏</button>
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
          </div>
        </review-table>
      </div>
      <div class="detail-grid">
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
              <dt>创建时间</dt>
              <dd>{{ info.createTime || '—' }}</dd>
            </dl>
          </review-state>
        </div>
        <div class="card chart-card">
          <div class="sub-title">策略产能</div>
          <review-state
            :state="panels.trend"
            :empty="!trend.months || !trend.months.length"
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
        <div class="card">
          <review-table
            title="业务产能明细"
            :columns="bizColumns"
            :rows="biz"
            :state="panels.biz"
            :page="bizPage"
            :total="bizTotal"
            :page-size="5"
            :empty-text="selected.strategyId ? '暂无业务产能数据' : '请选择左侧策略'"
            @page="changeBizPage"
            @retry="loadBiz"
          />
        </div>
      </div>
    </div>
    <div class="card daily-card">
      <review-table
        title="执行明细（分日）"
        tools
        :columns="dailyColumns"
        :rows="daily"
        :state="panels.daily"
        :page="dailyPage"
        :page-size="10"
        :total="dailyTotal"
        :empty-text="selected.strategyId ? '该日期范围暂无执行明细' : '请选择上方策略'"
        @page="changeDailyPage"
        @retry="loadDaily"
      >
        <div slot="filters" class="toolbar daily-toolbar">
          <div class="seg">
            <button class="seg-btn" aria-pressed="true">策略执行情况（分日）</button
            ><button class="seg-btn" disabled title="后端尚未提供对照执行数据接口">对照执行情况（非上线）</button>
          </div>
          <span class="spacer" /><span class="muted selected-name">{{
            selected.strategyName || selected.name || selected.strategyCode || '未选择策略'
          }}</span>
          <el-date-picker
            v-model="dailyRange"
            type="daterange"
            size="mini"
            value-format="yyyy-MM-dd"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            range-separator="至"
            :clearable="false"
            @change="changeDailyRange"
          />
        </div>
      </review-table>
    </div>
  </section>
</template>
<script>
import {
  getStrategyList,
  getStrategyInfo,
  getStrategyCapacityTrend,
  getStrategyBizCapacity,
  getStrategyDailyDetail,
  getStrategyRejectReason,
  addFavorite,
  getFavoriteList,
  removeFavorite,
} from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewState from './ReviewState.vue'
import ReviewTable from './ReviewTable.vue'
import { listOf, strategyColumns, controlStrategyColumns, strategyBizColumns, categoryLabelColumns, barLineOption, monthRange, panelRequests } from './reviewData'

export default {
  name: 'StockDetail',
  components: { EChart, ReviewState, ReviewTable },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true }, externalStrategy: { type: Object, default: null } },
  data() {
    return {
      strategies: [],
      total: 0,
      page: 1,
      selected: {},
      selection: [],
      info: {},
      trend: {},
      reasons: [],
      biz: [],
      bizTotal: 0,
      bizPage: 1,
      daily: [],
      dailyTotal: 0,
      dailyPage: 1,
      dailyRange: monthRange(this.query.statMonth),
      draftName: '',
      strategyName: '',
      sort: {},
      saving: false,
      favoritesOnly: false,
    }
  },
  computed: {
    columns() {
      const columns = this.query.tabType === 'control'
        ? controlStrategyColumns
        : strategyColumns.filter((column) => column.prop !== 'strategyClass')
      return categoryLabelColumns(columns, this.query)
    },
    bizColumns() {
      return this.query.tabType === 'control'
        ? strategyBizColumns.map(c => c.prop === 'count' ? { ...c, label: '成功量' } : c)
        : strategyBizColumns
    },
    dailyColumns() {
      const columns = this.columns
        .filter(column => this.query.tabType !== 'control' || column.prop !== 'income')
        .map((column) => ({ ...column, link: false }))
      return [{ prop: 'date', label: '日期', text: true }, ...columns.filter((column) => column.prop !== 'date')]
    },
    trendOption() {
      return barLineOption(this.trend.months, this.trend.capacity, this.trend.qoq, '产能', this.trend.unit || '')
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
              formatter: (params) => (params.name.length > 6 ? params.name.slice(0, 6) + '…' : params.name),
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
        this.selection = []
        this.dailyRange = monthRange(this.query.statMonth)
        this.clearDetails()
        this.loadList()
      },
    },
    externalStrategy(row) {
      if (row && row.strategyId) this.selectStrategy(row)
    },
  },
  created() {
    this.loadList()
  },
  methods: {
    params(extra = {}) {
      return { ...this.query, strategyId: this.selected.strategyId, ...extra }
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
    loadList() {
      this.selection = []
      return this.request(
        'list',
        () =>
          (this.favoritesOnly ? getFavoriteList : getStrategyList)({
            ...this.query,
            manualOnly: this.favoritesOnly,
            strategyName: this.strategyName,
            pageNum: this.page,
            pageSize: 5,
            ...this.sort,
          }),
        (result) => {
          this.strategies = listOf(result)
          this.total = Number(result && result.total) || 0
          const lastPage = Math.max(1, Math.ceil(this.total / 5))
          if (this.page > lastPage) {
            this.page = lastPage
            this.$nextTick(() => this.loadList())
            return
          }
          if (!this.selected.strategyId && this.strategies.length) this.selectStrategy(this.strategies[0])
        },
      )
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
      this.page = 1
      this.clearDetails()
      this.loadList()
    },
    setFavoritesOnly(value) {
      if (this.favoritesOnly === value) return
      this.favoritesOnly = value
      this.page = 1
      this.clearDetails()
      this.loadList()
    },
    resetSearch() {
      this.draftName = ''
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
          () => getStrategyCapacityTrend(this.params()),
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
      if (this.selected.strategyId)
        return this.request(
          'biz',
          () => getStrategyBizCapacity(this.params({ pageNum: this.bizPage, pageSize: 5 })),
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
    changeDailyRange() {
      this.dailyPage = 1
      this.loadDaily()
    },
    async favorite() {
      if (!this.selection.length || this.saving) return
      const removing = this.favoritesOnly
      this.saving = true
      try {
        await (removing ? removeFavorite : addFavorite)({ ...this.query, strategyIds: this.selection.map((row) => String(row.strategyId)) })
        this.$message.success(removing ? '已取消收藏' : '收藏成功')
        if (removing) {
          this.clearDetails()
          await this.loadList()
        }
      } catch (e) {
        /* 请求拦截器展示错误 */
      } finally {
        this.saving = false
      }
    },
  },
}
</script>
