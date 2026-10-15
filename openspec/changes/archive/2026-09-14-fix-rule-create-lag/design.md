## Context

`AutoWarning.vue`（约 477 行模板）同时承载：预警规则列表（2 个 el-table）、收藏/关注 tab、命中策略、以及新增/编辑 2 个 el-dialog。关键事实：

- Vue 2 更新粒度为组件级：弹窗内 `v-model` 输入 → 整个 AutoWarning render watcher 重跑 → 重建表格列 + 规则卡片 + 全部 el-option 的 vnode。
- el-dialog 无 `destroy-on-close`，内容常驻；3 个 el-select 的 el-option 在 mounted 时全量创建（策略名称选项可达数百条）。
- 打开弹窗 `openCreateModal()` 调 `resetCreateForm()`（整体替换 createForm 对象），关闭 `@closed` 又调一次 → 双重重置。
- `AutoWarning.vue#L755` 遗留 `debugger` 语句。
- 已排除：无轮询、无输入触发接口、无深层 watch（探查确认）。

## Goals / Non-Goals

**Goals:**
- 弹窗输入卡顿消除：重渲染范围缩小到弹窗组件。
- 打开弹窗不再有冗余重置与 debugger。

**Non-Goals:**
- 不重构 AutoWarning 其余部分（列表/命中策略逻辑不动）。
- 不在本期做下拉远程搜索/虚拟滚动/ECharts 按需引入（作为后续优化项，见 Risks）。

## Decisions

### Decision 1: 抽出 `RuleCreateDialog.vue` + `v-if` 挂载

把新增弹窗（AutoWarning.vue L282-388）及其表单 data/methods 抽为独立组件，父组件 `<rule-create-dialog v-if="createModalVisible" ... />` 方式挂载。

- v-if 而非 v-show：关闭即销毁，打开时全新挂载，天然替代 `destroy-on-close` 且重渲染不波及父组件模板其余部分。
- 备选：仅给 el-dialog 加 `destroy-on-close` → 只解决挂载，不解决输入时父组件级重渲染，收益不足。

### Decision 2: 编辑弹窗本期同批处理

编辑弹窗（L390-432）与新增弹窗共享表单结构，一并抽入 `RuleCreateDialog.vue`（以 `mode` 区分新增/编辑），避免二次返工。若实施中发现编辑弹窗耦合过深，可降级为仅抽新增弹窗并在 tasks 中记录。

### Decision 3: 保留 @closed 重置一处，删除 openCreateModal 内调用

关闭时重置足够；打开时不再整体替换 createForm。

### Decision 4: 下拉加 filterable 缓解大选项渲染

三个 el-select 加 `filterable`（本地过滤），降低打开弹窗时的感知负担；虚拟滚动/远程搜索不在本期。

## Risks / Trade-offs

- [抽组件涉及表单数据与事件的搬迁] → 字段较多（含日期区间、渠道/策略多选、条件行），需逐字段核对 props/events，避免遗漏；保存逻辑尽量留在子组件内、父组件仅订阅成功事件刷新列表。
- [策略名下拉数据量大仍是首屏成本] → filterable 只缓解输入不减少 mounted 创建量；根治需远程搜索，留待后续 change。