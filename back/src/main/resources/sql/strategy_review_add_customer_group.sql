-- 仅为策略主表增加客群名称；汇总表和事实表无需改动。
-- 先选择目标数据库。可重复执行，不覆盖已有客群归属。
SET @sr_customer_group_ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy' AND COLUMN_NAME = 'customer_group') = 0,
    'ALTER TABLE t_sr_strategy ADD COLUMN customer_group VARCHAR(64) DEFAULT NULL COMMENT ''重点客群分类名称，一条策略固定归属一类客群''',
    'SELECT 1'
);
PREPARE sr_customer_group_stmt FROM @sr_customer_group_ddl;
EXECUTE sr_customer_group_stmt;
DEALLOCATE PREPARE sr_customer_group_stmt;

SET @sr_customer_group_ddl = IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_key_audience') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_key_audience' AND COLUMN_NAME = 'customer_group') = 0,
    'ALTER TABLE t_sr_strategy_key_audience ADD COLUMN customer_group VARCHAR(64) DEFAULT NULL COMMENT ''重点客群分类名称，一条策略固定归属一类客群''',
    'SELECT 1'
);
PREPARE sr_customer_group_stmt FROM @sr_customer_group_ddl;
EXECUTE sr_customer_group_stmt;
DEALLOCATE PREPARE sr_customer_group_stmt;

-- Keep split masters aligned for v_sr_strategy_read.
SET @sr_customer_group_ddl = IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_special') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_special' AND COLUMN_NAME = 'customer_group') = 0,
    'ALTER TABLE t_sr_strategy_special ADD COLUMN customer_group VARCHAR(64) DEFAULT NULL COMMENT ''重点客群分类名称，一条策略固定归属一类客群''',
    'SELECT 1'
);
PREPARE sr_customer_group_stmt FROM @sr_customer_group_ddl;
EXECUTE sr_customer_group_stmt;
DEALLOCATE PREPARE sr_customer_group_stmt;

SET @sr_customer_group_ddl = IF(
    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_passive') > 0
    AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy_passive' AND COLUMN_NAME = 'customer_group') = 0,
    'ALTER TABLE t_sr_strategy_passive ADD COLUMN customer_group VARCHAR(64) DEFAULT NULL COMMENT ''重点客群分类名称，一条策略固定归属一类客群''',
    'SELECT 1'
);
PREPARE sr_customer_group_stmt FROM @sr_customer_group_ddl;
EXECUTE sr_customer_group_stmt;
DEALLOCATE PREPARE sr_customer_group_stmt;
