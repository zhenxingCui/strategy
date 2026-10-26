# 项目说明（Strategy Review）

> 本文件是 OpenSpec 的项目上下文。后续每个变更（change）在起草 proposal / specs / design 时，AI 会读取本文件作为背景约束。请保持其内容与代码现状一致。

## 1. 项目概述

策略复盘与预警系统，对营销策略做整体复盘评估，并基于指标阈值做自动预警。采用前后端分离架构：

- **后端** `back/`：Spring Boot，提供 REST 接口，返回平台统一响应结构 `ActionResponse`。
- **前端** `front/`：Vue 2 单页应用，Element UI + ECharts 展示，Axios 调用后端。
- 2026-10-22：active（存量策略）界面迁至 `front/src/views/strategyReview/active/`，参考 `策略复盘与预警/` 静态原型；开发运行及范围见 `front/ACTIVE_REVIEW_MIGRATION.md`。

核心业务按“策略形态”三分：`active`（主动策略）、`passive`（被动策略）、`control`（控损策略）。

## 2. 技术栈

### 后端（back/）
- Spring Boot 2.3.0（JDK 8）
- MyBatis-Plus 3.4.2 + MyBatis XML（手写 SQL）
- MySQL 8.0.13（`com.mysql.cj.jdbc.Driver`）
- Swagger / springfox 3.0.0（接口文档）、Lombok
- 内部平台 jar（system scope）：`pec-core` / `pec-common-jx` —— 提供 `ActionResponse`、`BaseException`、`UserUtilJx`
- 基础包：`com.asiainfo.biapp.pec.plan.jx.strategyreview`

### 前端（front/）
- Vue 2.6 + Vue CLI 4 + Vue Router 3 + Vuex 3
- Element UI 2.15.7、ECharts 5.2.1、Axios 0.19.2
- Node 版本由 `.nvmrc` 固定为 `20.18.0`

## 3. 目录结构

```
back/src/main/java/com/asiainfo/biapp/pec/plan/jx/strategyreview/
├── controller/          # REST 接口层
├── service/             # 业务逻辑（impl 实现）
├── mapper/              # MyBatis Mapper 接口
├── model/               # 实体
└── vo/req,vo/resp       # 请求/响应 VO

back/src/main/resources/
├── mapper/*.xml         # MyBatis SQL
├── sql/*.sql            # 建库建表 + 测试数据
└── application.yml      # 端口、数据库、MyBatis-Plus 配置

front/src/
├── api/                 # 接口封装（strategyReview.js / manage.js）
├── components/EChart.vue
├── views/strategyReview/ # 页面与子组件
└── router/ store/
```

## 4. 运行方式

### 后端
```bash
cd back
mvn spring-boot:run
# 端口 8080，上下文路径 /plan-svc-lj
```

### 前端
```bash
cd front
npm install
npm run serve
# 端口 8081，开发代理 /plan-svc-lj → http://localhost:8080（见 vue.config.js）
```

### 数据库
- 本地联调库：`strategy_review_active_class_local`（utf8mb4）；存量策略样例在 `t_sr_strategy.strategy_class` 中均分为 `升接`、`稳`、`降拆`、`离`；原始 SQL 脚本中的库名为 `strategy_review`。
- 建表：`back/src/main/resources/sql/strategy_review.sql`
- 测试数据：`back/src/main/resources/sql/strategy_review_data.sql`
- 默认连接本机 MySQL，支持 `SR_DB_URL` / `SR_DB_USER` / `SR_DB_PASSWORD` 环境变量。初始化本地联调数据：在 `front/` 执行 `npm run db:init-local`，拒绝覆盖已有库。`hikari.initialization-fail-timeout: -1`（库暂不可用也允许启动）。

## 5. 后端接口清单

统一前缀：`/plan-svc-lj`（context-path）+ 下列 `@RequestMapping` 基路径。

### StrategyReviewController — `/strategyReview`
| 方法 | 接口 | 说明 |
|---|---|---|
| POST | `/dim` | 维度枚举 |
| POST | `/overview/kpi` | KPI 卡片 |
| POST | `/overview/trend` | KPI 趋势（**需 metricCode**） |
| POST | `/touchpoint/channelSummary` | 触点渠道汇总 |
| POST | `/touchpoint/strategyList` | 触点策略列表 |
| POST | `/touchpoint/channelCapacityTrend` | 渠道产能趋势 |
| POST | `/touchpoint/channelBizCapacity` | 渠道业务容量 |
| POST | `/touchpoint/categorySummary` | 触点分类汇总 |
| POST | `/execution/strategyInfo` | 策略详情 |
| POST | `/execution/capacityTrend` | 产能趋势 |
| POST | `/execution/bizCapacity` | 业务容量 |
| POST | `/execution/dailyDetail` | 日粒度明细 |
| POST | `/execution/rejectReason` | 拒绝原因 |

