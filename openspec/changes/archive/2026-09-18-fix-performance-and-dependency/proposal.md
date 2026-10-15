# 变更提案

## 背景

1. 云机器（Chrome 109）上页面滚动卡顿、打开新增框 30 秒-1 分钟
2. 新增规则时报 `NoClassDefFoundError: cn/hutool/json/JSONUtil`

## 变更内容

### 1. ECharts SVG 渲染器切换
- **文件**：`front/src/components/EChart.vue`
- **改动**：新增 `renderer` prop（默认 `'svg'`），`init()` 传 `{ renderer: 'svg' }`
- **原因**：SVG 无 canvas 逐帧重绘开销，低配机器 + 老浏览器下滚动/交互更平滑

### 2. 策略名称远程搜索
- **文件**：
  - `front/src/views/strategyReview/components/AutoWarning.vue`
  - `front/src/views/strategyReview/components/RuleCreateDialog.vue`
  - `back/src/main/resources/mapper/SrStrategyReviewMapper.xml`
- **改动**：
  - 前端：策略名称 select 改 `filterable + remote`，输入关键字才调接口
  - 后端：无 keyword 返回空（`AND 1=0`），有 keyword 模糊过滤 + `LIMIT 10`
- **原因**：原接口无 keyword 时全量返回 6 万+ 条，导致前端渲染 6 万+ el-option 卡死、6 万+ 响应式对象常驻内存

### 3. hutool-json 依赖补全
- **文件**：`back/pom.xml`
- **改动**：新增 `hutool-json` 依赖（版本 5.8.25）
- **原因**：`pec-core` 的 `UserUtil.getUser()` 使用 `JSONUtil`，原 pom 只引入 `hutool-core`

## 验证

- 后端接口：无 keyword 返回 0 条，带 keyword 返回 ≤10 条
- 前端浏览器：打开弹窗不发全量请求，输入关键字才请求
- 新增规则接口：HTTP 200 成功
