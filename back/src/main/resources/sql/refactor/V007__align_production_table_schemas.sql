-- Align the seven production-backed local tables to the CREATE TABLE contracts in the supplied production DDL.
-- Local only: strategy_review_active_class_local. Take a full backup before running.
-- Decimal fields are rounded by the target DECIMAL scale. Monthly capacity dates become yyyyMM strings.
-- Local-only class rows are preserved in *_local_class_archive; control business rows are preserved in *_ctrl.

DELIMITER $$
DROP PROCEDURE IF EXISTS sr_assert_local_prod_alignment_target$$
CREATE PROCEDURE sr_assert_local_prod_alignment_target()
BEGIN
    IF DATABASE() <> 'strategy_review_active_class_local' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'V007 is restricted to strategy_review_active_class_local';
    END IF;
END$$
CALL sr_assert_local_prod_alignment_target()$$
DROP PROCEDURE sr_assert_local_prod_alignment_target$$
DELIMITER ;

-- Preserve local-only row classifications and control-scope records before replacing the base tables.
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_local_class_archive LIKE t_sr_kpi_summary;
INSERT IGNORE INTO t_sr_kpi_summary_local_class_archive
SELECT * FROM t_sr_kpi_summary WHERE strategy_class IS NOT NULL AND strategy_class <> '全部';
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_local_class_archive LIKE t_sr_channel_summary_ap;
INSERT IGNORE INTO t_sr_channel_summary_ap_local_class_archive
SELECT * FROM t_sr_channel_summary_ap WHERE strategy_class IS NOT NULL AND strategy_class <> '全部';
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_ctrl LIKE t_sr_strategy_biz_capacity_special;
INSERT IGNORE INTO t_sr_strategy_biz_capacity_ctrl
    (id, tab_type, strategy_id, stat_month, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, create_time, update_time, is_deleted, strategy_class)
SELECT id, tab_type, strategy_id, stat_month, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, create_time, update_time, is_deleted, strategy_class
FROM t_sr_strategy_biz_capacity WHERE tab_type = 'control';

-- Remove compatibility views while their base tables are replaced.
DROP VIEW IF EXISTS v_sr_kpi_summary_read;
DROP VIEW IF EXISTS v_sr_channel_summary_ap_read;
DROP VIEW IF EXISTS v_sr_strategy_biz_capacity_read;
DROP VIEW IF EXISTS v_sr_strategy_period_summary_ap_read;
DROP VIEW IF EXISTS v_sr_strategy_daily_ap_read;
DROP VIEW IF EXISTS v_sr_channel_monthly_capacity_ap_read;
DROP VIEW IF EXISTS v_sr_channel_biz_capacity_ap_read;

CREATE TABLE `t_sr_channel_biz_capacity_ap__v007` (
  id BIGINT COMMENT '主键',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive',
  channel VARCHAR(64) NOT NULL COMMENT '触点渠道',
  big_category VARCHAR(64) DEFAULT NULL COMMENT '策略大类（联动筛选用，NULL 表示全大类汇总）',
  small_category VARCHAR(64) DEFAULT NULL COMMENT '策略小类（联动筛选用，NULL 表示全小类汇总）',
  biz_name VARCHAR(128) NOT NULL COMMENT '业务/产品名称（如靓号推荐、家庭融合、宽带新装、千兆升级、校园专享）',
  stat_month DATE NOT NULL COMMENT '数据账期YYYYMM',
  capacity BIGINT NOT NULL DEFAULT 0 COMMENT '周期内产能（全产品转化量）',
  qoq DECIMAL(10,2) DEFAULT NULL COMMENT '环比（%）',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL COMMENT '更新时间',
is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
 strategy_class varchar(16) DEFAULT  NULL
);

