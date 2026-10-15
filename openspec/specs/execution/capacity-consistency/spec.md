# execution/capacity-consistency Specification

## Purpose

定义策略执行详情页三块数据（产能趋势、业务产能、执行明细）的过滤口径一致性契约。该能力确保同一策略在各数据块中采用一致的策略维度过滤口径，并在无数据时给出可解释的空态提示。

## Requirements

### Requirement: 执行详情三块数据过滤口径一致

策略执行详情中的产能趋势、业务产能、执行明细 SHALL 采用一致的策略维度过滤口径：`strategy_id` 匹配口径统一；`tab_type` 过滤 MUST 兼容该字段为 NULL 的数据行。

#### Scenario: tab_type 为空的数据行

- **WHEN** 某策略行 tab_type 为 NULL 且 strategy_id 匹配
- **THEN** 产能趋势与执行明细查询能命中该行，不再因 tab_type 过滤整体为空

#### Scenario: 策略信息查询口径

- **WHEN** 以 strategyId 查询策略详情信息
- **THEN** 使用与其他查询一致的 strategy_id 匹配口径（或明确兼容 strategy_code）

### Requirement: 图表与明细空态可解释

产能趋势柱状图无数据时 SHALL 展示「暂无数据」空态而非空白图；执行明细无数据时 SHALL 提示所选查询条件（含日期范围），便于区分数据缺口与查询口径问题。

#### Scenario: 柱状图无数据

- **WHEN** 产能趋势接口返回空月份
- **THEN** 柱状图区域展示「暂无数据」空态提示

#### Scenario: 执行明细无数据

- **WHEN** 执行明细接口返回空列表
- **THEN** 明细区域提示当前日期范围内无数据
