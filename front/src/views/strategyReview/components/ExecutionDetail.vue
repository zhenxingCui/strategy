<template>
  <section class="card execution-detail" :class="{ 'is-highlight': highlight }">
    <div class="card-header">
      <div class="card-title">
        <span class="card-title-dot"></span>
        策略执行详情
        <span v-if="strategyInfo.name" class="strategy-tag">{{ strategyInfo.name }}</span>
      </div>
    </div>

    <div class="card-body">
      <div class="three-col-grid">
        <div class="col-left">
          <div class="detail-card">
            <div class="detail-card-title">
              <span class="detail-dot blue"></span>
              策略详情
            </div>
            <div class="strategy-info-list" v-loading="infoLoading">
              <div class="info-row"><span class="info-lbl">策略名称</span><span class="info-val bold">{{ strategyInfo.name || '--' }}</span></div>
              <div class="info-row"><span class="info-lbl">所属渠道</span><span class="info-val">{{ strategyInfo.channel || '--' }}</span></div>
              <div class="info-row"><span class="info-lbl">策略级别</span><span class="info-val">{{ strategyInfo.level || '--' }}</span></div>
              <div class="info-row"><span class="info-lbl">客群口径</span><span class="info-val blue">{{ strategyInfo.caliber || '--' }}</span></div>
              <!-- 需求：隐藏迭代次数行（保留代码便于恢复）
              <div class="info-row"><span class="info-lbl">迭代次数</span><span class="info-val">{{ strategyInfo.iteration || '--' }}</span></div>
              -->
              <div class="info-row"><span class="info-lbl">创建时间</span><span class="info-val">{{ strategyInfo.createTime || '--' }}</span></div>
            </div>
          </div>

          <div class="detail-card reject-card">
            <div class="detail-card-title">
              <span class="detail-dot orange"></span>
              策略拒绝原因
            </div>
            <div class="reject-chart-wrap">
              <e-chart v-if="rejectData.reasons && rejectData.reasons.length > 0" :option="rejectChartOption" :height="rejectChartH + 'px'" v-loading="rejectLoading" />
              <div v-else class="no-reject-data">暂无拒绝原因数据</div>
            </div>
          </div>
        </div>

        <div class="col-mid">
          <div class="detail-card">
            <div class="detail-card-title">
              <span class="detail-dot blue"></span>
              策略产能
            </div>
            <e-chart :option="trendChartOption" height="180px" />
          </div>

          <div class="detail-card biz-card">
            <div class="detail-card-title">
              <span class="detail-dot blue"></span>
              业务产能明细
            </div>
            <div class="biz-table-wrap">
              <el-table
                :data="bizPageData"
                v-loading="bizLoading"
                :show-header="true"
                size="mini"
                :height="bizTableH"
                class="biz-table"
              >
                <el-table-column prop="bizName" label="业务" align="left" min-width="90" class-name="biz-name-col" header-align="left" />
                <el-table-column prop="count" label="产能" align="right" width="80" class-name="num-col" header-align="right" />
              </el-table>
            </div>
            <div class="biz-footer">
              <el-pagination
                background
                layout="prev, pager, next"
                :total="bizTotal"
                :page-size="bizPageSize"
                :current-page.sync="bizPage"
                @current-change="handleBizPageChange"
                small
              />
            </div>
          </div>
        </div>

        <div class="col-right">
          <div class="detail-card exec-card">
            <div class="exec-header">
              <div class="detail-card-title exec-title">
                <span class="detail-dot blue"></span>
                执行明细
              </div>
              <div class="exec-header-actions">
                <el-button type="text" icon="el-icon-full-screen" @click="showFullscreen = true" class="exec-action-btn" title="全屏查看"></el-button>
                <el-button v-if="activeTab === 'daily'" type="text" icon="el-icon-download" @click="handleExport" class="exec-action-btn">导出</el-button>
              </div>
            </div>
            <div class="exec-tabs-wrap">
              <div class="exec-tabs">
                <div
                  class="exec-tab-item"
                  :class="{ active: activeTab === 'daily' }"
                  @click="activeTab = 'daily'"
                >策略执行情况（分日）</div>
                <div
                  class="exec-tab-item"
                  :class="{ active: activeTab === 'control' }"
                  @click="activeTab = 'control'"
                >对照执行情况（待上线）</div>
              </div>
            </div>

            <div v-if="activeTab === 'daily'" class="exec-table-wrap">
              <div class="exec-table-scroll">
                <el-table
                  :data="dailyPageData"
                  v-loading="dailyLoading"
                  size="mini"
                  :height="dailyTableH"
                  class="daily-table"
                  border
                  :key="'main-' + tabType"
                >
                  <el-table-column label="日期" prop="date" width="90" align="center" header-align="center" fixed />
                  <template v-if="isActivePassive">
                    <el-table-column label="策略大类" prop="bigCategory" width="90" align="center" header-align="center" />
                    <el-table-column label="策略小类" prop="smallCategory" width="90" align="center" header-align="center" />
                    <el-table-column label="策略名称" prop="strategyName" min-width="130" align="left" header-align="left" show-overflow-tooltip />
                    <el-table-column label="推送量" prop="pushCount" width="75" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="使用量" prop="usageCount" width="75" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="使用率" prop="usageRate" width="75" align="right" header-align="right" />
                    <el-table-column label="触达量" prop="reachCount" width="75" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="目标转化量" prop="targetConvNum" width="90" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="目标转化率" prop="targetConvRate" width="90" align="right" header-align="right" />
                    <el-table-column label="全产品转化量" prop="productConvNum" width="100" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="全产品转化率" prop="productConvRate" width="100" align="right" header-align="right" />
                    <el-table-column label="实际收入(元)" prop="actualIncome" width="100" align="right" header-align="right" :formatter="formatNum" />
                  </template>
                  <template v-else>
                    <el-table-column label="场景大类" prop="bigCategory" width="90" align="center" header-align="center" />
                    <el-table-column label="场景小类" prop="smallCategory" width="110" align="center" header-align="center" />
                    <el-table-column label="策略名称" prop="strategyName" min-width="160" align="left" header-align="left" show-overflow-tooltip />
                    <el-table-column label="咨询量" prop="consultCount" width="80" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="挽留量" prop="retainCount" width="80" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="挽留率" prop="retainRate" width="75" align="right" header-align="right" />
                    <el-table-column label="成功量" prop="successCount" width="80" align="right" header-align="right" :formatter="formatNum" />
                    <el-table-column label="成功率" prop="successRate" width="75" align="right" header-align="right" />
                    <el-table-column label="收入(元)" prop="income" width="90" align="right" header-align="right" :formatter="formatNum" />
                  </template>
                </el-table>
              </div>
              <div class="exec-footer">
                <span class="exec-total">每页{{ dailyPageSize }}条</span>
                <el-pagination
                  background
                  layout="prev, pager, next"
                  :total="dailyTotal"
                  :page-size="dailyPageSize"
                  :current-page.sync="dailyPage"
                  @current-change="handleDailyPageChange"
                  small
                />
              </div>
            </div>

            <div v-else class="empty-control-tab">
              <i class="el-icon-info"></i>
              <span>对照执行情况功能待上线</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 全屏弹窗 -->
    <el-dialog
      :visible.sync="showFullscreen"
      fullscreen
      append-to-body
      custom-class="exec-fullscreen-dialog"
      :show-close="false"
    >
      <div class="fullscreen-header">
        <div class="fullscreen-title">
          <span class="detail-dot blue"></span>
          策略执行情况（分日）
          <span v-if="strategyInfo.name" class="strategy-tag">{{ strategyInfo.name }}</span>
        </div>
        <div class="fullscreen-actions">
          <el-button type="text" icon="el-icon-download" @click="handleExport" class="exec-action-btn">导出</el-button>
          <el-button type="text" icon="el-icon-close" @click="showFullscreen = false" class="exec-action-btn close-btn">关闭</el-button>
        </div>
      </div>
      <div class="fullscreen-tabs">
        <div class="exec-tabs">
          <div
            class="exec-tab-item"
            :class="{ active: activeTab === 'daily' }"
            @click="activeTab = 'daily'"
          >策略执行情况（分日）</div>
          <div
            class="exec-tab-item"
            :class="{ active: activeTab === 'control' }"
            @click="activeTab = 'control'"
          >对照执行情况（待上线）</div>
        </div>
      </div>
      <div v-if="activeTab === 'daily'" class="fullscreen-table-wrap">
        <el-table
          :data="dailyDetail"
          v-loading="dailyLoading"
          size="mini"
          :max-height="tableMaxHeight"
          :empty-text="dailyEmptyText"
          class="daily-table fullscreen-table"
          border
          :key="'daily-' + tabType"
          style="width:100%"
        >
          <el-table-column label="日期" prop="date" width="90" align="center" header-align="center" />
          <template v-if="isActivePassive">
            <el-table-column label="策略大类" prop="bigCategory" width="80" align="center" header-align="center" />
            <el-table-column label="策略小类" prop="smallCategory" width="80" align="center" header-align="center" />
            <el-table-column label="策略名称" prop="strategyName" min-width="100" align="left" header-align="left" show-overflow-tooltip />
            <el-table-column label="推送量" prop="pushCount" width="65" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="使用量" prop="usageCount" width="65" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="使用率" prop="usageRate" width="65" align="right" header-align="right" />
            <el-table-column label="触达量" prop="reachCount" width="65" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="目标转化量" prop="targetConvNum" width="80" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="目标转化率" prop="targetConvRate" width="80" align="right" header-align="right" />
            <el-table-column label="全产品转化量" prop="productConvNum" width="90" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="全产品转化率" prop="productConvRate" width="90" align="right" header-align="right" />
            <el-table-column label="实际收入" prop="actualIncome" width="80" align="right" header-align="right" :formatter="formatNum" />
          </template>
          <template v-else>
            <el-table-column label="场景大类" prop="bigCategory" width="80" align="center" header-align="center" />
            <el-table-column label="场景小类" prop="smallCategory" width="80" align="center" header-align="center" />
            <el-table-column label="策略名称" prop="strategyName" min-width="100" align="left" header-align="left" show-overflow-tooltip />
            <el-table-column label="咨询量" prop="consultCount" width="70" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="挽留量" prop="retainCount" width="70" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="挽留率" prop="retainRate" width="65" align="right" header-align="right" />
            <el-table-column label="成功量" prop="successCount" width="70" align="right" header-align="right" :formatter="formatNum" />
            <el-table-column label="成功率" prop="successRate" width="65" align="right" header-align="right" />
            <el-table-column label="收入(元)" prop="income" width="80" align="right" header-align="right" :formatter="formatNum" />
          </template>
        </el-table>
      </div>
      <div v-else class="fullscreen-empty">
        <i class="el-icon-info"></i>
        <span>对照执行情况功能待上线</span>
      </div>
    </el-dialog>
  </section>
