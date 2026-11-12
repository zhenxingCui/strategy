-- One-time alignment for active 降拆/离 fact tables.
-- Take a full database backup before applying. Standard active tables are the schema template.
-- Application and ETL paths use stat_month for these classes after this migration.

-- All special tables use the same nullable logical-delete column as their standard counterpart.
ALTER TABLE t_sr_strategy_period_summary_ap_special
    MODIFY COLUMN is_deleted TINYINT NULL DEFAULT NULL COMMENT '';

-- Rename the special daily date column to the standard active name.
ALTER TABLE t_sr_strategy_daily_ap_special
    CHANGE COLUMN stat_date stat_month DATE NULL DEFAULT NULL COMMENT '' AFTER channel,
    MODIFY COLUMN is_deleted TINYINT NULL DEFAULT NULL COMMENT '';

-- Normalize the special table to the pre-V005 standard shape without truncating DATE values.
-- V005 converts both standard and special stat_month columns to DATE.
ALTER TABLE t_sr_channel_monthly_capacity_ap_special
    ADD COLUMN stat_month_aligned VARCHAR(7) NULL DEFAULT NULL AFTER small_category;

UPDATE t_sr_channel_monthly_capacity_ap_special
SET stat_month_aligned = DATE_FORMAT(stat_month, '%Y-%m');

ALTER TABLE t_sr_channel_monthly_capacity_ap_special
    DROP INDEX idx_cmc_ap_tab_month,
    DROP COLUMN stat_month,
    CHANGE COLUMN stat_month_aligned stat_month VARCHAR(7) NULL DEFAULT NULL COMMENT '' AFTER small_category,
    ADD INDEX idx_cmc_ap_tab_month (tab_type, stat_month),
    MODIFY COLUMN is_deleted TINYINT NULL DEFAULT NULL COMMENT '';

ALTER TABLE t_sr_channel_biz_capacity_ap_special
    MODIFY COLUMN is_deleted TINYINT NULL DEFAULT NULL COMMENT '';

-- The standard per-strategy business table keeps stat_date for legacy/passive/control rows.
-- Special rows get stat_month as their active period column, plus the standard strategy_class.
ALTER TABLE t_sr_strategy_biz_capacity_special
    ADD COLUMN stat_month DATE NULL DEFAULT NULL AFTER biz_name,
    MODIFY COLUMN stat_date DATE NULL DEFAULT NULL AFTER stat_month,
    MODIFY COLUMN is_deleted TINYINT NULL DEFAULT NULL COMMENT '',
    ADD COLUMN strategy_class VARCHAR(16) NULL DEFAULT NULL COMMENT '' AFTER is_deleted;

UPDATE t_sr_strategy_biz_capacity_special b
JOIN (
    SELECT strategy_id, MIN(strategy_class) AS strategy_class
    FROM t_sr_strategy_period_summary_ap_special
    WHERE tab_type = 'active'
      AND strategy_class IN ('降拆', '离')
      AND strategy_id IS NOT NULL
      AND strategy_id <> '999'
    GROUP BY strategy_id
    HAVING COUNT(DISTINCT strategy_class) = 1
) p ON p.strategy_id = b.strategy_id
SET b.stat_month = DATE_SUB(b.stat_date, INTERVAL DAYOFMONTH(b.stat_date) - 1 DAY),
    b.strategy_class = p.strategy_class;

ALTER TABLE t_sr_strategy_biz_capacity_special
    DROP INDEX idx_sbc_strategy_date,
    ADD INDEX idx_sbc_strategy_date (strategy_id, stat_month);

-- Review these results after migration: no special business row should lack month or class.
SELECT COUNT(*) AS missing_special_business_month_or_class
FROM t_sr_strategy_biz_capacity_special
WHERE stat_month IS NULL OR strategy_class NOT IN ('降拆', '离');



