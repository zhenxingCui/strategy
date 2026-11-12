-- Normalize active monthly channel-capacity billing months to DATE.
-- Run after V004 on existing installations. Values such as 202610 and 2026-10
-- are converted to 2026-10-01; the application reads/writes stat_month as DATE.

ALTER TABLE t_sr_channel_monthly_capacity_ap
    ADD COLUMN stat_month_date DATE NULL DEFAULT NULL AFTER small_category;

UPDATE t_sr_channel_monthly_capacity_ap
SET stat_month_date = STR_TO_DATE(
    CONCAT(REPLACE(TRIM(stat_month), '-', ''), '01'),
    '%Y%m%d'
);

SELECT COUNT(*) AS unconverted_standard_months
FROM t_sr_channel_monthly_capacity_ap
WHERE stat_month IS NOT NULL AND stat_month_date IS NULL;

ALTER TABLE t_sr_channel_monthly_capacity_ap
    DROP INDEX idx_cmc_ap_tab_month,
    DROP COLUMN stat_month,
    CHANGE COLUMN stat_month_date stat_month DATE NULL DEFAULT NULL COMMENT '账期' AFTER small_category,
    ADD INDEX idx_cmc_ap_tab_month (tab_type, stat_month);

ALTER TABLE t_sr_channel_monthly_capacity_ap_special
    ADD COLUMN stat_month_date DATE NULL DEFAULT NULL AFTER small_category;

UPDATE t_sr_channel_monthly_capacity_ap_special
SET stat_month_date = STR_TO_DATE(
    CONCAT(REPLACE(TRIM(stat_month), '-', ''), '01'),
    '%Y%m%d'
);

SELECT COUNT(*) AS unconverted_special_months
FROM t_sr_channel_monthly_capacity_ap_special
WHERE stat_month IS NOT NULL AND stat_month_date IS NULL;

ALTER TABLE t_sr_channel_monthly_capacity_ap_special
    DROP INDEX idx_cmc_ap_tab_month,
    DROP COLUMN stat_month,
    CHANGE COLUMN stat_month_date stat_month DATE NULL DEFAULT NULL COMMENT '账期' AFTER small_category,
    ADD INDEX idx_cmc_ap_tab_month (tab_type, stat_month);
