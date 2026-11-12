-- =====================================================================
-- strategy_review 数据库初始化脚本
-- 用途：策略复盘查询 / 收藏管理 / 历史预警规则管理
-- MySQL 5.7
-- =====================================================================

CREATE DATABASE IF NOT EXISTS strategy_review
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE strategy_review;

-- ---------------------------------------------------------------------
-- 字典表
-- ---------------------------------------------------------------------

-- 触点渠道维度
CREATE TABLE IF NOT EXISTS t_sr_dim_channel (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    key_code    VARCHAR(64)  NOT NULL COMMENT '渠道编码',
    key_name    VARCHAR(128) NOT NULL COMMENT '渠道名称',
    tab_type    VARCHAR(64)  DEFAULT NULL COMMENT '适用类型，逗号分隔，空=全部',
    status      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1启用',
    sort_no     INT          NOT NULL DEFAULT 0 COMMENT '排序号',
    is_deleted  TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_channel_code (key_code),
    KEY idx_channel_tab (tab_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='触点渠道维度';

-- 预警指标维度
CREATE TABLE IF NOT EXISTS t_sr_dim_metric (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    metric_code VARCHAR(64)  NOT NULL COMMENT '指标编码（对应事实表列名）',
    metric_name VARCHAR(128) NOT NULL COMMENT '指标名称',
    tab_type    VARCHAR(64)  DEFAULT NULL COMMENT '适用类型，逗号分隔，空=全部',
    status      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1启用',
    sort_no     INT          NOT NULL DEFAULT 0 COMMENT '排序号',
    is_deleted  TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_metric_code (metric_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警指标维度';

-- 策略主表
CREATE TABLE IF NOT EXISTS t_sr_strategy (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    strategy_code  VARCHAR(64)  DEFAULT NULL COMMENT '策略编码',
    strategy_name  VARCHAR(255) DEFAULT NULL COMMENT '策略名称',
    tab_type       VARCHAR(32)  DEFAULT NULL COMMENT '策略类型：active/passive/control',
    strategy_class VARCHAR(16)  DEFAULT NULL COMMENT '策略分类：存量为升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    product_name   VARCHAR(128) DEFAULT NULL COMMENT '重点产品名称，一条策略固定归属一个产品',
    customer_group VARCHAR(64) DEFAULT NULL COMMENT '重点客群分类名称，一条策略固定归属一类客群',
    channel        VARCHAR(64)  DEFAULT NULL COMMENT '触点渠道编码',
    strategy_level VARCHAR(32)  DEFAULT NULL COMMENT '策略级别',
    caliber        VARCHAR(512) DEFAULT NULL COMMENT '客群口径描述',
    iteration      INT          DEFAULT NULL COMMENT '迭代次数',
    owner          VARCHAR(64)  DEFAULT NULL COMMENT '责任人',
    status         VARCHAR(32)  DEFAULT NULL COMMENT '策略状态',
    city_id        VARCHAR(64)  DEFAULT NULL COMMENT '来源地市',
    county_id      VARCHAR(64)  DEFAULT NULL COMMENT '来源区县',
    start_date     DATE         DEFAULT NULL COMMENT '生效起始日',
    end_date       DATE         DEFAULT NULL COMMENT '生效结束日',
    create_time    DATETIME     DEFAULT NULL COMMENT '创建时间',
    update_time    DATETIME     DEFAULT NULL COMMENT '更新时间',
    create_by      VARCHAR(64)  DEFAULT NULL COMMENT '创建人',
    update_by      VARCHAR(64)  DEFAULT NULL COMMENT '更新人',
    is_deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_strategy_code (strategy_code),
    KEY idx_strategy_tab (tab_type),
    KEY idx_strategy_class (tab_type, strategy_class, is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略主表';

-- ---------------------------------------------------------------------
-- 策略整体情况
-- ---------------------------------------------------------------------

-- KPI 汇总长表（每指标一行）
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary (
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

-- Consolidated storage for the six manual trend / QoQ tables.
-- Legacy tables are intentionally retained as rollback copies during cutover.
CREATE TABLE IF NOT EXISTS t_sr_manual_metric (
    id              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    record_type     VARCHAR(32)   NOT NULL COMMENT 'category_trend/strategy_trend/business_qoq/strategy_business_qoq',
    tab_type        VARCHAR(16)   NOT NULL DEFAULT 'active' COMMENT '策略类型',
    strategy_class  VARCHAR(16)   NOT NULL COMMENT '策略分类/客群类型',
    strategy_id     VARCHAR(64)   DEFAULT NULL COMMENT '策略ID；非单策略记录为空',
    strategy_name   VARCHAR(255)  DEFAULT NULL COMMENT '策略名称快照',
    customer_group  VARCHAR(64)   DEFAULT NULL COMMENT '客群；不适用时为空',
    stat_month      DATE          NOT NULL COMMENT '账期，统一存每月1日',
    channel         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '触点编码；全部表示全部触点',
    big_category    VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '策略大类；全部表示全部大类',
    small_category  VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '策略小类；全部表示全部小类',
    city_id         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '地市；全部表示全部地市',
    county_id       VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '区县；全部表示全部区县',
    biz_code        VARCHAR(64)   NOT NULL DEFAULT '' COMMENT '业务编码；业务环比专用',
    biz_name        VARCHAR(128)  NOT NULL DEFAULT '' COMMENT '业务名称；业务环比专用',
    metric_code     VARCHAR(64)   NOT NULL COMMENT '趋势指标编码；纯环比记录使用 manual_qoq',
    metric_value    DECIMAL(20,4) DEFAULT NULL COMMENT '当月指标值',
    manual_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '手工环比',
    qoq_unit        VARCHAR(8)    NOT NULL DEFAULT 'percent' COMMENT 'percent=百分比；pp=百分点',
    scope_hash      CHAR(64)      NOT NULL COMMENT '维度范围SHA-256',
    status          TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0草稿/停用，1已发布',
    source_batch    VARCHAR(64)   DEFAULT NULL COMMENT '数据来源批次',
    remark          VARCHAR(500)  DEFAULT NULL COMMENT '备注',
    created_by      VARCHAR(64)   DEFAULT NULL COMMENT '创建人',
    updated_by      VARCHAR(64)   DEFAULT NULL COMMENT '更新人',
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    legacy_table    VARCHAR(64)   DEFAULT NULL COMMENT '迁移来源表；完成切换后保留溯源',
    legacy_id       BIGINT        DEFAULT NULL COMMENT '迁移来源行ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_manual_metric_legacy (legacy_table, legacy_id),
    KEY idx_manual_metric_scope (record_type, stat_month, strategy_class, metric_code, scope_hash),
    KEY idx_manual_metric_lookup (record_type, strategy_class, metric_code, stat_month, status),
    KEY idx_manual_metric_strategy (tab_type, strategy_class, strategy_id, stat_month, metric_code, status),
    KEY idx_manual_metric_business (record_type, tab_type, strategy_class, customer_group, stat_month, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略趋势及业务环比人工维护统一表';

-- 增量策略月度趋势手工数据，维度与增量策略事实表一致。
CREATE TABLE IF NOT EXISTS t_sr_passive_monthly_trend_manual (
    id              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month      DATE          NOT NULL COMMENT '账期，统一存每月1日',
    channel         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '触点编码；全部表示全部触点',
    big_category    VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '策略大类；全部表示全部大类',
    small_category  VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '策略小类；全部表示全部小类',
    city_id         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '地市；全部表示全部地市',
    county_id       VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '区县；全部表示全部区县',
    metric_code     VARCHAR(64)   NOT NULL COMMENT '指标编码',
    metric_value    DECIMAL(20,4) DEFAULT NULL COMMENT '当月指标值',
    manual_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '手工环比；缺值保持为空',
    qoq_unit        VARCHAR(8)    NOT NULL COMMENT 'percent=百分比；pp=百分点',
    scope_hash      CHAR(64)      NOT NULL COMMENT '触点、分类和地域维度的SHA-256，用于唯一约束',
    status          TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0草稿/停用，1已发布',
    source_batch    VARCHAR(64)   DEFAULT NULL COMMENT '数据来源批次',
    remark          VARCHAR(500)  DEFAULT NULL COMMENT '备注',
    created_by      VARCHAR(64)   DEFAULT NULL,
    updated_by      VARCHAR(64)   DEFAULT NULL,
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pmt_month_metric_scope (stat_month, metric_code, scope_hash),
    KEY idx_pmt_trend_lookup (metric_code, stat_month, channel, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='增量策略月度趋势人工维护';

-- 增量策略单策略月度趋势，供策略执行明细的单策略产能图使用。
CREATE TABLE IF NOT EXISTS t_sr_passive_strategy_monthly_trend_manual (
    id              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month      DATE          NOT NULL COMMENT '账期，统一存每月1日',
    strategy_id     VARCHAR(64)   NOT NULL COMMENT '增量策略ID',
    channel         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '触点编码；全部表示全部触点',
    city_id         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '地市；全部表示全部地市',
    county_id       VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '区县；全部表示全部区县',
    metric_code     VARCHAR(64)   NOT NULL COMMENT '指标编码，如 product_conv_num',
    metric_value    DECIMAL(20,4) DEFAULT NULL COMMENT '当月指标值',
    manual_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '月环比百分比；首月或上月为0时为空',
    qoq_unit        VARCHAR(8)    NOT NULL DEFAULT 'percent' COMMENT 'percent=百分比；pp=百分点',
    scope_hash      CHAR(64)      NOT NULL COMMENT '触点和地域维度SHA-256，用于唯一约束',
    status          TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0草稿/停用，1已发布',
    source_batch    VARCHAR(64)   DEFAULT NULL COMMENT '数据来源批次',
    remark          VARCHAR(500)  DEFAULT NULL COMMENT '备注',
    created_by      VARCHAR(64)   DEFAULT NULL,
    updated_by      VARCHAR(64)   DEFAULT NULL,
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_psmt_month_strategy_metric_scope (stat_month, strategy_id, metric_code, scope_hash),
    KEY idx_psmt_strategy_metric_month (strategy_id, metric_code, stat_month, status),
    KEY idx_psmt_scope_month (channel, city_id, county_id, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='增量策略单策略月度趋势人工维护';

-- 重点产品整体月度趋势手工数据；产品维度对应 control 月表 small_category。
CREATE TABLE IF NOT EXISTS t_sr_control_monthly_trend_manual (
    id              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month      DATE          NOT NULL COMMENT '账期，统一存每月1日',
    product_name    VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '产品名称，对应control事实表small_category；全部表示全部产品',
    big_category    VARCHAR(128)  NOT NULL DEFAULT '全部' COMMENT '策略大类；全部表示全部大类',
    channel         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '触点编码；全部表示全部触点',
    city_id         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '地市；全部表示全部地市',
    county_id       VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '区县；全部表示全部区县',
    metric_code     VARCHAR(64)   NOT NULL COMMENT '指标编码，如 success_count、consult_count',
    metric_value    DECIMAL(20,4) DEFAULT NULL COMMENT '当月指标值',
    manual_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '手工环比；缺值不回退到自动计算',
    qoq_unit        VARCHAR(8)    NOT NULL COMMENT 'percent=百分比；pp=百分点',
    scope_hash      CHAR(64)      NOT NULL COMMENT '产品、大类、触点和地域维度的SHA-256，用于唯一约束',
    status          TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0草稿/停用，1已发布',
    source_batch    VARCHAR(64)   DEFAULT NULL COMMENT '数据来源批次',
    remark          VARCHAR(500)  DEFAULT NULL COMMENT '备注',
    created_by      VARCHAR(64)   DEFAULT NULL,
    updated_by      VARCHAR(64)   DEFAULT NULL,
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ctrl_month_metric_scope (stat_month, metric_code, scope_hash),
    KEY idx_ctrl_trend_lookup (metric_code, stat_month, product_name(32), status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='重点产品整体月度趋势人工维护';

-- 重点产品单策略月度趋势，供策略执行明细的单策略产能图使用。
CREATE TABLE IF NOT EXISTS t_sr_control_strategy_monthly_trend_manual (
    id              BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month      DATE          NOT NULL COMMENT '账期，统一存每月1日',
    strategy_id     VARCHAR(64)   NOT NULL COMMENT '重点产品策略ID',
    channel         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '触点编码；全部表示全部触点',
    city_id         VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '地市；全部表示全部地市',
    county_id       VARCHAR(64)   NOT NULL DEFAULT '全部' COMMENT '区县；全部表示全部区县',
    metric_code     VARCHAR(64)   NOT NULL COMMENT '指标编码，如 product_conv_num',
    metric_value    DECIMAL(20,4) DEFAULT NULL COMMENT '当月指标值',
    manual_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '月环比百分比；首月或上月为0时为空',
    qoq_unit        VARCHAR(8)    NOT NULL DEFAULT 'percent' COMMENT 'percent=百分比；pp=百分点',
    scope_hash      CHAR(64)      NOT NULL COMMENT '渠道和地域维度SHA-256，用于唯一约束',
    status          TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0草稿/停用，1已发布',
    source_batch    VARCHAR(64)   DEFAULT NULL COMMENT '数据来源批次',
    remark          VARCHAR(500)  DEFAULT NULL COMMENT '备注',
    created_by      VARCHAR(64)   DEFAULT NULL,
    updated_by      VARCHAR(64)   DEFAULT NULL,
    create_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ctrl_strategy_month_metric_scope (stat_month, strategy_id, metric_code, scope_hash),
    KEY idx_ctrl_strategy_metric_month (strategy_id, metric_code, stat_month, status),
    KEY idx_ctrl_strategy_scope_month (channel, city_id, county_id, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='重点产品单策略月度趋势人工维护';

-- ---------------------------------------------------------------------
-- 渠道执行汇总（control）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ctrl (
    id                 BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month         DATE          DEFAULT NULL COMMENT '账期',
    channel            VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    strategy_count     BIGINT        DEFAULT NULL COMMENT '策略量',
    strategy_count_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '策略量环比',
    consult_count      BIGINT        DEFAULT NULL COMMENT '咨询量',
    consult_count_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '咨询量环比',
    retain_count       BIGINT        DEFAULT NULL COMMENT '挽留量',
    retain_count_qoq   DECIMAL(14,4) DEFAULT NULL COMMENT '挽留量环比',
    retain_rate        DECIMAL(14,4) DEFAULT NULL COMMENT '挽留率',
    retain_rate_qoq    DECIMAL(14,4) DEFAULT NULL COMMENT '挽留率环比',
    dispatch_count     BIGINT        DEFAULT NULL COMMENT '派单量',
    dispatch_count_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '派单量环比',
    success_count      BIGINT        DEFAULT NULL COMMENT '成功办理量',
    success_count_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '成功办理量环比',
    success_rate       DECIMAL(14,4) DEFAULT NULL COMMENT '成功率',
    success_rate_qoq   DECIMAL(14,4) DEFAULT NULL COMMENT '成功率环比',
    income             DECIMAL(20,2) DEFAULT NULL COMMENT '收益',
    income_qoq         DECIMAL(14,4) DEFAULT NULL COMMENT '收益环比',
    city_id            VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id          VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    is_deleted         TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cs_ctrl_month (stat_month),
    KEY idx_cs_ctrl_channel (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道执行汇总-control';

-- 渠道执行汇总（active/passive）
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap (
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

-- 策略周期汇总（active/passive）
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap (
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

-- 重点产品周期汇总沿用升接/稳标准字段结构；产品维度使用 small_category，不依赖 product_name。
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ctrl LIKE t_sr_strategy_period_summary_ap;

-- ---------------------------------------------------------------------
-- 渠道月度产能 / 业务产能
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ctrl (
    id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month    DATE          DEFAULT NULL COMMENT '账期',
    channel       VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category  VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category VARCHAR(128) DEFAULT NULL COMMENT '业务小类',
    capacity      BIGINT        DEFAULT NULL COMMENT '产能',
    qoq           DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    city_id       VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id     VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    is_deleted    TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cmc_ctrl_month (stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道月度产能-control';

CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap (
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

CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ctrl (
    id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    stat_month    DATE          DEFAULT NULL COMMENT '账期',
    channel       VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category  VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category VARCHAR(128) DEFAULT NULL COMMENT '业务小类',
    biz_name      VARCHAR(128)  DEFAULT NULL COMMENT '业务名称',
    capacity      BIGINT        DEFAULT NULL COMMENT '产能',
    qoq           DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    city_id       VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id     VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    is_deleted    TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cbc_ctrl_month (stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道业务产能-control';

CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap (
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

-- ---------------------------------------------------------------------
-- 策略业务产能
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity (
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

-- ---------------------------------------------------------------------
-- 策略日粒度明细
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ctrl (
    id               BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    strategy_id      VARCHAR(64)   DEFAULT NULL COMMENT '策略ID',
    strategy_code    VARCHAR(64)   DEFAULT NULL COMMENT '策略编码',
    strategy_name    VARCHAR(255)  DEFAULT NULL COMMENT '策略名称',
    big_category     VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category   VARCHAR(128)  DEFAULT NULL COMMENT '业务小类',
    tab_type         VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class   VARCHAR(16)   DEFAULT NULL COMMENT '策略分类',
    channel          VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    stat_month       DATE          DEFAULT NULL COMMENT '统计日期',
    original_cust    BIGINT        DEFAULT NULL COMMENT '原始客群',
    push_count       BIGINT        DEFAULT NULL COMMENT '推送量',
    usage_count      BIGINT        DEFAULT NULL COMMENT '使用量',
    usage_rate       DECIMAL(14,4) DEFAULT NULL COMMENT '使用率',
    reach_count      BIGINT        DEFAULT NULL COMMENT '触达量',
    target_conv_num  BIGINT        DEFAULT NULL COMMENT '目标转化量',
    target_conv_rate DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率',
    product_conv_num BIGINT        DEFAULT NULL COMMENT '产品转化量',
    product_conv_rate DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率',
    expected_income  DECIMAL(20,2) DEFAULT NULL COMMENT '预计收益',
    actual_income    DECIMAL(20,2) DEFAULT NULL COMMENT '实际收益',
    reject_rate      DECIMAL(14,4) DEFAULT NULL COMMENT '拦截率',
    reject_count     BIGINT        DEFAULT NULL COMMENT '拦截量',
    city_id          VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id        VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time      DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time      DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted       TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_sdc_ctrl_strategy_month (strategy_id, stat_month),
    KEY idx_sdc_ctrl_tab (tab_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略日粒度明细-control';

CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap (
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

-- ---------------------------------------------------------------------
-- 策略拒绝原因
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason (
    id           BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    strategy_id  VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    stat_month   DATE          DEFAULT NULL COMMENT '账期',
    reason_code  VARCHAR(64)   DEFAULT NULL COMMENT '拒绝原因编码',
    reason_name  VARCHAR(128)  DEFAULT NULL COMMENT '拒绝原因名称',
    reject_count BIGINT        DEFAULT NULL COMMENT '拒绝量',
    reject_ratio DECIMAL(14,4) DEFAULT NULL COMMENT '占比',
    color        VARCHAR(32)   DEFAULT NULL COMMENT '展示颜色',
    sort_no      INT           DEFAULT 0 COMMENT '排序号',
    city_id      VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id    VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time  DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time  DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted   TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_rej_strategy_month (strategy_id, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略拒绝原因';

-- ---------------------------------------------------------------------
-- 预警规则相关
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_warning_rule (
    id             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    rule_name      VARCHAR(255) NOT NULL COMMENT '规则名称',
    rule_desc      VARCHAR(512) DEFAULT NULL COMMENT '规则描述',
    tab_type       VARCHAR(32)  DEFAULT NULL COMMENT '策略类型',
    status         VARCHAR(32)  DEFAULT NULL COMMENT '状态',
    start_date     DATE         DEFAULT NULL COMMENT '生效起始日',
    end_date       DATE         DEFAULT NULL COMMENT '生效结束日',
    data_start_date DATE        DEFAULT NULL COMMENT '数据起始日',
    data_end_date  DATE         DEFAULT NULL COMMENT '数据结束日',
    channels       VARCHAR(512) DEFAULT NULL COMMENT '渠道编码，逗号分隔',
    strategies     VARCHAR(512) DEFAULT NULL COMMENT '策略ID，逗号分隔',
    logic          VARCHAR(16)  DEFAULT NULL COMMENT '条件逻辑：and/or',
    create_by      VARCHAR(64)  DEFAULT NULL COMMENT '创建人账号',
    creator        VARCHAR(64)  DEFAULT NULL COMMENT '创建人姓名',
    create_time    DATETIME     DEFAULT NULL COMMENT '创建时间',
    update_time    DATETIME     DEFAULT NULL COMMENT '更新时间',
    update_by      VARCHAR(64)  DEFAULT NULL COMMENT '更新人',
    is_deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_warn_rule_tab (tab_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则主表';

CREATE TABLE IF NOT EXISTS t_sr_warning_rule_condition (
    id          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    rule_id     BIGINT        NOT NULL COMMENT '规则ID',
    metric_code VARCHAR(64)   DEFAULT NULL COMMENT '指标编码',
    metric_name VARCHAR(128)  DEFAULT NULL COMMENT '指标名称',
    operator    VARCHAR(16)   DEFAULT NULL COMMENT '比较符',
    threshold   DECIMAL(18,4) DEFAULT NULL COMMENT '阈值',
    unit        VARCHAR(32)   DEFAULT NULL COMMENT '单位',
    sort_no     INT           DEFAULT 0 COMMENT '排序号',
    create_time DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted  TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_warn_cond_rule (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警规则条件子表';

CREATE TABLE IF NOT EXISTS t_sr_warning_hit (
    id          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    rule_id     BIGINT      DEFAULT NULL COMMENT '规则ID',
    strategy_id VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    tab_type    VARCHAR(32) DEFAULT NULL COMMENT '策略类型',
    followed    TINYINT(1)  DEFAULT 0 COMMENT '是否已关注',
    create_time DATETIME    DEFAULT NULL COMMENT '创建时间',
    update_time DATETIME    DEFAULT NULL COMMENT '更新时间',
    is_deleted  TINYINT     NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_hit_rule (rule_id),
    KEY idx_hit_strategy (strategy_id, tab_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警命中记录';

-- ---------------------------------------------------------------------
-- 收藏
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_favorite (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id       VARCHAR(64)  NOT NULL COMMENT '用户ID',
    tab_type      VARCHAR(32)  NOT NULL COMMENT '策略类型',
    strategy_id   VARCHAR(64)  NOT NULL COMMENT '策略ID',
    strategy_name VARCHAR(255) DEFAULT NULL COMMENT '策略名称',
    channel       VARCHAR(64)  DEFAULT NULL COMMENT '渠道编码',
    rule_id       VARCHAR(64)  DEFAULT NULL COMMENT '预警规则ID（source=follow时关联）',
    source        VARCHAR(32)  DEFAULT NULL COMMENT '来源：manual/follow',
    create_time   DATETIME     DEFAULT NULL COMMENT '创建时间',
    update_time   DATETIME     DEFAULT NULL COMMENT '更新时间',
    is_deleted    TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    UNIQUE KEY uk_fav_user_tab_str (user_id, tab_type, strategy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略收藏表';

-- ---------------------------------------------------------------------
-- 存量特殊分类与增量策略专用数据表
-- ---------------------------------------------------------------------
-- active“降拆 / 离”单独存入 *_special；增量策略单独存入 *_passive。
-- v_sr_*_read 作为兼容读取层，供现有查询读取原表和专用表。
CREATE TABLE IF NOT EXISTS t_sr_strategy_special LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_special LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_special LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_special LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_special LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_special LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_special LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_special LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_special LIKE t_sr_strategy_reject_reason;
CREATE TABLE IF NOT EXISTS t_sr_strategy_passive LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_passive LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_passive LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_passive LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_passive LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_passive LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_passive LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_passive LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_passive LIKE t_sr_strategy_reject_reason;
CREATE TABLE IF NOT EXISTS t_sr_strategy_key_audience LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_key_audience LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_key_audience LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_key_audience LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_key_audience LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_key_audience LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_key_audience LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_key_audience LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_key_audience LIKE t_sr_strategy_reject_reason;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_ctrl LIKE t_sr_strategy_reject_reason;

DELIMITER $
DROP PROCEDURE IF EXISTS sr_ensure_local_ap_variant_extensions$
CREATE PROCEDURE sr_ensure_local_ap_variant_extensions()
BEGIN
    DECLARE v_exists INT DEFAULT 0;
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
END$
CALL sr_ensure_local_ap_variant_extensions()$
DROP PROCEDURE sr_ensure_local_ap_variant_extensions$
DELIMITER ;

CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_ctrl LIKE t_sr_strategy_biz_capacity_passive;

-- Local-only extensions for production-shaped variant tables.

CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_special_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  strategy_class VARCHAR(16) DEFAULT NULL,
  value_was_null TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_special_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  strategy_class VARCHAR(16) DEFAULT NULL,
  reach_rate DECIMAL(14,4) DEFAULT NULL,
  reach_rate_qoq DECIMAL(14,4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_special_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  tab_type VARCHAR(32) DEFAULT NULL,
  stat_date DATE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW v_sr_kpi_summary_special_compat AS
SELECT b.id, b.tab_type, b.metric_code, b.metric_name, b.stat_month, CASE WHEN e.value_was_null = 1 AND b.value = 0 THEN NULL ELSE b.value END AS value, b.unit, b.qoq, b.yoy, b.icon, b.sort_no, b.city_id, b.county_id, b.create_time, b.update_time, b.is_deleted, e.strategy_class AS strategy_class
FROM t_sr_kpi_summary_special b LEFT JOIN t_sr_kpi_summary_special_local_ext e ON e.id = b.id;
CREATE OR REPLACE VIEW v_sr_channel_summary_ap_special_compat AS
SELECT b.*, e.reach_rate, e.reach_rate_qoq, e.strategy_class AS strategy_class
FROM t_sr_channel_summary_ap_special b LEFT JOIN t_sr_channel_summary_ap_special_local_ext e ON e.id = b.id;
CREATE OR REPLACE VIEW v_sr_strategy_biz_capacity_special_compat AS
SELECT b.*, COALESCE(e.tab_type, 'active') AS tab_type, COALESCE(e.stat_date, b.stat_month) AS stat_date
FROM t_sr_strategy_biz_capacity_special b LEFT JOIN t_sr_strategy_biz_capacity_special_local_ext e ON e.id = b.id;

CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_key_audience_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  strategy_class VARCHAR(16) DEFAULT NULL,
  value_was_null TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_key_audience_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  strategy_class VARCHAR(16) DEFAULT NULL,
  reach_rate DECIMAL(14,4) DEFAULT NULL,
  reach_rate_qoq DECIMAL(14,4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_key_audience_local_ext (
  id BIGINT NOT NULL PRIMARY KEY,
  tab_type VARCHAR(32) DEFAULT NULL,
  stat_date DATE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW v_sr_kpi_summary_key_audience_compat AS
SELECT b.id, b.tab_type, b.metric_code, b.metric_name, b.stat_month, CASE WHEN e.value_was_null = 1 AND b.value = 0 THEN NULL ELSE b.value END AS value, b.unit, b.qoq, b.yoy, b.icon, b.sort_no, b.city_id, b.county_id, b.create_time, b.update_time, b.is_deleted, COALESCE(e.strategy_class, '重点客群') AS strategy_class
FROM t_sr_kpi_summary_key_audience b LEFT JOIN t_sr_kpi_summary_key_audience_local_ext e ON e.id = b.id;
CREATE OR REPLACE VIEW v_sr_channel_summary_ap_key_audience_compat AS
SELECT b.*, e.reach_rate, e.reach_rate_qoq, COALESCE(e.strategy_class, '重点客群') AS strategy_class
FROM t_sr_channel_summary_ap_key_audience b LEFT JOIN t_sr_channel_summary_ap_key_audience_local_ext e ON e.id = b.id;
CREATE OR REPLACE VIEW v_sr_strategy_biz_capacity_key_audience_compat AS
SELECT b.*, COALESCE(e.tab_type, 'active') AS tab_type, COALESCE(e.stat_date, b.stat_month) AS stat_date
FROM t_sr_strategy_biz_capacity_key_audience b LEFT JOIN t_sr_strategy_biz_capacity_key_audience_local_ext e ON e.id = b.id;

CREATE OR REPLACE VIEW v_sr_strategy_read AS
SELECT * FROM t_sr_strategy UNION ALL SELECT * FROM t_sr_strategy_special UNION ALL SELECT * FROM t_sr_strategy_passive UNION ALL SELECT * FROM t_sr_strategy_key_audience;
CREATE OR REPLACE VIEW v_sr_kpi_summary_read (id, tab_type, metric_code, metric_name, stat_month, value, unit, qoq, yoy, icon, sort_no, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST('全部' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_kpi_summary_special_compat
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_kpi_summary_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(metric_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_code, (CAST(metric_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS metric_name, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, value, (CAST(unit AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS unit, qoq, yoy, (CAST(icon AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS icon, sort_no, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_kpi_summary_key_audience_compat;
CREATE OR REPLACE VIEW v_sr_channel_summary_ap_read (id, tab_type, channel, stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, CAST(NULL AS DECIMAL(14,4)) AS reach_rate, CAST(NULL AS DECIMAL(14,4)) AS reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST('全部' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_channel_summary_ap_special_compat
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_channel_summary_ap_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(channel AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS channel, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, strategy_count, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, strategy_count_qoq, original_cust_qoq, push_count_qoq, usage_count_qoq, usage_rate_qoq, reach_count_qoq, reach_rate, reach_rate_qoq, target_conv_num_qoq, target_conv_rate_qoq, product_conv_num_qoq, product_conv_rate_qoq, expected_income_qoq, actual_income_qoq, strategy_count_yoy, original_cust_yoy, push_count_yoy, usage_count_yoy, usage_rate_yoy, reach_count_yoy, target_conv_num_yoy, target_conv_rate_yoy, product_conv_num_yoy, product_conv_rate_yoy, expected_income_yoy, actual_income_yoy, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_channel_summary_ap_key_audience_compat;
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
CREATE OR REPLACE VIEW v_sr_strategy_biz_capacity_read (id, tab_type, strategy_id, stat_month, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, create_time, update_time, is_deleted, strategy_class) AS
SELECT id, (CAST('active' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_month AS stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_strategy_biz_capacity_special_compat
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_passive
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM v_sr_strategy_biz_capacity_key_audience_compat
UNION ALL SELECT id, (CAST(tab_type AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS tab_type, (CAST(strategy_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_id, (CAST(stat_month AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS stat_month, stat_date, (CAST(biz_code AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_code, (CAST(biz_name AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS biz_name, count, mom_ratio, yoy_ratio, (CAST(city_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS city_id, (CAST(county_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS county_id, create_time, update_time, is_deleted, (CAST(strategy_class AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) AS strategy_class FROM t_sr_strategy_biz_capacity_ctrl;
CREATE OR REPLACE VIEW v_sr_strategy_reject_reason_read AS
SELECT * FROM t_sr_strategy_reject_reason UNION ALL SELECT * FROM t_sr_strategy_reject_reason_special UNION ALL SELECT * FROM t_sr_strategy_reject_reason_passive UNION ALL SELECT * FROM t_sr_strategy_reject_reason_key_audience UNION ALL SELECT * FROM t_sr_strategy_reject_reason_ctrl;