CREATE TABLE `t_sr_channel_monthly_capacity_ap__v007` (
  id BIGINT COMMENT '主键',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive',
  channel VARCHAR(64) NOT NULL COMMENT '触点渠道',
  big_category VARCHAR(64) DEFAULT NULL COMMENT '策略大类（联动筛选用，NULL 表示全大类汇总）',
  small_category VARCHAR(64) DEFAULT NULL COMMENT '策略小类（联动筛选用，NULL 表示全小类汇总）',
  stat_month VARCHAR(7) NOT NULL COMMENT '统计月份 yyyyMM',
  capacity BIGINT NOT NULL DEFAULT 0 COMMENT '月产能（全产品转化量）',
  qoq DECIMAL(10,2) DEFAULT 0 COMMENT '环比（%）',
  yoy DECIMAL(10,2) DEFAULT 0 COMMENT '同比（%）',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL  COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
 strategy_class varchar(16) DEFAULT  NULL
) ;

CREATE TABLE `t_sr_channel_summary_ap__v007` (
  id BIGINT COMMENT '主键',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive',
  channel VARCHAR(64) NOT NULL COMMENT '触点渠道',
  stat_month DATE NOT NULL COMMENT '数据账期',
  strategy_count INT NOT NULL DEFAULT 0 COMMENT '策略量',
  original_cust BIGINT DEFAULT NULL COMMENT '原始客群',
  push_count BIGINT DEFAULT NULL COMMENT '推送量',
  usage_count BIGINT DEFAULT NULL COMMENT '使用量',
  usage_rate DECIMAL(10,2) DEFAULT NULL COMMENT '使用率（%）',
  reach_count BIGINT DEFAULT NULL COMMENT '触达量',
  target_conv_num BIGINT DEFAULT NULL COMMENT '目标转化量',
  target_conv_rate DECIMAL(10,2) DEFAULT NULL COMMENT '目标转化率（%）',
  product_conv_num BIGINT DEFAULT NULL COMMENT '全产品转化量',
  product_conv_rate DECIMAL(10,2) DEFAULT NULL COMMENT '全产品转化率（%）',
  expected_income DECIMAL(18,2) DEFAULT NULL COMMENT '预期收入（元）',
  actual_income DECIMAL(18,2) DEFAULT NULL COMMENT '实际收入（元）',
  strategy_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '策略量环比（%）',
  original_cust_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '原始客群环比（%）',
  push_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '推送量环比（%）',
  usage_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '使用量环比（%）',
  usage_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '使用率环比（pp）',
  reach_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '触达量环比（%）',
  target_conv_num_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化量环比（%）',
  target_conv_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化率环比（pp）',
  product_conv_num_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化量环比（%）',
  product_conv_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化率环比（pp）',
  expected_income_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '预期收入环比（%）',
  actual_income_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '实际收入环比（%）',
  strategy_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '策略量同比（%）',
  original_cust_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '原始客群同比（%）',
  push_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '推送量同比（%）',
  usage_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '使用量同比（%）',
  usage_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '使用率同比（pp）',
  reach_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '触达量同比（%）',
  target_conv_num_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化量同比（%）',
  target_conv_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化率同比（pp）',
  product_conv_num_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化量同比（%）',
  product_conv_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化率同比（pp）',
  expected_income_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '预期收入同比（%）',
  actual_income_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '实际收入同比（%）',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除'
) ;

CREATE TABLE `t_sr_kpi_summary__v007` (
  id BIGINT  COMMENT '主键',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive/control',
  metric_code VARCHAR(64) NOT NULL COMMENT '指标编码（dim_metric.metric_code）',
  metric_name VARCHAR(128) NOT NULL COMMENT '指标名称（冗余，如策略数/推送量/使用量/触达量/转化量/转化率/转收）',
  stat_month VARCHAR(16) NOT NULL COMMENT '账期月份 202608',
  value DECIMAL(18,2) NOT NULL COMMENT '周期汇总值',
  unit VARCHAR(16) NOT NULL DEFAULT '个' COMMENT '单位：个/%/元/万/万元',
  qoq DECIMAL(10,2) DEFAULT NULL COMMENT '环比（%，正升负降；百分比类指标存 pp 差）',
  yoy DECIMAL(10,2) DEFAULT NULL COMMENT '同比（%，正升负降；百分比类指标存 pp 差）',
  icon VARCHAR(32) DEFAULT NULL COMMENT '图标标识（冗余，前端用：grid/send/user-check/eye/trending/percent/dollar）',
  sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL  COMMENT '创建时间',
  update_time DATETIME NOT  NULL COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除'
) ;

