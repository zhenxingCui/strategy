<template>
  <section class="section">
    <h2 class="section-title">
      重点关注策略<span class="spacer" /><span class="badge"
        >{{ focused ? '已关注策略' : '预警策略' }} {{ hitTotal }} 条</span
      >
    </h2>
    <div class="split split--m3">
      <div class="card rules-card">
        <div class="sub-title">
          历史预警规则<span class="spacer" /><button
            class="btn btn-primary"
            :disabled="!metricOptions.length"
            @click="openCreate"
          >
            <i class="el-icon-plus" />新增规则
          </button>
        </div>
        <div class="toolbar">
          <input
            v-model="draftName"
            class="input"
            type="search"
            placeholder="请输入预警规则名称"
            aria-label="预警规则名称"
            @keyup.enter="search"
          />
          <select v-model="draftStatus" class="select" aria-label="规则状态">
            <option value="">全部状态</option>
            <option>生效中</option>
            <option>已过期</option>
            <option>已停用</option>
          </select>
          <button class="btn" @click="search">搜索</button><button class="btn" @click="reset">重置</button>
        </div>
        <review-state v-if="dimensionError" :state="{ error: dimensionError }" @retry="loadDimensions" />
        <review-state :state="panels.rules" :empty="!rules.length" empty-text="暂无预警规则" @retry="loadRules">
          <div class="rule-list">
            <article
              v-for="rule in rules"
              :key="rule.id"
              class="rule-item"
              :class="{ selected: selectedRule && selectedRule.id === rule.id }"
              @click="chooseRule(rule)"
            >
              <button class="rule-pick" @click.stop="chooseRule(rule)">
                <strong>{{ rule.ruleName }}</strong
                ><span class="status" :class="{ live: rule.status === '生效中' }">{{ rule.status }}</span>
              </button>
              <p class="rule-condition">{{ conditionText(rule) }}</p>
              <p class="muted">生效：{{ rule.dateRange || `${rule.startDate || '—'} 至 ${rule.endDate || '—'}` }}</p>
              <div class="rule-footer">
                <span class="muted">{{ rule.createTime || rule.creator || '—' }}</span
                ><span class="spacer" /><button class="btn-link" :disabled="busy" @click.stop="edit(rule)">编辑</button
                ><button class="btn-link" :disabled="busy" @click.stop="toggleStatus(rule)">
                  {{ rule.status === '生效中' ? '停用' : '启用' }}</button
                ><button class="btn-link danger" :disabled="busy" @click.stop="remove(rule)">删除</button>
              </div>
            </article>
          </div>
        </review-state>
        <div class="table-note">
          <span>共 {{ ruleTotal }} 条</span
          ><el-pagination
            small
            background
            layout="prev, pager, next"
            :current-page="rulePage"
            :page-size="5"
            :total="ruleTotal"
            :pager-count="5"
            @current-change="changeRulePage"
          />
        </div>
      </div>
      <div class="card warning-table-card">
        <review-table
          :title="selectedRule ? `预警策略 · ${selectedRule.ruleName}` : '预警策略'"
          tools
          selectable
          :columns="columns"
          :rows="hits"
          :page="hitPage"
          :page-size="5"
          :total="hitTotal"
          :state="panels.hits"
          :empty-text="selectedRule ? '当前规则无命中策略' : '请选择一条生效中的规则'"
          @page="changeHitPage"
          @retry="loadHits"
          @selection="selection = $event"
          @strategy="$emit('strategy', $event)"
        >
          <template slot="actions"
            ><button class="btn" :disabled="!selection.length || busy" @click="follow(true)">关注选中</button
            ><button v-if="focused" class="btn" :disabled="!selection.length || busy" @click="follow(false)">
              取消关注
            </button></template
          >
          <div slot="filters" class="toolbar warning-tabs">
            <button class="seg-btn" :aria-pressed="!focused ? 'true' : 'false'" @click="setFocused(false)">
              预警策略</button
            ><button class="seg-btn" :aria-pressed="focused ? 'true' : 'false'" @click="setFocused(true)">
              重点关注策略</button
            ><span class="muted">点击左侧规则切换</span>
          </div>
        </review-table>
      </div>
    </div>
    <rule-create-dialog
      v-if="dialogMode"
      :key="dialogKey"
      :mode="dialogMode"
      :rule="editingRule"
      full-edit
      :tab-type="query.tabType"
      :channel-options="channels"
      :metric-options="metricOptions"
      @close="dialogMode = ''"
      @created="createdRule"
      @saved="savedRule"
    />
  </section>
