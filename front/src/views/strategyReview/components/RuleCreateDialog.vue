<template>
  <div>
    <!-- ===== 新增规则弹窗 ===== -->
    <el-dialog
      v-if="isCreate || fullEdit"
      :title="isCreate ? '新增预警规则' : '编辑预警规则'"
      :visible.sync="dialogVisible"
      width="460px"
      :close-on-click-modal="false"
      @closed="emitClose"
    >
      <div class="create-form">
        <div class="form-group">
          <label class="form-label"><span class="required">*</span>场景指标</label>
          <el-input v-model="form.ruleName" placeholder="请输入场景指标名称" size="small" />
        </div>
        <div class="form-group">
          <label class="form-label">场景指标描述</label>
          <el-input v-model="form.sceneDesc" type="textarea" :rows="2" placeholder="请输入场景指标描述..." size="small" />
        </div>
        <div class="form-group">
          <label class="form-label"><span class="required">*</span>指标生效周期</label>
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="yyyy-MM-dd"
            size="small"
            style="width: 100%;"
          />
        </div>
        <div class="form-divider"></div>
        <div class="form-section-title">筛选条件</div>
        <div v-if="!isCreate" class="form-group">
          <label class="form-label">规则状态</label>
          <el-select v-model="editStatus" size="small">
            <el-option label="生效中" value="生效中" /><el-option label="已停用" value="已停用" />
            <el-option v-if="rule.status === '已过期'" label="已过期" value="已过期" disabled />
          </el-select>
        </div>
        <div class="form-group">
          <label class="form-label">触点</label>
          <el-select
            v-model="form.channels"
            multiple
            collapse-tags
            filterable
            placeholder="请选择触点（支持全选/多选）"
            size="small"
            style="width: 100%;"
          >
            <el-option v-for="ch in channelOptions" :key="ch.keyCode" :label="ch.keyName" :value="ch.keyCode" />
          </el-select>
        </div>
        <div class="form-group">
          <label class="form-label">策略名称</label>
          <el-select
            v-model="form.strategies"
            multiple
            collapse-tags
            filterable
            remote
            :remote-method="remoteSearchStrategies"
            :loading="strategyLoading"
            placeholder="请输入关键字搜索策略名称（支持全选/多选）"
            size="small"
            style="width: 100%;"
          >
            <el-option v-for="s in searchStrategyOptions" :key="s.keyCode" :label="s.keyName" :value="s.keyCode" />
          </el-select>
        </div>
        <div class="form-divider"></div>
        <div class="form-section-bar">
          <span><span class="required">*</span>指标规则配置</span>
          <div class="form-section-actions">
            <div class="logic-switch-wrap" v-if="form.metrics.length > 1">
              <span class="logic-switch-btn" :class="{ active: form.logic === 'and' }" @click="form.logic = 'and'">且</span>
              <span class="logic-switch-btn" :class="{ active: form.logic === 'or' }" @click="form.logic = 'or'">或</span>
            </div>
            <el-button type="text" size="mini" @click="addMetric">+ 添加</el-button>
          </div>
        </div>
        <div class="metrics-list">
          <div v-for="(metric, idx) in form.metrics" :key="metric.id" class="metric-row">
            <span v-if="idx > 0" class="logic-label">{{ form.logic === 'or' ? '或' : '且' }}</span>
            <span v-else class="logic-placeholder"></span>
            <el-select v-model="metric.metricCode" placeholder="指标" size="mini" class="metric-select" @change="onMetricSelect(idx, $event)">
              <el-option v-for="m in metricOptions" :key="m.keyCode" :label="m.keyName" :value="m.keyCode" />
            </el-select>
            <el-select v-model="metric.operator" size="mini" class="operator-select">
              <el-option label="≥" value="gte" />
              <el-option label="≤" value="lte" />
              <el-option label="=" value="eq" />
              <el-option label=">" value="gt" />
              <el-option label="<" value="lt" />
            </el-select>
            <el-input v-model="metric.value" placeholder="阈值" size="mini" class="metric-value-input" />
            <span class="metric-unit">{{ metric.unit || (isRateMetric(metric.metricName) ? '%' : '') }}</span>
            <i v-if="form.metrics.length > 1" class="el-icon-close metric-remove" @click="removeMetric(idx)" />
          </div>
        </div>
      </div>
      <div slot="footer">
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="small" :loading="submitting" @click="submitCreate">{{ isCreate ? '提交' : '保存' }}</el-button>
      </div>
    </el-dialog>

    <!-- ===== 编辑弹窗（状态在此处处理） ===== -->
    <el-dialog
      v-else
      title="编辑预警规则"
      :visible.sync="dialogVisible"
      width="420px"
      :close-on-click-modal="false"
      @closed="emitClose"
    >
      <div class="edit-form" v-if="rule">
        <div class="form-group">
          <label class="form-label">场景指标</label>
          <el-input :value="rule.ruleName" disabled size="small" />
        </div>
        <div class="form-group">
          <label class="form-label">规则描述</label>
          <el-input v-model="editDesc" type="textarea" :rows="3" size="small" />
        </div>
        <div class="form-group">
          <label class="form-label">生效周期</label>
          <el-date-picker
            v-model="editDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="yyyy-MM-dd"
            size="small"
            style="width: 100%;"
          />
        </div>
        <div class="form-group">
          <label class="form-label">状态</label>
          <el-select v-model="editStatus" size="small" style="width: 100%;">
            <el-option label="生效中" value="生效中" />
            <el-option label="已过期" value="已过期" />
            <el-option label="已停用" value="已停用" />
          </el-select>
        </div>
      </div>
      <div slot="footer">
        <el-button size="small" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="small" @click="saveEdit">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  createWarningRule,
  updateWarningRule,
  toggleWarningRuleStatus,
  getDim
} from '@/api/strategyReview'
import { monthRange } from '../active/reviewData'