</template>

<script>
import EChart from '@/components/EChart.vue'
import {
  getStrategyInfo,
  getStrategyCapacityTrend,
  getStrategyBizCapacity,
  getStrategyRejectReason,
  getStrategyDailyDetail
} from '@/api/strategyReview'
import { getCityId, getUserId } from '@/utils/auth'
import { chartRows, percentText } from '../active/reviewData'
import { exportTableToCsv } from '../utils/csvExport'

const REJECT_COLORS = ['#3b6cb5', '#e67e22', '#f1c40f', '#5aad3e', '#95a5a6']

// 统一解包后端响应列表
function extractList (res) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.list)) return res.list
  if (res && Array.isArray(res.data)) return res.data
  if (res && res.data && Array.isArray(res.data.list)) return res.data.list
  if (res && res.result && Array.isArray(res.result)) return res.result
  return []
}
function extractTotal (res, list) {
  if (res && typeof res.total === 'number') return res.total
  if (res && res.data && typeof res.data.total === 'number') return res.data.total
  return (list || []).length
}

export default {
  name: 'ExecutionDetail',
  components: { EChart },
  props: {
    tabType: { type: String, default: 'active' },
    dateRange: { type: Array, default: () => [] },
    activeStrategy: { type: Object, default: () => ({ name: null, channel: null, strategyId: null }) }
  },
  data () {
    return {
      highlight: false,
      infoLoading: false,
      rejectLoading: false,
      bizLoading: false,
      dailyLoading: false,
      activeTab: 'daily',
      strategyInfo: {},
      capacityTrend: { months: [], capacity: [], mom: [] },
      rejectData: { rejectRate: null, rejectCount: null, reasons: [] },
      bizCapacity: [],
      bizPage: 1,
      bizPageSize: 5,
      bizTotal: 0,
      dailyDetail: [],
      dailyPage: 1,
      dailyPageSize: 10,
      dailyTotal: 0,
      showFullscreen: false,
      tableMaxHeight: 600,
      rejectChartH: 200,
      bizTableH: 200,
      dailyTableH: 300,
      highlightTimer: null
    }
  },
  computed: {
    isActivePassive () {
      return this.tabType === 'active' || this.tabType === 'passive'
    },
    bizPageData () {
      // 后端已按 pageNum/pageSize 服务端分页，接口返回的即当前页数据
      return this.bizCapacity
    },
    dailyPageData () {
      return this.dailyDetail
    },
    // 执行明细空态提示：带上日期范围，便于识别时间口径缺口
    dailyEmptyText () {
      const [startDate, endDate] = this.dateRange || []
      if (startDate && endDate) return `${startDate} ~ ${endDate} 内暂无执行明细数据`
      return '暂无执行明细数据'
    },
    trendChartOption () {
      const { months, capacity, mom } = this.capacityTrend
      const points = chartRows(months, capacity, mom)
      if (!points.months.length) {
        // 空态提示：区分"无数据"与渲染异常，避免白图
        return {
          title: {
            text: '暂无数据',
            left: 'center',
            top: 'middle',
            textStyle: { color: '#8c8c8c', fontSize: 13, fontWeight: 400 }
          }
        }
      }
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['策略产能', '环比'], top: 0, right: 0, itemWidth: 10, itemHeight: 6, textStyle: { fontSize: 9, color: '#595959' } },
        grid: { left: 36, right: 36, top: 24, bottom: 18 },
        xAxis: { type: 'category', data: points.months, axisLine: { lineStyle: { color: '#e5e7eb' } }, axisTick: { show: false }, axisLabel: { fontSize: 9, color: '#8c8c8c' } },
        yAxis: [
          { type: 'value', position: 'left', splitLine: { lineStyle: { color: '#f0f2f5', type: 'dashed' } }, axisLabel: { fontSize: 9, color: '#8c8c8c' } },
          { type: 'value', position: 'right', splitLine: { show: false }, axisLabel: { fontSize: 9, color: '#8c8c8c', formatter: '{value}%' } }
        ],
        series: [
          {
            name: '策略产能',
            type: 'bar',
            data: points.values,
            barWidth: 12,
            itemStyle: {
              color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#60a5fa' }, { offset: 1, color: '#2563eb' }] },
              borderRadius: [2, 2, 0, 0]
            }
          },
          {
            name: '环比',
            type: 'line',
            yAxisIndex: 1,
            data: points.comparison,
            smooth: true,
            symbol: 'circle',
            symbolSize: 4,
            lineStyle: { width: 2, color: '#F59E0B' },
            itemStyle: { color: '#F59E0B' },
            label: {
              formatter: (p) => p.value == null ? '' : (p.value >= 0 ? '+' : '') + p.value + '%'
            }
          }
        ]
      }
    },
    rejectChartOption () {
      const { reasons, rejectRate } = this.rejectData
      if (!reasons || !reasons.length) {
        return { series: [] }
      }
      const pieData = reasons.map((r, i) => ({
        name: r.reasonName,
        value: r.ratio,
        itemStyle: { color: r.color || REJECT_COLORS[i % REJECT_COLORS.length] }
      }))
      return {
        tooltip: {
          trigger: 'item',
          formatter: (p) => `${p.name}<br/>占比: ${p.value}%`
        },
        // 需求：隐藏环形图中心的拒绝率文字（保留代码便于恢复）
        graphic: [
          // {
          //   type: 'text',
          //   left: 'center',
          //   top: '38%',
          //   style: {
          //     text: (rejectRate != null ? rejectRate.toFixed(1) : '0') + '%',
          //     fontSize: 18,
          //     fontWeight: 'bold',
          //     fill: '#2563eb',
          //     textAlign: 'center'
          //   }
          // },
          // {
          //   type: 'text',
          //   left: 'center',
          //   top: '52%',
          //   style: {
          //     text: '拒绝率',
          //     fontSize: 10,
          //     fill: '#9ca3af',
          //     textAlign: 'center'
          //   }
          // }
        ],
        series: [
          {
            name: '拒绝原因',
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            label: {
              show: true,
              position: 'outside',
              fontSize: 9,
              color: '#595959',
              formatter: (p) => `${p.name} ${percentText(p.value)}`
            },
            labelLine: {
              show: true,
              length: 5,
              length2: 6,
              lineStyle: { color: '#d9d9d9', width: 1 }
            },
            data: pieData
          }
        ]
      }
    }
  },
  watch: {
    tabType () {
      this.activeTab = 'daily'
      // 重置数据，等待 activeStrategy 更新后再加载（避免用旧 tab 的 strategyId 请求）
      this.strategyInfo = {}
      this.capacityTrend = { months: [], capacity: [], mom: [] }
      this.rejectData = { rejectRate: null, rejectCount: null, reasons: [] }
      this.bizCapacity = []
      this.dailyDetail = []
      this.dailyTotal = 0
      this.bizTotal = 0
      this.bizPage = 1
      this.dailyPage = 1
      // 不在此处调用 fetchAll()，等待 activeStrategy watcher 触发加载
      // 因为 tab 切换时，父组件需要先获取新 tab 的策略列表，然后自动选中第一条，
      // 再通过 $emit 通知父组件更新 activeStrategy，此时 activeStrategy 还是旧值
    },
    dateRange () {
      this.bizPage = 1
      this.dailyPage = 1
      this.fetchAll()
    },
    activeTab () {
      this.calcTableHeights()
    },
    activeStrategy (val, oldVal) {
      // 用 strategyId + name + channel 组合作为唯一 key，避免同一 strategyId 不同渠道时联动失效
      const newKey = val ? `${val.strategyId || ''}_${val.name || ''}_${val.channel || ''}` : null
      const oldKey = oldVal ? `${oldVal.strategyId || ''}_${oldVal.name || ''}_${oldVal.channel || ''}` : null
      if (newKey === oldKey || !newKey || newKey === '___') return
      // auto: 列表加载后自动选中（非用户点击），不滚动定位
      if (!val.auto) this.triggerHighlight()
      this.bizPage = 1
      this.dailyPage = 1
      this.fetchAll()
    },
    showFullscreen (val) {
      if (val) {
        this.calcTableHeight()
        window.addEventListener('resize', this.calcTableHeight)
      } else {
        window.removeEventListener('resize', this.calcTableHeight)
      }
    }
  },
  mounted () {
    this.fetchAll()
    this.$nextTick(() => { this.calcTableHeights() })
  },
  beforeDestroy () {
    if (this.highlightTimer) clearTimeout(this.highlightTimer)
    window.removeEventListener('resize', this.calcTableHeight)
  },
  methods: {
    // 千分位格式化：推送量、收入等大数字便于阅读；比率/字符串原样返回
    // 兼容两种调用：el-table :formatter 传 (row, column, cellValue)，模板直传单值
    formatNum (row, column, cellValue) {
      const value = arguments.length >= 3 ? cellValue : row
      if (value === null || value === undefined || value === '') return '--'
      const num = Number(value)
      if (Number.isNaN(num)) return value
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
    },
    calcTableHeights () {
      this.$nextTick(() => {
        // 拒绝原因图表高度
        const rejectWrap = this.$el.querySelector('.reject-chart-wrap')
        if (rejectWrap) {
          this.rejectChartH = Math.max(rejectWrap.offsetHeight, 100)
        }
        // 业务产能表格高度
        const bizWrap = this.$el.querySelector('.biz-table-wrap')
        if (bizWrap) {
          this.bizTableH = Math.max(bizWrap.offsetHeight, 80)
        }
        // 执行明细表格高度
        const execScroll = this.$el.querySelector('.exec-table-scroll')
        if (execScroll) {
          this.dailyTableH = Math.max(execScroll.offsetHeight, 120)
        }
      })
    },
    calcTableHeight () {
      this.tableMaxHeight = window.innerHeight - 140
    },
    triggerHighlight () {
      this.highlight = true
      if (this.highlightTimer) clearTimeout(this.highlightTimer)
      this.highlightTimer = setTimeout(() => { this.highlight = false }, 1800)
    },
    // 公共参数：仅 tabType + strategyId（API.md 4.1/4.2/4.5 要求）
    buildParams () {
      const sid = this.activeStrategy.strategyId || null
      return {
        tabType: this.tabType,
        strategyId: sid,
        strategyClass: this.activeStrategy.strategyClass || null,
        channel: this.activeStrategy.channel || null,
        // 登录身份透传：后端按 city_id/user_id 过滤
        cityId: getCityId(),
        userId: getUserId()
      }
    },
    // 业务产能（4.3）：需要 statMonth（取全局日期范围起始月 yyyy-MM）
    buildBizParams () {
      const [startDate] = this.dateRange || []
      return {
        ...this.buildParams(),
        statMonth: (startDate || '').slice(0, 7),
        pageNum: this.bizPage,
        pageSize: this.bizPageSize
      }
    },
    // 分日明细（4.4）：需要日期范围 yyyy-MM-dd
    buildDailyParams () {
      const [startDate, endDate] = this.dateRange || []
      return {
        ...this.buildParams(),
        startDate: startDate || '',
        endDate: endDate || '',
        pageNum: this.dailyPage,
        pageSize: this.dailyPageSize
      }
    },
    async fetchAll () {
      await Promise.all([
        this.fetchStrategyInfo(),
        this.fetchCapacityTrend(),
        this.fetchRejectReason(),
        this.fetchBizCapacity(),
        this.fetchDailyDetail()
      ])
      this.calcTableHeights()
    },
    async fetchStrategyInfo () {
      const defaultInfo = { name: this.activeStrategy.name || '', channel: this.activeStrategy.channel || '' }
      if (!this.activeStrategy.strategyId) {
        this.strategyInfo = defaultInfo
        return
      }
      this.infoLoading = true
      try {
        const params = this.buildParams()
        const res = await getStrategyInfo(params)
        if (res && typeof res === 'object') {
          if (Array.isArray(res)) {
            this.strategyInfo = res.length > 0 ? { ...defaultInfo, ...res[0] } : defaultInfo
          } else if (res.data && typeof res.data === 'object') {
            this.strategyInfo = { ...defaultInfo, ...res.data }
          } else if (res.list && Array.isArray(res.list)) {
            this.strategyInfo = res.list.length > 0 ? { ...defaultInfo, ...res.list[0] } : defaultInfo
          } else {
            this.strategyInfo = { ...defaultInfo, ...res }
          }
        } else {
          this.strategyInfo = defaultInfo
        }
      } catch (e) {
        console.error('[ExecutionDetail] getStrategyInfo error:', e)
        this.strategyInfo = { name: this.activeStrategy.name || '', channel: this.activeStrategy.channel || '' }
      } finally {
        this.infoLoading = false
      }
    },
    async fetchCapacityTrend () {
      if (!this.activeStrategy.strategyId) {
        this.capacityTrend = { months: [], capacity: [], mom: [] }
        return
      }
      try {
        let res = await getStrategyCapacityTrend(this.buildParams())
        // 兼容 { data: {...} } 包装（与 extractList 容错风格一致）
        if (res && res.data && !Array.isArray(res)) res = res.data
        if (res && Array.isArray(res.months) && res.months.length > 0) {
          this.capacityTrend = {
            months: res.months,
            capacity: res.values || res.capacity || [],
            mom: res.qoq || res.mom || []
          }
        } else if (Array.isArray(res) && res.length > 0) {
          const sorted = [...res].reverse()
          this.capacityTrend = {
            months: sorted.map(i => i.month || i.statMonth),
            capacity: sorted.map(i => i.capacity != null ? i.capacity : i.value),
            mom: sorted.map(i => i.mom != null ? i.mom : i.qoq)
          }
        } else if (Array.isArray(res && res.list) && res.list.length > 0) {
          const sorted = [...res.list].reverse()
          this.capacityTrend = {
            months: sorted.map(i => i.month || i.statMonth),
            capacity: sorted.map(i => i.capacity != null ? i.capacity : i.value),
            mom: sorted.map(i => i.mom != null ? i.mom : i.qoq)
          }
        } else {
          this.capacityTrend = { months: [], capacity: [], mom: [] }
        }
      } catch (e) {
        console.error('[ExecutionDetail] getStrategyCapacityTrend error:', e)
        this.capacityTrend = { months: [], capacity: [], mom: [] }
      }
    },
    async fetchRejectReason () {
      if (!this.activeStrategy.strategyId) {
        this.rejectData = { rejectRate: null, rejectCount: null, reasons: [] }
        return
      }
      this.rejectLoading = true
      try {
        const [startDate] = this.dateRange || []
        const res = await getStrategyRejectReason({
          ...this.buildParams(),
          statMonth: (startDate || '').slice(0, 7)
        })
        if (res && Array.isArray(res.reasons) && res.reasons.length > 0) {
          this.rejectData = res
        } else if (Array.isArray(res) && res.length > 0) {
          this.rejectData = { rejectRate: null, rejectCount: null, reasons: res }
        } else if (Array.isArray(res && res.list) && res.list.length > 0) {
          this.rejectData = { rejectRate: res.rejectRate ?? null, rejectCount: res.rejectCount ?? null, reasons: res.list }
        } else {
          this.rejectData = { rejectRate: null, rejectCount: null, reasons: [] }
        }
      } catch (e) {
        console.error('[ExecutionDetail] getStrategyRejectReason error:', e)
        this.rejectData = { rejectRate: null, rejectCount: null, reasons: [] }
      } finally {
        this.rejectLoading = false
      }
    },
    handleBizPageChange () {
      this.fetchBizCapacity()
    },
    async fetchBizCapacity () {
      if (!this.activeStrategy.strategyId) {
        this.bizCapacity = []
        this.bizTotal = 0
        this.bizPage = 1
        return
      }
      this.bizLoading = true
      try {
        const params = this.buildBizParams()
        const res = await getStrategyBizCapacity(params)
        const list = extractList(res)
        this.bizCapacity = list
        this.bizTotal = extractTotal(res, list)
      } catch (e) {
        console.error('[ExecutionDetail] getStrategyBizCapacity error:', e)
        this.bizCapacity = []
        this.bizTotal = 0
        this.bizPage = 1
      } finally {
        this.bizLoading = false
      }
    },
    handleDailyPageChange () {
      this.fetchDailyDetail()
    },
    async fetchDailyDetail () {
      if (!this.activeStrategy.strategyId) {
        this.dailyDetail = []
        this.dailyTotal = 0
        this.dailyPage = 1
        return
      }
      this.dailyLoading = true
      try {
        const params = this.buildDailyParams()
        const res = await getStrategyDailyDetail(params)
        const list = extractList(res)
        this.dailyDetail = list
        this.dailyTotal = extractTotal(res, list)
      } catch (e) {
        console.error('[ExecutionDetail] getStrategyDailyDetail error:', e)
        this.dailyDetail = []
        this.dailyTotal = 0
        this.dailyPage = 1
      } finally {
        this.dailyLoading = false
      }
    },
    handleExport () {
      let columns = []
      let data = this.dailyDetail
      let filename = ''
      if (this.isActivePassive) {
        columns = [
          { label: '日期', prop: 'date' },
          { label: '策略大类', prop: 'bigCategory' },
          { label: '策略小类', prop: 'smallCategory' },
          { label: '策略名称', prop: 'strategyName' },
          { label: '推送量', prop: 'pushCount' },
          { label: '使用量', prop: 'usageCount' },
          { label: '使用率', prop: 'usageRate' },
          { label: '触达量', prop: 'reachCount' },
          { label: '目标转化量', prop: 'targetConvNum' },
          { label: '目标转化率', prop: 'targetConvRate' },
          { label: '全产品转化量', prop: 'productConvNum' },
          { label: '全产品转化率', prop: 'productConvRate' },
          { label: '实际收入(元)', prop: 'actualIncome' }
        ]
        filename = `策略执行情况(分日)_${this.strategyInfo.name || this.tabType}`
      } else {
        columns = [
          { label: '日期', prop: 'date' },
          { label: '场景大类', prop: 'bigCategory' },
          { label: '场景小类', prop: 'smallCategory' },
          { label: '策略名称', prop: 'strategyName' },
          { label: '咨询量', prop: 'consultCount' },
          { label: '挽留量', prop: 'retainCount' },
          { label: '挽留率', prop: 'retainRate' },
          { label: '成功量', prop: 'successCount' },
          { label: '成功率', prop: 'successRate' },
          { label: '收入(元)', prop: 'income' }
        ]
        filename = `策略执行情况(分日)_${this.strategyInfo.name || this.tabType}`
      }
      exportTableToCsv({ columns, data, filename })
    }
  }
}
</script>

