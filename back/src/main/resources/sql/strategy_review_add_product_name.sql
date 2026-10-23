-- 先选择目标数据库。仅在策略主表增加产品名称，可重复执行，不修改已有归属及统计数据。
SET @sr_product_name_ddl = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_sr_strategy' AND COLUMN_NAME = 'product_name') = 0,
    'ALTER TABLE t_sr_strategy ADD COLUMN product_name VARCHAR(128) DEFAULT NULL COMMENT ''重点产品名称，一条策略固定归属一个产品''',
    'SELECT 1'
);
PREPARE sr_product_name_stmt FROM @sr_product_name_ddl;
EXECUTE sr_product_name_stmt;
DEALLOCATE PREPARE sr_product_name_stmt;
