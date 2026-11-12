-- Demo bootstrap: create published 1% manual QoQ values for the scopes shown in StockExecution.
-- Seed scopes cover all categories, one big category, and one big/small category.
-- INSERT IGNORE preserves any manually maintained values when this script is rerun.
INSERT IGNORE INTO t_sr_strategy_biz_capacity_qoq_manual
    (tab_type, strategy_class, customer_group, stat_month, channel,
     big_category, small_category, city_id, county_id, biz_name,
     manual_qoq, status, remark, created_by, updated_by)
SELECT DISTINCT seed.tab_type, seed.strategy_class, seed.customer_group, seed.stat_month,
       seed.channel, seed.big_category, seed.small_category, seed.city_id, seed.county_id,
       seed.biz_name, 1, 1, '本地演示默认值，后续可由人工维护覆盖', 'seed', 'seed'
FROM (
    SELECT 'active' AS tab_type, p.strategy_class, '全部' AS customer_group, p.stat_month,
           '全部' AS channel, p.big_category, p.small_category,
           '全部' AS city_id, '全部' AS county_id, b.biz_name
    FROM v_sr_strategy_period_summary_ap_read p
    JOIN v_sr_strategy_biz_capacity_read b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class IN ('升接', '稳')
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', p.strategy_class, '全部', p.stat_month,
           '全部', p.big_category, '全部', '全部', '全部', b.biz_name
    FROM v_sr_strategy_period_summary_ap_read p
    JOIN v_sr_strategy_biz_capacity_read b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class IN ('升接', '稳')
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', p.strategy_class, '全部', p.stat_month,
           '全部', '全部', '全部', '全部', '全部', b.biz_name
    FROM v_sr_strategy_period_summary_ap_read p
    JOIN v_sr_strategy_biz_capacity_read b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class IN ('升接', '稳')
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', '全部', p.stat_month,
           '全部', p.big_category, p.small_category, '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', '全部', p.stat_month,
           '全部', p.big_category, '全部', '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', '全部', p.stat_month,
           '全部', '全部', '全部', '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', TRIM(cg.customer_group), p.stat_month,
           '全部', p.big_category, p.small_category, '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    JOIN t_sr_strategy_key_audience cg
      ON cg.tab_type = 'active' AND cg.strategy_class = '重点客群'
     AND cg.strategy_code = p.strategy_id AND cg.is_deleted = 0
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND cg.customer_group IS NOT NULL AND TRIM(cg.customer_group) != ''
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', TRIM(cg.customer_group), p.stat_month,
           '全部', p.big_category, '全部', '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    JOIN t_sr_strategy_key_audience cg
      ON cg.tab_type = 'active' AND cg.strategy_class = '重点客群'
     AND cg.strategy_code = p.strategy_id AND cg.is_deleted = 0
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND cg.customer_group IS NOT NULL AND TRIM(cg.customer_group) != ''
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'

    UNION ALL

    SELECT 'active', '重点客群', TRIM(cg.customer_group), p.stat_month,
           '全部', '全部', '全部', '全部', '全部', b.biz_name
    FROM t_sr_strategy_period_summary_ap_key_audience p
    JOIN t_sr_strategy_biz_capacity_key_audience b
      ON b.tab_type = p.tab_type AND b.strategy_id = p.strategy_id
     AND DATE_FORMAT(b.stat_month, '%Y-%m') = DATE_FORMAT(p.stat_month, '%Y-%m')
     AND b.city_id <=> p.city_id AND b.county_id <=> p.county_id
    JOIN t_sr_strategy_key_audience cg
      ON cg.tab_type = 'active' AND cg.strategy_class = '重点客群'
     AND cg.strategy_code = p.strategy_id AND cg.is_deleted = 0
    WHERE p.tab_type = 'active' AND p.strategy_class = '重点客群'
      AND p.strategy_id != '999' AND p.channel != '全部'
      AND p.big_category != '全部' AND COALESCE(p.small_category, '') != '全部'
      AND p.is_deleted = 0 AND b.is_deleted = 0
      AND cg.customer_group IS NOT NULL AND TRIM(cg.customer_group) != ''
      AND b.biz_name IS NOT NULL AND b.biz_name != '' AND b.biz_name != '全部'
) seed;
