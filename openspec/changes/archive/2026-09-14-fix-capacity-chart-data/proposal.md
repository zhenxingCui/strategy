## Why

客户反馈：策略执行详情里「业务产能明细」有值，但「策略产能柱状图」有问题、「执行明细」无数据（原始需求见同目录 [requirement.md](./requirement.md)）。

根因探查结论：三个数据块走三条独立链路，过滤口径不一致——

1. **tab_type 口径不一致（最可能）**：柱状图（`SrStrategyReviewMapper.xml#L702`）与执行明细（`#L806`）强制 `tab_type = #{tabType}`，而业务产能表（`t_sr_strategy_biz_capacity`）**无此条件**。若数据侧该字段为 NULL 或与前端枚举（active/passive）不一致，则柱状图与明细同时为空、业务产能正常——与客户现象完全吻合。
2. **时间口径不一致**：业务产能按月（statMonth）匹配、执行明细按日区间匹配、柱状图不看日期取近 6 个有数据月。日明细测试数据仅覆盖 09-01~09-05，日期范围选到 09-06 之后即空。
3. **「全部」汇总行排除口径不一致**：柱状图/明细排除 `channel/big_category/...='全部'` 汇总行，业务产能仅排除 `biz_name='全部'`。
4. **前端掩盖问题**：柱状图取数不兼容 `res.data` 包装；months 为空时渲染白图，无空态提示，无法区分「无数据」与「渲染异常」。

## What Changes

- 后端：柱状图与执行明细的 `tab_type` 过滤放宽为 `= #{tabType} OR IS NULL`（与业务产能、控损表先例口径对齐），消除 NULL 数据导致的整体空结果。
- 后端：顺带修复 `selectStrategyInfo` 用 `strategy_code = #{strategyId}` 与其他查询 `strategy_id` 口径不一致的问题。
- 前端：产能趋势柱状图增加「暂无数据」空态提示；`fetchCapacityTrend` 补 `res.data` 包装兼容；执行明细空时提示所选日期范围，便于识别时间口径问题。
- 数据排查：实施前先在库中核实目标策略行的 `tab_type` 实际值，确认根因归属。

## Capabilities

### New Capabilities
- `execution/capacity-consistency`: 策略执行详情三块数据（产能趋势/业务产能/执行明细）的过滤口径一致性能力——同一策略在任一数据块有值时，其他块 SHOULD 能给出明确数据或明确空态原因。

### Modified Capabilities

（无既有基线）

## Impact

- `back/src/main/resources/mapper/SrStrategyReviewMapper.xml`：`selectStrategyCapacityTrend`、`selectStrategyDailyDetail`、`selectStrategyInfo`。
- `front/src/views/strategyReview/components/ExecutionDetail.vue`：柱状图空态、取数兼容、明细空提示。
- 可能需要补测试数据（`strategy_review_data.sql`）覆盖日明细日期缺口。