# 升接、稳：按页面模块维护数据库 SQL

> **环境差异待核对：**本清单按本机 `127.0.0.1:3306` 的 `strategy_review_active_class_local` 编写，该库的 `t_sr_strategy_period_summary_ap` 有 `strategy_class` 列。用户反馈另一环境没有此列，因此下方 SQL 不能直接用于该环境；在取得其实际表结构及分类关联方式并完成适配前，请勿执行，也不要简单删掉分类条件。

适用于当前项目的升接、稳页面和本地数据库 `strategy_review_active_class_local`；以下均为示例，**不会自动执行**。请先替换策略编码、名称、月份、渠道、分类、地区及数值；将 `升接` 改为 `稳` 即可维护稳类。写入前备份并先查重，尤其是未指定区县时可能查到多个区县。所有查询示例均不包含 `county_id IS NULL` 条件。

月事实及日事实 `strategy_id` 使用策略编码，与 `t_sr_strategy.strategy_code` 关联，不是基础表自增 `id`。`999` 是分类汇总标识，不是实际策略。月度日期通常填每月 1 日；日数据填实际日期。插入值中的 `county_id = NULL` 只是示例，按实际地区替换。写操作示例没有提交事务：在同一连接先 `START TRANSACTION;`，执行并核实后自行 `COMMIT;`，有误则 `ROLLBACK;`。

本地月事实、日事实、渠道月产能、渠道业务产能及单策略业务产能表的 `id` 当前允许为空且非自增；其他环境请先检查约束并使用该环境规定的 ID。不要并发使用 `MAX(id)+1`。

| 页面模块 | 页面内容 | 当前数据来源 |
|---|---|---|
| 策略整体情况 | 指标卡片、整体趋势 | `t_sr_strategy_period_summary_ap` 的 `strategy_id='999'` 汇总行 |
| 策略触点执行情况 | 渠道汇总 | 按 `t_sr_strategy_period_summary_ap` 的策略明细聚合 |
| 策略执行情况 | 分类执行表 | 按同一月事实表的策略明细聚合 |
| 策略执行情况 | 产能趋势 | `t_sr_channel_monthly_capacity_ap` |
| 策略执行情况 | 业务产能明细 | `t_sr_channel_biz_capacity_ap`，按业务汇总 |
| 策略执行明细 | 策略列表、单策略趋势、策略详情 | 月事实表及基础表 `t_sr_strategy` |
| 策略执行明细 | 单策略业务产能 | `t_sr_strategy_biz_capacity` |
| 策略执行明细 | 分日、拒绝原因 | `t_sr_strategy_daily_ap`、`t_sr_strategy_reject_reason` |

> 各模块的数据来源独立维护。升接/稳整体页面查询时会按所选范围从月事实自动重算 `999` 汇总；其他模块的数据仍需分别维护。环比单位：数量环比以百分数存储（`5` 表示 5%）；比率环比通常为百分点（`1` 表示 1pp）。不同模块有直接读取和按数据重算两种情况，以各节说明为准。

## 1. 策略整体情况：卡片与历史趋势

整体接口查询时先从明细重算对应范围的分类汇总行，再读取结果；已有环比字段保留不变。全部渠道对应 `strategy_id='999'`、渠道/大类/小类为 `全部`；默认地市为 `999`，未选区县不限制区县。整体产能取 `product_conv_num`，环比取 `product_conv_num_qoq`。历史环比已存表，修改产能不会自动重算环比或下一月环比。

### 查询

```sql
SELECT stat_month, strategy_count, push_count, usage_count, usage_rate,
       reach_count, product_conv_num, product_conv_num_qoq,
       product_conv_rate, product_conv_rate_qoq, actual_income,
       city_id, county_id
FROM t_sr_strategy_period_summary_ap
WHERE tab_type='active' AND strategy_class='升接' AND strategy_id='999'
  AND channel='全部' AND big_category='全部' AND small_category='全部'
  AND city_id='999' AND stat_month >= '2026-01-01'
  AND stat_month < '2026-11-01' AND is_deleted=0
ORDER BY stat_month;
```

### 新增一个月的汇总数据

先用上面的查询检查目标月、地区是否已有记录。以下为各月汇总行示例，不是单策略明细；已存在时应精确修改目标行，不能再插入一条重复汇总。