### StrategyWarningController — `/strategyReview/warning`
| 方法 | 接口 | 说明 |
|---|---|---|
| POST | `/ruleList` | 预警规则列表 |
| POST | `/ruleCreate` | 创建规则 |
| POST | `/ruleUpdate` | 更新规则 |
| POST | `/ruleDelete` | 删除规则 |
| POST | `/ruleDetail` | 规则详情 |
| POST | `/ruleUpdateStatus` | 更新规则状态 |
| POST | `/hitStrategyList` | 命中策略列表 |
| POST | `/toggleFollow` | 关注切换 |

### StrategyFavoriteController — `/strategyReview/favorite`
| 方法 | 接口 | 说明 |
|---|---|---|
| POST | `/add` | 添加收藏 |
| POST | `/remove` | 移除收藏 |
| POST | `/list` | 收藏列表 |

## 6. 核心数据表（三态设计）

三类汇总/明细表，命名按策略形态后缀区分：

- 主动/被动：`t_sr_strategy_period_summary_ap`
- 控损：`t_sr_strategy_period_summary_ctrl`
- 日明细：`t_sr_strategy_daily_*`
- 维度字典：`t_sr_dim_channel` / `t_sr_dim_metric` / `t_sr_strategy`
- 预警：`t_sr_warning_rule` / `t_sr_warning_rule_condition` / `t_sr_warning_hit`
- 收藏：`t_sr_favorite`

> 每张表结构以 `back/src/main/resources/sql/strategy_review.sql` 为唯一事实来源。改结构时同步更新该脚本和实际库。

## 7. 踩坑记录与关键约定（MUST 遵守）

### 7.1 重点产品事实表字段对齐
- `t_sr_strategy_period_summary_ctrl` 与 `t_sr_strategy_period_summary_ap` 使用相同字段结构；`t_sr_strategy_daily_ctrl` 对齐日表指标字段，日期列为 `stat_month`。
- 重点产品记录使用 `tab_type='control'`、`strategy_class='全部'`；本地旧库迁移先保留旧表备份，再运行 `front/scripts/align-control-product-tables-local.cjs` 执行字段映射。
- 产品筛选维度取事实表 `small_category`；`t_sr_strategy.product_name` 不参与事实分组或筛选。

### 7.2 预警条件操作符编码
- 前端/保存使用编码：`gte`(≥)、`lte`(≤)、`gt`(＞)、`lt`(＜)、`eq`(＝)。
- 数据库 `t_sr_warning_rule_condition.operator` 可能存半角 `>= <= > < =` 或全角符号，后端 `getOption()` 需兼容两者。
- 动态拼接 SQL 时操作符与阈值两侧 **必须带空格**，否则生成 `push_count 300000` 这类缺操作符/缺空格的非法 SQL。

### 7.3 动态 SQL 注入防护
- 命中策略查询的 `$conditionSQL` 由服务层拼接后以 `${}` 注入，属高风险点。
- 排序字段 MUST 走白名单校验（如 `product_conv_num`），禁止直接拼接用户输入作为列名/排序方向。
- `ORDER BY` MUST 有明确的排序字段，不能留空。

### 7.4 前后端字段对齐：`metricCode`
- `/overview/trend` 依赖请求参数 `metricCode`；后端 `queryKpiTrend` 会校验非空，否则抛“指标编码metricCode不能为空”。
- 前端 `StrategyOverview.vue` 中 `activeMetricCode` 依赖 KPI 接口返回，可能为空；触发趋势请求前 MUST 先判空保护，避免空参数打接口。

### 7.5 请求/响应契约
- 所有接口统一返回平台结构 `ActionResponse`，前端 `manage.js` 负责解包并处理成功/失败。
- 请求体均为 JSON `POST`，参数校验用 `@Validated` + JSR-303 注解。

### 7.6 分页约定
- 请求用 `pageNum` / `pageSize`（后端归一化 `pageNum>=1`，`pageSize` 兜底）；返回统一 `PageResultVO<T>`。
- MyBatis 分页用 `LIMIT #{limit} OFFSET #{offset}`，count 与列表查询必须保持过滤条件一致，否则 total 与列表不符。
