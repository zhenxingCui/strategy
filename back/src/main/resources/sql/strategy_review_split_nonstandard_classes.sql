-- Split active “降拆 / 离”, key-audience, and incremental (passive) data into dedicated table families.
-- Run after the existing schema upgrade scripts. The script is safe to rerun.
-- Active “全部” aggregate rows stay shared; all passive rows move to *_passive.

CREATE TABLE IF NOT EXISTS t_sr_strategy_special LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_special LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_special LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_special LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_special LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_special LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_special LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_special LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_special LIKE t_sr_strategy_reject_reason;

-- Incremental strategies (tab_type=passive) are a separate data domain from
-- both the shared/control tables and active special-class tables.
CREATE TABLE IF NOT EXISTS t_sr_strategy_passive LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_passive LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_passive LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_passive LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_passive LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_passive LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_passive LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_passive LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_passive LIKE t_sr_strategy_reject_reason;
CREATE TABLE IF NOT EXISTS t_sr_strategy_key_audience LIKE t_sr_strategy;
CREATE TABLE IF NOT EXISTS t_sr_kpi_summary_key_audience LIKE t_sr_kpi_summary;
CREATE TABLE IF NOT EXISTS t_sr_channel_summary_ap_key_audience LIKE t_sr_channel_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_period_summary_ap_key_audience LIKE t_sr_strategy_period_summary_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_daily_ap_key_audience LIKE t_sr_strategy_daily_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_monthly_capacity_ap_key_audience LIKE t_sr_channel_monthly_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_channel_biz_capacity_ap_key_audience LIKE t_sr_channel_biz_capacity_ap;
CREATE TABLE IF NOT EXISTS t_sr_strategy_biz_capacity_key_audience LIKE t_sr_strategy_biz_capacity;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_key_audience LIKE t_sr_strategy_reject_reason;
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_ctrl LIKE t_sr_strategy_reject_reason;

-- Control rejection reasons used to be routed into the passive demo table.
-- Move those marked local seed rows to the control fact table during upgrade.
INSERT IGNORE INTO t_sr_strategy_reject_reason_ctrl
SELECT * FROM t_sr_strategy_reject_reason_passive
WHERE county_id = 'LOCAL_CONTROL_SEED';
DELETE FROM t_sr_strategy_reject_reason_passive
WHERE county_id = 'LOCAL_CONTROL_SEED';
INSERT IGNORE INTO t_sr_strategy_reject_reason_ctrl
SELECT * FROM t_sr_strategy_reject_reason
WHERE county_id = 'LOCAL_CONTROL_SEED';
DELETE FROM t_sr_strategy_reject_reason
WHERE county_id = 'LOCAL_CONTROL_SEED';

-- The legacy shared table has no tab_type column. Move reasons whose strategy
-- master belongs only to control; leave strategy codes shared with other tabs untouched.
INSERT IGNORE INTO t_sr_strategy_reject_reason_ctrl
SELECT r.* FROM t_sr_strategy_reject_reason r
WHERE EXISTS (SELECT 1 FROM t_sr_strategy s
    WHERE s.strategy_code = r.strategy_id AND s.tab_type = 'control' AND s.is_deleted = 0)
  AND NOT EXISTS (SELECT 1 FROM t_sr_strategy s
    WHERE s.strategy_code = r.strategy_id AND s.tab_type IN ('active', 'passive') AND s.is_deleted = 0);
DELETE r FROM t_sr_strategy_reject_reason r
WHERE EXISTS (SELECT 1 FROM t_sr_strategy s
    WHERE s.strategy_code = r.strategy_id AND s.tab_type = 'control' AND s.is_deleted = 0)
  AND NOT EXISTS (SELECT 1 FROM t_sr_strategy s
    WHERE s.strategy_code = r.strategy_id AND s.tab_type IN ('active', 'passive') AND s.is_deleted = 0);

-- Strategy masters first; child fact tables use strategy_code / strategy_id to identify them.
INSERT IGNORE INTO t_sr_strategy_special
SELECT * FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

-- Move all incremental strategy masters, including their strategy_class='全部' rows.
UPDATE t_sr_strategy
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_strategy_passive
SELECT * FROM t_sr_strategy
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_period_summary_ap_special
SELECT * FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_strategy_period_summary_ap
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_strategy_period_summary_ap_passive
SELECT * FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_period_summary_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_strategy_daily_ap_special
SELECT * FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_strategy_daily_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_strategy_daily_ap
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_strategy_daily_ap_passive
SELECT * FROM t_sr_strategy_daily_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_daily_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_kpi_summary_special
SELECT * FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_kpi_summary
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_kpi_summary
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_kpi_summary_passive
SELECT * FROM t_sr_kpi_summary
WHERE tab_type = 'passive';
DELETE FROM t_sr_kpi_summary
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_summary_ap_special
SELECT * FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_summary_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_channel_summary_ap
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_channel_summary_ap_passive
SELECT * FROM t_sr_channel_summary_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_summary_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_monthly_capacity_ap_special
SELECT * FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_channel_monthly_capacity_ap
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_channel_monthly_capacity_ap_passive
SELECT * FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_monthly_capacity_ap
WHERE tab_type = 'passive';