CREATE TABLE `t_sr_strategy_biz_capacity__v007` (
  id BIGINT COMMENT '主键',
  strategy_id VARCHAR(64)  NOT NULL COMMENT '策略 id',
  biz_code VARCHAR(64) NOT NULL COMMENT '业务编码',
  biz_name VARCHAR(128) NOT NULL COMMENT '业务名称',
  stat_month DATE NOT NULL COMMENT '统计日期',
  count BIGINT NOT NULL DEFAULT 0 COMMENT '办理量',
  mom_ratio DECIMAL(10,2) DEFAULT 0 COMMENT '环比（%，正升负降）',
  yoy_ratio DECIMAL(10,2) DEFAULT 0 COMMENT '同比（%，正升负降，由写表方填入）',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
 strategy_class varchar(16) DEFAULT  NULL
) ;

CREATE TABLE `t_sr_strategy_daily_ap__v007` (
  id BIGINT COMMENT '主键',
  strategy_id VARCHAR(64)  NOT NULL COMMENT '策略 id（t_sr_strategy.id）',
  strategy_code VARCHAR(64) NOT NULL COMMENT '策略编码（冗余，便于查询）',
  strategy_name VARCHAR(128) NOT NULL COMMENT '策略名称（冗余）',
  big_category VARCHAR(64) DEFAULT NULL COMMENT '策略大类（联动筛选用，NULL 表示全大类汇总）',
  small_category VARCHAR(64) DEFAULT NULL COMMENT '策略小类（联动筛选用，NULL 表示全小类汇总）',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive',
  channel VARCHAR(64) NOT NULL COMMENT '触点渠道',
  stat_month DATE NOT NULL COMMENT '统计日期',
  original_cust BIGINT DEFAULT 0 COMMENT '原始客群',
  push_count BIGINT DEFAULT 0 COMMENT '推送量',
  usage_count BIGINT DEFAULT 0 COMMENT '使用量',
  usage_rate DECIMAL(10,2) DEFAULT 0 COMMENT '使用率（%）',
  reach_count BIGINT DEFAULT 0 COMMENT '触达量',
  target_conv_num BIGINT DEFAULT 0 COMMENT '目标转化量',
  target_conv_rate DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化率（%）',
  product_conv_num BIGINT DEFAULT 0 COMMENT '全产品转化量',
  product_conv_rate DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化率（%）',
  expected_income DECIMAL(18,2) DEFAULT 0 COMMENT '预期收入（元）',
  actual_income DECIMAL(18,2) DEFAULT 0 COMMENT '实际收入（元）',
  reject_rate DECIMAL(10,2) DEFAULT 0 COMMENT '拒绝率（%）',
  reject_count BIGINT DEFAULT 0 COMMENT '拒绝量',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
 strategy_class varchar(16) DEFAULT  NULL
) ;

