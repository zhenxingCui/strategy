-- Align the five key-audience fact tables with the active-class schemas.
-- Take a full database backup before applying this migration.
-- Existing daily dates are retained under stat_month; per-strategy business
-- rows keep stat_date and gain a first-of-month stat_month for active queries.

ALTER TABLE t_sr_strategy_daily_ap_key_audience
    CHANGE COLUMN stat_date stat_month DATE NULL DEFAULT NULL COMMENT '统计日期' AFTER channel;

ALTER TABLE t_sr_strategy_biz_capacity_key_audience
    ADD COLUMN stat_month DATE NULL DEFAULT NULL COMMENT '账期' AFTER biz_name,
    ADD COLUMN strategy_class VARCHAR(16) NULL DEFAULT NULL COMMENT '策略分类' AFTER is_deleted;

UPDATE t_sr_strategy_biz_capacity_key_audience
SET stat_month = DATE_SUB(stat_date, INTERVAL DAYOFMONTH(stat_date) - 1 DAY),
    strategy_class = '重点客群';

UPDATE t_sr_strategy_period_summary_ap_key_audience SET strategy_class = '重点客群';
UPDATE t_sr_strategy_daily_ap_key_audience SET strategy_class = '重点客群';
UPDATE t_sr_channel_monthly_capacity_ap_key_audience SET strategy_class = '重点客群';
UPDATE t_sr_channel_biz_capacity_ap_key_audience SET strategy_class = '重点客群';

-- Use each standard table as the source of column order, nullability,
-- defaults, comments, and types. This keeps SELECT * compatibility views safe.
DELIMITER $$
CREATE PROCEDURE sr_align_key_audience_fact_table(
    IN p_source_table VARCHAR(64),
    IN p_target_table VARCHAR(64)
)
BEGIN
    DECLARE v_done TINYINT DEFAULT 0;
    DECLARE v_column_name VARCHAR(64);
    DECLARE v_column_type TEXT;
    DECLARE v_nullable VARCHAR(3);
    DECLARE v_default TEXT;
    DECLARE v_extra VARCHAR(128);
    DECLARE v_comment TEXT;
    DECLARE v_previous_column VARCHAR(64) DEFAULT NULL;
    DECLARE v_definition LONGTEXT DEFAULT '';
    DECLARE v_alter_sql LONGTEXT DEFAULT '';

    DECLARE c_columns CURSOR FOR
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_source_table
        ORDER BY ORDINAL_POSITION;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN c_columns;
    read_columns: LOOP
        FETCH c_columns INTO v_column_name, v_column_type, v_nullable, v_default, v_extra, v_comment;
        IF v_done = 1 THEN
            LEAVE read_columns;
        END IF;

        SET v_definition = CONCAT(
            'MODIFY COLUMN `', REPLACE(v_column_name, '`', '``'), '` ', v_column_type,
            IF(v_nullable = 'YES', ' NULL', ' NOT NULL'),
            IF(v_default IS NOT NULL, CONCAT(' DEFAULT ', QUOTE(v_default)),
                IF(v_nullable = 'YES', ' DEFAULT NULL', '')),
            IF(v_extra IS NOT NULL AND v_extra <> '', CONCAT(' ', v_extra), ''),
            ' COMMENT ', QUOTE(v_comment),
            IF(v_previous_column IS NULL, ' FIRST',
                CONCAT(' AFTER `', REPLACE(v_previous_column, '`', '``'), '`'))
        );
        SET v_alter_sql = IF(v_alter_sql = '', v_definition, CONCAT(v_alter_sql, ', ', v_definition));
        SET v_previous_column = v_column_name;
    END LOOP;
    CLOSE c_columns;

    SET @sr_key_audience_alter_sql = CONCAT(
        'ALTER TABLE `', REPLACE(DATABASE(), '`', '``'), '`.`',
        REPLACE(p_target_table, '`', '``'), '` ', v_alter_sql
    );
    PREPARE sr_key_audience_alter_stmt FROM @sr_key_audience_alter_sql;
    EXECUTE sr_key_audience_alter_stmt;
    DEALLOCATE PREPARE sr_key_audience_alter_stmt;
END$$
DELIMITER ;

