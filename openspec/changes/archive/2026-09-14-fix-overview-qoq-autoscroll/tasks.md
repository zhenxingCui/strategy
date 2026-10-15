## 1. 环比轴自适应

- [x] 1.1 修改 `front/src/views/strategyReview/components/StrategyOverview.vue` 的 `chartOption`：删除 `rightMax = ceil(maxQoQ * 1.3)` / `rightMin = -ceil(rightMax * 2.6)` 魔法常数逻辑，改为按数据 min/max 加 25% 标签余量自适应推导（0 必须在区间内）—— verify：构造环比 ±100% 以上数据，折线与标签完整可见不裁剪

## 2. 取消自动滚动

- [x] 2.1 修改 `front/src/views/strategyReview/components/ExecutionDetail.vue` 的 `triggerHighlight()`：删除 `this.$el.scrollIntoView(...)` 一行，保留高亮逻辑 —— verify：点击策略执行情况某一条后页面滚动位置不变，详情更新且高亮仍出现

## 3. 回归验证

- [x] 3.1 `npm run serve` 启动前端，切换三个 tabType（active/passive/control）与不同 KPI 指标查看趋势图 —— verify：各场景折线/标签完整，柱状图不受影响
- [x] 3.2 点击策略执行情况列表行 —— verify：无自动滚动，高亮正常