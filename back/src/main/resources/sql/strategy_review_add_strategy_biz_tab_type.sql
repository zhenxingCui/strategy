-- Existing database migration: separate per-strategy business-capacity rows
-- by the existing view type without creating or dropping any table.
-- Compatible with MySQL 5.7; safe to rerun.

SET @sr_has_tab_type = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 't_sr_strategy_biz_capacity'
      AND COLUMN_NAME = 'tab_type'
);
SET @sr_ddl = IF(
    @sr_has_tab_type = 0,
    'ALTER TABLE t_sr_strategy_biz_capacity ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT ''active'' COMMENT ''策略类型：active/passive/control'' AFTER id',
    'SELECT 1'
);
PREPARE sr_stmt FROM @sr_ddl;
EXECUTE sr_stmt;
DEALLOCATE PREPARE sr_stmt;

-- Backfill from the strategy master when possible; historical orphan rows
-- belong to the existing active dataset by default.
UPDATE t_sr_strategy_biz_capacity b
JOIN t_sr_strategy s ON s.strategy_code = b.strategy_id
SET b.tab_type = s.tab_type
WHERE s.tab_type IN ('active', 'passive', 'control');
UPDATE t_sr_strategy_biz_capacity
SET tab_type = 'active'
WHERE tab_type IS NULL OR tab_type = '';

SET @sr_has_index = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 't_sr_strategy_biz_capacity'
      AND INDEX_NAME = 'idx_sbc_tab_strategy_date'
);
SET @sr_ddl = IF(
    @sr_has_index = 0,
    'ALTER TABLE t_sr_strategy_biz_capacity ADD INDEX idx_sbc_tab_strategy_date (tab_type, strategy_id, stat_date)',
    'SELECT 1'
);
PREPARE sr_stmt FROM @sr_ddl;
EXECUTE sr_stmt;
DEALLOCATE PREPARE sr_stmt;
