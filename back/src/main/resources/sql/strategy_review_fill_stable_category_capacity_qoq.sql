-- Backfill missing category capacity QoQ from the strategy-level source QoQ.
-- The weighted aggregation reconstructs each strategy's comparison base;
-- existing manual_qoq entries are preserved.
UPDATE t_sr_upgrade_stable_monthly_trend_manual trend
JOIN (
    SELECT s.stat_month,
           ROUND((
               SUM(s.product_conv_num) / NULLIF(SUM(
                   s.product_conv_num / NULLIF(1 + s.product_conv_num_qoq / 100.0, 0)
               ), 0) - 1
           ) * 100, 4) AS manual_qoq
    FROM t_sr_strategy_period_summary_ap s
    WHERE s.tab_type = 'active'
      AND s.strategy_class = '稳'
      AND s.channel = 'ACH0012'
      AND s.big_category = '风险修复'
      AND s.small_category = '平档低消扩流量'
      AND s.city_id = '999'
      AND s.county_id IS NULL
      AND s.is_deleted = 0
      AND s.strategy_id != '999'
      AND s.stat_month >= '2026-01-01'
      AND s.stat_month < '2026-11-01'
    GROUP BY s.stat_month
    HAVING COUNT(*) = SUM(s.product_conv_num_qoq IS NOT NULL)
) source ON source.stat_month = trend.stat_month
SET trend.manual_qoq = source.manual_qoq
WHERE trend.strategy_class = '稳'
  AND trend.channel = 'ACH0012'
  AND trend.big_category = '风险修复'
  AND trend.small_category = '平档低消扩流量'
  AND trend.city_id = '999'
  AND trend.county_id = '全部'
  AND trend.metric_code = 'product_conv_num'
  AND trend.status = 1
  AND trend.source_batch = 'current-data-backfill'
  AND trend.manual_qoq IS NULL;
