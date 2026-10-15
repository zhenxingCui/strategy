## 1. 抽出规则弹窗子组件

- [x] 1.1 新建 `front/src/views/strategyReview/components/RuleCreateDialog.vue`，搬迁新增弹窗模板（AutoWarning.vue L282-388）及表单 data/校验/保存逻辑，props 接收下拉数据源（channels/strategies/metrics），事件回传保存成功 —— verify：子组件编译通过，字段与原弹窗一一对应
- [x] 1.2 编辑弹窗同批抽入（以 mode 区分新增/编辑）；若耦合过深则降级为仅抽新增弹窗并在本任务备注 —— verify：编辑回填与保存行为与重构前一致（已按 design Decision 2 完整合并，未降级）
- [x] 1.3 `AutoWarning.vue` 中改为 `<rule-create-dialog v-if="..."/>` 挂载，移除原弹窗模板与相关 data/methods，删除 `openCreateModal` 中的 `resetCreateForm()` 调用（保留 `@closed` 一处）—— verify：打开/关闭弹窗行为正常，无重复重置（重置仅由子组件 created + v-if 卸载天然承担）
- [x] 1.4 清理 `AutoWarning.vue#L755` 遗留 `debugger` 语句 —— verify：源码中无 debugger
- [x] 1.5 三个 el-select 增加 `filterable` —— verify：下拉可输入过滤

## 2. 回归验证

- [ ] 2.1 `npm run serve` 启动，打开「新增规则」弹窗 —— verify：打开无明显卡顿，弹窗内连续输入流畅（肉眼无滞后）
- [ ] 2.2 完整走一遍新增保存 → 列表刷新、编辑回填 → 保存 —— verify：请求参数与重构前一致，功能无回归
- [ ] 2.3 规则列表滚动、tab 切换 —— verify：弹窗外区块行为无变化