CREATE TABLE `t_sr_strategy_period_summary_ap__v007` (
  id BIGINT COMMENT '主键',
  strategy_id VARCHAR(64)   NOT NULL COMMENT '策略 id',
  strategy_code VARCHAR(64) NOT NULL COMMENT '策略编码（冗余）',
  strategy_name VARCHAR(128) NOT NULL COMMENT '策略名称（冗余）',
strategy_count bigint(20)  COMMENT '策略条数',
  tab_type VARCHAR(16) NOT NULL COMMENT '策略类型：active/passive',
  channel VARCHAR(64) NOT NULL COMMENT '触点渠道',
  big_category VARCHAR(64) DEFAULT NULL COMMENT '策略大类',
  small_category VARCHAR(64) DEFAULT NULL COMMENT '策略小类',
  stat_month DATE NOT NULL COMMENT '数据账期',
  original_cust BIGINT DEFAULT NULL COMMENT '原始客群',
  push_count BIGINT DEFAULT NULL COMMENT '推送量',
  usage_count BIGINT DEFAULT NULL COMMENT '使用量',
  usage_rate DECIMAL(10,2) DEFAULT NULL COMMENT '使用率（%）',
  reach_count BIGINT DEFAULT NULL COMMENT '触达量',
  target_conv_num BIGINT DEFAULT NULL COMMENT '目标转化量',
  target_conv_rate DECIMAL(10,2) DEFAULT NULL COMMENT '目标转化率（%）',
  product_conv_num BIGINT DEFAULT NULL COMMENT '全产品转化量',
  product_conv_rate DECIMAL(10,2) DEFAULT NULL COMMENT '全产品转化率（%）',
  expected_income DECIMAL(18,2) DEFAULT NULL COMMENT '预期收入（元）',
  actual_income DECIMAL(18,2) DEFAULT NULL COMMENT '实际收入（元）',
  reject_rate DECIMAL(10,2) DEFAULT NULL COMMENT '拒绝率（%）',
  reject_count BIGINT DEFAULT NULL COMMENT '拒绝量',
  original_cust_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '原始客群环比（%）',
  push_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '推送量环比（%）',
  usage_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '使用量环比（%）',
  usage_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '使用率环比（pp）',
  reach_count_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '触达量环比（%）',
  target_conv_num_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化量环比（%）',
  target_conv_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化率环比（pp）',
  product_conv_num_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化量环比（%）',
  product_conv_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化率环比（pp）',
  expected_income_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '预期收入环比（%）',
  actual_income_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '实际收入环比（%）',
  reject_rate_qoq DECIMAL(10,2) DEFAULT 0 COMMENT '拒绝率环比（pp）',
  original_cust_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '原始客群同比（%）',
  push_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '推送量同比（%）',
  usage_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '使用量同比（%）',
  usage_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '使用率同比（pp）',
  reach_count_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '触达量同比（%）',
  target_conv_num_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化量同比（%）',
  target_conv_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '目标转化率同比（pp）',
  product_conv_num_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化量同比（%）',
  product_conv_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '全产品转化率同比（pp）',
  expected_income_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '预期收入同比（%）',
  actual_income_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '实际收入同比（%）',
  reject_rate_yoy DECIMAL(10,2) DEFAULT 0 COMMENT '拒绝率同比（pp）',
  city_id VARCHAR(32) DEFAULT NULL COMMENT '地市编码',
  county_id VARCHAR(32) DEFAULT NULL COMMENT '区县编码',
  create_time DATETIME NOT NULL COMMENT '创建时间',
  update_time DATETIME NOT NULL COMMENT '更新时间',
  is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
 strategy_class varchar(16) DEFAULT  NULL
) ;

INSERT INTO `t_sr_channel_biz_capacity_ap__v007`
    (`id`, `tab_type`, `channel`, `big_category`, `small_category`, `biz_name`, `stat_month`, `capacity`, `qoq`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`, `strategy_class`)
SELECT
        id,
    tab_type,
    channel,
    big_category,
    small_category,
    biz_name,
    stat_month,
    capacity,
    ROUND(qoq, 2),
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted,
    strategy_class
FROM `t_sr_channel_biz_capacity_ap`;

INSERT INTO `t_sr_channel_monthly_capacity_ap__v007`
    (`id`, `tab_type`, `channel`, `big_category`, `small_category`, `stat_month`, `capacity`, `qoq`, `yoy`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`, `strategy_class`)
SELECT
        id,
    tab_type,
    channel,
    big_category,
    small_category,
    DATE_FORMAT(stat_month, '%Y%m'),
    capacity,
    ROUND(qoq, 2),
    ROUND(yoy, 2),
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted,
    strategy_class
FROM `t_sr_channel_monthly_capacity_ap`;

