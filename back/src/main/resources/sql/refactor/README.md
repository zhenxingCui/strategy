# 存量策略重构：迁移准备与身份、事实过渡

此目录和配套脚本是重构的第一批工作，**新库尚不能运行现有应用**：后端仍读取旧库的表、汇总、人工数据及视图；业务产能、拒绝原因、业务环比和用户操作数据尚未迁移。不得将应用数据库连接切换到新库。

## 固定范围与保护

脚本只能连接 loopback MySQL，源库固定为 `strategy_review_active_class_local`，目标库固定为 `strategy_review_refactor_local`。不会修改源库。目标库或目标表已存在时迁移脚本拒绝覆盖。使用 `SR_DB_HOST`、`SR_DB_PORT`、`SR_DB_USER`、`SR_DB_PASSWORD` 选择本机连接，不要把凭据提交到仓库。

先停止会写入源库的服务和导入任务，创建包含源库结构、数据及视图的一致性备份，并在独立库验证恢复。`--backup` 仅检查备份文件头与大小，不代替恢复验证。脚本不负责备份，也不负责清理创建失败的目标库；MySQL 的 DDL 会隐式提交，失败后应检查目标库并人工处置，不得在不确认目标名称和内容时删除。

## 执行顺序

以下命令在 `front/` 执行。`outputs/` 在 Git 中被忽略；快照和备份可能包含业务数据，不要提交或分享。

1. 启动旧后端，采集旧接口结果：

   ```text
   node scripts/stock-refactor-baseline.cjs capture ../outputs/stock-baseline.json
   node scripts/stock-refactor-baseline.cjs compare ../outputs/stock-baseline.json
   ```

   默认访问本机 8080；可用 `SR_API_BASE` 指定另一条本机地址。快照只调用查询接口，文件已存在时不会覆盖。比较逐项严格比对响应；列表排序或数据变更也会产生差异，需人工分析。基线不是全部接口和业务情形的替代品。

2. 检查策略身份，再创建目标库与身份映射：

   ```text
   node scripts/stock-refactor-migrate-identity.cjs
   node scripts/stock-refactor-migrate-identity.cjs --apply --backup=../outputs/<源库备份文件>.sql
   node scripts/stock-refactor-verify-identity.cjs
   ```

   主表分类为空时仅在月事实唯一分类时映射。其余记录保存在 `sr_legacy_strategy_map.original_data` 中并附原因；逻辑删除及不在五个分类的记录同样保留旧值供审计。相同策略编码发生冲突时停止，不能自动覆盖。`sr_strategy` 中的内部 ID 是新 ID，API 使用的旧编码不能直接当作这个 ID。

3. 检查并复制五个分类的月度/日度行：

   ```text
   node scripts/stock-refactor-migrate-facts.cjs
   node scripts/stock-refactor-migrate-facts.cjs --apply
   node scripts/stock-refactor-verify-facts.cjs
   ```

   过渡表结构按运行时源表复制：月表以普通月表为模板，日表以 special 日表为模板。升接/稳日表的 `stat_month` 映射为 `stat_date`；所有行保留来源表及来源主键。`row_kind` 为 `detail`、`aggregate`（旧 ID 为 999）或 `unresolved`。无法匹配主表的事实仍保留原值和策略编码；跨分类“全部”不迁入。保留这些过渡汇总是为了核对现有页面，不能将其混入真实策略明细。

4. 如果日事实可提供唯一分类，补齐身份链接并重复核对：

   ```text
   node scripts/stock-refactor-resolve-daily-identities.cjs
   node scripts/stock-refactor-resolve-daily-identities.cjs --apply
   node scripts/stock-refactor-verify-identity.cjs
   node scripts/stock-refactor-verify-facts.cjs
   ```

   仅处理原因为 `classification unavailable`、且所有已迁移有效月/日事实都指向同一分类的记录；冲突不会被猜测。处理和事实关联在同一事务中执行。没有候选时重复执行不改变数据。

5. 检查并迁移升接/稳和重点客群的四张整体及单策略人工趋势表：

   ```text
   node scripts/stock-refactor-manual-trends.cjs
   node scripts/stock-refactor-manual-trends.cjs --apply
   node scripts/stock-refactor-verify-manual-trends.cjs
   ```

   `sr_manual_trend` 保留人工指标值、环比及单位、维度、发布状态、来源批次、原表和原 ID；单策略无匹配主数据时仍保留原编码。该表只覆盖这四张趋势表，业务产能人工环比尚未迁移。后续用步骤 4 补齐身份时，会在同一事务中更新该表关联。