```sql
INSERT INTO t_sr_strategy_period_summary_ap
    (strategy_id, strategy_code, strategy_name, strategy_count,
     tab_type, strategy_class, channel, big_category, small_category, stat_month,
     push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq,
     reach_count, reach_count_qoq, product_conv_num, product_conv_num_qoq,
     product_conv_rate, product_conv_rate_qoq, actual_income, actual_income_qoq,
     city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('999', '999', '分类汇总', 100, 'active', '升接', '全部', '全部', '全部', '2026-06-01',
     800000, 2.00, 500000, 3.00, 62.50, 0.50,
     400000, 4.00, 100000, 5.00, 25.00, 1.00, 100000.00, 2.00,
     '999', NULL, NOW(), NOW(), 0);
```

补录历史月同样使用此 SQL，日期改为目标月第一天。选择特定渠道时需要维护该渠道对应的汇总行。整体趋势最多取最近 12 条，且前端可能按模拟数据起始月份过滤。最新月份存在额外事实对账，最终以接口返回为准。现有升接 2026 年 1—9 月历史数据在项目记录中标为模拟值。

## 2. 策略触点执行情况：渠道汇总

该模块按策略月事实明细聚合；策略 ID、渠道、大类和小类为汇总标记的行会被排除。渠道汇总数据与第 3 节分类表、以及第 4 节单策略列表共用月事实；新增事实后按筛选范围计算，不需为本模块单独插渠道汇总表。部分环比按历史月或同期日数据计算，不一定直接等于单条事实环比。

### 查询渠道下的事实

```sql
SELECT stat_month, channel, strategy_id, strategy_name, big_category, small_category,
       city_id, county_id, push_count, usage_count, reach_count, product_conv_num
FROM t_sr_strategy_period_summary_ap
WHERE tab_type='active' AND strategy_class='升接' AND stat_month='2026-10-01'
  AND strategy_id <> '999' AND channel <> '全部' AND big_category <> '全部'
  AND COALESCE(small_category, '') <> '全部' AND city_id='999' AND is_deleted=0
ORDER BY channel, strategy_id;
```

### 新增

使用第 4 节“新增策略月度事实”的 SQL；如果还没有策略基础信息，先新增基础信息。渠道必须填写有效渠道编码，可通过以下 SQL 查询：

```sql
SELECT key_code, key_name FROM t_sr_dim_channel WHERE status=1 AND is_deleted=0;
```

## 3. 策略执行情况

### 3.1 策略分类执行情况

分类表根据策略月事实按大类、小类聚合，和第 2 节共用明细行。查询使用第 2 节 SQL，新增使用第 4 节月事实 SQL；不要把 `999` 汇总行当作真实策略。数值与环比可能由接口汇总或计算。

### 3.2 产能趋势

升接、稳的此趋势**直接读取** `t_sr_channel_monthly_capacity_ap` 的 `capacity` 和 `qoq`，与整体趋势不是同一张表；默认全部渠道/大类/小类时读取相应的 `全部` 行。当前本地该表 `stat_month` 为 `varchar(7)`，使用 `2026-06`，请按目标库结构填写。

```sql
SELECT stat_month, channel, big_category, small_category, city_id, county_id, capacity, qoq
FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type='active' AND strategy_class='升接'
  AND channel='全部' AND big_category='全部' AND small_category='全部'
  AND city_id='999' AND stat_month <= '2026-10' AND is_deleted=0
ORDER BY stat_month DESC LIMIT 6;

-- 查重后新增一个月
INSERT INTO t_sr_channel_monthly_capacity_ap
    (tab_type, strategy_class, channel, big_category, small_category, stat_month,
     capacity, qoq, yoy, city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('active', '升接', '全部', '全部', '全部', '2026-06',
     100000, 5.00, NULL, '999', NULL, NOW(), NOW(), 0);
```

筛选某渠道或分类时，需要维护该具体范围的行。升接、稳趋势按当前选择月份最多读取最近 12 条，前端也可能过滤模拟基准月。

### 3.3 业务产能明细

