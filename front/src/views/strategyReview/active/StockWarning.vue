<template>
  <section class="section">
    <h2 class="section-title">
      预警管理<span class="spacer" /><span class="badge">命中策略 {{ hitTotal }} 条</span>
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
            >
              <div class="rule-pick">
                <strong>{{ rule.ruleName }}</strong
                ><span class="status" :class="{ live: rule.status === '生效中' }">{{ rule.status }}</span>
              </div>
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
          ref="hitTable"
          title="预警策略"
          tools
          :exporting="exportingHits"
          :columns="columns"
          :rows="hits"
          :page="hitPage"
          :page-size="10"
          :total="hitTotal"
          :state="panels.hits"
          :empty-text="selectedRule ? '当前规则无命中策略' : '暂无生效中的预警规则'"
          @page="changeHitPage"
          @export-all="exportAllHits"
          @retry="loadHits"
          @strategy="$emit('strategy', $event)"
        >
          <template slot="filters">
            <review-state
              v-if="panels.liveRules && panels.liveRules.error"
              :state="panels.liveRules"
              @retry="loadLiveRules"
            />
            <div v-else class="warning-rule-tabs" role="tablist" aria-label="预警规则">
              <span v-if="!liveRules.length" class="muted">暂无生效中的预警规则</span>
              <button
                v-for="rule in liveRules"
                :key="rule.id"
                type="button"
                class="warning-rule-tab"
                :class="{ active: selectedRule && String(selectedRule.id) === String(rule.id) }"
                role="tab"
                :aria-selected="Boolean(selectedRule && String(selectedRule.id) === String(rule.id))"
                :title="rule.ruleName"
                @click="chooseRule(rule)"
              >
                {{ rule.ruleName }}
              </button>
            </div>
          </template>
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
      :page-scope="pageScope"
      :channel-options="channels"
      :metric-options="metricOptions"
      @close="dialogMode = ''"
      @created="createdRule"
      @saved="savedRule"
    />
  </section>
</template>
<script>
import { Message } from 'element-ui'
import {
  getDim,
  getWarningRuleList,
  getWarningRuleDetail,
  deleteWarningRule,
  toggleWarningRuleStatus,
  getWarningHitStrategyList,
} from '@/api/strategyReview'
import RuleCreateDialog from '../components/RuleCreateDialog.vue'
import ReviewState from './ReviewState.vue'
import ReviewTable from './ReviewTable.vue'
import { listOf, strategyColumns, controlStrategyColumns, categoryLabelColumns, panelRequests } from './reviewData'
import { fetchAllPagedRows } from './fetchAllPagedRows'

