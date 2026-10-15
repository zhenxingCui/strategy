# 设计说明

## 关键决策

### 1. latestDate 的 ActionResponse 重载陷阱

外部 JAR `ActionResponse` 同时存在 `getSuccessResp(String)`（语义为 message）与 `getSuccessResp(Object)`（语义为 data）。编译期静态绑定使 String 实参优先命中 String 重载。无法修改外部 JAR，采用 `(Object)` 强转规避；全库仅 `getLatestDataDate` 一处返回 String，其余接口安全。

### 2. formatNum 双签名兼容

el-table `:formatter` 传 `(row, column, cellValue, index)`，模板插值直传单值。用 `arguments.length >= 3 ? cellValue : row` 区分两种调用，三个组件共用同一实现，模板无需改动。

### 3. append-to-body 弹窗样式作用域

全屏弹窗 `append-to-body` 不吃 scoped 样式，筛选栏样式定义在非 scoped 的 `.table-fullscreen-dialog` 样式块（`.fullscreen-filter-bar`），与主界面 `.filter-bar` 视觉一致（24px 迷你输入框）。

### 4. 收藏 GreatDB 兼容策略

唯一索引 `uk_fav_user_tab_str(user_id, tab_type, strategy_id)` 会被 `is_deleted=1` 的逻辑删除行占用，故先物理 DELETE 再 INSERT，Service 层保证顺序，Mapper 层纯 SQL 无 MySQL 特有语法。

### 5. 测试数据口径

放大遵循业务合理性约束（推送≥使用≥转化，比率列不动）；"全部/合计"行按明细行重新求和保持口径一致；9→10 月平移统一用 `DATE_ADD(..., INTERVAL 1 MONTH)`，KPI 表 stat_month 为 VARCHAR 单独处理；data.sql 重新导入会回到基础量级+9 月口径（头部注释已声明）。

## 遗留观察项

- `selectExistFavoriteIds` 返回类型仍为 `List<Long>` 而 strategy_id 已是 String（当前无调用方报错，潜在类型隐患）
