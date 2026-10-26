-- Move existing active “降拆 / 离”, key-audience, and passive rows after dedicated tables are created.
-- Active “全部” cross-class aggregate rows remain in shared tables.
INSERT IGNORE INTO t_sr_strategy_special
SELECT * FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_strategy_period_summary_ap_special
SELECT * FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_strategy_daily_ap_special
SELECT * FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_kpi_summary_special
SELECT * FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_channel_summary_ap_special
SELECT * FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_channel_monthly_capacity_ap_special
SELECT * FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_channel_biz_capacity_ap_special
SELECT * FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

INSERT IGNORE INTO t_sr_strategy_biz_capacity_special
SELECT b.* FROM t_sr_strategy_biz_capacity b
WHERE b.tab_type = 'active'
  AND EXISTS (
      SELECT 1 FROM t_sr_strategy_special s
      WHERE s.tab_type = 'active'
        AND s.strategy_class IN ('降拆', '离')
        AND s.strategy_code = b.strategy_id
  );
DELETE b FROM t_sr_strategy_biz_capacity b
WHERE b.tab_type = 'active'
  AND EXISTS (
      SELECT 1 FROM t_sr_strategy_special s
      WHERE s.tab_type = 'active'
        AND s.strategy_class IN ('降拆', '离')
        AND s.strategy_code = b.strategy_id
  );

INSERT IGNORE INTO t_sr_strategy_reject_reason_special
SELECT r.* FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_special s
      WHERE s.tab_type = 'active'
        AND s.strategy_class IN ('降拆', '离')
        AND s.strategy_code = r.strategy_id
  );
DELETE r FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_special s
      WHERE s.tab_type = 'active'
        AND s.strategy_class IN ('降拆', '离')
        AND s.strategy_code = r.strategy_id
  );

-- Move active key-audience data to its own table family; shared “全部” totals stay put.
INSERT IGNORE INTO t_sr_strategy_key_audience
SELECT * FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_strategy_period_summary_ap_key_audience
SELECT * FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_strategy_daily_ap_key_audience
SELECT * FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_kpi_summary_key_audience
SELECT * FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_channel_summary_ap_key_audience
SELECT * FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_channel_monthly_capacity_ap_key_audience
SELECT * FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_channel_biz_capacity_ap_key_audience
SELECT * FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';
DELETE FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class = '重点客群';

INSERT IGNORE INTO t_sr_strategy_biz_capacity_key_audience
SELECT b.* FROM t_sr_strategy_biz_capacity b
WHERE b.tab_type = 'active'
  AND EXISTS (SELECT 1 FROM t_sr_strategy_key_audience s WHERE s.strategy_code = b.strategy_id AND s.tab_type = 'active');
DELETE b FROM t_sr_strategy_biz_capacity b
WHERE b.tab_type = 'active'
  AND EXISTS (SELECT 1 FROM t_sr_strategy_key_audience s WHERE s.strategy_code = b.strategy_id AND s.tab_type = 'active');

INSERT IGNORE INTO t_sr_strategy_reject_reason_key_audience
SELECT r.* FROM t_sr_strategy_reject_reason r
WHERE EXISTS (SELECT 1 FROM t_sr_strategy_key_audience s WHERE s.strategy_code = r.strategy_id AND s.tab_type = 'active');
DELETE r FROM t_sr_strategy_reject_reason r
WHERE EXISTS (SELECT 1 FROM t_sr_strategy_key_audience s WHERE s.strategy_code = r.strategy_id AND s.tab_type = 'active');

-- Move all incremental strategy data to the passive table family.
INSERT IGNORE INTO t_sr_strategy_passive
SELECT * FROM t_sr_strategy
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_period_summary_ap_passive
SELECT * FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_daily_ap_passive
SELECT * FROM t_sr_strategy_daily_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_daily_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_kpi_summary_passive
SELECT * FROM t_sr_kpi_summary
WHERE tab_type = 'passive';
DELETE FROM t_sr_kpi_summary
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_summary_ap_passive
SELECT * FROM t_sr_channel_summary_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_summary_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_monthly_capacity_ap_passive
SELECT * FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_biz_capacity_ap_passive
SELECT * FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_biz_capacity_passive
SELECT * FROM t_sr_strategy_biz_capacity
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_biz_capacity
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_reject_reason_passive
SELECT r.* FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_passive s
      WHERE s.tab_type = 'passive'
        AND s.strategy_code = r.strategy_id
  );
DELETE r FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_passive s
      WHERE s.tab_type = 'passive'
        AND s.strategy_code = r.strategy_id
  );