-- Reorder and normalize each special table to the corresponding active table definition.
-- Match t_sr_strategy_period_summary_ap_special field names, definitions, comments, and ordinal positions to t_sr_strategy_period_summary_ap.
ALTER TABLE t_sr_strategy_period_summary_ap_special
    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '' FIRST,
    MODIFY COLUMN `strategy_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `id`,
    MODIFY COLUMN `strategy_code` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `strategy_id`,
    MODIFY COLUMN `strategy_name` varchar(255) NULL DEFAULT NULL COMMENT '' AFTER `strategy_code`,
    MODIFY COLUMN `strategy_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `strategy_name`,
    MODIFY COLUMN `tab_type` varchar(32) NULL DEFAULT NULL COMMENT '' AFTER `strategy_count`,
    MODIFY COLUMN `channel` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `tab_type`,
    MODIFY COLUMN `big_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `channel`,
    MODIFY COLUMN `small_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `big_category`,
    MODIFY COLUMN `stat_month` date NULL DEFAULT NULL COMMENT '' AFTER `small_category`,
    MODIFY COLUMN `original_cust` bigint NULL DEFAULT NULL COMMENT '' AFTER `stat_month`,
    MODIFY COLUMN `push_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `original_cust`,
    MODIFY COLUMN `usage_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `push_count`,
    MODIFY COLUMN `usage_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_count`,
    MODIFY COLUMN `reach_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `usage_rate`,
    MODIFY COLUMN `target_conv_num` bigint NULL DEFAULT NULL COMMENT '' AFTER `reach_count`,
    MODIFY COLUMN `target_conv_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_num`,
    MODIFY COLUMN `product_conv_num` bigint NULL DEFAULT NULL COMMENT '' AFTER `target_conv_rate`,
    MODIFY COLUMN `product_conv_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_num`,
    MODIFY COLUMN `expected_income` decimal(20,2) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_rate`,
    MODIFY COLUMN `actual_income` decimal(20,2) NULL DEFAULT NULL COMMENT '' AFTER `expected_income`,
    MODIFY COLUMN `reject_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `actual_income`,
    MODIFY COLUMN `reject_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `reject_rate`,
    MODIFY COLUMN `original_cust_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `reject_count`,
    MODIFY COLUMN `push_count_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `original_cust_qoq`,
    MODIFY COLUMN `usage_count_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `push_count_qoq`,
    MODIFY COLUMN `usage_rate_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_count_qoq`,
    MODIFY COLUMN `reach_count_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_rate_qoq`,
    MODIFY COLUMN `target_conv_num_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `reach_count_qoq`,
    MODIFY COLUMN `target_conv_rate_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_num_qoq`,
    MODIFY COLUMN `product_conv_num_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_rate_qoq`,
    MODIFY COLUMN `product_conv_rate_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_num_qoq`,
    MODIFY COLUMN `expected_income_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_rate_qoq`,
    MODIFY COLUMN `actual_income_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `expected_income_qoq`,
    MODIFY COLUMN `reject_rate_qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `actual_income_qoq`,
    MODIFY COLUMN `original_cust_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `reject_rate_qoq`,
    MODIFY COLUMN `push_count_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `original_cust_yoy`,
    MODIFY COLUMN `usage_count_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `push_count_yoy`,
    MODIFY COLUMN `usage_rate_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_count_yoy`,
    MODIFY COLUMN `reach_count_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_rate_yoy`,
    MODIFY COLUMN `target_conv_num_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `reach_count_yoy`,
    MODIFY COLUMN `target_conv_rate_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_num_yoy`,
    MODIFY COLUMN `product_conv_num_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_rate_yoy`,
    MODIFY COLUMN `product_conv_rate_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_num_yoy`,
    MODIFY COLUMN `expected_income_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_rate_yoy`,
    MODIFY COLUMN `actual_income_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `expected_income_yoy`,
    MODIFY COLUMN `reject_rate_yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `actual_income_yoy`,
    MODIFY COLUMN `city_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `reject_rate_yoy`,
    MODIFY COLUMN `county_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `city_id`,
    MODIFY COLUMN `create_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `county_id`,
    MODIFY COLUMN `update_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `create_time`,
    MODIFY COLUMN `is_deleted` tinyint NULL DEFAULT NULL COMMENT '' AFTER `update_time`,
    MODIFY COLUMN `strategy_class` varchar(16) NULL DEFAULT NULL COMMENT '' AFTER `is_deleted`;

