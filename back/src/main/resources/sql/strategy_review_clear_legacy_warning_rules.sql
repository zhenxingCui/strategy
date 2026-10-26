-- One-time cleanup before deploying page-scoped warning rules.
-- Keeps the existing schema and marks all existing warning rules and their
-- dependent conditions/hit records as logically deleted.
START TRANSACTION;

UPDATE t_sr_warning_hit h
INNER JOIN t_sr_warning_rule r ON r.id = h.rule_id
SET h.is_deleted = 1,
    h.update_time = NOW()
WHERE h.is_deleted = 0;

UPDATE t_sr_warning_rule_condition c
INNER JOIN t_sr_warning_rule r ON r.id = c.rule_id
SET c.is_deleted = 1,
    c.update_time = NOW()
WHERE c.is_deleted = 0;

UPDATE t_sr_warning_rule
SET is_deleted = 1,
    update_by = 'page-scope-reset',
    update_time = NOW()
WHERE is_deleted = 0;

COMMIT;
