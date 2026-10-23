-- 存量策略分类改为中文。先选择目标数据库；字段 strategy_class 必须已存在。
-- 与新版本应用及 ETL 一同切换；执行前停止旧版本读写。
-- 本脚本可重复执行，仅更新 active；不补造分类、不重算指标。
-- 当前建表脚本没有包含 strategy_class 的唯一键。若目标库自行增加了唯一键，
-- 请先核对旧值/新值并存的同维度记录，处理重复后再执行。
SET NAMES utf8mb4;

START TRANSACTION;

UPDATE t_sr_strategy
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_kpi_summary
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_channel_summary_ap
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_channel_monthly_capacity_ap
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_channel_biz_capacity_ap
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_strategy_period_summary_ap
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_strategy_daily_ap
SET strategy_class = CASE strategy_class
    WHEN 'UPSELL' THEN '升接'
    WHEN 'STABLE' THEN '稳'
    WHEN 'DOWNGRADE' THEN '降拆'
    WHEN 'CHURN' THEN '离'
    ELSE strategy_class END
WHERE tab_type = 'active'
  AND strategy_class IN ('UPSELL', 'STABLE', 'DOWNGRADE', 'CHURN');

UPDATE t_sr_kpi_summary
SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;

UPDATE t_sr_channel_summary_ap
SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;

UPDATE t_sr_channel_monthly_capacity_ap
SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;

UPDATE t_sr_channel_biz_capacity_ap
SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;

UPDATE t_sr_strategy_period_summary_ap
SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL AND strategy_id = '999';

-- 主表和真实逐策略月/日明细中的 NULL 为未分类，保留供业务补齐。
COMMIT;
