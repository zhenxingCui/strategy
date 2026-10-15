<template>
  <section class="card auto-warning">
    <div class="card-header">
      <div class="card-title">
        <span class="card-title-dot"></span>
        策略自动预警
      </div>
    </div>

    <div class="card-body two-col-grid">
      <!-- ===== 左侧：历史预警规则 ===== -->
      <div class="left-panel">
        <div class="rule-list-card">
          <div class="rule-list-header">
            <div class="rule-list-title">
              <span class="rule-list-dot"></span>
              历史预警规则
            </div>
            <div class="rule-list-right">
              <span class="rule-count">{{ historyRules.length }} 条</span>
              <el-button type="primary" size="mini" icon="el-icon-plus" @click="openCreateModal">新增规则</el-button>
            </div>
          </div>
          <!-- 筛选栏 -->
          <div class="rule-filter-bar">
            <el-input
              v-model="ruleNameFilterInput"
              placeholder="请输入场景指标名称"
              size="mini"
              clearable
              class="filter-input"
            />
            <el-input
              v-model="userCodeFilterInput"
              placeholder="用户编码"
              size="mini"
              clearable
              class="filter-input filter-input-sm"
            />
            <el-select
              v-model="ruleStatusFilterInput"
              placeholder="全部状态"
              size="mini"
              clearable
              class="filter-select"
            >
              <el-option label="生效中" value="生效中" />
              <el-option label="已过期" value="已过期" />
              <el-option label="已停用" value="已停用" />
            </el-select>
            <el-button type="primary" size="mini" @click="applyFilter">搜索</el-button>
            <el-button size="mini" @click="resetFilter">重置</el-button>
          </div>
          <!-- 规则卡片列表（状态在编辑弹窗中处理，列表不展示状态） -->
          <div class="rule-cards scrollbar-thin">
            <div
              v-for="rule in filteredRules"
              :key="rule.id"
              class="rule-item"
            >
              <div class="rule-item-header">
                <div class="rule-item-left">
                  <span class="rule-item-name" @click="openDetailModal(rule)">{{ rule.ruleName }}</span>
                </div>
                <div class="rule-item-center">
                  <span class="rule-status-tag" :class="rule.statusType">{{ rule.status }}</span>
                </div>
                <div class="rule-item-actions">
                  <i class="el-icon-edit edit-icon" @click="openEditModal(rule)" title="编辑" />
                  <i class="el-icon-delete delete-icon" @click="deleteRule(rule)" title="删除" />
                </div>
              </div>
              <div class="rule-item-desc">{{ rule.desc }}</div>
              <div class="rule-item-meta">
                <span><i class="el-icon-date"></i> {{ rule.startDate && rule.endDate ? rule.startDate + ' ~ ' + rule.endDate : (rule.dateRange || '-') }}</span>
                <span><i class="el-icon-user"></i> {{ rule.createTime || rule.creator }}</span>
              </div>
            </div>
            <div v-if="filteredRules.length === 0" class="rule-empty">暂无规则</div>
          </div>
        </div>
      </div>

      <!-- ===== 右侧：预警策略 + 重点关注策略 ===== -->
      <div class="right-panel">
        <!-- 预警策略 -->
        <div class="strategy-card">
          <div class="strategy-card-header">
            <div class="strategy-card-title">
              <span class="strategy-dot blue"></span>
              预警策略
            </div>
          </div>
          <!-- 动态 tab：根据生效中规则生成 -->
          <div class="inner-tabs">
            <div
              v-for="rule in activeRules"
              :key="'w_' + rule.id"
              class="inner-tab"
              :class="{ active: warningActiveTab === 'rule_' + rule.id }"
              @click="warningActiveTab = 'rule_' + rule.id"
            >{{ rule.ruleName }}</div>
          </div>
          <!-- 表格区域 -->
          <div class="strategy-table-wrap">
            <div class="strategy-table-toolbar">
              <span class="selected-count">已选 {{ warningCheckedCount }} 项</span>
              <el-button
                type="primary"
                size="mini"
                :disabled="warningCheckedCount === 0"
                @click="handleFavFromWarning"
              >☆ 收藏</el-button>
            </div>
            <el-table
              ref="warningTable"
              :data="currentWarningPageData"
              border
              stripe
              size="mini"
              @selection-change="handleWarningSelectionChange"
              class="warning-table"
            >
              <el-table-column type="selection" width="28" />
              <el-table-column prop="statMonth" label="日期" align="left" min-width="90" show-overflow-tooltip />
              <el-table-column prop="channelName" label="触点" align="left" min-width="70" show-overflow-tooltip />
              <template v-if="isActive || isPassive">
                <el-table-column label="策略大类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).bigCategory }}</template>
                </el-table-column>
                <el-table-column label="策略小类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).smallCategory }}</template>
                </el-table-column>
              </template>
              <template v-if="isControl">
                <el-table-column label="场景大类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).bigCategory }}</template>
                </el-table-column>
                <el-table-column label="场景小类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).smallCategory }}</template>
                </el-table-column>
              </template>
              <el-table-column label="策略名称" align="left" min-width="100" show-overflow-tooltip>
                <template slot-scope="{ row }">
                  <span class="strategy-name-link" @click.stop="handleStrategyClick(row)">{{ row.strategyName || row.name }}</span>
                </template>
              </el-table-column>
              <template v-if="isActive || isPassive">
                <el-table-column prop="pushCount" label="推送量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="usageCount" label="使用量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="usageRate" label="使用率" align="right" min-width="60" />
                <el-table-column prop="reachCount" label="触达量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="targetConvNum" label="目标转化量" align="right" min-width="80" :formatter="formatNum" />
                <el-table-column prop="targetConvRate" label="目标转化率" align="right" min-width="80" />
                <el-table-column prop="productConvNum" label="全产品转化量" align="right" min-width="90" :formatter="formatNum" />
                <el-table-column prop="productConvRate" label="全产品转化率" align="right" min-width="90" />
                <el-table-column prop="expectedIncome" label="预期收入(元)" align="right" min-width="90" :formatter="formatNum" />
                <el-table-column prop="actualIncome" label="实际收入(元)" align="right" min-width="90" :formatter="formatNum" />
              </template>
              <template v-else>
                <el-table-column prop="consultCount" label="咨询量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="retainCount" label="挽留量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="retainRate" label="挽留率" align="right" min-width="60" />
                <el-table-column prop="successCount" label="成功量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="successRate" label="成功率" align="right" min-width="60" />
                <el-table-column prop="income" label="收入(元)" align="right" min-width="80" :formatter="formatNum" />
              </template>
            </el-table>
            <div class="table-footer">
              <span>共 {{ warningTotal }} 条，每页 {{ warningPageSize }} 条</span>
              <el-pagination
                background
                layout="prev, pager, next"
                :total="warningTotal"
                :page-size="warningPageSize"
                :current-page.sync="warningPage"
                @current-change="fetchHitStrategies"
                small
              />
            </div>
          </div>
        </div>

        <!-- 重点关注策略 -->
        <div class="strategy-card">
          <div class="strategy-card-header">
            <div class="strategy-card-title">
              <span class="strategy-dot orange"></span>
              重点关注策略
            </div>
          </div>
          <!-- 动态 tab：根据生效中规则 + 其他收藏策略 -->
          <div class="inner-tabs">
            <div
              v-for="rule in activeRules"
              :key="'f_' + rule.id"
              class="inner-tab"
              :class="{ active: focusActiveTab === 'rule_' + rule.id }"
              @click="focusActiveTab = 'rule_' + rule.id"
            >{{ rule.ruleName }}</div>
            <div
              class="inner-tab"
              :class="{ active: focusActiveTab === 'other' }"
              @click="focusActiveTab = 'other'"
            >其他收藏策略</div>
          </div>
          <!-- 表格区域 -->
          <div class="strategy-table-wrap">
            <div class="strategy-table-toolbar">
              <span class="selected-count">已选 {{ focusCheckedCount }} 项</span>
              <el-button
                type="primary"
                size="mini"
                :disabled="focusCheckedCount === 0"
                @click="handleFavFromFocus"
              >取消收藏</el-button>
            </div>
            <el-table
              ref="focusTable"
              :data="currentFocusPageData"
              border
              stripe
              size="mini"
              @selection-change="handleFocusSelectionChange"
              class="warning-table"
            >
              <el-table-column type="selection" width="28" />
              <el-table-column prop="statMonth" label="日期" align="left" min-width="90" show-overflow-tooltip />
              <el-table-column prop="channelName" label="触点" align="left" min-width="70" show-overflow-tooltip />
              <template v-if="isActive || isPassive">
                <el-table-column label="策略大类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).bigCategory }}</template>
                </el-table-column>
                <el-table-column label="策略小类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).smallCategory }}</template>
                </el-table-column>
              </template>
              <template v-if="isControl">
                <el-table-column label="场景大类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).bigCategory }}</template>
                </el-table-column>
                <el-table-column label="场景小类" align="left" min-width="70" show-overflow-tooltip>
                  <template slot-scope="{ row }">{{ getStrategyCategory(row).smallCategory }}</template>
                </el-table-column>
              </template>
              <el-table-column label="策略名称" align="left" min-width="100" show-overflow-tooltip>
                <template slot-scope="{ row }">
                  <span class="strategy-name-link" @click.stop="handleStrategyClick(row)">{{ row.strategyName || row.name }}</span>
                </template>
              </el-table-column>
              <template v-if="isActive || isPassive">
                <el-table-column prop="pushCount" label="推送量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="usageCount" label="使用量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="usageRate" label="使用率" align="right" min-width="60" />
                <el-table-column prop="reachCount" label="触达量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="targetConvNum" label="目标转化量" align="right" min-width="80" :formatter="formatNum" />
                <el-table-column prop="targetConvRate" label="目标转化率" align="right" min-width="80" />
                <el-table-column prop="productConvNum" label="全产品转化量" align="right" min-width="90" :formatter="formatNum" />
                <el-table-column prop="productConvRate" label="全产品转化率" align="right" min-width="90" />
                <el-table-column prop="expectedIncome" label="预期收入(元)" align="right" min-width="90" :formatter="formatNum" />
                <el-table-column prop="actualIncome" label="实际收入(元)" align="right" min-width="90" :formatter="formatNum" />
              </template>
              <template v-else>
                <el-table-column prop="consultCount" label="咨询量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="retainCount" label="挽留量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="retainRate" label="挽留率" align="right" min-width="60" />
                <el-table-column prop="successCount" label="成功量" align="right" min-width="60" :formatter="formatNum" />
                <el-table-column prop="successRate" label="成功率" align="right" min-width="60" />
                <el-table-column prop="income" label="收入(元)" align="right" min-width="80" :formatter="formatNum" />
              </template>
            </el-table>
            <div class="table-footer">
              <span>共 {{ focusTotal }} 条，每页 {{ focusPageSize }} 条</span>
              <el-pagination
                background
                layout="prev, pager, next"
                :total="focusTotal"
                :page-size="focusPageSize"
                :current-page.sync="focusPage"
                @current-change="fetchFocusStrategies"
                small
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 新增/编辑规则弹窗（独立子组件，v-if 按需挂载） ===== -->
    <rule-create-dialog
      v-if="dialogMode"
      :mode="dialogMode"
      :rule="editingRule"
      :tab-type="tabType"
      :channel-options="channelOptions"
      :strategy-options="strategyNameOptions"
      :metric-options="metricOptions"
      @close="dialogMode = ''"
      @created="onRuleCreated"
      @saved="onRuleSaved"
    />

    <!-- ===== 详情弹窗 ===== -->
    <el-dialog
      title="规则详情"
      :visible.sync="detailModalVisible"
      width="460px"
    >
      <div class="detail-content" v-if="detailRule" v-loading="detailLoading">
        <div class="detail-name-row">
          <span class="detail-name">{{ detailRule.ruleName }}</span>
          <span class="status-badge" :class="detailRule.statusType === 'success' ? 'green' : 'gray'">{{ detailRule.status }}</span>
        </div>
        <div class="detail-fields">
          <div class="detail-field">
            <span class="detail-label">规则描述</span>
            <span class="detail-value">{{ detailRule.desc }}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">生效周期</span>
            <span class="detail-value">{{ detailRule.dateRange || (detailRule.startDate && detailRule.endDate ? detailRule.startDate + ' ~ ' + detailRule.endDate : '-') }}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">{{ detailRule.createTime || detailRule.creator || '-' }}</span>
          </div>
          <div class="detail-field" v-if="detailRule.hitCount != null">
            <span class="detail-label">命中策略数</span>
            <span class="detail-value">{{ detailRule.hitCount }} 条</span>
          </div>
          <div class="detail-field" v-if="detailRule.conditions && detailRule.conditions.length">
            <span class="detail-label">指标条件</span>
            <span class="detail-value">
              <span v-for="(c, i) in detailRule.conditions" :key="i">
                {{ i > 0 ? (detailRule.logic === 'or' ? ' 或 ' : ' 且 ') : '' }}{{ c.metricName }} {{ OPERATOR_LABEL_MAP[c.operator] || c.operator }} {{ c.threshold }}{{ c.unit || '' }}
              </span>
            </span>
          </div>
        </div>
      </div>
      <div slot="footer">
        <el-button size="small" @click="detailModalVisible = false">关闭</el-button>
      </div>
    </el-dialog>
  </section>