INSERT INTO `t_sr_channel_summary_ap__v007`
    (`id`, `tab_type`, `channel`, `stat_month`, `strategy_count`, `original_cust`, `push_count`, `usage_count`, `usage_rate`, `reach_count`, `target_conv_num`, `target_conv_rate`, `product_conv_num`, `product_conv_rate`, `expected_income`, `actual_income`, `strategy_count_qoq`, `original_cust_qoq`, `push_count_qoq`, `usage_count_qoq`, `usage_rate_qoq`, `reach_count_qoq`, `target_conv_num_qoq`, `target_conv_rate_qoq`, `product_conv_num_qoq`, `product_conv_rate_qoq`, `expected_income_qoq`, `actual_income_qoq`, `strategy_count_yoy`, `original_cust_yoy`, `push_count_yoy`, `usage_count_yoy`, `usage_rate_yoy`, `reach_count_yoy`, `target_conv_num_yoy`, `target_conv_rate_yoy`, `product_conv_num_yoy`, `product_conv_rate_yoy`, `expected_income_yoy`, `actual_income_yoy`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`)
SELECT
        id,
    tab_type,
    channel,
    stat_month,
    strategy_count,
    original_cust,
    push_count,
    usage_count,
    ROUND(usage_rate, 2),
    reach_count,
    target_conv_num,
    ROUND(target_conv_rate, 2),
    product_conv_num,
    ROUND(product_conv_rate, 2),
    ROUND(expected_income, 2),
    ROUND(actual_income, 2),
    ROUND(strategy_count_qoq, 2),
    ROUND(original_cust_qoq, 2),
    ROUND(push_count_qoq, 2),
    ROUND(usage_count_qoq, 2),
    ROUND(usage_rate_qoq, 2),
    ROUND(reach_count_qoq, 2),
    ROUND(target_conv_num_qoq, 2),
    ROUND(target_conv_rate_qoq, 2),
    ROUND(product_conv_num_qoq, 2),
    ROUND(product_conv_rate_qoq, 2),
    ROUND(expected_income_qoq, 2),
    ROUND(actual_income_qoq, 2),
    ROUND(strategy_count_yoy, 2),
    ROUND(original_cust_yoy, 2),
    ROUND(push_count_yoy, 2),
    ROUND(usage_count_yoy, 2),
    ROUND(usage_rate_yoy, 2),
    ROUND(reach_count_yoy, 2),
    ROUND(target_conv_num_yoy, 2),
    ROUND(target_conv_rate_yoy, 2),
    ROUND(product_conv_num_yoy, 2),
    ROUND(product_conv_rate_yoy, 2),
    ROUND(expected_income_yoy, 2),
    ROUND(actual_income_yoy, 2),
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted
FROM `t_sr_channel_summary_ap`
WHERE strategy_class = '全部' OR strategy_class IS NULL;

INSERT INTO `t_sr_kpi_summary__v007`
    (`id`, `tab_type`, `metric_code`, `metric_name`, `stat_month`, `value`, `unit`, `qoq`, `yoy`, `icon`, `sort_no`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`)
SELECT
        id,
    tab_type,
    metric_code,
    metric_name,
    stat_month,
    COALESCE(value, 0),
    unit,
    ROUND(qoq, 2),
    ROUND(yoy, 2),
    icon,
    sort_no,
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted
FROM `t_sr_kpi_summary`
WHERE strategy_class = '全部' OR strategy_class IS NULL;

INSERT INTO `t_sr_strategy_biz_capacity__v007`
    (`id`, `strategy_id`, `biz_code`, `biz_name`, `stat_month`, `count`, `mom_ratio`, `yoy_ratio`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`, `strategy_class`)
SELECT
        id,
    strategy_id,
    biz_code,
    biz_name,
    stat_month,
    count,
    ROUND(mom_ratio, 2),
    ROUND(yoy_ratio, 2),
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted,
    strategy_class
FROM `t_sr_strategy_biz_capacity`
WHERE tab_type = 'active' OR tab_type IS NULL;

INSERT INTO `t_sr_strategy_daily_ap__v007`
    (`id`, `strategy_id`, `strategy_code`, `strategy_name`, `big_category`, `small_category`, `tab_type`, `channel`, `stat_month`, `original_cust`, `push_count`, `usage_count`, `usage_rate`, `reach_count`, `target_conv_num`, `target_conv_rate`, `product_conv_num`, `product_conv_rate`, `expected_income`, `actual_income`, `reject_rate`, `reject_count`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`, `strategy_class`)