当前升接、稳接口读取 `t_sr_channel_biz_capacity_ap`，按业务名称汇总 `capacity`，并依据各行 `capacity` 和 `qoq` 计算汇总环比。没有选渠道时接口排除渠道及分类为 `全部` 的行。这里不读取 `t_sr_manual_metric` 的业务环比；此前文档对此说明有误。

```sql
SELECT stat_month, channel, big_category, small_category, biz_name,
       city_id, county_id, capacity, qoq
FROM t_sr_channel_biz_capacity_ap
WHERE tab_type='active' AND strategy_class='升接'
  AND stat_month >= '2026-10-01' AND stat_month < '2026-11-01'
  AND city_id='999' AND is_deleted=0
ORDER BY channel, big_category, small_category, biz_name;

-- 查重后新增一个渠道与业务范围
INSERT INTO t_sr_channel_biz_capacity_ap
    (tab_type, strategy_class, channel, big_category, small_category, biz_name,
     stat_month, capacity, qoq, city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('active', '升接', '渠道编码', '实际大类', '实际小类', '示例业务',
     '2026-10-01', 100, 5.00, '999', NULL, NOW(), NOW(), 0);
```

## 4. 策略执行明细

### 4.1 策略基础信息

```sql
SELECT * FROM t_sr_strategy
WHERE tab_type='active' AND strategy_class='升接' AND strategy_code='S_TEST_001'
  AND is_deleted=0;
```

确认编码未使用后新增：

```sql
INSERT INTO t_sr_strategy
    (strategy_code, strategy_name, tab_type, strategy_class, channel,
     create_time, update_time, is_deleted)
VALUES
    ('S_TEST_001', '示例策略', 'active', '升接', '渠道编码', NOW(), NOW(), 0);
```

基础表可按需要补充级别、负责人、开始和结束日期等字段。仅新增基础信息不一定出现在列表：列表还需要对应月份的策略月事实。

### 4.2 策略列表和单策略产能趋势：月度事实

```sql
SELECT stat_month, strategy_id, strategy_name, channel, big_category, small_category,
       city_id, county_id, product_conv_num, product_conv_num_qoq, actual_income
FROM t_sr_strategy_period_summary_ap
WHERE tab_type='active' AND strategy_class='升接' AND strategy_id='S_TEST_001'
  AND stat_month >= '2026-01-01' AND stat_month < '2026-11-01' AND is_deleted=0
ORDER BY stat_month, channel;
```

查重后新增某月、渠道和地区的明细：

```sql
INSERT INTO t_sr_strategy_period_summary_ap
    (strategy_id, strategy_code, strategy_name, strategy_count,
     tab_type, strategy_class, channel, big_category, small_category, stat_month,
     original_cust, push_count, usage_count, usage_rate, reach_count,
     target_conv_num, target_conv_rate, product_conv_num, product_conv_rate,
     expected_income, actual_income, reject_count, reject_rate,
     product_conv_num_qoq, product_conv_rate_qoq, actual_income_qoq,
     city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('S_TEST_001', 'S_TEST_001', '示例策略', 1,
     'active', '升接', '渠道编码', '实际大类', '实际小类', '2026-10-01',
     1000, 800, 500, 62.50, 400,
     100, 25.00, 120, 30.00,
     1200.00, 1000.00, 20, 5.00,
     5.00, 1.00, 3.00,
     '999', NULL, NOW(), NOW(), 0);
```

`stat_month` 改为历史月份的第一天即可补录历史记录。升接、稳策略趋势按月汇总符合条件的明细行，最多取最近 12 个月；环比在多行时按查询逻辑加权。未知的环比请显式写 `NULL`，省略的环比列可能使用表默认 0。查询第 1 节整体页面时会自动重算相应范围的 `999` 汇总；日数据和业务产能仍需分别维护。

### 4.3 单策略业务产能

```sql
SELECT strategy_id, strategy_class, stat_month, biz_code, biz_name, `count`, mom_ratio,
       city_id, county_id
FROM t_sr_strategy_biz_capacity
WHERE strategy_class='升接' AND strategy_id='S_TEST_001'
  AND stat_month >= '2026-10-01' AND stat_month < '2026-11-01'
  AND city_id='999' AND is_deleted=0;

-- 查重后新增
INSERT INTO t_sr_strategy_biz_capacity
    (strategy_id, biz_code, biz_name, stat_month, `count`, mom_ratio, yoy_ratio,
     city_id, county_id, create_time, update_time, is_deleted, strategy_class)
VALUES
    ('S_TEST_001', 'BIZ_001', '示例业务', '2026-10-01', 80, 5.20, NULL,
     '999', NULL, NOW(), NOW(), 0, '升接');
```

