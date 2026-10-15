## 1. 数据诊断（先于代码修改）

- [x] 1.1 在 strategy_review 库执行诊断查询：目标策略在 `t_sr_strategy_period_summary_ap` / `t_sr_strategy_daily_ap` 的 `tab_type` 实际值分布、`stat_date` 覆盖范围、是否仅存在「全部」汇总行 —— verify：明确根因归属（tab_type NULL / 日期缺口 / 汇总行），记录结论

## 2. 后端 SQL 修复

- [x] 2.1 `selectStrategyCapacityTrend`（ap 分支）：`tab_type` 条件改为 `(s.tab_type = #{tabType} OR s.tab_type IS NULL)` —— verify：tab_type 为 NULL 的数据行可被命中
- [x] 2.2 `selectStrategyDailyDetail`（ap 分支，含 count）：同样放宽 `d.tab_type` 条件 —— verify：同上
- [x] 2.3 `selectStrategyInfo`：`strategy_code = #{strategyId}` 改为 `id = #{strategyId}` —— verify：策略详情按 strategyId 正常返回

## 3. 前端空态与兼容

- [x] 3.1 `ExecutionDetail.vue` 的 `trendChartOption`：months 为空时返回带「暂无数据」提示的空态配置 —— verify：柱状图区域显示空态而非白图
- [x] 3.2 `fetchCapacityTrend` 补 `res.data` 包装兼容 —— verify：两种响应包装下均能取到 months/capacity/qoq
- [x] 3.3 执行明细空列表提示「{startDate} ~ {endDate} 内暂无数据」；删除 `buildParams` 冗余 `id` 参数 —— verify：空明细时提示可见，接口参数不含 id

## 4. 测试数据与回归

- [x] 4.1 `strategy_review_data.sql` 补日明细数据覆盖到当月（平移复制 +5~+13、passive +2~+4），库中已同步执行并去重 —— verify：默认日期范围下执行明细有数据
- [x] 4.2 `mvn clean package -DskipTests` 重新打包通过 —— verify：编译无错误
- [x] 4.3 前端目检三块数据 —— verify：业务产能/柱状图/执行明细三块口径一致，空态可解释