</template>

<script>
import {
  getWarningRuleList,
  deleteWarningRule,
  getWarningRuleDetail,
  getWarningHitStrategyList,
  toggleFollowStrategy,
  getFavoriteList,
  getDim
} from '@/api/strategyReview'
import { getCityId, getUserId } from '@/utils/auth'
import RuleCreateDialog from './RuleCreateDialog.vue'

// 比较符映射：UI 展示 → API 编码
const OPERATOR_MAP = { '≥': 'gte', '≤': 'lte', '>': 'gt', '<': 'lt', '=': 'eq' }
const OPERATOR_LABEL_MAP = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' }

function formatDate (d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default {
  name: 'AutoWarning',
  components: { RuleCreateDialog },
  props: {
    // tab 类型：active 主动 / passive 被动 / control 控损
    tabType: { type: String, default: 'active' },
    // 账期月份 yyyy-MM
    statMonth: { type: String, default: '' }
  },
  data () {
    return {
      OPERATOR_LABEL_MAP: { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' },
      // 历史预警规则列表
      historyRules: [],
      // 筛选条件（输入态与生效态分离）
      ruleNameFilter: '',
      ruleStatusFilter: '',
      ruleNameFilterInput: '',
      ruleStatusFilterInput: '',
      userCodeFilter: '',
      userCodeFilterInput: '',
      // 预警策略（命中策略列表）
      warningActiveTab: '',
      warningSelection: [],
      warningPage: 1,
      warningPageSize: 10,
      warningList: [],
      warningTotal: 0,
      // 重点关注策略（收藏列表）
      focusActiveTab: 'other',
      focusSelection: [],
      focusPage: 1,
      focusPageSize: 10,
      focusList: [],
      focusTotal: 0,
      // 下拉选项（从 dim 接口获取）
      channelOptions: [],
      strategyNameOptions: [],
      metricOptions: [],
      // 新增/编辑规则弹窗（独立子组件按需挂载：'create' / 'edit' / ''）
      dialogMode: '',
      // 编辑中的规则对象
      editingRule: null,
      // 规则详情弹窗
      detailModalVisible: false,
      detailRule: null,
      detailLoading: false
    }
  },
  computed: {
    isActive () { return this.tabType === 'active' },
    isPassive () { return this.tabType === 'passive' },
    isControl () { return this.tabType === 'control' },
    // 筛选后的规则列表
    filteredRules () {
      return this.historyRules
        .filter(r => !this.ruleNameFilter || r.ruleName.indexOf(this.ruleNameFilter) !== -1)
        .filter(r => !this.ruleStatusFilter || r.status === this.ruleStatusFilter)
    },
    // 生效中的规则（用于生成右侧动态 tab）
    activeRules () {
      return this.historyRules.filter(r => r.status === '生效中')
    },
    // 当前预警策略 tab 数据（服务端分页，直接用 warningList）
    currentWarningPageData () {
      return this.warningList
    },
    warningCheckedCount () {
      return this.warningSelection.length
    },
    // 当前重点关注策略 tab 数据（服务端分页，直接用 focusList）
    currentFocusPageData () {
      return this.focusList
    },
    focusCheckedCount () {
      return this.focusSelection.length
    }
  },
  watch: {
    tabType () {
      this.resetOnTabChange()
    },
    warningActiveTab () {
      this.warningPage = 1
      this.warningSelection = []
      this.fetchHitStrategies()
    },
    focusActiveTab () {
      this.focusPage = 1
      this.focusSelection = []
      this.fetchFocusStrategies()
    }
  },
  created () {
    this.fetchDimOptions()
    this.fetchRules()
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
    // ===== 下拉枚举 =====
    async fetchDimOptions () {
      try {
        const [channels, metrics] = await Promise.all([
          getDim({ type: '触点渠道', tabType: this.tabType }),
          // 策略名称改为远程搜索（RuleCreateDialog 内按关键字查询，最多 10 条），不再全量拉取
          getDim({ type: '预警指标', tabType: this.tabType })
        ])
        this.channelOptions = Array.isArray(channels) ? channels : (channels && channels.data) || []
        this.strategyNameOptions = []
        this.metricOptions = Array.isArray(metrics) ? metrics : (metrics && metrics.data) || []
      } catch (e) {
        console.error('[AutoWarning] fetchDimOptions error:', e)
      }
    },
    // ===== 规则列表 =====
    async fetchRules () {
      try {
        const params = { tabType: this.tabType, cityId: getCityId(), userId: getUserId() }
        if (this.userCodeFilter) params.userCode = this.userCodeFilter
        const res = await getWarningRuleList(params)
        let list = []
        if (Array.isArray(res)) list = res
        else if (res && Array.isArray(res.list)) list = res.list
        else if (res && Array.isArray(res.data)) list = res.data
        this.historyRules = list
      } catch (e) {
        console.error('[AutoWarning] getWarningRuleList error:', e)
        this.historyRules = []
      }
      this.ensureTabs()
    },
    resetOnTabChange () {
      this.ruleNameFilter = ''
      this.ruleStatusFilter = ''
      this.ruleNameFilterInput = ''
      this.ruleStatusFilterInput = ''
      this.userCodeFilter = ''
      this.userCodeFilterInput = ''
      this.warningSelection = []
      this.focusSelection = []
      this.fetchDimOptions()
      this.fetchRules()
    },
    // 保证当前 tab 指向有效规则
    ensureTabs () {
      const first = this.activeRules[0]
      const fallback = first ? 'rule_' + first.id : ''
      if (!this.activeRules.some(r => 'rule_' + r.id === this.warningActiveTab)) {
        this.warningActiveTab = fallback
      }
      if (this.focusActiveTab !== 'other' && !this.activeRules.some(r => 'rule_' + r.id === this.focusActiveTab)) {
        this.focusActiveTab = 'other'
      }
      this.warningPage = 1
      this.focusPage = 1
    },
    // ===== 筛选 =====
    applyFilter () {
      this.ruleNameFilter = this.ruleNameFilterInput
      this.ruleStatusFilter = this.ruleStatusFilterInput
      this.userCodeFilter = this.userCodeFilterInput
      // userCode 需要后端过滤，重新拉取列表
      this.fetchRules()
    },
    resetFilter () {
      this.ruleNameFilterInput = ''
      this.ruleStatusFilterInput = ''
      this.userCodeFilterInput = ''
      this.ruleNameFilter = ''
      this.ruleStatusFilter = ''
      this.userCodeFilter = ''
      this.fetchRules()
    },
    // ===== 预警命中策略列表 =====
    async fetchHitStrategies () {
      const ruleId = this.warningActiveTab ? this.warningActiveTab.replace('rule_', '') : ''
      if (!ruleId) { this.warningList = []; this.warningTotal = 0; return }
      try {
        const res = await getWarningHitStrategyList({
          tabType: this.tabType,
          ruleId: Number(ruleId),
          statMonth: this.statMonth,
          cityId: getCityId(),
          userId: getUserId(),
          pageNum: this.warningPage,
          pageSize: this.warningPageSize
        })
        const data = res || {}
        this.warningList = Array.isArray(data.list) ? data.list : []
        this.warningTotal = data.total || 0
      } catch (e) {
        console.error('[AutoWarning] fetchHitStrategies error:', e)
        this.warningList = []
        this.warningTotal = 0
      }
    },
    // ===== 收藏策略列表 =====
    async fetchFocusStrategies () {
      // 重点关注 tab：其他收藏策略
      if (this.focusActiveTab === 'other') {
        try {
          const res = await getFavoriteList({
            tabType: this.tabType,
            statMonth: this.statMonth,
            cityId: getCityId(),
            userId: getUserId(),
            pageNum: this.focusPage,
            pageSize: this.focusPageSize
          })
          const data = res || {}
          this.focusList = Array.isArray(data.list) ? data.list : []
          this.focusTotal = data.total || 0
        } catch (e) {
          console.error('[AutoWarning] fetchFocusStrategies error:', e)
          this.focusList = []
          this.focusTotal = 0
        }
        return
      }
      // 重点关注 tab：按规则筛选
      const ruleId = this.focusActiveTab ? this.focusActiveTab.replace('rule_', '') : ''
      if (!ruleId) { this.focusList = []; this.focusTotal = 0; return }
      try {
        const res = await getWarningHitStrategyList({
          tabType: this.tabType,
          ruleId: Number(ruleId),
          favorite: ruleId,
          statMonth: this.statMonth,
          cityId: getCityId(),
          userId: getUserId(),
          pageNum: this.focusPage,
          pageSize: this.focusPageSize
        })
        const data = res || {}
        this.focusList = Array.isArray(data.list) ? data.list : []
        this.focusTotal = data.total || 0
      } catch (e) {
        console.error('[AutoWarning] fetchFocusStrategies error:', e)
        this.focusList = []
        this.focusTotal = 0
      }
    },
    getStrategyCategory (row) {
      return { bigCategory: row.bigCategory || '-', smallCategory: row.smallCategory || '-' }
    },
    // ===== 表格交互 =====
    handleWarningSelectionChange (rows) {
      this.warningSelection = rows
    },
    handleFocusSelectionChange (rows) {
      this.focusSelection = rows
    },
    handleStrategyClick (row) {
      this.$emit('strategyClick', { strategyId: row.strategyId, name: row.strategyName, channel: row.channelName || row.channel })
    },
    async handleFavFromWarning () {
      if (this.warningSelection.length === 0) return
      const strategyIds = this.warningSelection.map(r => r.strategyId).filter(Boolean)
      const ruleId = this.warningActiveTab ? this.warningActiveTab.replace('rule_', '') : ''
      if (!strategyIds.length) return
      try {
        await toggleFollowStrategy({ strategyIds, followed: true, ruleId:ruleId,tabType: this.tabType })

        this.$message.success(`已关注 ${strategyIds.length} 项策略`)
        this.fetchHitStrategies()
      } catch (e) {
        this.$message.error('关注失败')
      }
      this.clearTableSelection('warningTable')
    },
    async handleFavFromFocus () {
      if (this.focusSelection.length === 0) return
      const strategyIds = this.focusSelection.map(r => r.strategyId).filter(Boolean)
      if (!strategyIds.length) return
      try {
        await toggleFollowStrategy({ strategyIds, followed: false, tabType: this.tabType })
        this.$message.success(`已取消关注 ${strategyIds.length} 项策略`)
        this.fetchFocusStrategies()
      } catch (e) {
        this.$message.error('取消关注失败')
      }
      this.clearTableSelection('focusTable')
    },
    clearTableSelection (ref) {
      this.$nextTick(() => {
        const table = this.$refs[ref]
        if (table && table.clearSelection) table.clearSelection()
      })
    },
    // ===== 新增/编辑规则（弹窗由 RuleCreateDialog 子组件承载） =====
    openCreateModal () {
      // 表单在子组件 created 时初始化，无需父组件重置
      this.editingRule = null
      this.dialogMode = 'create'
    },
    openEditModal (rule) {
      this.editingRule = rule
      this.dialogMode = 'edit'
    },
    // 新增成功：刷新列表并切换到新规则 tab
    async onRuleCreated (res) {
      this.dialogMode = ''
      await this.fetchRules()
      // 后端返回 ActionResponse<Long>，经拦截解包后 res 可能是数字/对象/null
      let newId = null
      if (typeof res === 'number') {
        newId = res
      } else if (res && typeof res === 'object') {
        newId = res.id || (res.data && res.data.id) || null
      }
      if (newId) {
        this.warningActiveTab = 'rule_' + newId
        this.focusActiveTab = 'rule_' + newId
      }
    },
    // 编辑保存成功：刷新列表
    onRuleSaved () {
      this.dialogMode = ''
      this.editingRule = null
      this.fetchRules()
    },
    // ===== 删除规则 =====
    async deleteRule (rule) {
      try {
        await this.$confirm('确定删除该预警规则？', '提示', { type: 'warning' })
      } catch { return }
      try {
        await deleteWarningRule({ id: rule.id })
        this.$message.success('删除成功')
        this.fetchRules()
      } catch (e) {
        this.$message.error('删除失败')
      }
    },
    // ===== 规则详情 =====
    async openDetailModal (rule) {
      this.detailRule = rule
      this.detailModalVisible = true
      this.detailLoading = true
      try {
        const res = await getWarningRuleDetail({ id: rule.id })
        const detail = (res && res.data) || res || {}
        if (detail.id) {
          this.detailRule = { ...rule, ...detail }
        }
      } catch (e) {
        console.error('[AutoWarning] getWarningRuleDetail error:', e)
      } finally {
        this.detailLoading = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../styles/index.less';

.card {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid @border-light;
    .card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: @text-primary;
      .card-title-dot {
        width: 3px;
        height: 12px;
        background: @color-primary;
        border-radius: 2px;
      }
    }
  }
  .card-body {
    padding: 12px;
  }
}

.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
  align-items: stretch;
}

// ===== 左侧：历史预警规则 =====
.left-panel {
  min-width: 0;
}

.rule-list-card {
  background: #fff;
  border: 1px solid @border-light;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.rule-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid @border-light;
  background: @bg-subtle;
  .rule-list-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: @text-primary;
    .rule-list-dot {
      width: 3px;
      height: 12px;
      background: @color-primary;
      border-radius: 2px;
    }
  }
  .rule-list-right {
    display: flex;
    align-items: center;
    gap: 8px;
    .rule-count {
      font-size: 10px;
      color: @text-secondary;
      font-weight: normal;
    }
  }
}

.rule-filter-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid @border-light;
  .filter-input {
    flex: 1;
    min-width: 0;
  }
  .filter-input-sm {
    flex: 0.6;
    max-width: 100px;
  }
  .filter-select {
    width: 76px;
    flex-shrink: 0;
  }
}

.rule-cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  .rule-item {
    border: 1px solid @border-light;
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: #fff;
    &:hover {
      border-color: fade(@color-primary, 40%);
      box-shadow: 0 1px 4px rgba(37, 99, 235, 0.08);
    }
    .rule-item-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      .rule-item-left {
        flex: 0 0 auto;
        min-width: 0;
        .rule-item-name {
          font-size: 12px;
          font-weight: 600;
          color: @color-primary;
          cursor: pointer;
          &:hover {
            text-decoration: underline;
          }
        }
      }
      .rule-item-center {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        .rule-status-tag {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
          text-align: center;
          width: 36px;
          word-break: break-all;
          &.success {
            color: #16a34a;
            background: #f0fdf4;
          }
          &.gray {
            color: #6b7280;
            background: #f3f4f6;
          }
        }
      }
      .rule-item-actions {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 6px;
        .edit-icon,
        .delete-icon {
          font-size: 13px;
          color: @text-secondary;
          cursor: pointer;
          &:hover {
            color: @color-primary;
          }
        }
        .delete-icon:hover {
          color: @color-danger;
        }
      }
    }
    .rule-item-desc {
      font-size: 11px;
      color: @text-regular;
      margin: 4px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rule-item-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: @text-secondary;
      i {
        margin-right: 2px;
      }
    }
  }
  .rule-empty {
    text-align: center;
    color: @text-placeholder;
    font-size: 12px;
    padding: 24px 0;
  }
}

