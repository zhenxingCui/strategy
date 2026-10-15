## Context

本变更修三处既有 SQL 错误（动机见 proposal.md - Why）：

- `SrWarningMapper.xml` 的 `countHitStrategyList` 写死为 `FROM t_sr_strategy_period_summary_ap`，但控损形态的预警指标（如 `success_rate`、`retain_rate`）属于控损表，导致 `Unknown column`。
- `hitStrategyWhere` 片段含 `s.tab_type = #{tabType}`，而控损汇总表 `t_sr_strategy_period_summary_ctrl` 没有 `tab_type` 列（见 project.md 7.1），控损查询会再报 `Unknown column 'tab_type'`。
- `selectStrategyDailyDetail` 控损分支存在多余条件 `AND DATE_FORMAT(s.stat_month, '%Y-%m') = #{statMonth}`，引用了不存在的别名 `s` 与 Mapper 方法里没有的 `statMonth` 参数。

## Goals / Non-Goals

**Goals:**
- 使命中策略列表（含计数）在 control 与 active/passive 形态下均能正确查询、排序，且 count 与 list 过滤一致。
- 使控损日明细按日期范围正常查询。

**Non-Goals:**
- 不修改数据库表结构（不新增 `tab_type` 列、不做数据迁移）。
- 不更改接口契约（请求/响应结构与分页语义不变）。
- 不重写动态条件拼接的整体架构。

## Decisions

### Decision 1: 用 `<choose>` 按 `tabType` 分表，而非给控损表加 `tab_type` 列

`countHitStrategyList` 与 `selectHitStrategyList` 均按 `tabType` 选择数据源：control 查 `_ctrl` 表，其余查 `_ap` 表。

- 备选：给 `t_sr_strategy_period_summary_ctrl` 增加 `tab_type` 列统一过滤 → 需改 DDL + 数据迁移，且字段语义冗余（控损表本身即控损数据）。
- 结论：选 `<choose>` 分表，改动最小、无需迁移。

### Decision 2: 独立 `hitStrategyWhereCtrl` 片段处理控损过滤

新增 `<sql id="hitStrategyWhereCtrl">`（仅 `WHERE s.is_deleted = 0`），供控损分支使用；`hitStrategyWhere` 保留 `tab_type` 过滤供非控损分支使用。避免在控损表上按 `tab_type` 过滤报错。

### Decision 3: 控损排序补全字段

控损分支 `ORDER BY` 后补 `s.success_count DESC`（对应 spec「按成功量倒序」）；非控损分支保持 `s.product_conv_num DESC`。

### Decision 4: 删除日明细控损分支的多余月份条件

直接删除 `AND DATE_FORMAT(s.stat_month, '%Y-%m') = #{statMonth}`。日粒度明细以 `stat_date` + `startDate/endDate` 过滤已足够，`statMonth` 本就不在 Mapper 参数中。

### Decision 5: count 与 list 过滤条件对齐

`countHitStrategyList` 补上与 `selectHitStrategyList` 相同的 `channel/big_category/small_category/strategy_name != '全部'` 过滤，保证 total 与列表页一致。

## Risks / Trade-offs

- [分表逻辑在 count 与 list 两处重复维护] → 后续若新增第四种策略形态需同步改两处；已在 project.md 7.1 记录该约定，降低遗漏风险。
- [动态条件仍走 `${conditionSQL}` 注入] → 本次不扩大改动范围；沿用 project.md 7.3 的排序白名单与拼接规范。
- [需实际数据验证] → 需重启后端，分别用 control 与 active/passive 规则点开命中策略列表、控损日明细进行回归。