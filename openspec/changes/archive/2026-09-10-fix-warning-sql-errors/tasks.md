## 1. 修复命中策略查询分表与过滤

- [x] 1.1 修改 `SrWarningMapper.xml` 的 `countHitStrategyList`，用 `<choose>` 按 `tabType` 区分 `_ctrl`/`_ap` 表，并补上 `channel/big_category/small_category/strategy_name != '全部'` 过滤 —— verify：control 与 active/passive 下计数不再报 `Unknown column`，且 total 等于对应列表条件命中条数
- [x] 1.2 在 `SrWarningMapper.xml` 新增 `hitStrategyWhereCtrl` 片段（仅 `WHERE s.is_deleted = 0`），并让 `selectHitStrategyList` 控损分支引用它 —— verify：control 命中策略列表不再报 `Unknown column 'tab_type'`

## 2. 修复排序与日明细 SQL

- [x] 2.1 修改 `selectHitStrategyList` 控损分支 `ORDER BY` 补上 `s.success_count DESC` —— verify：control 列表按成功量倒序，且无 `ORDER BY` 空字段语法错误
- [x] 2.2 修改 `SrStrategyReviewMapper.xml` 的 `selectStrategyDailyDetail` 控损分支，删除多余条件 `AND DATE_FORMAT(s.stat_month, '%Y-%m') = #{statMonth}` —— verify：控损日明细按 startDate/endDate 正常返回，不再报 `Parameter 'statMonth' not found`

## 3. 回归验证

- [x] 3.1 重新打包后端 `mvn clean package -DskipTests` —— verify：编译通过，无 XML/映射错误
- [ ] 3.2 分别用 control 与 active/passive 规则点开「命中策略列表」 —— verify：三种形态均能正常返回且 total 与列表页一致
- [ ] 3.3 打开控损策略执行「日明细」 —— verify：正常返回日粒度数据，无 SQL 报错