-- 增量、重点产品已有 strategy_class 字段统一存全部；无此字段的专用表无需修改。
-- 与新应用、ETL 一起切换；仅更新 NULL，不覆盖已有非空分类。
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE t_sr_strategy
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_kpi_summary
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_summary_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_strategy_period_summary_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_monthly_capacity_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_biz_capacity_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_strategy_daily_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

COMMIT;
