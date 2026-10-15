## Why

客户反馈：点击「新增规则」后卡一段时间，弹窗中输入内容也非常卡（原始需求见同目录 [requirement.md](./requirement.md)）。

根因探查结论：`AutoWarning.vue` 是约 477 行模板的巨型单组件（2 个 12~17 列的 el-table、3 个 el-dialog、多个 v-for 列表、3 个 el-select 的**全量** el-option）。Vue 2 更新粒度为组件级——弹窗输入框每敲一个字符都触发整个组件 render + 上千 vnode 重建 diff（数十至上百毫秒）；el-dialog 内容常驻 DOM（无 `destroy-on-close`），打开时集中重渲染 + 重排；打开/关闭还存在双重重置。选项数据量随 `getDim('策略名称')` 返回量线性放大。

## What Changes

- 将「新增/编辑规则弹窗」从 `AutoWarning.vue` 抽出为独立子组件 `RuleCreateDialog.vue`，用 `v-if` 挂载，使弹窗内输入的重渲染范围缩小到弹窗自身。
- 策略名称等大下拉增加 `filterable`，减少全量渲染压力（本期不引入远程搜索/虚拟滚动，作为后续优化项记录）。
- 去除打开/关闭的双重重置：保留关闭时重置一处。
- 清理 `AutoWarning.vue` 遗留的 `debugger` 语句。

## Capabilities

### New Capabilities
- `warning/rule-dialog`: 预警规则新增/编辑弹窗能力——独立组件承载、输入流畅（输入响应不随页面复杂度放大）、开关无冗余重置。

### Modified Capabilities

（无既有基线）

## Impact

- `front/src/views/strategyReview/components/AutoWarning.vue`：抽出弹窗、精简重置逻辑、删 `debugger`。
- 新增 `front/src/views/strategyReview/components/RuleCreateDialog.vue`。
- 弹窗的表单字段、校验、保存接口调用行为保持不变（对外行为无变化）。