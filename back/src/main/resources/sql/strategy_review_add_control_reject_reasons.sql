-- 为重点产品增加独立的拒绝原因表。
-- Run against an existing database after the base schema and passive table family exist.
CREATE TABLE IF NOT EXISTS t_sr_strategy_reject_reason_ctrl LIKE t_sr_strategy_reject_reason;

-- Recover control seed rows written to the passive table by older local seed scripts.
INSERT IGNORE INTO t_sr_strategy_reject_reason_ctrl
SELECT * FROM t_sr_strategy_reject_reason_passive
WHERE county_id = 'LOCAL_CONTROL_SEED';
DELETE FROM t_sr_strategy_reject_reason_passive
WHERE county_id = 'LOCAL_CONTROL_SEED';

-- The old shared table has no tab_type. Move rows only when the strategy master
-- identifies a control strategy and no active/passive strategy reuses its code.
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
