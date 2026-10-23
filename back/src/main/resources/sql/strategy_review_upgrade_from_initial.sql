-- 从最初提交 9eeced3 的表结构升级到当前版本，兼容 MySQL 5.7。
-- 执行前先选择目标数据库。本脚本仅适用于尚未执行这些结构变更的初始库，不能重复执行。
-- 仅包含 DDL；历史策略分类、客群名称、产品名称及业务产能类型的数据回填需另行处理。
SET NAMES utf8mb4;

ALTER TABLE t_sr_strategy
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type,
    ADD COLUMN product_name VARCHAR(128) DEFAULT NULL
        COMMENT '重点产品名称，一条策略固定归属一个产品' AFTER strategy_class,
    ADD COLUMN customer_group VARCHAR(64) DEFAULT NULL
        COMMENT '重点客群分类名称，一条策略固定归属一类客群' AFTER product_name,
    ADD INDEX idx_strategy_class (tab_type, strategy_class, is_deleted);

ALTER TABLE t_sr_kpi_summary
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_channel_summary_ap
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_strategy_period_summary_ap
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_channel_monthly_capacity_ap
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_channel_biz_capacity_ap
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为全部/升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_strategy_daily_ap
    ADD COLUMN strategy_class VARCHAR(16) DEFAULT NULL
        COMMENT '策略分类：存量为升接/稳/降拆/离/重点客群；增量/重点产品为全部' AFTER tab_type;

ALTER TABLE t_sr_strategy_biz_capacity
    ADD COLUMN tab_type VARCHAR(32) NOT NULL DEFAULT 'active'
        COMMENT '策略类型：active/passive/control' AFTER id,
    ADD INDEX idx_sbc_tab_strategy_date (tab_type, strategy_id, stat_date);