INSERT IGNORE INTO t_sr_channel_biz_capacity_ap_special
SELECT * FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');
DELETE FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'active' AND strategy_class IN ('降拆', '离');

UPDATE t_sr_channel_biz_capacity_ap
SET strategy_class = '全部'
WHERE tab_type = 'passive' AND strategy_class IS NULL;
INSERT IGNORE INTO t_sr_channel_biz_capacity_ap_passive
SELECT * FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'passive';
DELETE FROM t_sr_channel_biz_capacity_ap
WHERE tab_type = 'passive';

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

INSERT IGNORE INTO t_sr_strategy_biz_capacity_passive
SELECT * FROM t_sr_strategy_biz_capacity
WHERE tab_type = 'passive';
DELETE FROM t_sr_strategy_biz_capacity
WHERE tab_type = 'passive';

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

-- Key-audience rows have their own business rules and must never be imported into the shared active-class tables.
-- Cross-class “全部” rollups remain shared; only rows classified as “重点客群” are moved.
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
  AND EXISTS (
      SELECT 1 FROM t_sr_strategy_key_audience s
      WHERE s.tab_type = 'active' AND s.strategy_code = b.strategy_id
  );
DELETE b FROM t_sr_strategy_biz_capacity b
WHERE b.tab_type = 'active'
  AND EXISTS (
      SELECT 1 FROM t_sr_strategy_key_audience s
      WHERE s.tab_type = 'active' AND s.strategy_code = b.strategy_id
  );

INSERT IGNORE INTO t_sr_strategy_reject_reason_key_audience
SELECT r.* FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_key_audience s
      WHERE s.tab_type = 'active' AND s.strategy_code = r.strategy_id
  );
DELETE r FROM t_sr_strategy_reject_reason r
WHERE EXISTS (
      SELECT 1 FROM t_sr_strategy_key_audience s
      WHERE s.tab_type = 'active' AND s.strategy_code = r.strategy_id
  );

-- Read views keep the API contract stable while the source rows live in separate tables.
CREATE OR REPLACE VIEW v_sr_strategy_read AS
SELECT * FROM t_sr_strategy
UNION ALL
SELECT * FROM t_sr_strategy_special
UNION ALL
SELECT * FROM t_sr_strategy_passive
UNION ALL
SELECT * FROM t_sr_strategy_key_audience;

CREATE OR REPLACE VIEW v_sr_kpi_summary_read AS
SELECT * FROM t_sr_kpi_summary
UNION ALL
SELECT * FROM t_sr_kpi_summary_special
UNION ALL
SELECT * FROM t_sr_kpi_summary_passive
UNION ALL
SELECT * FROM t_sr_kpi_summary_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_summary_ap_read AS
SELECT * FROM t_sr_channel_summary_ap
UNION ALL
SELECT * FROM t_sr_channel_summary_ap_special
UNION ALL
SELECT * FROM t_sr_channel_summary_ap_passive
UNION ALL
SELECT * FROM t_sr_channel_summary_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_period_summary_ap_read AS
SELECT * FROM t_sr_strategy_period_summary_ap
UNION ALL
SELECT * FROM t_sr_strategy_period_summary_ap_special
UNION ALL
SELECT * FROM t_sr_strategy_period_summary_ap_passive
UNION ALL
SELECT * FROM t_sr_strategy_period_summary_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_daily_ap_read AS
SELECT * FROM t_sr_strategy_daily_ap
UNION ALL
SELECT * FROM t_sr_strategy_daily_ap_special
UNION ALL
SELECT * FROM t_sr_strategy_daily_ap_passive
UNION ALL
SELECT * FROM t_sr_strategy_daily_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_monthly_capacity_ap_read AS
SELECT * FROM t_sr_channel_monthly_capacity_ap
UNION ALL
SELECT * FROM t_sr_channel_monthly_capacity_ap_special
UNION ALL
SELECT * FROM t_sr_channel_monthly_capacity_ap_passive
UNION ALL
SELECT * FROM t_sr_channel_monthly_capacity_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_channel_biz_capacity_ap_read AS
SELECT * FROM t_sr_channel_biz_capacity_ap
UNION ALL
SELECT * FROM t_sr_channel_biz_capacity_ap_special
UNION ALL
SELECT * FROM t_sr_channel_biz_capacity_ap_passive
UNION ALL
SELECT * FROM t_sr_channel_biz_capacity_ap_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_biz_capacity_read AS
SELECT * FROM t_sr_strategy_biz_capacity
UNION ALL
SELECT * FROM t_sr_strategy_biz_capacity_special
UNION ALL
SELECT * FROM t_sr_strategy_biz_capacity_passive
UNION ALL
SELECT * FROM t_sr_strategy_biz_capacity_key_audience;

CREATE OR REPLACE VIEW v_sr_strategy_reject_reason_read AS
SELECT * FROM t_sr_strategy_reject_reason
UNION ALL
SELECT * FROM t_sr_strategy_reject_reason_special
UNION ALL
SELECT * FROM t_sr_strategy_reject_reason_passive
UNION ALL
SELECT * FROM t_sr_strategy_reject_reason_key_audience
UNION ALL
SELECT * FROM t_sr_strategy_reject_reason_ctrl;
