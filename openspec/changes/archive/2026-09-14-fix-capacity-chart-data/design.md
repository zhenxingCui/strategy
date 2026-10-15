## Context

探查已闭环三块数据链路的差异（详见 proposal.md - Why），关键代码位置：

- 后端 `SrStrategyReviewMapper.xml`：柱状图 `selectStrategyCapacityTrend`（L676-714，`tab_type` 条件在 L702）、业务产能 `selectStrategyBizCapacity`（L716-735，无 tab_type 条件）、执行明细 `selectStrategyDailyDetail`（L752-825，`tab_type` 条件在 L806）、策略信息 `selectStrategyInfo`（L671，用 `strategy_code = #{strategyId}`）。
- 前端 `ExecutionDetail.vue`：`buildParams`（L644-651，含冗余 `id` 参数）、`buildBizParams`（L653-661，月粒度）、`buildDailyParams`（L663-672，日粒度）、`fetchCapacityTrend`（L715-748，不兼容 `res.data` 包装）、`trendChartOption`（L476-478，空数据返回 `{}` 白图）。
- 测试数据 `strategy_review_data.sql`：日明细仅覆盖 2026-09-01~09-05。

## Goals / Non-Goals

**Goals:**
- 消除 tab_type NULL 数据导致的柱状图/明细整体空结果。
- 统一 strategy_id 查询口径。
- 空结果可解释（空态提示），不再白图。

**Non-Goals:**
- 不改动业务产能接口与 SQL（其口径为基准之一，保持不变）。
- 不重写时间口径体系（月 vs 日粒度是业务语义差异，保留），仅通过空态提示暴露时间缺口。
- 不引入「无数据自动回退到最新有数据月份」的逻辑（超范围，留后续）。

## Decisions

### Decision 1: 先诊断后修复（数据探查作为首个任务）

实施前先在库执行诊断查询（目标策略行在 `period_summary_ap`/`daily_ap` 的 `tab_type` 实际值、日期覆盖范围、是否只有「全部」汇总行），确认根因归属后再动 SQL。避免「放宽过滤」掩盖真实的数据生产问题。

### Decision 2: tab_type 放宽为 `= #{tabType} OR IS NULL`

与业务产能（无 tab_type 条件）及控损表先例（无 tab_type 列）口径对齐：

```sql
AND (s.tab_type = #{tabType} OR s.tab_type IS NULL)
```

- 备选：彻底去掉 tab_type 条件 → 当同一 strategy_id 在 active/passive 各有一行时会串数据，不采纳。
- 备选：修数据（UPDATE 补 tab_type）→ 测试数据可同步补，但客户环境写表方不一定可控，SQL 兜底更稳。

### Decision 3: selectStrategyInfo 改为 strategy_id 口径

`WHERE t.strategy_code = #{strategyId}` → `WHERE t.id = #{strategyId}`，与其他三个查询一致；demo 数据中两者相同，改动无回归风险。

### Decision 4: 前端空态 + 取数兼容

- `trendChartOption` months 为空时返回含「暂无数据」graphic/text 的空态配置。
- `fetchCapacityTrend` 补 `res.data` 解包兼容。
- 执行明细空列表时展示「{startDate} ~ {endDate} 内暂无数据」。
- 删除 `buildParams` 冗余 `id` 参数。

### Decision 5: 补测试数据日期缺口

`strategy_review_data.sql` 的日明细补充覆盖到当月的日期（或生成脚本说明），便于回归验证时间口径问题。

## Risks / Trade-offs

- [OR IS NULL 可能带入本不属于该 tab 的脏数据] → 仅当 strategy_id 相同且 tab_type 为 NULL 的行存在时才可能；诊断任务先行可评估该风险。
- [空态提示不解决数据本身缺口] → 若写表方数据滞后仍需数据侧治理，本 change 保证「问题可被用户与开发一眼识别」。