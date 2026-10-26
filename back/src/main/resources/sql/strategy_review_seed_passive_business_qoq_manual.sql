-- Incremental strategy business-capacity QoQ values, calculated from the
-- strategy-level business capacity and its source mom_ratio.
-- Existing rows edited by a user are preserved; generated rows are refreshed.

INSERT INTO t_sr_strategy_biz_capacity_qoq_manual
    (tab_type, strategy_class, customer_group, stat_month, channel,
     big_category, small_category, city_id, county_id, biz_name,
     manual_qoq, status, remark, created_by, updated_by)
SELECT 'passive', '全部', '全部', aggregated.stat_month, '全部',
       aggregated.big_category, aggregated.small_category, '全部', '全部', aggregated.biz_name,
       ROUND((SUM(aggregated.current_capacity) / NULLIF(SUM(aggregated.previous_capacity), 0) - 1) * 100, 4),
       1, '按策略明细产能加权计算环比', 'codex-simulation', 'codex-simulation'
FROM (
    SELECT scopes.stat_month, scopes.big_category, scopes.small_category,
           business.biz_name, business.current_capacity, business.previous_capacity
    FROM (
        SELECT DISTINCT p.strategy_id, p.stat_month, p.city_id, p.county_id,
               p.big_category, p.small_category
        FROM t_sr_strategy_period_summary_ap_passive p
        WHERE p.strategy_class = '全部' AND p.strategy_id != '999'
          AND p.channel != '全部' AND p.big_category IS NOT NULL AND p.big_category != '全部'
          AND p.small_category IS NOT NULL AND p.small_category != '' AND p.small_category != '全部'
          AND p.is_deleted = 0

        UNION

        SELECT DISTINCT p.strategy_id, p.stat_month, p.city_id, p.county_id,
               p.big_category, '全部'
        FROM t_sr_strategy_period_summary_ap_passive p
        WHERE p.strategy_class = '全部' AND p.strategy_id != '999'
          AND p.channel != '全部' AND p.big_category IS NOT NULL AND p.big_category != '全部'
          AND p.small_category IS NOT NULL AND p.small_category != '' AND p.small_category != '全部'
          AND p.is_deleted = 0

        UNION

        SELECT DISTINCT p.strategy_id, p.stat_month, p.city_id, p.county_id,
               '全部', '全部'
        FROM t_sr_strategy_period_summary_ap_passive p
        WHERE p.strategy_class = '全部' AND p.strategy_id != '999'
          AND p.channel != '全部' AND p.big_category IS NOT NULL AND p.big_category != '全部'
          AND p.small_category IS NOT NULL AND p.small_category != '' AND p.small_category != '全部'
          AND p.is_deleted = 0
    ) scopes
    JOIN (
        SELECT b.strategy_id,
               STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d') AS stat_month,
               b.city_id, b.county_id, b.biz_name,
               SUM(b.count) AS current_capacity,
               SUM(b.count / NULLIF(1 + b.mom_ratio / 100, 0)) AS previous_capacity
        FROM t_sr_strategy_biz_capacity_passive b
        WHERE b.is_deleted = 0 AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
          AND b.count IS NOT NULL AND b.mom_ratio IS NOT NULL AND b.mom_ratio > -100
        GROUP BY b.strategy_id, STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d'),
                 b.city_id, b.county_id, b.biz_name
    ) business
      ON business.strategy_id = scopes.strategy_id
     AND business.stat_month = scopes.stat_month
     AND business.city_id <=> scopes.city_id
     AND business.county_id <=> scopes.county_id
 ) aggregated
GROUP BY aggregated.stat_month, aggregated.big_category, aggregated.small_category, aggregated.biz_name
HAVING SUM(aggregated.previous_capacity) > 0
ON DUPLICATE KEY UPDATE
    manual_qoq = IF(created_by = 'codex-simulation' AND updated_by = 'codex-simulation',
                    VALUES(manual_qoq), manual_qoq);

INSERT IGNORE INTO t_sr_strategy_detail_biz_capacity_qoq_manual
    (tab_type, strategy_class, strategy_id, strategy_name, stat_month, biz_code, biz_name,
     city_id, county_id, manual_qoq, status, remark, created_by, updated_by)
SELECT DISTINCT 'passive', '全部', b.strategy_id, COALESCE(s.strategy_name, ''),
       STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d'),
       COALESCE(b.biz_code, ''), b.biz_name,
       COALESCE(NULLIF(b.city_id, ''), '全部'), COALESCE(NULLIF(b.county_id, ''), '全部'),
       b.mom_ratio, 1, '增量策略本地演示模拟环比，取模拟业务产能环比',
       'codex-simulation', 'codex-simulation'
FROM v_sr_strategy_biz_capacity_read b
LEFT JOIN v_sr_strategy_period_summary_ap_read s
  ON s.tab_type = b.tab_type AND s.strategy_id = b.strategy_id
 AND s.stat_month = STR_TO_DATE(DATE_FORMAT(b.stat_date, '%Y-%m-01'), '%Y-%m-%d')
 AND s.is_deleted = 0
WHERE b.tab_type = 'passive'
  AND b.is_deleted = 0
  AND b.strategy_id IS NOT NULL AND b.strategy_id != '999'
  AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
  AND b.mom_ratio IS NOT NULL;