-- Match t_sr_strategy_daily_ap_special field names, definitions, comments, and ordinal positions to t_sr_strategy_daily_ap.
ALTER TABLE t_sr_strategy_daily_ap_special
    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '' FIRST,
    MODIFY COLUMN `strategy_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `id`,
    MODIFY COLUMN `strategy_code` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `strategy_id`,
    MODIFY COLUMN `strategy_name` varchar(255) NULL DEFAULT NULL COMMENT '' AFTER `strategy_code`,
    MODIFY COLUMN `big_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `strategy_name`,
    MODIFY COLUMN `small_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `big_category`,
    MODIFY COLUMN `tab_type` varchar(32) NULL DEFAULT NULL COMMENT '' AFTER `small_category`,
    MODIFY COLUMN `channel` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `tab_type`,
    MODIFY COLUMN `stat_month` date NULL DEFAULT NULL COMMENT '' AFTER `channel`,
    MODIFY COLUMN `original_cust` bigint NULL DEFAULT NULL COMMENT '' AFTER `stat_month`,
    MODIFY COLUMN `push_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `original_cust`,
    MODIFY COLUMN `usage_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `push_count`,
    MODIFY COLUMN `usage_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `usage_count`,
    MODIFY COLUMN `reach_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `usage_rate`,
    MODIFY COLUMN `target_conv_num` bigint NULL DEFAULT NULL COMMENT '' AFTER `reach_count`,
    MODIFY COLUMN `target_conv_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `target_conv_num`,
    MODIFY COLUMN `product_conv_num` bigint NULL DEFAULT NULL COMMENT '' AFTER `target_conv_rate`,
    MODIFY COLUMN `product_conv_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_num`,
    MODIFY COLUMN `expected_income` decimal(20,2) NULL DEFAULT NULL COMMENT '' AFTER `product_conv_rate`,
    MODIFY COLUMN `actual_income` decimal(20,2) NULL DEFAULT NULL COMMENT '' AFTER `expected_income`,
    MODIFY COLUMN `reject_rate` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `actual_income`,
    MODIFY COLUMN `reject_count` bigint NULL DEFAULT NULL COMMENT '' AFTER `reject_rate`,
    MODIFY COLUMN `city_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `reject_count`,
    MODIFY COLUMN `county_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `city_id`,
    MODIFY COLUMN `create_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `county_id`,
    MODIFY COLUMN `update_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `create_time`,
    MODIFY COLUMN `is_deleted` tinyint NULL DEFAULT NULL COMMENT '' AFTER `update_time`,
    MODIFY COLUMN `strategy_class` varchar(16) NULL DEFAULT NULL COMMENT '' AFTER `is_deleted`;