SELECT
        id,
    strategy_id,
    strategy_code,
    strategy_name,
    big_category,
    small_category,
    tab_type,
    channel,
    stat_month,
    original_cust,
    push_count,
    usage_count,
    ROUND(usage_rate, 2),
    reach_count,
    target_conv_num,
    ROUND(target_conv_rate, 2),
    product_conv_num,
    ROUND(product_conv_rate, 2),
    ROUND(expected_income, 2),
    ROUND(actual_income, 2),
    ROUND(reject_rate, 2),
    reject_count,
    city_id,
    county_id,
    COALESCE(create_time, CAST(stat_month AS DATETIME)),
    COALESCE(update_time, CAST(stat_month AS DATETIME)),
    is_deleted,
    strategy_class
FROM `t_sr_strategy_daily_ap`;

INSERT INTO `t_sr_strategy_period_summary_ap__v007`
    (`id`, `strategy_id`, `strategy_code`, `strategy_name`, `strategy_count`, `tab_type`, `channel`, `big_category`, `small_category`, `stat_month`, `original_cust`, `push_count`, `usage_count`, `usage_rate`, `reach_count`, `target_conv_num`, `target_conv_rate`, `product_conv_num`, `product_conv_rate`, `expected_income`, `actual_income`, `reject_rate`, `reject_count`, `original_cust_qoq`, `push_count_qoq`, `usage_count_qoq`, `usage_rate_qoq`, `reach_count_qoq`, `target_conv_num_qoq`, `target_conv_rate_qoq`, `product_conv_num_qoq`, `product_conv_rate_qoq`, `expected_income_qoq`, `actual_income_qoq`, `reject_rate_qoq`, `original_cust_yoy`, `push_count_yoy`, `usage_count_yoy`, `usage_rate_yoy`, `reach_count_yoy`, `target_conv_num_yoy`, `target_conv_rate_yoy`, `product_conv_num_yoy`, `product_conv_rate_yoy`, `expected_income_yoy`, `actual_income_yoy`, `reject_rate_yoy`, `city_id`, `county_id`, `create_time`, `update_time`, `is_deleted`, `strategy_class`)
SELECT
        id,
    strategy_id,
    strategy_code,
    COALESCE(NULLIF(TRIM(strategy_name), ''), NULLIF(TRIM(strategy_code), ''), strategy_id),
    strategy_count,
    tab_type,
    channel,
    big_category,
    small_category,
    stat_month,
    original_cust,
    push_count,
    usage_count,
    ROUND(usage_rate, 2),
    reach_count,
    target_conv_num,
    ROUND(target_conv_rate, 2),
    product_conv_num,
    ROUND(product_conv_rate, 2),
    ROUND(expected_income, 2),
    ROUND(actual_income, 2),
    ROUND(reject_rate, 2),
    reject_count,
    ROUND(original_cust_qoq, 2),
    ROUND(push_count_qoq, 2),
    ROUND(usage_count_qoq, 2),
    ROUND(usage_rate_qoq, 2),
    ROUND(reach_count_qoq, 2),
    ROUND(target_conv_num_qoq, 2),
    ROUND(target_conv_rate_qoq, 2),
    ROUND(product_conv_num_qoq, 2),
    ROUND(product_conv_rate_qoq, 2),
    ROUND(expected_income_qoq, 2),
    ROUND(actual_income_qoq, 2),
    ROUND(reject_rate_qoq, 2),
    ROUND(original_cust_yoy, 2),
    ROUND(push_count_yoy, 2),
    ROUND(usage_count_yoy, 2),
    ROUND(usage_rate_yoy, 2),
    ROUND(reach_count_yoy, 2),
    ROUND(target_conv_num_yoy, 2),
    ROUND(target_conv_rate_yoy, 2),
    ROUND(product_conv_num_yoy, 2),
    ROUND(product_conv_rate_yoy, 2),
    ROUND(expected_income_yoy, 2),
    ROUND(actual_income_yoy, 2),
    ROUND(reject_rate_yoy, 2),
    city_id,
    county_id,
    create_time,
    update_time,
    is_deleted,
    strategy_class
