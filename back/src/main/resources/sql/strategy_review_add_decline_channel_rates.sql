-- One-time migration: store the decline success rate and its month-over-month
-- percentage-point change on the AP channel summary tables.
ALTER TABLE t_sr_channel_summary_ap
    ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '成功率（降拆成功量/推送量，百分数）' AFTER reach_count_qoq,
    ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '成功率环比（百分点）' AFTER reach_rate;

ALTER TABLE t_sr_channel_summary_ap_special
    ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '成功率（降拆成功量/推送量，百分数）' AFTER reach_count_qoq,
    ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '成功率环比（百分点）' AFTER reach_rate;

ALTER TABLE t_sr_channel_summary_ap_passive
    ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '成功率（降拆成功量/推送量，百分数）' AFTER reach_count_qoq,
    ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '成功率环比（百分点）' AFTER reach_rate;

ALTER TABLE t_sr_channel_summary_ap_key_audience
    ADD COLUMN reach_rate DECIMAL(14,4) DEFAULT NULL COMMENT '成功率（降拆成功量/推送量，百分数）' AFTER reach_count_qoq,
    ADD COLUMN reach_rate_qoq DECIMAL(14,4) DEFAULT NULL COMMENT '成功率环比（百分点）' AFTER reach_rate;

-- Recompute historical decline rates from the saved channel totals. For QoQ,
-- compare each row with the same touchpoint and region in the prior calendar month.
DROP TEMPORARY TABLE IF EXISTS tmp_decline_channel_rate_rows;
CREATE TEMPORARY TABLE tmp_decline_channel_rate_rows AS
SELECT c.id, c.tab_type, c.strategy_class, c.channel, c.city_id, c.county_id,
       c.stat_month, c.reach_count, c.push_count,
       ROUND(c.reach_count * 100.0 / NULLIF(c.push_count, 0), 2) AS reach_rate
FROM t_sr_channel_summary_ap_special c
JOIN (
    SELECT tab_type, strategy_class, channel, city_id, county_id, stat_month, MAX(id) AS id
    FROM t_sr_channel_summary_ap_special
    WHERE tab_type = 'active' AND strategy_class = '降拆' AND is_deleted = 0
    GROUP BY tab_type, strategy_class, channel, city_id, county_id, stat_month
) latest ON latest.id = c.id;

UPDATE t_sr_channel_summary_ap_special c
LEFT JOIN tmp_decline_channel_rate_rows prev
  ON prev.tab_type = c.tab_type
 AND prev.strategy_class = c.strategy_class
 AND prev.channel = c.channel
 AND prev.city_id <=> c.city_id
 AND prev.county_id <=> c.county_id
 AND prev.stat_month = DATE_SUB(c.stat_month, INTERVAL 1 MONTH)
SET c.reach_rate = ROUND(c.reach_count * 100.0 / NULLIF(c.push_count, 0), 2),
    c.reach_rate_qoq = CASE
        WHEN prev.id IS NULL
          OR c.reach_count IS NULL OR c.push_count IS NULL OR c.push_count = 0
          OR prev.reach_count IS NULL OR prev.push_count IS NULL OR prev.push_count = 0
        THEN NULL
        ELSE ROUND(
            ROUND(c.reach_count * 100.0 / NULLIF(c.push_count, 0), 2) - prev.reach_rate,
            2
        )
    END
WHERE c.tab_type = 'active' AND c.strategy_class = '降拆' AND c.is_deleted = 0;

DROP TEMPORARY TABLE tmp_decline_channel_rate_rows;

-- Refresh the SELECT * UNION view so its metadata includes the two new columns.
CREATE OR REPLACE VIEW v_sr_channel_summary_ap_read AS
SELECT * FROM t_sr_channel_summary_ap
UNION ALL SELECT * FROM t_sr_channel_summary_ap_special
UNION ALL SELECT * FROM t_sr_channel_summary_ap_passive
UNION ALL SELECT * FROM t_sr_channel_summary_ap_key_audience;
