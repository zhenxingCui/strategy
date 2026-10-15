# 设计文档

## 1. SVG 渲染器切换

### 现状
- `EChart.vue` 的 `init()` 调用 `echarts.init(this.$refs.chart)`，默认 canvas 渲染器
- 4 个图表（StrategyOverview 1 + Touchpoint 1 + ExecutionDetail 2）全部 canvas

### 方案
- `echarts.init(dom, theme, opts)` 第三参传 `{ renderer: 'svg' }`
- 新增 `renderer` prop 支持回退到 canvas（个别图表如需 canvas 特性）
- echarts 5.6.0 完整包已内置 SVG 渲染器，零新增依赖

### 兼容性
- 图表 option 无 `texture`/`shadowBlur`/canvas 滤镜 → SVG 完全支持
- `graphic` 元素（ExecutionDetail 环形图中心文字）为纯文本 → SVG 支持
- 渐变、tooltip、dataZoom、legend → SVG 全支持

## 2. 策略名称远程搜索

### 现状
- `AutoWarning.vue` 挂载即调用 `getDim({ type: '策略名称' })` → 6 万+ 条存入响应式数组
- `RuleCreateDialog.vue` 打开时 `<el-option v-for="s in strategyOptions">` 全量渲染 6 万+ DOM

### 方案
- **前端**：
  - `AutoWarning.vue`：`fetchDimOptions` 不再拉取"策略名称"
  - `RuleCreateDialog.vue`：策略名称 select 改 `filterable + remote`，新增 `remoteSearchStrategies(keyword)` 方法
- **后端**：
  - `SrStrategyReviewMapper.xml`：无 keyword → `AND 1=0` 返回空；有 keyword → 模糊过滤 + `LIMIT 10`

### 数据流
```
用户输入关键字 → remote-method 触发 → getDim({ type: '策略名称', keyword }) → 后端模糊查询 LIMIT 10 → 渲染选项
```

## 3. hutool-json 依赖

### 现状
- `pec-core-7.0.0-SNAPSHOT.jar` 的 `UserUtil.getUser()` 使用 `cn.hutool.json.JSONUtil`
- pom 只引入 `hutool-core`（不含 JSON 模块）

### 方案
- pom 新增 `hutool-json` 依赖（版本与 `hutool-core` 一致：5.8.25）