FROM `t_sr_strategy_period_summary_ap`;

RENAME TABLE
    `t_sr_channel_biz_capacity_ap` TO `t_sr_channel_biz_capacity_ap__pre_v007`,
    `t_sr_channel_biz_capacity_ap__v007` TO `t_sr_channel_biz_capacity_ap`,
    `t_sr_channel_monthly_capacity_ap` TO `t_sr_channel_monthly_capacity_ap__pre_v007`,
    `t_sr_channel_monthly_capacity_ap__v007` TO `t_sr_channel_monthly_capacity_ap`,
    `t_sr_channel_summary_ap` TO `t_sr_channel_summary_ap__pre_v007`,
    `t_sr_channel_summary_ap__v007` TO `t_sr_channel_summary_ap`,
    `t_sr_kpi_summary` TO `t_sr_kpi_summary__pre_v007`,
    `t_sr_kpi_summary__v007` TO `t_sr_kpi_summary`,
    `t_sr_strategy_biz_capacity` TO `t_sr_strategy_biz_capacity__pre_v007`,
    `t_sr_strategy_biz_capacity__v007` TO `t_sr_strategy_biz_capacity`,
    `t_sr_strategy_daily_ap` TO `t_sr_strategy_daily_ap__pre_v007`,
    `t_sr_strategy_daily_ap__v007` TO `t_sr_strategy_daily_ap`,
    `t_sr_strategy_period_summary_ap` TO `t_sr_strategy_period_summary_ap__pre_v007`,
    `t_sr_strategy_period_summary_ap__v007` TO `t_sr_strategy_period_summary_ap`;

DROP TABLE `t_sr_channel_biz_capacity_ap__pre_v007`, `t_sr_channel_monthly_capacity_ap__pre_v007`, `t_sr_channel_summary_ap__pre_v007`, `t_sr_kpi_summary__pre_v007`, `t_sr_strategy_biz_capacity__pre_v007`, `t_sr_strategy_daily_ap__pre_v007`, `t_sr_strategy_period_summary_ap__pre_v007`;

-- Ensure passive companion tables exist even in local databases initialized before they were added.
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_passive LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_passive LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_passive LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_passive LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_passive LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_passive LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_passive LIKE t_sr_strategy_biz_capacity;

DELIMITER $
DROP PROCEDURE IF EXISTS sr_ensure_local_ap_variant_extensions$
CREATE PROCEDURE sr_ensure_local_ap_variant_extensions()
BEGIN
    DECLARE v_exists INT DEFAULT 0;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_kpi_summary_special' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_kpi_summary_special ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_special' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_special ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_special' AND COLUMN_NAME='reach_rate';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_special ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_count_qoq; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_special' AND COLUMN_NAME='reach_rate_qoq';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_special ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_rate; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_special' AND COLUMN_NAME='tab_type';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_special ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT '本地范围扩展' AFTER id; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_special' AND COLUMN_NAME='stat_date';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_special ADD COLUMN stat_date DATE DEFAULT NULL COMMENT '本地日期扩展' AFTER stat_month; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_kpi_summary_passive' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_kpi_summary_passive ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_passive' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_passive ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_passive' AND COLUMN_NAME='reach_rate';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_passive ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_count_qoq; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_passive' AND COLUMN_NAME='reach_rate_qoq';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_passive ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_rate; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_passive' AND COLUMN_NAME='tab_type';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_passive ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT '本地范围扩展' AFTER id; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_passive' AND COLUMN_NAME='stat_date';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_passive ADD COLUMN stat_date DATE DEFAULT NULL COMMENT '本地日期扩展' AFTER stat_month; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_kpi_summary_key_audience' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_kpi_summary_key_audience ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_key_audience' AND COLUMN_NAME='strategy_class';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_key_audience ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL COMMENT '本地分类扩展' AFTER is_deleted; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_key_audience' AND COLUMN_NAME='reach_rate';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_key_audience ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_count_qoq; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_channel_summary_ap_key_audience' AND COLUMN_NAME='reach_rate_qoq';
    IF v_exists=0 THEN ALTER TABLE t_sr_channel_summary_ap_key_audience ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '本地扩展' AFTER reach_rate; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_key_audience' AND COLUMN_NAME='tab_type';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_key_audience ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT '本地范围扩展' AFTER id; END IF;
    SELECT COUNT(*) INTO v_exists FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_sr_strategy_biz_capacity_key_audience' AND COLUMN_NAME='stat_date';
    IF v_exists=0 THEN ALTER TABLE t_sr_strategy_biz_capacity_key_audience ADD COLUMN stat_date DATE DEFAULT NULL COMMENT '本地日期扩展' AFTER stat_month; END IF;
