## Why

预警命中策略列表与策略执行日明细两个查询接口存在 SQL 语法/结构错误：控损（control）形态下命中策略查询报 `Unknown column 'success_rate'`，控损日明细报 `Parameter 'statMonth' not found`，导致相关页面无法打开。需要修正 SQL，使三种策略形态（active / passive / control）下的查询都能正确返回。

## What Changes

- 修复 `countHitStrategyList` 硬编码查询 `t_sr_strategy_period_summary_ap` 表的问题，按 `tabType` 区分控损表与非控损表。
- 为控损汇总表补齐专用 WHERE（去掉 `tab_type` 过滤），避免 `Unknown column 'tab_type'`。
- 修复 `selectHitStrategyList` 控损分支 `ORDER BY` 后无排序字段的语法错误。
- 修复 `selectStrategyDailyDetail` 控损分支多余条件 `DATE_FORMAT(s.stat_month, ...) = #{statMonth}`（引用了不存在的别名与参数）。
- 使 count 与 list 查询的过滤条件保持一致（`channel != '全部'` 等），保证 total 与列表页一致。

## Capabilities

### New Capabilities
- `warning/hit-strategy`: 预警命中策略列表查询能力，按策略形态正确分表、过滤、排序与计数。
- `execution/daily-detail`: 策略执行日粒度明细查询能力，按日期范围查询，控损/非控损分支正确。

### Modified Capabilities

（无，本仓库 `openspec/specs/` 尚未建立基线，本变更首次为上述两个能力引入规格）

## Impact

- `back/src/main/resources/mapper/SrWarningMapper.xml`：`countHitStrategyList`、`selectHitStrategyList`、新增 `hitStrategyWhereCtrl` 片段。
- `back/src/main/resources/mapper/SrStrategyReviewMapper.xml`：`selectStrategyDailyDetail`。
- 无数据库结构变更、无接口契约变更（请求/响应结构不变）。