CALL sr_align_key_audience_fact_table(
    't_sr_strategy_period_summary_ap', 't_sr_strategy_period_summary_ap_key_audience');
CALL sr_align_key_audience_fact_table(
    't_sr_strategy_daily_ap', 't_sr_strategy_daily_ap_key_audience');
CALL sr_align_key_audience_fact_table(
    't_sr_channel_monthly_capacity_ap', 't_sr_channel_monthly_capacity_ap_key_audience');
CALL sr_align_key_audience_fact_table(
    't_sr_channel_biz_capacity_ap', 't_sr_channel_biz_capacity_ap_key_audience');
CALL sr_align_key_audience_fact_table(
    't_sr_strategy_biz_capacity', 't_sr_strategy_biz_capacity_key_audience');
DROP PROCEDURE sr_align_key_audience_fact_table;

-- Match the monthly lookup index on the strategy-business table. Retain the
-- tab/strategy/day index so daily business source rows remain addressable.
ALTER TABLE t_sr_strategy_biz_capacity_key_audience
    DROP INDEX idx_sbc_strategy_date,
    ADD INDEX idx_sbc_strategy_date (strategy_id, stat_month);

-- The shared daily compatibility view exposes stat_date for legacy callers;
-- each aligned physical table now supplies that value from stat_month.
CREATE OR REPLACE VIEW v_sr_strategy_daily_ap_read AS
SELECT id, tab_type, strategy_class, strategy_id, stat_month AS stat_date, channel, big_category, small_category,
       strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num,
       target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count,
       reject_rate, city_id, county_id, is_deleted, strategy_code, create_time, update_time
FROM t_sr_strategy_daily_ap
UNION ALL
SELECT id, tab_type, strategy_class, strategy_id, stat_month AS stat_date, channel, big_category, small_category,
       strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num,
       target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count,
       reject_rate, city_id, county_id, is_deleted, strategy_code, create_time, update_time
FROM t_sr_strategy_daily_ap_special
UNION ALL
SELECT id, tab_type, strategy_class, strategy_id, stat_month AS stat_date, channel, big_category, small_category,
       strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num,
       target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count,
       reject_rate, city_id, county_id, is_deleted, strategy_code, create_time, update_time
FROM t_sr_strategy_daily_ap_key_audience;

-- The following query should return no rows once all five schemas are aligned.
SELECT base.TABLE_NAME AS base_table, target.TABLE_NAME AS key_audience_table,
       base.COLUMN_NAME AS base_column, target.COLUMN_NAME AS key_audience_column
FROM information_schema.COLUMNS base
LEFT JOIN information_schema.COLUMNS target
  ON target.TABLE_SCHEMA = base.TABLE_SCHEMA
 AND target.TABLE_NAME = CASE base.TABLE_NAME
       WHEN 't_sr_strategy_period_summary_ap' THEN 't_sr_strategy_period_summary_ap_key_audience'
       WHEN 't_sr_strategy_daily_ap' THEN 't_sr_strategy_daily_ap_key_audience'
       WHEN 't_sr_channel_monthly_capacity_ap' THEN 't_sr_channel_monthly_capacity_ap_key_audience'
       WHEN 't_sr_channel_biz_capacity_ap' THEN 't_sr_channel_biz_capacity_ap_key_audience'
       WHEN 't_sr_strategy_biz_capacity' THEN 't_sr_strategy_biz_capacity_key_audience'
     END
 AND target.ORDINAL_POSITION = base.ORDINAL_POSITION
WHERE base.TABLE_SCHEMA = DATABASE()
  AND base.TABLE_NAME IN (
      't_sr_strategy_period_summary_ap', 't_sr_strategy_daily_ap',
      't_sr_channel_monthly_capacity_ap', 't_sr_channel_biz_capacity_ap',
      't_sr_strategy_biz_capacity')
  AND (target.COLUMN_NAME IS NULL OR target.COLUMN_NAME <> base.COLUMN_NAME
       OR target.COLUMN_TYPE <> base.COLUMN_TYPE
       OR target.IS_NULLABLE <> base.IS_NULLABLE
       OR NOT (target.COLUMN_DEFAULT <=> base.COLUMN_DEFAULT));
