-- Rename the province-level leave strategies imported into the local strategy review database.
-- The strategy name is denormalized into monthly and daily facts, so update all three sources.
START TRANSACTION;

UPDATE t_sr_strategy_special
SET strategy_name = CASE strategy_code
    WHEN 'lw_1001' THEN '全省-离-近两月首次查码50+客户-挽留'
    WHEN 'lw_1002' THEN '全省-离-近两月多次查码50+客户-挽留'
    WHEN 'lw_1003' THEN '全省-离-近两月首次查码200+客户-挽留'
    WHEN 'lw_1004' THEN '全省-离-近两月多次查码200+客户-挽留'
    WHEN 'lw_1005' THEN '全省-离-反向服务一级风险50+客户-挽留'
    WHEN 'lw_1006' THEN '全省-离-反向服务一级风险200+客户-挽留'
    WHEN 'lw_1007' THEN '全省-离-反向服务二级风险50+客户-挽留'
    WHEN 'lw_1008' THEN '全省-离-反向服务二级风险200+客户-挽留'
    WHEN 'lw_1009' THEN '全省-离-反向服务一级风险宽带风险客户-挽留'
    WHEN 'lw_1010' THEN '全省-离-反向服务二级风险宽带风险客户-挽留'
    WHEN 'lw_1011' THEN '全省-离-预停机高风险50+客户-回捞'
    WHEN 'lw_1012' THEN '全省-离-瞬时单停50+剔除频繁停复机-回捞'
    WHEN 'lw_1013' THEN '全省-离-瞬时双停50+剔除频繁停复机-回捞'
    WHEN 'lw_1014' THEN '全省-离-双停5天有宽50+客户-回捞'
    ELSE strategy_name
END
WHERE tab_type = 'active'
  AND strategy_class = '离'
  AND strategy_code IN ('lw_1001','lw_1002','lw_1003','lw_1004','lw_1005','lw_1006','lw_1007','lw_1008','lw_1009','lw_1010','lw_1011','lw_1012','lw_1013','lw_1014');

UPDATE t_sr_strategy_period_summary_ap_special
SET strategy_name = CASE COALESCE(strategy_code, strategy_id)
    WHEN 'lw_1001' THEN '全省-离-近两月首次查码50+客户-挽留'
    WHEN 'lw_1002' THEN '全省-离-近两月多次查码50+客户-挽留'
    WHEN 'lw_1003' THEN '全省-离-近两月首次查码200+客户-挽留'
    WHEN 'lw_1004' THEN '全省-离-近两月多次查码200+客户-挽留'
    WHEN 'lw_1005' THEN '全省-离-反向服务一级风险50+客户-挽留'
    WHEN 'lw_1006' THEN '全省-离-反向服务一级风险200+客户-挽留'
    WHEN 'lw_1007' THEN '全省-离-反向服务二级风险50+客户-挽留'
    WHEN 'lw_1008' THEN '全省-离-反向服务二级风险200+客户-挽留'
    WHEN 'lw_1009' THEN '全省-离-反向服务一级风险宽带风险客户-挽留'
    WHEN 'lw_1010' THEN '全省-离-反向服务二级风险宽带风险客户-挽留'
    WHEN 'lw_1011' THEN '全省-离-预停机高风险50+客户-回捞'
    WHEN 'lw_1012' THEN '全省-离-瞬时单停50+剔除频繁停复机-回捞'
    WHEN 'lw_1013' THEN '全省-离-瞬时双停50+剔除频繁停复机-回捞'
    WHEN 'lw_1014' THEN '全省-离-双停5天有宽50+客户-回捞'
    ELSE strategy_name
END
WHERE tab_type = 'active'
  AND strategy_class = '离'
  AND (strategy_code IN ('lw_1001','lw_1002','lw_1003','lw_1004','lw_1005','lw_1006','lw_1007','lw_1008','lw_1009','lw_1010','lw_1011','lw_1012','lw_1013','lw_1014')
       OR strategy_id IN ('lw_1001','lw_1002','lw_1003','lw_1004','lw_1005','lw_1006','lw_1007','lw_1008','lw_1009','lw_1010','lw_1011','lw_1012','lw_1013','lw_1014'));

UPDATE t_sr_strategy_daily_ap_special
SET strategy_name = CASE COALESCE(strategy_code, strategy_id)
    WHEN 'lw_1001' THEN '全省-离-近两月首次查码50+客户-挽留'
    WHEN 'lw_1002' THEN '全省-离-近两月多次查码50+客户-挽留'
    WHEN 'lw_1003' THEN '全省-离-近两月首次查码200+客户-挽留'
    WHEN 'lw_1004' THEN '全省-离-近两月多次查码200+客户-挽留'
    WHEN 'lw_1005' THEN '全省-离-反向服务一级风险50+客户-挽留'
    WHEN 'lw_1006' THEN '全省-离-反向服务一级风险200+客户-挽留'
    WHEN 'lw_1007' THEN '全省-离-反向服务二级风险50+客户-挽留'
    WHEN 'lw_1008' THEN '全省-离-反向服务二级风险200+客户-挽留'
    WHEN 'lw_1009' THEN '全省-离-反向服务一级风险宽带风险客户-挽留'
    WHEN 'lw_1010' THEN '全省-离-反向服务二级风险宽带风险客户-挽留'
    WHEN 'lw_1011' THEN '全省-离-预停机高风险50+客户-回捞'
    WHEN 'lw_1012' THEN '全省-离-瞬时单停50+剔除频繁停复机-回捞'
    WHEN 'lw_1013' THEN '全省-离-瞬时双停50+剔除频繁停复机-回捞'
    WHEN 'lw_1014' THEN '全省-离-双停5天有宽50+客户-回捞'
    ELSE strategy_name
END
WHERE tab_type = 'active'
  AND strategy_class = '离'
  AND (strategy_code IN ('lw_1001','lw_1002','lw_1003','lw_1004','lw_1005','lw_1006','lw_1007','lw_1008','lw_1009','lw_1010','lw_1011','lw_1012','lw_1013','lw_1014')
       OR strategy_id IN ('lw_1001','lw_1002','lw_1003','lw_1004','lw_1005','lw_1006','lw_1007','lw_1008','lw_1009','lw_1010','lw_1011','lw_1012','lw_1013','lw_1014'));

COMMIT;
