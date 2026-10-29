# 存量策略重构：迁移准备与身份、事实过渡

此目录和配套脚本是重构的第一批工作，**新库尚不能运行现有应用**：后端仍读取旧库的表、汇总、人工数据及视图；业务产能、拒绝原因、人工指标和用户操作数据尚未迁移。不得将应用数据库连接切换到新库。

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

## 后续工作

处理无主数据的事实和剩余未分类主数据；设计并迁移业务产能、拒绝原因、汇总、人工数据及用户操作数据；完成独立的版本化事实 DDL、导入链路及后端查询改造；迁移前后执行完整指标和页面对账。过渡表保留了旧的列和索引，仅用于无损核查，不能视为最终数据模型。
