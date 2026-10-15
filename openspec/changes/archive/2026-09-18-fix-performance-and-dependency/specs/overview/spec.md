# Delta Spec: 图表渲染器优化

## 修改需求：kpi-trend

### 场景：低配机器 + 老浏览器下图表渲染性能

**Given** 用户在 Chrome 109 + 低配云机器上访问策略复盘页面
**When** 页面加载并滚动
**Then** 4 个 ECharts 图表使用 SVG 渲染器（无 canvas 逐帧重绘开销）
**And** 滚动/交互流畅，无卡顿

### 场景：图表渲染器可配置

**Given** EChart.vue 组件
**When** 传入 `renderer="canvas"` prop
**Then** 该图表使用 canvas 渲染器（回退机制）
**And** 默认 `renderer="svg"`
