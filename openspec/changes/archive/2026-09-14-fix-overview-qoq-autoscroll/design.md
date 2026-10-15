## Context

两个问题的现状代码：

- **环比裁剪**：`StrategyOverview.vue` 的 `chartOption` 中，环比 Y 轴（双 Y 轴的右轴）用固定比例推导范围：`rightMax = ceil(maxQoQ * 1.3)`，`rightMin = -ceil(rightMax * 2.6)`，意图是让 0% 线落在约 72% 高度、高于柱状图最高点。该方案对中等量级有效，但当环比量级大时正区间被压缩到全高的约 28%，折线点贴近顶部，ECharts 的 `label.position: 'top'` 标签溢出 grid 被裁剪。
- **自动滚动**：`ExecutionDetail.vue` 的 `triggerHighlight()` 在设置高亮后调用 `this.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })`，导致点击列表行后页面滚走。

## Goals / Non-Goals

**Goals:**
- 环比轴范围按数据自适应，任意量级下折线与标签完整可见。
- 取消点击策略行后的自动滚动，保留高亮。

**Non-Goals:**
- 不改趋势图的整体设计（双轴、柱+线、配色不变）。
- 不改 KPI 卡片、tooltip、图例等其他图表元素。
- 不改执行详情的数据加载逻辑。

## Decisions

### Decision 1: 环比轴改为「数据驱动 + 标签余量」的自适应计算

以数据实际 min/max 为基础推导：

- `qoqMax = max(0, max(qoq))`，`qoqMin = min(0, min(qoq))`（0 必须在区间内，保证 0% 线存在）。
- 上下各留标签余量：`padding = max(8, (qoqMax - qoqMin) * 0.25)`；`rightMax = qoqMax + padding`，`rightMin = qoqMin - padding`。
- 放弃「固定 0% 线在 72% 高度」的目标——该目标正是大数值下裁剪的根因；0% 线位置随数据自然浮动。
- 备选：对超出阈值的环比截断显示 → 会丢失真实数据，不采纳。
- 备选：加大 grid top/bottom → 只能缓解，不解决量级比例问题。

### Decision 2: 仅删除 scrollIntoView，保留 triggerHighlight 高亮

客户只反馈"自动往下滑动"这一交互，高亮提示（1.8s 渐隐）不在反馈范围内，保留。删除 `ExecutionDetail.vue#L642` 一行即可。

## Risks / Trade-offs

- [0% 线位置不再固定] → 不同指标/数据下 0% 线高度不同，视觉一致性略降；换来的是任意量级不裁剪，符合客户诉求。
- [极端值（单月环比远超其他）会压缩其余折线波动] → 属数据本身特性，可通过 tooltip 查看精确值，不在本次范围。