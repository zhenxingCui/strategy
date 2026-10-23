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
    id          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type    VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class VARCHAR(16) DEFAULT NULL COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    metric_code VARCHAR(64)   DEFAULT NULL COMMENT '指标编码',
    metric_name VARCHAR(128)  DEFAULT NULL COMMENT '指标名称',
    value       DECIMAL(20,4) DEFAULT NULL COMMENT '当期值',
    unit        VARCHAR(32)   DEFAULT NULL COMMENT '单位',
    qoq         DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    yoy         DECIMAL(14,4) DEFAULT NULL COMMENT '同比',
    icon        VARCHAR(64)   DEFAULT NULL COMMENT '图标标识',
    sort_no     INT           DEFAULT 0 COMMENT '排序号',
    stat_month  VARCHAR(7)    DEFAULT NULL COMMENT '账期 yyyy-MM',
    city_id     VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id   VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted  TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_kpi_tab_month (tab_type, stat_month),
    KEY idx_kpi_metric (metric_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='KPI汇总长表';

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
    id                   BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type             VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class       VARCHAR(16)   DEFAULT NULL COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    stat_month           DATE          DEFAULT NULL COMMENT '账期',
    channel              VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    strategy_count       BIGINT        DEFAULT NULL COMMENT '策略量',
    strategy_count_qoq   DECIMAL(14,4) DEFAULT NULL COMMENT '策略量环比',
    original_cust        BIGINT        DEFAULT NULL COMMENT '原始客群',
    original_cust_qoq    DECIMAL(14,4) DEFAULT NULL COMMENT '原始客群环比',
    push_count           BIGINT        DEFAULT NULL COMMENT '推送量',
    push_count_qoq       DECIMAL(14,4) DEFAULT NULL COMMENT '推送量环比',
    usage_count          BIGINT        DEFAULT NULL COMMENT '使用量',
    usage_count_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '使用量环比',
    usage_rate           DECIMAL(14,4) DEFAULT NULL COMMENT '使用率',
    usage_rate_qoq       DECIMAL(14,4) DEFAULT NULL COMMENT '使用率环比',
    reach_count          BIGINT        DEFAULT NULL COMMENT '触达量',
    reach_count_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '触达量环比',
    target_conv_num      BIGINT        DEFAULT NULL COMMENT '目标转化量',
    target_conv_num_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化量环比',
    target_conv_rate     DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率',
    target_conv_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率环比',
    product_conv_num     BIGINT        DEFAULT NULL COMMENT '产品转化量',
    product_conv_num_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化量环比',
    product_conv_rate    DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率',
    product_conv_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率环比',
    expected_income      DECIMAL(20,2) DEFAULT NULL COMMENT '预计收益',
    expected_income_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '预计收益环比',
    actual_income        DECIMAL(20,2) DEFAULT NULL COMMENT '实际收益',
    actual_income_qoq    DECIMAL(14,4) DEFAULT NULL COMMENT '实际收益环比',
    strategy_count_yoy   DECIMAL(14,4) DEFAULT NULL COMMENT '策略量同比',
    original_cust_yoy    DECIMAL(14,4) DEFAULT NULL COMMENT '原始客群同比',
    push_count_yoy       DECIMAL(14,4) DEFAULT NULL COMMENT '推送量同比',
    usage_count_yoy      DECIMAL(14,4) DEFAULT NULL COMMENT '使用量同比',
    usage_rate_yoy       DECIMAL(14,4) DEFAULT NULL COMMENT '使用率同比',
    reach_count_yoy      DECIMAL(14,4) DEFAULT NULL COMMENT '触达量同比',
    target_conv_num_yoy  DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化量同比',
    target_conv_rate_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率同比',
    product_conv_num_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化量同比',
    product_conv_rate_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率同比',
    expected_income_yoy  DECIMAL(14,4) DEFAULT NULL COMMENT '预计收益同比',
    actual_income_yoy    DECIMAL(14,4) DEFAULT NULL COMMENT '实际收益同比',
    city_id              VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id            VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time          DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time          DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted           TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cs_ap_tab_month (tab_type, stat_month),
    KEY idx_cs_ap_channel (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道执行汇总-active/passive';

-- ---------------------------------------------------------------------
-- 策略周期汇总（control）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ctrl (
    id                 BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    strategy_id        VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    strategy_code      VARCHAR(64)   DEFAULT NULL COMMENT '策略编码',
    strategy_name      VARCHAR(255)  DEFAULT NULL COMMENT '策略名称',
    channel            VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category       VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category     VARCHAR(128)  DEFAULT NULL COMMENT '业务小类',
    stat_month         DATE          DEFAULT NULL COMMENT '账期',
    strategy_count     BIGINT        DEFAULT NULL COMMENT '策略量',
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
    KEY idx_sps_ctrl_strategy (strategy_id),
    KEY idx_sps_ctrl_month (stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略周期汇总-control';

-- 策略周期汇总（active/passive）
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap (
    id                   BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type             VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class       VARCHAR(16)   DEFAULT NULL COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    strategy_id          VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    strategy_code        VARCHAR(64)  DEFAULT NULL COMMENT '策略编码',
    strategy_name        VARCHAR(255)  DEFAULT NULL COMMENT '策略名称',
    channel              VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category         VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category       VARCHAR(128)  DEFAULT NULL COMMENT '业务小类',
    stat_month           DATE          DEFAULT NULL COMMENT '账期',
    strategy_count       BIGINT        DEFAULT NULL COMMENT '策略量',
    original_cust        BIGINT        DEFAULT NULL COMMENT '原始客群',
    original_cust_qoq    DECIMAL(14,4) DEFAULT NULL COMMENT '原始客群环比',
    push_count           BIGINT        DEFAULT NULL COMMENT '推送量',
    push_count_qoq       DECIMAL(14,4) DEFAULT NULL COMMENT '推送量环比',
    usage_count          BIGINT        DEFAULT NULL COMMENT '使用量',
    usage_count_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '使用量环比',
    usage_rate           DECIMAL(14,4) DEFAULT NULL COMMENT '使用率',
    usage_rate_qoq       DECIMAL(14,4) DEFAULT NULL COMMENT '使用率环比',
    reach_count          BIGINT        DEFAULT NULL COMMENT '触达量',
    reach_count_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '触达量环比',
    target_conv_num      BIGINT        DEFAULT NULL COMMENT '目标转化量',
    target_conv_num_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化量环比',
    target_conv_rate     DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率',
    target_conv_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率环比',
    product_conv_num     BIGINT        DEFAULT NULL COMMENT '产品转化量',
    product_conv_num_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化量环比',
    product_conv_rate    DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率',
    product_conv_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率环比',
    expected_income      DECIMAL(20,2) DEFAULT NULL COMMENT '预计收益',
    expected_income_qoq  DECIMAL(14,4) DEFAULT NULL COMMENT '预计收益环比',
    actual_income        DECIMAL(20,2) DEFAULT NULL COMMENT '实际收益',
    actual_income_qoq    DECIMAL(14,4) DEFAULT NULL COMMENT '实际收益环比',
    reject_rate          DECIMAL(14,4) DEFAULT NULL COMMENT '拦截率',
    reject_rate_qoq      DECIMAL(14,4) DEFAULT NULL COMMENT '拦截率环比',
    reject_count         BIGINT        DEFAULT NULL COMMENT '拦截量',
    original_cust_yoy    DECIMAL(14,4) DEFAULT NULL COMMENT '原始客群同比',
    push_count_yoy       DECIMAL(14,4) DEFAULT NULL COMMENT '推送量同比',
    usage_count_yoy      DECIMAL(14,4) DEFAULT NULL COMMENT '使用量同比',
    usage_rate_yoy       DECIMAL(14,4) DEFAULT NULL COMMENT '使用率同比',
    reach_count_yoy      DECIMAL(14,4) DEFAULT NULL COMMENT '触达量同比',
    target_conv_num_yoy  DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化量同比',
    target_conv_rate_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '目标转化率同比',
    product_conv_num_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化量同比',
    product_conv_rate_yoy DECIMAL(14,4) DEFAULT NULL COMMENT '产品转化率同比',
    expected_income_yoy  DECIMAL(14,4) DEFAULT NULL COMMENT '预计收益同比',
    actual_income_yoy    DECIMAL(14,4) DEFAULT NULL COMMENT '实际收益同比',
    reject_rate_yoy      DECIMAL(14,4) DEFAULT NULL COMMENT '拒绝率同比',
    city_id              VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id            VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time          DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time          DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted           TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_sps_ap_strategy (strategy_id),
    KEY idx_sps_ap_tab_month (tab_type, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略周期汇总-active/passive';

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
    id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type      VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class VARCHAR(16)  DEFAULT NULL COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    stat_month    DATE          DEFAULT NULL COMMENT '账期',
    channel       VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category  VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category VARCHAR(128) DEFAULT NULL COMMENT '业务小类',
    capacity      BIGINT        DEFAULT NULL COMMENT '产能',
    qoq           DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    yoy           DECIMAL(14,4) DEFAULT NULL COMMENT '同比',
    city_id       VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id     VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time   DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time   DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted    TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cmc_ap_tab_month (tab_type, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道月度产能-active/passive';

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
    id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type      VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class VARCHAR(16)  DEFAULT NULL COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    stat_month    DATE          DEFAULT NULL COMMENT '账期',
    channel       VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category  VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category VARCHAR(128) DEFAULT NULL COMMENT '业务小类',
    biz_name      VARCHAR(128)  DEFAULT NULL COMMENT '业务名称',
    capacity      BIGINT        DEFAULT NULL COMMENT '产能',
    qoq           DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    city_id       VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id     VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time   DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time   DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted    TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_cbc_ap_tab_month (tab_type, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道业务产能-active/passive';

-- ---------------------------------------------------------------------
-- 策略业务产能
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity (
    id          BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type    VARCHAR(32)  NOT NULL DEFAULT 'active' COMMENT '策略类型：active/passive/control',
    strategy_id VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    stat_date   DATE          DEFAULT NULL COMMENT '统计日期',
    biz_code    VARCHAR(64)   DEFAULT NULL COMMENT '业务编码',
    biz_name    VARCHAR(128)  DEFAULT NULL COMMENT '业务名称',
    count       BIGINT        DEFAULT NULL COMMENT '数量',
    mom_ratio   DECIMAL(14,4) DEFAULT NULL COMMENT '环比',
    yoy_ratio   DECIMAL(14,4) DEFAULT NULL COMMENT '同比',
    city_id     VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id   VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted  TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_sbc_strategy_date (strategy_id, stat_date),
    KEY idx_sbc_tab_strategy_date (tab_type, strategy_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略业务产能';

-- ---------------------------------------------------------------------
-- 策略日粒度明细
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ctrl (
    id            BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    strategy_id   VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    stat_date     DATE          DEFAULT NULL COMMENT '统计日期',
    channel       VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category  VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category VARCHAR(128) DEFAULT NULL COMMENT '业务小类',
    strategy_name VARCHAR(255)  DEFAULT NULL COMMENT '策略名称',
    consult_count BIGINT        DEFAULT NULL COMMENT '咨询量',
    retain_count  BIGINT        DEFAULT NULL COMMENT '挽留量',
    retain_rate   DECIMAL(14,4) DEFAULT NULL COMMENT '挽留率',
    dispatch_count BIGINT       DEFAULT NULL COMMENT '派单量',
    success_count BIGINT        DEFAULT NULL COMMENT '成功办理量',
    success_rate  DECIMAL(14,4) DEFAULT NULL COMMENT '成功率',
    city_id       VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id     VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    is_deleted    TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_sdc_ctrl_strategy_date (strategy_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略日粒度明细-control';

CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap (
    id               BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
    tab_type         VARCHAR(32)   DEFAULT NULL COMMENT '策略类型',
    strategy_class   VARCHAR(16)  DEFAULT NULL COMMENT '策略分类：存量为升接/稳/降拆/离/重点客群；增量/重点产品为全部',
    strategy_id      VARCHAR(64)  DEFAULT NULL COMMENT '策略ID',
    stat_date        DATE          DEFAULT NULL COMMENT '统计日期',
    channel          VARCHAR(64)   DEFAULT NULL COMMENT '渠道编码',
    big_category     VARCHAR(128)  DEFAULT NULL COMMENT '业务大类',
    small_category   VARCHAR(128)  DEFAULT NULL COMMENT '业务小类',
    strategy_name    VARCHAR(255)  DEFAULT NULL COMMENT '策略名称',
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
    reject_count     BIGINT        DEFAULT NULL COMMENT '拒绝量',
    reject_rate      DECIMAL(14,4) DEFAULT NULL COMMENT '拒绝率',
    strategy_code    VARCHAR(64)   DEFAULT NULL COMMENT '策略编码',
    city_id          VARCHAR(64)   DEFAULT NULL COMMENT '地市',
    county_id        VARCHAR(64)   DEFAULT NULL COMMENT '区县',
    create_time      DATETIME      DEFAULT NULL COMMENT '创建时间',
    update_time      DATETIME      DEFAULT NULL COMMENT '更新时间',
    is_deleted       TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删1已删',
    PRIMARY KEY (id),
    KEY idx_sda_ap_strategy_date (strategy_id, stat_date),
    KEY idx_sda_ap_tab (tab_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略日粒度明细-active/passive';

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
