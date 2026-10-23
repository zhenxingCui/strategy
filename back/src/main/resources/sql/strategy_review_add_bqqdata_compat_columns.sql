-- Add source columns used by the BQQData October exports.
-- Safe to rerun on MySQL 5.7+; no existing rows are removed or rewritten.

DROP PROCEDURE IF EXISTS sr_add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE sr_add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @sr_ddl = CONCAT(
            'ALTER TABLE `', REPLACE(p_table, '`', '``'),
            '` ADD COLUMN `', REPLACE(p_column, '`', '``'), '` ', p_definition
        );
        PREPARE sr_stmt FROM @sr_ddl;
        EXECUTE sr_stmt;
        DEALLOCATE PREPARE sr_stmt;
    END IF;
END$$
DELIMITER ;

CALL sr_add_column_if_missing('t_sr_strategy', 'city_id', 'VARCHAR(64) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy', 'county_id', 'VARCHAR(64) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy', 'update_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy', 'create_by', 'VARCHAR(64) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy', 'update_by', 'VARCHAR(64) DEFAULT NULL');

CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'strategy_code', 'VARCHAR(64) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'original_cust_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'push_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'usage_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'usage_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'reach_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'target_conv_num_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'target_conv_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'product_conv_num_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'product_conv_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'expected_income_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'actual_income_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'reject_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_period_summary_ap', 'update_time', 'DATETIME DEFAULT NULL');

CALL sr_add_column_if_missing('t_sr_strategy_daily_ap', 'strategy_code', 'VARCHAR(64) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_daily_ap', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_daily_ap', 'update_time', 'DATETIME DEFAULT NULL');

CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'strategy_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'original_cust_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'push_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'usage_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'usage_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'reach_count_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'target_conv_num_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'target_conv_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'product_conv_num_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'product_conv_rate_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'expected_income_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'actual_income_yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_summary_ap', 'update_time', 'DATETIME DEFAULT NULL');

CALL sr_add_column_if_missing('t_sr_channel_monthly_capacity_ap', 'yoy', 'DECIMAL(14,4) DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_monthly_capacity_ap', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_monthly_capacity_ap', 'update_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_biz_capacity_ap', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_channel_biz_capacity_ap', 'update_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_biz_capacity', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_biz_capacity', 'update_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_kpi_summary', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_kpi_summary', 'update_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_reject_reason', 'create_time', 'DATETIME DEFAULT NULL');
CALL sr_add_column_if_missing('t_sr_strategy_reject_reason', 'update_time', 'DATETIME DEFAULT NULL');

DROP PROCEDURE IF EXISTS sr_add_column_if_missing;