// ===== 右侧：预警策略 / 重点关注策略 =====
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.strategy-card {
  background: #fff;
  border: 1px solid @border-light;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .strategy-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid @border-light;
    background: @bg-subtle;
    .strategy-card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: @text-primary;
      .strategy-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        &.blue {
          background: @color-primary;
        }
        &.orange {
          background: @color-warning;
        }
      }
    }
  }
  .inner-tabs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid @border-light;
    .inner-tab {
      padding: 3px 10px;
      font-size: 11px;
      color: @text-secondary;
      background: @bg-subtle;
      border: 1px solid @border-light;
      border-radius: 10px;
      cursor: pointer;
      white-space: nowrap;
      &.active {
        color: #fff;
        background: @color-primary;
        border-color: @color-primary;
      }
    }
  }
  .strategy-table-wrap {
    padding: 6px 8px 8px;
    .strategy-table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      .selected-count {
        font-size: 11px;
        color: @text-secondary;
      }
    }
    .warning-table {
      ::v-deep {
        th {
          padding: 4px 0;
          font-size: 11px;
          color: @text-primary;
          background: @bg-subtle !important;
        }
        td {
          padding: 3px 0;
          font-size: 11px;
          color: @text-regular;
        }
        .el-checkbox {
          margin-right: 0;
        }
      }
      .strategy-name-link {
        color: @color-primary;
        cursor: pointer;
        &:hover {
          text-decoration: underline;
        }
      }
    }
    .table-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
      > span {
        font-size: 11px;
        color: @text-secondary;
      }
    }
  }
}

.detail-content {
  .detail-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    .detail-name {
      font-size: 14px;
      font-weight: 600;
      color: @text-primary;
    }
    .status-badge {
      padding: 2px 10px;
      font-size: 11px;
      border-radius: 10px;
      &.green {
        color: @color-success;
        background: fade(@color-success, 10%);
      }
      &.gray {
        color: @text-secondary;
        background: @bg-subtle;
      }
    }
  }
  .detail-fields {
    .detail-field {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
      .detail-label {
        flex-shrink: 0;
        width: 72px;
        font-size: 12px;
        color: @text-secondary;
      }
      .detail-value {
        font-size: 12px;
        color: @text-regular;
        word-break: break-all;
      }
    }
  }
  .detail-match {
    margin-top: 12px;
    padding: 10px 12px;
    background: @color-primary-light;
    border-radius: 4px;
    font-size: 12px;
    color: @text-regular;
    .detail-match-title {
      font-weight: 600;
      color: @color-primary;
      margin-bottom: 4px;
    }
  }
}
</style>