END$
CALL sr_ensure_local_ap_variant_extensions()$
DROP PROCEDURE sr_ensure_local_ap_variant_extensions$
DELIMITER ;

CREATE OR REPLACE VIEW v_sr_kpi_summary_read (id, tab_type, metric_code, metric_name, stat_month, value, unit, qoq, yoy, icon, sort_no, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST('全部' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_summary_ap_read (id, tab_type, channel, stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, CAST(NULL AS DECIMAL(14,4)) AS reach_rate, CAST(NULL AS DECIMAL(14,4)) AS reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST('全部' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_biz_capacity_read (id, tab_type, strategy_id, stat_month, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST('active' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_month AS stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_key_audience
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_ctrl;

CREATE OR REPLACE VIEW v_sr_strategy_period_summary_ap_read (id, strategy_id, strategy_code, strategy_name, strategy_count, tab_type, channel, big_category, small_category, stat_month, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_rate, reject_count, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, reject_rate_qoq, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, reject_rate_yoy, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, strategy_count, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_rate, reject_count, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, reject_rate_qoq, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, reject_rate_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_period_summary_ap
UNION ALL SELECT id, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, strategy_count, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_rate, reject_count, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, reject_rate_qoq, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, reject_rate_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_period_summary_ap_special
UNION ALL SELECT id, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, strategy_count, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_rate, reject_count, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, reject_rate_qoq, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, reject_rate_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_period_summary_ap_passive
UNION ALL SELECT id, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, strategy_count, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_rate, reject_count, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, reject_rate_qoq, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, reject_rate_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_period_summary_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_daily_ap_read (id, tab_type, strategy_class, strategy_id, stat_date, channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, is_deleted, strategy_code, create_time, update_time) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, stat_month AS stat_date, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, is_deleted, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, create_time, update_time FROM t_sr_strategy_daily_ap
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, stat_month AS stat_date, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, is_deleted, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, create_time, update_time FROM t_sr_strategy_daily_ap_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, stat_month AS stat_date, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, is_deleted, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, create_time, update_time FROM t_sr_strategy_daily_ap_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, stat_month AS stat_date, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(strategy_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, is_deleted, (CAST(strategy_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_code, create_time, update_time FROM t_sr_strategy_daily_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_monthly_capacity_ap_read (id, tab_type, channel, big_category, small_category, stat_month, capacity, qoq, yoy, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_monthly_capacity_ap
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_monthly_capacity_ap_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_monthly_capacity_ap_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_monthly_capacity_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_biz_capacity_ap_read (id, tab_type, channel, big_category, small_category, biz_name, stat_month, capacity, qoq, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_biz_capacity_ap
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_biz_capacity_ap_special
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_biz_capacity_ap_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(big_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS big_category, (CAST(small_category AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS small_category, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, capacity, qoq, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_biz_capacity_ap_key_audience;