-- Match t_sr_channel_monthly_capacity_ap_special field names, definitions, comments, and ordinal positions to t_sr_channel_monthly_capacity_ap.
ALTER TABLE t_sr_channel_monthly_capacity_ap_special
    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '' FIRST,
    MODIFY COLUMN `tab_type` varchar(32) NULL DEFAULT NULL COMMENT '' AFTER `id`,
    MODIFY COLUMN `channel` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `tab_type`,
    MODIFY COLUMN `big_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `channel`,
    MODIFY COLUMN `small_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `big_category`,
    MODIFY COLUMN `stat_month` varchar(7) NULL DEFAULT NULL COMMENT '账期 yyyyMM' AFTER `small_category`,
    MODIFY COLUMN `capacity` bigint NULL DEFAULT NULL COMMENT '' AFTER `stat_month`,
    MODIFY COLUMN `qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `capacity`,
    MODIFY COLUMN `yoy` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `qoq`,
    MODIFY COLUMN `city_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `yoy`,
    MODIFY COLUMN `county_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `city_id`,
    MODIFY COLUMN `create_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `county_id`,
    MODIFY COLUMN `update_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `create_time`,
    MODIFY COLUMN `is_deleted` tinyint NULL DEFAULT NULL COMMENT '' AFTER `update_time`,
    MODIFY COLUMN `strategy_class` varchar(16) NULL DEFAULT NULL COMMENT '' AFTER `is_deleted`;

-- Match t_sr_channel_biz_capacity_ap_special field names, definitions, comments, and ordinal positions to t_sr_channel_biz_capacity_ap.
ALTER TABLE t_sr_channel_biz_capacity_ap_special
    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '' FIRST,
    MODIFY COLUMN `tab_type` varchar(32) NULL DEFAULT NULL COMMENT '' AFTER `id`,
    MODIFY COLUMN `channel` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `tab_type`,
    MODIFY COLUMN `big_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `channel`,
    MODIFY COLUMN `small_category` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `big_category`,
    MODIFY COLUMN `biz_name` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `small_category`,
    MODIFY COLUMN `stat_month` date NULL DEFAULT NULL COMMENT '' AFTER `biz_name`,
    MODIFY COLUMN `capacity` bigint NULL DEFAULT NULL COMMENT '' AFTER `stat_month`,
    MODIFY COLUMN `qoq` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `capacity`,
    MODIFY COLUMN `city_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `qoq`,
    MODIFY COLUMN `county_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `city_id`,
    MODIFY COLUMN `create_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `county_id`,
    MODIFY COLUMN `update_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `create_time`,
    MODIFY COLUMN `is_deleted` tinyint NULL DEFAULT NULL COMMENT '' AFTER `update_time`,
    MODIFY COLUMN `strategy_class` varchar(16) NULL DEFAULT NULL COMMENT '' AFTER `is_deleted`;

-- Match t_sr_strategy_biz_capacity_special field names, definitions, comments, and ordinal positions to t_sr_strategy_biz_capacity.
ALTER TABLE t_sr_strategy_biz_capacity_special
    MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT COMMENT '' FIRST,
    MODIFY COLUMN `tab_type` varchar(32) NOT NULL DEFAULT 'active' COMMENT '' AFTER `id`,
    MODIFY COLUMN `strategy_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `tab_type`,
    MODIFY COLUMN `biz_code` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `strategy_id`,
    MODIFY COLUMN `biz_name` varchar(128) NULL DEFAULT NULL COMMENT '' AFTER `biz_code`,
    MODIFY COLUMN `stat_month` date NULL DEFAULT NULL COMMENT '' AFTER `biz_name`,
    MODIFY COLUMN `stat_date` date NULL DEFAULT NULL COMMENT '' AFTER `stat_month`,
    MODIFY COLUMN `count` bigint NULL DEFAULT NULL COMMENT '' AFTER `stat_date`,
    MODIFY COLUMN `mom_ratio` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `count`,
    MODIFY COLUMN `yoy_ratio` decimal(14,4) NULL DEFAULT NULL COMMENT '' AFTER `mom_ratio`,
    MODIFY COLUMN `city_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `yoy_ratio`,
    MODIFY COLUMN `county_id` varchar(64) NULL DEFAULT NULL COMMENT '' AFTER `city_id`,
    MODIFY COLUMN `create_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `county_id`,
    MODIFY COLUMN `update_time` datetime NULL DEFAULT NULL COMMENT '' AFTER `create_time`,
    MODIFY COLUMN `is_deleted` tinyint NULL DEFAULT NULL COMMENT '' AFTER `update_time`,
    MODIFY COLUMN `strategy_class` varchar(16) NULL DEFAULT NULL COMMENT '' AFTER `is_deleted`;
