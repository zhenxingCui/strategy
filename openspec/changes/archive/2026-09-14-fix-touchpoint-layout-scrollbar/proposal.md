## Why

客户反馈两个纯样式问题（原始需求见同目录 [requirement.md](./requirement.md)）：

1. **「策略触点执行情况」左右两块没有对齐**：`TouchpointExecution.vue` 左右两栏布局模型不对称——左栏是 flex column（顶部「标题→表格」直接开始），右栏顶部多一条 filter-bar（约 30px）；左表用 `max-height` 动态高度、右表用固定 `height` + 分页 footer；左右 gap（10px vs 8px）与分隔方式（margin vs 虚线）不一致；`.right-panel` 甚至没有任何样式规则。多个因素叠加导致左右各块分界线错位。
2. **滑动条不美观**：全站没有任何全局 `::-webkit-scrollbar` 规则，页面级滚动条与 el-table 内部滚动条全是浏览器默认宽体灰条；已有的 `.scrollbar-thin` 工具类（6px 细条）需手动挂 class 且无法穿透 scoped 样式，全站仅用过一次。

## What Changes

- 触点执行组件左右两栏统一布局节奏：两栏顶部结构对齐（消除 filter-bar 造成的高度差或补齐占位）、表格高度策略统一、gap 与分隔方式统一、`.right-panel` 补对称样式。
- 在全局非 scoped 样式（App.vue 或组件非 scoped 块）增加统一的 6px 细滚动条规则，覆盖页面级滚动与 el-table 内部滚动。

## Capabilities

### New Capabilities
- `touchpoint/execution-layout`: 策略触点执行情况页面布局能力——左右两栏各区块水平对齐、视觉节奏统一。
- `ui/scrollbar-style`: 全局滚动条样式能力——页面与表格滚动条统一为细条样式。

### Modified Capabilities

（无既有基线）

## Impact

- `front/src/views/strategyReview/components/TouchpointExecution.vue`（模板结构或样式）
- `front/src/App.vue`（全局非 scoped 样式追加滚动条规则）
- 纯样式改动，无接口/数据变更，不影响组件逻辑。