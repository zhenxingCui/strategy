# execution/daily-detail Specification

## Purpose

定义策略执行日粒度明细查询的行为契约。该能力支持按策略、地域与日期范围返回主动、被动、控损三种策略形态的日粒度执行数据，供执行明细页逐日展示。

## Requirements

### Requirement: 日粒度明细按日期范围查询

系统 SHALL 支持按日期范围（startDate / endDate）查询策略执行日粒度明细，且不依赖与日粒度无关的月份参数。

#### Scenario: 控损形态日明细按日期范围查询

- **WHEN** 查询控损形态的日粒度明细并提供 startDate 与 endDate
- **THEN** 系统返回该日期范围内的日粒度记录，且不会因缺失无关参数而报错
