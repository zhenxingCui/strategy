# 任务清单

## 前端
- [x] TouchpointExecution.vue 两个全屏弹窗加筛选栏（绑定 categoryFilter/rightFilter 与搜索/重置方法）
- [x] TouchpointExecution.vue 新增非 scoped `.fullscreen-filter-bar` 样式（append-to-body 弹窗不吃 scoped 样式）
- [x] TouchpointExecution.vue 五处表格渲染接入千分位 formatNum
- [x] ExecutionDetail.vue 主表/分日表所有数字列接入千分位（`:formatter`）
- [x] AutoWarning.vue 两个表格数字列接入千分位（`:formatter`）
- [x] 修复 formatNum 与 el-table `:formatter` 参数错位导致的 undefined（arguments.length 区分两种调用）
- [x] 全站删除 originalCust 原始客群列（TouchpointExecution/ExecutionDetail 主表、分日表、导出列/AutoWarning 两表格）

## 后端
- [x] 修复 latestDate 接口 ActionResponse String 重载陷阱（`(Object)` 强转走 data）
- [x] selectCategorySummary 两处 `strategy_id=999` 改为 `'ALLSUM'`（修复策略分类执行情况无数据）
- [x] 收藏 upsert 改 GreatDB 兼容：移除 ON DUPLICATE KEY UPDATE，新增 deleteFavorite 物理删除
- [x] StrategyWarningServiceImpl.toggleFollow / StrategyFavoriteServiceImpl.addFavorites 改为先删后插

## 数据
- [x] data.sql 补齐 strategy_id 字母编号迁移遗漏（reject_reason 8 行、末尾 UPDATE、favorite seed）
- [x] 库内数据放大为百万级大数字测试数据（渠道系数×月份系数，合计行重算）
- [x] 9 月数据全表平移至 10 月（stat_month/stat_date +1 MONTH，KPI VARCHAR 表单独处理）
- [x] 清理 period_summary_ap 中 strategy_id='999' 残留 24 行
- [x] strategy_review_data.sql 头部注释同步放大与平移口径

## 验证
- [x] 全屏弹窗筛选实时刷新生效
- [x] 数字列千分位显示正常（726,000 / 4,449,600），undefined 消失
- [x] latestDate 返回 `data: "2026-09-01"`（修复前 data=null）
- [x] channelSummary 9 月接口返回大数字数据（total>0）
- [x] 10 月平移后无 9 月残留行
- [x] mvn compile 通过