// 百分比类指标（单位为 %）
const RATE_METRICS = ['挽留率', '成功率', '使用率', '目标转化率', '全产品转化率']
const DEFAULT_DATA_MONTH = '2026-10'

export default {
  name: 'RuleCreateDialog',
  props: {
    // create 新增 / edit 编辑
    mode: { type: String, default: 'create' },
    fullEdit: Boolean,
    // 编辑时的规则对象
    rule: { type: Object, default: null },
    // tab 类型：active / passive / control
    tabType: { type: String, default: 'active' },
    // 页面范围：例如 active:重点客群
    pageScope: { type: String, default: 'active:升接' },
    channelOptions: { type: Array, default: () => [] },
    strategyOptions: { type: Array, default: () => [] },
    metricOptions: { type: Array, default: () => [] }
  },
  data () {
    return {
      dialogVisible: true,
      strategyLoading: false,
      submitting: false,
      searchStrategyOptions: [],
      form: {
        ruleName: '',
        sceneDesc: '',
        dateRange: [],
        channels: [],
        strategies: [],
        logic: 'and',
        metrics: []
      },
      editDesc: '',
      editDateRange: [],
      editStatus: '生效中'
    }
  },
  computed: {
    isCreate () { return this.mode === 'create' }
  },
  created () {
    if (this.isCreate) {
      this.form = this.buildDefaultForm()
    } else if (this.rule) {
      this.editDesc = this.rule.desc || ''
      this.editDateRange = [this.rule.startDate || '', this.rule.endDate || '']
      this.editStatus = this.rule.status || '生效中'
      if (this.fullEdit) {
        this.form = {
          ruleName: this.rule.ruleName || '', sceneDesc: this.rule.desc || '',
          dateRange: [this.rule.startDate, this.rule.endDate],
          channels: [...(this.rule.channels || [])], strategies: [...(this.rule.strategies || [])],
          logic: this.rule.logic || 'and',
          metrics: (this.rule.conditions || []).map((condition, index) => ({ ...condition, id: index + 1, value: condition.threshold }))
        }
        this.searchStrategyOptions = this.form.strategies.map(id => ({ keyCode: id, keyName: String(id) }))
      }
    }
  },
  methods: {
    emitClose () {
      this.$emit('close')
    },
    // 策略名称远程搜索：输入关键字才请求，后端最多返回 10 条
    async remoteSearchStrategies (keyword) {
      if (!keyword || !keyword.trim()) {
        this.searchStrategyOptions = []
        return
      }
      this.strategyLoading = true
      try {
        const res = await getDim({ type: '策略名称', tabType: this.tabType, keyword: keyword.trim() })
        this.searchStrategyOptions = Array.isArray(res) ? res : (res && res.data) || []
      } catch (e) {
        this.searchStrategyOptions = []
      } finally {
        this.strategyLoading = false
      }
    },
    buildDefaultForm () {
      const firstMetric = this.metricOptions[0]
      return {
        ruleName: '',
        sceneDesc: '',
        dateRange: [],
        channels: [],
        strategies: [],
        logic: 'and',
        metrics: [{
          id: 1,
          metricCode: firstMetric ? firstMetric.keyCode : '',
          metricName: firstMetric ? firstMetric.keyName : '',
          operator: 'gte',
          value: '',
          unit: firstMetric ? firstMetric.unit || '' : ''
        }]
      }
    },
    addMetric () {
      const ids = this.form.metrics.map(m => m.id)
      const newId = (ids.length ? Math.max(...ids) : 0) + 1
      const firstMetric = this.metricOptions[0]
      this.form.metrics.push({
        id: newId,
        metricCode: firstMetric ? firstMetric.keyCode : '',
        metricName: firstMetric ? firstMetric.keyName : '',
        operator: 'gte',
        value: '',
        unit: firstMetric ? firstMetric.unit || '' : ''
      })
    },
    removeMetric (idx) {
      if (this.form.metrics.length <= 1) return
      this.form.metrics.splice(idx, 1)
    },
    onMetricSelect (idx, keyCode) {
      const opt = this.metricOptions.find(m => m.keyCode === keyCode)
      if (opt) {
        this.form.metrics[idx].metricCode = opt.keyCode
        this.form.metrics[idx].metricName = opt.keyName
        this.form.metrics[idx].unit = opt.unit || ''
      }
    },
    isRateMetric (metricName) {
      return RATE_METRICS.indexOf(metricName) !== -1
    },
    async submitCreate () {
      if (this.submitting) return
      if (!this.form.ruleName.trim()) {
        this.$message.warning('请输入场景指标名称')
        return
      }
      if (!this.form.dateRange || this.form.dateRange.length < 2) {
        this.$message.warning('请选择指标生效周期')
        return
      }
      const conditions = this.form.metrics.map(m => ({
        metricCode: m.metricCode,
        metricName: m.metricName,
        operator: m.operator,
        threshold: Number(m.value),
        unit: m.unit
      }))
      if (!conditions.length || this.form.metrics.some(m => !m.metricCode || m.value === '' || m.value == null || !Number.isFinite(Number(m.value)))) {
        this.$message.warning('请为每条规则选择指标并填写有效阈值')
        return
      }
      const [dataStartDate, dataEndDate] = monthRange(DEFAULT_DATA_MONTH)
      this.submitting = true
      try {
        const payload = {
          ...(this.isCreate ? {} : { id: this.rule.id }),
          tabType: this.tabType,
          pageScope: this.pageScope,
          ruleName: this.form.ruleName.trim(),
          desc: this.form.sceneDesc || undefined,
          startDate: this.form.dateRange[0],
          endDate: this.form.dateRange[1],
          dataStartDate,
          dataEndDate,
          channels: this.form.channels,
          strategies: this.form.strategies,
          logic: this.form.logic,
          conditions
        }
        const res = this.isCreate ? await createWarningRule(payload) : await updateWarningRule(payload)
        if (!this.isCreate && this.editStatus !== this.rule.status) {
          await toggleWarningRuleStatus({ id: this.rule.id, status: this.editStatus, pageScope: this.pageScope })
        }
        this.dialogVisible = false
        this.$message.success(this.isCreate ? '新增预警规则成功' : '保存成功')
        this.$emit(this.isCreate ? 'created' : 'saved', res)
      } catch (e) {
        // 请求拦截器统一显示后端错误，保留表单以便重试。
      } finally { this.submitting = false }
    },
    async saveEdit () {
      if (!this.rule) return
      try {
        await updateWarningRule({
          id: this.rule.id,
          tabType: this.tabType,
          pageScope: this.pageScope,
          ruleName: this.rule.ruleName,
          desc: this.editDesc,
          startDate: (this.editDateRange && this.editDateRange[0]) || '',
          endDate: (this.editDateRange && this.editDateRange[1]) || ''
        })
        if (this.editStatus !== this.rule.status) {
          await toggleWarningRuleStatus({ id: this.rule.id, status: this.editStatus, pageScope: this.pageScope })
        }
        this.dialogVisible = false
        this.$message.success('保存成功')
        this.$emit('saved')
      } catch (e) {
        this.$message.error('保存失败')
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../styles/index.less';

// ===== 弹窗表单（新增 / 编辑） =====
.create-form,
.edit-form {
  .form-group {
    margin-bottom: 12px;
    .form-label {
      display: block;
      font-size: 12px;
      color: @text-regular;
      margin-bottom: 4px;
      .required {
        color: @color-danger;
        margin-right: 2px;
      }
    }
  }
  .form-divider {
    height: 1px;
    background: @border-light;
    margin: 12px 0;
  }
  .form-section-title {
    font-size: 12px;
    font-weight: 600;
    color: @text-primary;
    padding-left: 8px;
    border-left: 3px solid @color-primary;
    margin-bottom: 10px;
  }
  .form-section-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    color: @text-primary;
    margin-bottom: 8px;
    .required {
      color: @color-danger;
      margin-right: 2px;
    }
    .form-section-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logic-switch-wrap {
      display: flex;
      align-items: center;
      gap: 0;
      border: 1px solid #dcdfe6;
      border-radius: 3px;
      overflow: hidden;
      .logic-switch-btn {
        padding: 0 8px;
        height: 22px;
        line-height: 22px;
        font-size: 12px;
        font-weight: 400;
        color: #606266;
        background: #fff;
        cursor: pointer;
        user-select: none;
        &:not(:last-child) {
          border-right: 1px solid #dcdfe6;
        }
        &.active {
          color: #fff;
          background: @color-primary;
        }
      }
    }
  }
  .metrics-list {
    .metric-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
      .logic-label {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        line-height: 26px;
        text-align: center;
        font-size: 12px;
        color: @color-primary;
        background: @color-primary-light;
        border-radius: 3px;
        user-select: none;
      }
      .logic-placeholder {
        flex-shrink: 0;
        width: 26px;
        height: 26px;
      }
      .metric-select {
        flex: 1;
        min-width: 0;
      }
      .operator-select {
        width: 56px;
        flex-shrink: 0;
      }
      .metric-value-input {
        width: 76px;
        flex-shrink: 0;
      }
      .metric-unit {
        flex-shrink: 0;
        width: 12px;
        font-size: 12px;
        color: @text-secondary;
      }
      .metric-remove {
        flex-shrink: 0;
        font-size: 14px;
        color: @text-placeholder;
        cursor: pointer;
        &:hover {
          color: @color-danger;
        }
      }
    }
  }
}
</style>