export default {
  name: 'StockWarning',
  components: { RuleCreateDialog, ReviewState, ReviewTable },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true }, channels: { type: Array, default: () => [] } },
  data() {
    return {
      rules: [],
      liveRules: [],
      ruleTotal: 0,
      rulePage: 1,
      selectedRule: null,
      hits: [],
      hitTotal: 0,
      hitPage: 1,
      exportingHits: false,
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
    pageScope() {
      const pageKey = this.query.tabType === 'active' ? (this.query.strategyClass || '升接') : '全部'
      return `${this.query.tabType}:${pageKey}`
    },
    isDowngrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === '降拆'
    },
    isLeave() {
      return this.query.tabType === 'active' && this.query.strategyClass === '离'
    },
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
        ...(this.query.tabType === 'control' || this.isDowngrade || this.isLeave
          ? []
          : [{ prop: 'actualIncome', label: '实际收入(元)' }]),
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
        this.requestVersions.hits = (this.requestVersions.hits || 0) + 1
        this.$set(this.panels, 'hits', {})
        this.rulePage = 1
        this.selectedRule = null
        this.rules = []
        this.liveRules = []
        this.loadDimensions()
        this.loadRules()
        this.loadLiveRules()
      },
    },
  },
  created() {
    this.loadDimensions()
    this.loadRules()
    this.loadLiveRules()
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
    loadRules() {
      return this.request(
        'rules',
        () =>
          getWarningRuleList({
            ...this.query,
            pageScope: this.pageScope,
            ruleName: this.ruleName,
            status: this.status,
            pageNum: this.rulePage,
            pageSize: 5,
          }),
        (result) => {
          this.rules = listOf(result)
          this.ruleTotal = Number(result && result.total) || 0
        },
      )
    },
    loadLiveRules(preferredId) {
      return this.request(
        'liveRules',
        async () => {
          const params = {
            ...this.query,
            pageScope: this.pageScope,
            ruleName: '',
            status: '生效中',
            pageNum: 1,
            pageSize: 500,
          }
          const firstPage = await getWarningRuleList(params)
          const liveRules = listOf(firstPage)
          const total = Number(firstPage && firstPage.total) || liveRules.length
          for (let pageNum = 2; liveRules.length < total; pageNum++) {
            const page = await getWarningRuleList({ ...params, pageNum })
            const nextPage = listOf(page)
            if (!nextPage.length) break
            liveRules.push(...nextPage)
          }
          return { ...(firstPage || {}), list: liveRules, total }
        },
        (result) => {
          this.liveRules = listOf(result)
          const id = preferredId || (this.selectedRule && this.selectedRule.id)
          this.selectedRule =
            this.liveRules.find((rule) => String(rule.id) === String(id)) || this.liveRules[0] || null
          this.hitPage = 1
          this.loadHits()
        },
      )
    },
    chooseRule(rule) {
      if (this.selectedRule && String(this.selectedRule.id) === String(rule.id)) return
      this.selectedRule = rule
      this.hitPage = 1
      this.loadHits()
    },
    loadHits() {
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
            pageScope: this.pageScope,
            ruleId: this.selectedRule.id,
            pageNum: this.hitPage,
            pageSize: 10,
          }),
        (result) => {
          this.hits = listOf(result)
          this.hitTotal = Number(result && result.total) || 0
          const lastPage = Math.max(1, Math.ceil(this.hitTotal / 10))
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
    async exportAllHits() {
      if (this.exportingHits || !this.selectedRule || !this.hitTotal) return
      this.exportingHits = true
      const params = {
        ...this.query,
        pageScope: this.pageScope,
        ruleId: this.selectedRule.id,
      }
      try {
        const rows = await fetchAllPagedRows(
          (pageNum, pageSize) => getWarningHitStrategyList({ ...params, pageNum, pageSize }),
          this.hitTotal,
        )
        if (this.$refs.hitTable) this.$refs.hitTable.exportRows(rows)
      } catch (error) {
        if (error && error.message === '导出数据未完整加载，请重试') {
          Message.error(error.message)
        }
      } finally {
        this.exportingHits = false
      }
    },
    openCreate() {
      this.editingRule = null
      this.dialogKey++
      this.dialogMode = 'create'
    },
    async edit(rule) {
      this.busy = true
      try {
        this.editingRule = await getWarningRuleDetail({ ...this.query, pageScope: this.pageScope, id: rule.id })
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
          pageScope: this.pageScope,
          id: rule.id,
          status: rule.status === '生效中' ? '已停用' : '生效中',
        })
        await Promise.all([this.loadRules(), this.loadLiveRules()])
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
        await deleteWarningRule({ ...this.query, pageScope: this.pageScope, id: rule.id })
        if (this.rules.length === 1 && this.rulePage > 1) this.rulePage--
        await Promise.all([this.loadRules(), this.loadLiveRules()])
        this.$message.success('规则已删除')
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
      await Promise.all([this.loadRules(), this.loadLiveRules(id)])
    },
    savedRule() {
      this.dialogMode = ''
      Promise.all([this.loadRules(), this.loadLiveRules()])
    },
  },
}
</script>
