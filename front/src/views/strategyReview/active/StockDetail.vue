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
        <div v-if="!hideBusinessCapacity" class="card">
          <review-table
            title="业务产能明细"
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
      <p v-if="dailySimulationNote" class="metric-footnote" role="note">{{ dailySimulationNote }}</p>
      <review-table
        title="执行明细（分日）"
        tools
        :columns="dailyColumns"
        :rows="daily"
        :state="panels.daily"
        :page="dailyPage"
        :page-size="10"
        :total="dailyTotal"
        :empty-text="selected.strategyId ? '当前月份暂无执行明细' : '请选择上方策略'"
        @page="changeDailyPage"
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
import { listOf, percentText, strategyColumns, controlStrategyColumns, strategyBizColumns, categoryLabelColumns, barLineOption, monthRange, panelRequests } from './reviewData'
import leaveSimulation from './leaveSimulation.json'
import customerGroupSimulation from './customerGroupSimulation.json'
import incrementalSimulation from './incrementalSimulation.json'
import declineSimulation from './declineSimulation.json'
import { visibleSimulationTrend } from './simulationTrend'

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
    dailySimulationNote() {
      if (this.query.tabType === incrementalSimulation.tabType && this.query.cityId === incrementalSimulation.cityId &&
          incrementalSimulation.dailyStrategyIds.includes(this.selected.strategyId) && this.dailyRange &&
          this.dailyRange[0] <= incrementalSimulation.dailyEndDate && this.dailyRange[1] >= incrementalSimulation.dailyStartDate) {
        return `${incrementalSimulation.dailyStartDate}至${incrementalSimulation.dailyEndDate}为依据月度总量、固定种子星期权重及逐日漏斗上限拆分的模拟日数据；各策略日合计与10月Excel月度数据一致。`
      }
      if (this.query.tabType === customerGroupSimulation.tabType && this.query.cityId === customerGroupSimulation.cityId &&
          this.query.strategyClass === customerGroupSimulation.strategyClass &&
          (!this.query.customerGroup || this.query.customerGroup === customerGroupSimulation.customerGroup) &&
          customerGroupSimulation.dailyStrategyIds.includes(this.selected.strategyId) && this.dailyRange &&
          this.dailyRange[0] <= customerGroupSimulation.dailyEndDate && this.dailyRange[1] >= customerGroupSimulation.dailyStartDate) {
        return `9月及10月1—23日为按月度数据、星期权重和转化漏斗关系模拟的日明细；9月日合计与9月全月一致，10月日合计与Excel截至10月23日数据一致。10月环比比较9月与10月各自1—23日同期累计值。`
      }
      if (this.query.tabType === declineSimulation.tabType && this.query.cityId === declineSimulation.cityId &&
          this.query.strategyClass === declineSimulation.strategyClass && declineSimulation.dailyAvailable === true &&
          this.selected.strategyId && this.dailyRange &&
          this.dailyRange[0] <= declineSimulation.dailyEndDate &&
          this.dailyRange[1] >= declineSimulation.dailyStartDate) {
        return `${declineSimulation.dailyStartDate}至${declineSimulation.dailyEndDate}为按固定种子的工作日/周末权重和最大余数法拆分的模拟日数据；各策略日合计与Excel月度原值一致。派单量为空及成功量大于派单量的来源情况按原值保留，此处为模拟分摊，不代表实际逐日业绩。`
      }
      if (this.query.tabType !== leaveSimulation.tabType || this.query.cityId !== leaveSimulation.cityId ||
          !leaveSimulation.dailyStrategyIds || !leaveSimulation.dailyStrategyIds.includes(this.selected.strategyId) ||
          !this.dailyRange || this.dailyRange[0] > leaveSimulation.dailyEndDate || this.dailyRange[1] < leaveSimulation.dailyStartDate) return ''
      return `${leaveSimulation.dailyStartDate}至${leaveSimulation.dailyEndDate}为依据Excel“分日展示”比例并按漏斗关系校准的模拟日明细；各项日合计与10月月度数据一致，逐日数量满足使用≤推送、触达≤使用、转化≤触达。`
    },
    hideBusinessCapacity() {
      return this.query.tabType === 'active' && ['降拆', '离'].includes(this.query.strategyClass)
    },
    columns() {
      const columns = this.query.tabType === 'control'
        ? controlStrategyColumns
        : strategyColumns.filter((column) => column.prop !== 'strategyClass')
      return categoryLabelColumns(columns, this.query)
    },
    bizColumns() {
      return this.query.tabType === 'control'
        ? strategyBizColumns.map(c => c.prop === 'count' ? { ...c, label: '转化量' } : c)
        : categoryLabelColumns(strategyBizColumns, this.query)
    },
    dailyColumns() {
      const columns = this.columns
        .filter(column => this.query.tabType !== 'control' || column.prop !== 'income')
        .map((column) => ({ ...column, link: false }))
      return [{ prop: 'date', label: '日期', text: true }, ...columns.filter((column) => column.prop !== 'date')]
    },
    trendOption() {
      const trend = visibleSimulationTrend(this.query, this.trend, 'capacity', this.selected.strategyId)
      return barLineOption(trend.months, trend.capacity, trend.qoq, '产能', trend.unit || '')
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
            pageSize: 10,
            ...this.sort,
          }),
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