</template>
<script>
import {
  getDim,
  getWarningRuleList,
  getWarningRuleDetail,
  deleteWarningRule,
  toggleWarningRuleStatus,
  getWarningHitStrategyList,
  toggleFollowStrategy,
} from '@/api/strategyReview'
import RuleCreateDialog from '../components/RuleCreateDialog.vue'
import ReviewState from './ReviewState.vue'
import ReviewTable from './ReviewTable.vue'
import { listOf, strategyColumns, controlStrategyColumns, categoryLabelColumns, panelRequests } from './reviewData'

export default {
  name: 'StockWarning',
  components: { RuleCreateDialog, ReviewState, ReviewTable },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true }, channels: { type: Array, default: () => [] } },
  data() {
    return {
      rules: [],
      ruleTotal: 0,
      rulePage: 1,
      selectedRule: null,
      hits: [],
      hitTotal: 0,
      hitPage: 1,
      selection: [],
      focused: false,
      draftName: '',
      draftStatus: '',
      ruleName: '',
      status: '',
      metricOptions: [],
      dimensionError: '',
      busy: false,
      dialogMode: '',
      dialogKey: 0,
      editingRule: null,
    }
  },
  computed: {
    columns() {
      const detail = this.query.tabType === 'control'
        ? controlStrategyColumns
        : strategyColumns.filter((column) => column.prop !== 'strategyClass')
      return [
        {
          prop: 'statMonth',
          label: '日期',
          text: true,
          format: (value) => (value ? String(value).replace(/-/g, '').slice(0, 6) : '—'),
        },
        { prop: 'channelName', label: '触点', text: true, format: (value, row) => value || row.channel || '—' },
        ...categoryLabelColumns(detail, this.query),
        ...(this.query.tabType === 'control'
          ? []
          : [{ prop: 'expectedIncome', label: '预期收入(元)' }, { prop: 'actualIncome', label: '实际收入(元)' }]),
      ]
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.hitPage = 1
        this.hitTotal = 0
        this.hits = []
        this.selection = []
        this.requestVersions.hits = (this.requestVersions.hits || 0) + 1
        this.$set(this.panels, 'hits', {})
        this.rulePage = 1
        this.selectedRule = null
        this.rules = []
        this.loadDimensions()
        this.loadRules()
      },
    },
  },
  created() {
    this.loadDimensions()
    this.loadRules()
  },
  methods: {
    async loadDimensions() {
      try {
        this.metricOptions = listOf(await getDim({ type: '预警指标', tabType: this.query.tabType }))
        this.dimensionError = ''
      } catch (e) {
        this.dimensionError = '规则指标加载失败，请重试'
      }
    },
    loadRules(preferredId) {
      return this.request(
        'rules',
        () =>
          getWarningRuleList({
            ...this.query,
            ruleName: this.ruleName,
            status: this.status,
            pageNum: this.rulePage,
            pageSize: 5,
          }),
        (result) => {
          this.rules = listOf(result)
          this.ruleTotal = Number(result && result.total) || 0
          const id = preferredId || (this.selectedRule && this.selectedRule.id)
          this.selectedRule =
            this.rules.find((r) => String(r.id) === String(id) && r.status === '生效中') ||
            this.rules.find((r) => r.status === '生效中') ||
            null
          this.hitPage = 1
          this.loadHits()
        },
      )
    },
    chooseRule(rule) {
      if (rule.status !== '生效中') {
        this.$message.info('该规则当前未生效')
        return
      }
      this.selectedRule = rule
      this.hitPage = 1
      this.loadHits()
    },
    loadHits() {
      this.selection = []
      this.hits = []
      if (!this.selectedRule) {
        this.hitTotal = 0
        this.hitPage = 1
        this.requestVersions.hits = (this.requestVersions.hits || 0) + 1
        this.$set(this.panels, 'hits', {})
        return
      }
      return this.request(
        'hits',
        () =>
          getWarningHitStrategyList({
            ...this.query,
            ruleId: this.selectedRule.id,
            favorite: this.focused ? '1' : '',
            pageNum: this.hitPage,
            pageSize: 5,
          }),
        (result) => {
          this.hits = listOf(result)
          this.hitTotal = Number(result && result.total) || 0
          const lastPage = Math.max(1, Math.ceil(this.hitTotal / 5))
          if (this.hitPage > lastPage) {
            this.hitPage = lastPage
            this.$nextTick(() => this.loadHits())
          }
        },
      )
    },
    conditionText(rule) {
      const operators = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' }
      return (
        (rule.conditions || [])
          .map(
            (c) =>
              `${c.metricName || c.metricCode} ${operators[c.operator] || c.operator} ${c.threshold}${c.unit || ''}`,
          )
          .join(rule.logic === 'or' ? ' 或 ' : ' 且 ') ||
        rule.desc ||
        '暂无条件描述'
      )
    },
    search() {
      this.ruleName = this.draftName.trim()
      this.status = this.draftStatus
      this.rulePage = 1
      this.loadRules()
    },
    reset() {
      this.draftName = ''
      this.draftStatus = ''
      this.search()
    },
    changeRulePage(page) {
      this.rulePage = page
      this.loadRules()
    },
    changeHitPage(page) {
      this.hitPage = page
      this.loadHits()
    },
    setFocused(value) {
      this.focused = value
      this.hitPage = 1
      this.loadHits()
    },
    openCreate() {
      this.editingRule = null
      this.dialogKey++
      this.dialogMode = 'create'
    },
    async edit(rule) {
      this.busy = true
      try {
        this.editingRule = await getWarningRuleDetail({ ...this.query, id: rule.id })
        this.dialogKey++
        this.dialogMode = 'edit'
      } catch (e) {
        /* 请求拦截器展示错误 */
      } finally {
        this.busy = false
      }
    },
    async toggleStatus(rule) {
      this.busy = true
      try {
        await toggleWarningRuleStatus({
          ...this.query,
          id: rule.id,
          status: rule.status === '生效中' ? '已停用' : '生效中',
        })
        await this.loadRules()
      } catch (e) {
        /* 请求拦截器展示错误 */
      } finally {
        this.busy = false
      }
    },
    async remove(rule) {
      try {
        await this.$confirm(`确定删除规则“${rule.ruleName}”？`, '删除预警规则', { type: 'warning' })
      } catch (e) {
        return
      }
      this.busy = true
      try {
        await deleteWarningRule({ ...this.query, id: rule.id })
        if (this.rules.length === 1 && this.rulePage > 1) this.rulePage--
        await this.loadRules()
        this.$message.success('规则已删除')
      } catch (e) {
        /* 请求拦截器展示错误 */
      } finally {
        this.busy = false
      }
    },
    async follow(followed) {
      if (!this.selectedRule || !this.selection.length || this.busy) return
      this.busy = true
      try {
        await toggleFollowStrategy({
          ...this.query,
          ruleId: String(this.selectedRule.id),
          strategyIds: this.selection.map((r) => String(r.strategyId)),
          followed,
        })
        this.$message.success(followed ? '已关注' : '已取消关注')
        await this.loadHits()
      } catch (e) {
        /* 请求拦截器展示错误 */
      } finally {
        this.busy = false
      }
    },
    async createdRule(id) {
      this.dialogMode = ''
      this.rulePage = 1
      this.draftName = ''
      this.ruleName = ''
      this.draftStatus = ''
      this.status = ''
      await this.loadRules(id)
    },
    savedRule() {
      this.dialogMode = ''
      this.loadRules()
    },
  },
}
</script>
