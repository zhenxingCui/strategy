-- Align the active up-sell/stable base tables with the production ETL column contract.
-- The stat_month additions are conditional because local/production installations may
-- already have them. Legacy stat_date columns and rows are retained for other tabs.
DELIMITER $$
DROP PROCEDURE IF EXISTS sr_align_upgrade_stable_production_columns$$
CREATE PROCEDURE sr_align_upgrade_stable_production_columns()
BEGIN
    DECLARE v_exists INT DEFAULT 0;
    DECLARE v_type VARCHAR(32);

    SELECT COUNT(*) INTO v_exists
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 't_sr_strategy_daily_ap'
       AND column_name = 'stat_month';
    IF v_exists = 0 THEN
        ALTER TABLE t_sr_strategy_daily_ap
            ADD COLUMN stat_month DATE DEFAULT NULL COMMENT '生产ETL统计日期' AFTER strategy_id;
    END IF;

    SELECT COUNT(*) INTO v_exists
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 't_sr_strategy_daily_ap'
       AND column_name = 'stat_date';
    IF v_exists > 0 THEN
        UPDATE t_sr_strategy_daily_ap
           SET stat_month = stat_date
         WHERE stat_month IS NULL AND stat_date IS NOT NULL;
    END IF;

    SELECT COUNT(*) INTO v_exists
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 't_sr_strategy_biz_capacity'
       AND column_name = 'stat_month';
    IF v_exists = 0 THEN
        ALTER TABLE t_sr_strategy_biz_capacity
            ADD COLUMN stat_month DATE DEFAULT NULL COMMENT '生产ETL账期' AFTER strategy_id;
    END IF;

    SELECT COUNT(*) INTO v_exists
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 't_sr_strategy_biz_capacity'
       AND column_name = 'stat_date';
    IF v_exists > 0 THEN
        UPDATE t_sr_strategy_biz_capacity
           SET stat_month = stat_date
         WHERE stat_month IS NULL AND stat_date IS NOT NULL;
    END IF;

    SELECT DATA_TYPE INTO v_type
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 't_sr_channel_monthly_capacity_ap'
       AND column_name = 'stat_month';
    IF v_type IN ('date', 'datetime', 'timestamp') THEN
        ALTER TABLE t_sr_channel_monthly_capacity_ap
            MODIFY COLUMN stat_month VARCHAR(10) DEFAULT NULL COMMENT '账期 yyyyMM';
        UPDATE t_sr_channel_monthly_capacity_ap
           SET stat_month = REPLACE(LEFT(stat_month, 7), '-', '')
         WHERE stat_month IS NOT NULL;
    END IF;
    ALTER TABLE t_sr_channel_monthly_capacity_ap
        MODIFY COLUMN stat_month VARCHAR(7) DEFAULT NULL COMMENT '账期 yyyyMM';
END$$
DELIMITER ;
CALL sr_align_upgrade_stable_production_columns();
DROP PROCEDURE sr_align_upgrade_stable_production_columns;
