## Why

客户反馈两个策略整体情况（KPI 趋势）图表问题：

1. **环比太大显示不出来**：趋势图右侧环比 Y 轴用魔法常数（`rightMin = -2.57 * rightMax`，固定 0% 线在 72% 高度）计算范围，当环比值很大时，折线顶到绘图区顶部，数据标签被裁剪不可见（客户反馈.md 问题 2）。
2. **点击列表自动下滑**：点击策略执行情况某一条后，页面自动平滑滚动到执行详情区，客户认为干扰浏览，建议取消（客户反馈.md 问题 3）。

原始需求见同目录 [requirement.md](./requirement.md)。

## What Changes

- 环比 Y 轴范围改为自适应计算：以数据实际 min/max 加标签余量动态推导，去掉固定比例魔法常数，保证任意环比量级下折线与标签完整可见。
- 删除点击策略行后的自动滚动交互（`scrollIntoView`），保留高亮提示。

## Capabilities

### New Capabilities
- `overview/kpi-trend`: KPI 趋势图展示能力——环比轴自适应、标签完整可见、无自动滚动干扰。

### Modified Capabilities

（无既有基线）

## Impact

- `front/src/views/strategyReview/components/StrategyOverview.vue`：`chartOption` 计算属性中环比 Y 轴 min/max 逻辑。
- `front/src/views/strategyReview/components/ExecutionDetail.vue`：`triggerHighlight()` 中的 `scrollIntoView`。
- 纯前端改动，无后端/数据库变更，无接口契约变更。