## 后续工作

处理无主数据的事实和剩余未分类主数据；设计并迁移业务产能、拒绝原因、汇总、业务环比及用户操作数据；完成独立的版本化事实 DDL、导入链路及后端查询改造；迁移前后执行完整指标和页面对账。过渡事实表保留了旧的列和索引，仅用于无损核查，不能视为最终数据模型。

## 策略整体情况：当月事实对账接入

`OverviewMonthlyReconciler` 在现有已发布卡片和趋势结果上接入统一的月度事实查询，范围是五个存量分类的最新事实月份。升接、稳按事实的 `strategy_count` 求和，重点客群按事实行计数，均不按策略编码去重；降拆保留真实的“整体”渠道口径，离沿用当前不按渠道筛选的口径。月度事实通过现有 `v_sr_strategy_period_summary_ap_read` 兼容视图读取，未修改旧库表或导入路径。

事实值与既有已发布值一致时，卡片和趋势当月点使用事实值；不一致或缺失时保留既有值并记录警告。环比、展示元数据、历史点和前端现有展示逻辑继续沿用原来源。这个保护步骤**尚未移除 KPI、渠道汇总和人工趋势表的运行时依赖**，也未完成最终人工覆盖表或前端固定值的迁移。历史月份的事实对账不在本次范围。

本地已通过 `stock-overview-regression.cjs` 覆盖五类、各渠道及客群的当月接口比较，以及 `stock-refactor-baseline.cjs` 的其他页面接口比较。快照保存在被忽略的 `outputs/` 中，不进入 Git。执行比较示例：

```text
node scripts/stock-overview-regression.cjs capture ../outputs/overview-before.json 2026-10
node scripts/stock-overview-regression.cjs compare ../outputs/overview-before.json --current-only
```

验证应使用相同数据版本，目标后端可通过 `SR_API_BASE` 指定本机另一端口。新旧结果一致并不意味着历史趋势或未来的新数据已完成迁移。

## V007：本地表对齐生产 DDL

`V007__align_production_table_schemas.sql` 仅用于本地库 `strategy_review_active_class_local`，按邮件附件中的七张 `CREATE TABLE` 定义重建表结构。先备份七张表，再在本地执行；脚本自身会校验当前库名。它应在 `V003` 至 `V006` 和一次性分类拆表脚本之后执行。不要对生产库运行。

迁移把 KPI 与渠道汇总中带本地 `strategy_class` 的分类行留在 `*_local_class_archive` 辅助表；主表仅保留可映射到生产无分类列的汇总行。策略业务产能的 control 行迁到 `t_sr_strategy_biz_capacity_ctrl`。月产能 `stat_month` 统一保存为 `yyyyMM`。目标表按生产 DDL 收紧的数值精度会四舍五入；为满足生产非空定义，KPI 空 `value` 填 0，日表空审计时间回填 `stat_month`，周期表空策略名回填策略编码或 ID。

接口层从策略周期事实聚合 active 的 KPI 与渠道汇总；策略业务产能查询区分生产基表与 control 辅助表。迁移后可以只读检查七张表的 `information_schema.COLUMNS` 和 `STATISTICS`，确认字段顺序、类型、空值约束、默认值及索引与附件 DDL 一致。

## V008：分类后缀表对齐基表

`V008__align_variant_table_schemas.sql` 仅用于 `strategy_review_active_class_local`，在 V007 之后执行一次。脚本使用 `CREATE TABLE ... LIKE` 重建 9 组 `_special` 和 `_key_audience` 表，保留全部行，并在切换前核对行数。原表保留为 `__pre_v008` 结尾的本地备份表；执行前仍需另行备份数据。不要重复执行 V008，也不要在 V008 后重跑会给分类表添加扩展列的旧迁移。

KPI、渠道汇总和策略业务产能中基表没有的分类、原始空值、触达率及本地日期字段保存到 `*_local_ext`，后端通过 `v_sr_*_compat` 视图读取。月产能账期从 DATE 转为 `yyyyMM`；超出基表精度的小数按目标位数四舍五入；KPI 空值在物理表填 0 并在扩展表记录原始空值，日表空审计时间使用统计日期回填。

`front/scripts` 中旧版手工导入或模拟脚本若直接向分类物理表写入 `strategy_class`、`reach_rate`、`tab_type` 或 `stat_date` 等已移除字段，需要先改为按基表列写入并同步对应扩展表。特别是基表允许 `id` 为空；需要扩展数据的新增行必须使用唯一、非空的 `id` 并在同一事务中写入扩展表，才能通过兼容视图关联。
