# overview/kpi-trend Specification

## Purpose

定义策略总览 KPI 趋势图的行为契约。该能力确保环比折线在任意数值量级下完整可见，并约束点击策略列表行时的页面滚动行为不打断用户浏览，同时在低配机器 + 老浏览器下使用 SVG 渲染器保证流畅性。

## Requirements

### Requirement: 环比轴自适应展示

KPI 趋势图的环比折线及其数据标签 SHALL 在任意环比数值量级下完整可见，不被绘图区边缘裁剪；0% 参考线 SHOULD 位于绘图区内合理位置。

#### Scenario: 环比值较大

- **WHEN** 某月环比绝对值较大（如超过 100%）
- **THEN** 该月折线数据点与标签完整显示在绘图区内，不被顶部/底部裁剪

#### Scenario: 环比值较小

- **WHEN** 各月环比绝对值较小
- **THEN** 折线与标签正常显示，0% 线不遮挡柱状图数据标签

### Requirement: 点击策略行不自动滚动

点击策略执行情况列表某一条后，系统 SHALL NOT 自动滚动页面到执行详情区域；SHALL 保留选中态与高亮反馈。

#### Scenario: 点击某条策略

- **WHEN** 用户点击策略执行情况列表中的某一条
- **THEN** 页面滚动位置保持不变，执行详情区域更新且高亮提示仍生效

### Requirement: 图表 SVG 渲染器

ECharts 图表 SHALL 默认使用 SVG 渲染器，以在低配机器 + 老浏览器（如 Chrome 109）下避免 canvas 逐帧重绘开销；SHALL 支持通过 prop 回退到 canvas 渲染器。

#### Scenario: 低配机器滚动

- **WHEN** 用户在 Chrome 109 + 低配云机器上访问页面并滚动
- **THEN** 4 个 ECharts 图表使用 SVG 渲染器，无 canvas 逐帧重绘开销
- **AND** 滚动/交互流畅，无卡顿

#### Scenario: 渲染器回退

- **WHEN** EChart.vue 组件传入 `renderer="canvas"` prop
- **THEN** 该图表使用 canvas 渲染器
- **AND** 默认 `renderer="svg"`