`count` 是单策略业务产能，`mom_ratio` 是对应环比。此表与第 3.3 节渠道业务产能表分开维护；新增一处不会自动同步另一处。

### 4.4 执行明细（分日）

```sql
SELECT strategy_id, strategy_class, stat_month, channel, big_category, small_category,
       city_id, county_id, push_count, usage_count, reach_count, product_conv_num
FROM t_sr_strategy_daily_ap
WHERE tab_type='active' AND strategy_class='升接' AND strategy_id='S_TEST_001'
  AND stat_month >= '2026-10-01' AND stat_month < '2026-11-01' AND is_deleted=0
ORDER BY stat_month;

-- 查重后新增一天
INSERT INTO t_sr_strategy_daily_ap
    (strategy_id, strategy_code, strategy_name, big_category, small_category,
     tab_type, strategy_class, channel, stat_month,
     original_cust, push_count, usage_count, usage_rate, reach_count,
     target_conv_num, target_conv_rate, product_conv_num, product_conv_rate,
     expected_income, actual_income, reject_count, reject_rate,
     city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('S_TEST_001', 'S_TEST_001', '示例策略', '实际大类', '实际小类',
     'active', '升接', '渠道编码', '2026-10-15',
     100, 80, 50, 62.50, 40,
     10, 25.00, 12, 30.00,
     120.00, 100.00, 2, 5.00,
     '999', NULL, NOW(), NOW(), 0);
```

日表 `stat_month` 是实际日期；历史月份只需填该月实际日期。日数据可能影响按同期日数计算的环比。策略、渠道、分类、地区应与对应月事实的业务范围一致，不要把月总量逐日重复填写。

### 4.5 拒绝原因

```sql
SELECT strategy_id, stat_month, reason_code, reason_name, reject_count, reject_ratio,
       color, sort_no, city_id, county_id
FROM t_sr_strategy_reject_reason
WHERE strategy_id='S_TEST_001' AND stat_month >= '2026-10-01'
  AND stat_month < '2026-11-01' AND is_deleted=0
ORDER BY sort_no, reject_count DESC;

-- 查重后新增一条原因
INSERT INTO t_sr_strategy_reject_reason
    (strategy_id, stat_month, reason_code, reason_name, reject_count, reject_ratio,
     color, sort_no, city_id, county_id, create_time, update_time, is_deleted)
VALUES
    ('S_TEST_001', '2026-10-01', 'R001', '示例原因', 10, 25.00,
     '#409EFF', 1, '999', NULL, NOW(), NOW(), 0);
```

原因明细来自此表；拒绝率和拒绝量汇总可能读取月事实的对应汇总行，需要按对应范围另行维护。

## 5. 维护后验证

按对应月份、升接/稳、渠道和地区重新查询数据库，再刷新页面检查卡片、趋势、分类表和单策略明细。插入前后分别核对记录数及地区维度，未选区县不限制区县，重复范围可能造成多行或重复汇总。新增历史值后，后续月份环比不会统一自动重算；逐项检查。不要在生产环境直接照搬示例。

代码依据：`StrategyReviewServiceImpl.java`、`StrategyScopeAggregationService.java`、`SrStrategyReviewMapper.xml`、`SrStrategyScopeMapper.xml` 和前端 `StockOverview.vue`、`StockExecution.vue`、`StockDetail.vue`。本文件整理 SQL，不对数据库执行写操作。

**整体自动汇总规则：** 查询升接或稳整体卡片时重算所选月份，查询整体趋势时重算截至所选月份的 12 个月。按策略编码去重统计策略数，数量及收入求和，比率由汇总分子分母计算；现有环比保持不变，新汇总行的环比为空。未选区县时如存在多个区县范围、重复汇总行，或汇总行存在但没有明细，接口会返回错误，需先核对数据或选择区县。仅查询相应页面时触发，不是数据库写入时立即更新。