<style lang="less" scoped>
@import '../styles/index.less';

.execution-detail {
  background: #fff;
  border-radius: 6px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.3s;
  &.is-highlight {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    .card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      .card-title-dot {
        width: 3px;
        height: 12px;
        background: #2563eb;
        border-radius: 2px;
      }
      .strategy-tag {
        padding: 1px 6px;
        background: #eff6ff;
        color: #2563eb;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
      }
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  .card-body { padding: 10px 12px; }
  .three-col-grid {
    display: grid;
    grid-template-columns: 260px 1fr 2fr;
    gap: 10px;
    min-width: 0;
    align-items: stretch;
  }
  // 表格统一圆角（含边框伪元素，避免直角边框线戳出圆角）
  /deep/ .el-table {
    border-radius: 6px;
    overflow: hidden;
    &.el-table--border::after {
      border-radius: 6px;
    }
  }
  .col-left, .col-mid, .col-right {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .col-right {
    min-width: 0;
  }
  .detail-card {
    background: #f9fafb;
    border-radius: 6px;
    padding: 8px 10px;
  }
  // 上排「策略详情」「策略产能」卡片统一固定高度：
  // col-left / col-mid 是两根独立列，上排高度一致才能让「上排/下排」的水平分界线左右贯通
  .col-left > .detail-card:first-child,
  .col-mid > .detail-card:first-child {
    height: 228px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .reject-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    .reject-chart-wrap {
      flex: 1;
      min-height: 0;
      position: relative;
      > div {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }
    }
    .no-reject-data {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #9ca3af;
    }
  }
  .exec-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 8px 10px;
    .exec-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .exec-title {
      margin-bottom: 0;
    }
    .exec-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .exec-action-btn {
      padding: 0 4px;
      font-size: 13px;
      color: #6b7280;
      &:hover {
        color: #2563eb;
      }
    }
    .exec-tabs-wrap {
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 8px;
    }
    .exec-tabs {
      display: flex;
      gap: 0;
      .exec-tab-item {
        padding: 6px 16px;
        font-size: 12px;
        color: #6b7280;
        cursor: pointer;
        position: relative;
        transition: color 0.15s;
        &:first-child {
          padding-left: 0;
        }
        &:hover {
          color: #2563eb;
        }
        &.active {
          color: #2563eb;
          font-weight: 600;
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: -1px;
            height: 2px;
            background: #2563eb;
          }
          &:first-child::after {
            left: 0;
          }
        }
      }
    }
    .exec-table-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      .exec-table-scroll {
        flex: 1;
        min-height: 0;
        position: relative;
        /deep/ .el-table {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          height: 100% !important;
        }
      }
      .exec-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #f3f4f6;
        flex-shrink: 0;
        .exec-total {
          font-size: 11px;
          color: #9ca3af;
        }
        /deep/ .el-pagination--small { font-size: 11px; }
        /deep/ .btn-prev, /deep/ .btn-next, /deep/ .el-pager li {
          min-width: 22px;
          height: 22px;
          line-height: 22px;
          font-size: 11px;
        }
      }
    }
    .empty-control-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #9ca3af;
      font-size: 12px;
      min-height: 300px;
      i {
        font-size: 32px;
        color: #d1d5db;
      }
    }
  }
  .detail-card-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 6px;
    .detail-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      &.blue { background: #2563eb; }
      &.orange { background: #f59e0b; }
    }
  }
  .strategy-info-list {
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      font-size: 12px;
      border-bottom: 1px dashed #f3f4f6;
      &:last-child { border-bottom: none; }
      .info-lbl { color: #6b7280; }
      .info-val {
        color: #111827;
        font-weight: 500;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        &.bold { font-weight: 700; font-size: 14px; color: #111827; }
        &.blue { color: #2563eb; font-weight: 600; }
      }
    }
  }
  .biz-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    .biz-table-wrap {
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .biz-table {
      /deep/ .el-table {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        height: 100% !important;
      }
      /deep/ .el-table__body-wrapper { overflow-x: hidden; overflow-y: auto; }
      /deep/ .biz-name-col .cell { color: #111827; font-weight: 500; padding-left: 6px; }
      /deep/ .num-col .cell { color: #374151; font-weight: 600; font-size: 12px; }
    }
    .biz-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 4px;
      flex-shrink: 0;
      /deep/ .el-pagination--small { font-size: 11px; }
      /deep/ .btn-prev, /deep/ .btn-next, /deep/ .el-pager li {
        min-width: 22px;
        height: 22px;
        line-height: 22px;
        font-size: 11px;
      }
    }
  }
  .qoq-badge {
    font-size: 12px;
    font-weight: 500;
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
    &.up { color: #10b981; }
    &.down { color: #ef4444; }
  }
  /deep/ .el-table--mini td, /deep/ .el-table--mini th {
    padding: 4px 0;
    font-size: 11px;
  }
  /deep/ .el-table::before { display: none; }
  /deep/ .daily-table {
    /deep/ .el-table__header-wrapper th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    /deep/ .el-table__body td {
      padding: 5px 0;
    }
  }
}
</style>

<style lang="less">
.exec-fullscreen-dialog {
  .el-dialog__header {
    display: none;
  }
  .el-dialog__body {
    padding: 16px 20px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .fullscreen-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    .fullscreen-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      .detail-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #2563eb;
      }
      .strategy-tag {
        padding: 2px 8px;
        background: #eff6ff;
        color: #2563eb;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
    }
    .fullscreen-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      .exec-action-btn {
        font-size: 14px;
        color: #6b7280;
        &:hover { color: #2563eb; }
        &.close-btn {
          margin-left: 8px;
          padding: 4px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 13px;
          &:hover { border-color: #2563eb; color: #2563eb; }
        }
      }
    }
  }
  .fullscreen-tabs {
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 12px;
    .exec-tabs {
      display: flex;
      gap: 0;
      .exec-tab-item {
        padding: 8px 20px;
        font-size: 13px;
        color: #6b7280;
        cursor: pointer;
        position: relative;
        transition: color 0.15s;
        &:first-child { padding-left: 0; }
        &:hover { color: #2563eb; }
        &.active {
          color: #2563eb;
          font-weight: 600;
          &::after {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: -1px;
            height: 2px;
            background: #2563eb;
          }
        }
      }
    }
  }
  .fullscreen-table-wrap {
    flex: 1;
    overflow: hidden;
  }
  .fullscreen-table {
    /deep/ .el-table__header-wrapper th {
      background: #f0f5ff;
      font-weight: 600;
      color: #1f2937;
      font-size: 12px;
      padding: 4px 0;
    }
    /deep/ .el-table__header-wrapper th .cell {
      font-size: 12px;
    }
    /deep/ .el-table__body td {
      font-size: 12px;
      padding: 2px 0;
    }
    /deep/ .el-table__body td .cell {
      font-size: 12px;
    }
    /deep/ .el-table__body-wrapper {
      overflow-x: hidden !important;
    }
  }
  .fullscreen-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #9ca3af;
    font-size: 14px;
    i { font-size: 40px; color: #d1d5db; }
  }
}
</style>
