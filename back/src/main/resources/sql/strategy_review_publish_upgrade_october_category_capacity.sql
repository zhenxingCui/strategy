-- Publish the October 2026 upgrade capacity scopes for the Business Hall
-- touchpoint so every category with source capacity can appear in its trend.
-- Keep manual QoQ values unchanged.
UPDATE t_sr_upgrade_stable_monthly_trend_manual
SET status = 1
WHERE stat_month = '2026-10-01'
  AND strategy_class = '升接'
  AND channel = 'ACH0010'
  AND county_id = '全部'
  AND city_id IN ('999', '全部')
  AND metric_code = 'product_conv_num'
  AND metric_value IS NOT NULL
  AND source_batch = 'current-data-backfill'
  AND status = 0;
