# 变更提案

## 背景

策略复盘系统近期连续迭代中产生的一批功能增强与缺陷修复，统一补录文档并归档。涉及前端 Vue 组件、后端 Controller/Mapper 与测试数据。

## 变更清单

### 增强（用户需求 19/20）

1. **全屏弹窗加搜索筛选条件**：触点执行页两个全屏弹窗（策略分类执行情况、策略执行情况）加入与主界面一致的筛选栏（月份/大类/小类/触点/策略名 + 搜索/重置），复用主界面筛选状态与方法
2. **大数字千分位展示**：全站数字列千分位格式化（如 10000 → 10,000），覆盖 TouchpointExecution（5 处表格）、ExecutionDetail（主表+分日表）、AutoWarning（两个表格）；比率列与空值（--）不受影响

### 缺陷修复

3. **latestDate 接口 String 重载陷阱**：`ActionResponse.getSuccessResp(String)` 重载把日期放进 message 而 data 为 null，导致前端回退当前系统月份（10 月）查不到 7~9 月数据、表格全空；Controller 加 `(Object)` 强转走 `getSuccessResp(Object)` 重载
4. **formatNum formatter 参数错位**：el-table `:formatter` 回调签名是 `(row, column, cellValue)`，单参 formatNum 收到的是 row 对象，导致预警策略列表数值列显示 undefined；改为兼容两种调用（按参数个数区分）
5. **策略分类执行情况无数据**：`selectCategorySummary` 写死 `strategy_id=999`，strategy_id 迁移字母编号后失配，改为 `strategy_id='ALLSUM'`
6. **收藏 upsert GreatDB 兼容**：GreatDB 不支持 `ON DUPLICATE KEY UPDATE`，改为先物理 DELETE（`deleteFavorite`，含逻辑删除历史行释放唯一索引）再纯 INSERT

### 展示调整

7. **全站隐藏原始客群列**：TouchpointExecution、ExecutionDetail（主表/分日表/导出列）、AutoWarning 的 originalCust 列定义全部删除

### 数据与工程

8. **strategy_id 迁移收尾**：data.sql 遗漏的 reject_reason 8 行、末尾 UPDATE、favorite seed 修正为 STR 编号；清理全部临时脚本
9. **大数字测试数据**：库内数据按「渠道系数 × 月份系数」放大为百万级（含 +475%/+168.5% 极端环比），"全部/合计"行按明细重算，用于千分位展示测试
10. **9 月数据平移至 10 月**：全表 stat_month/stat_date +1 MONTH（KPI、渠道/策略周期/产能汇总、日明细、拒绝原因、预警命中），消除当前月（10 月）无数据导致的空表格
11. **数据 SQL 注释同步**：strategy_review_data.sql 头部注明放大规则与月份平移口径

## 验证

- 全屏弹窗可筛选并实时刷新
- 数字列显示千分位，undefined 问题消失
- latestDate 返回 data 正确、页面表格有数据
- 收藏重复操作走删除+插入，GreatDB 兼容
- 10 月数据齐全，无 9 月残留
