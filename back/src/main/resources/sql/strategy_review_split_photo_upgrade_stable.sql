-- 升接、稳：从 ST_PHOTO_STRATEGY_EVALUATE_DM 拆分到页面目标表（MySQL 8）
-- 使用前先核对目标库 DDL、数据类型、渠道和地市编码。脚本不删除旧数据；只在空目标范围执行。
-- 附件表结构没有 TAB_TYPE，本脚本按 STRATEGY_TYPE 选升接/稳并写入 active。
-- @snapshot 为所选月的唯一月累计快照：历史月通常用月末，当前月用实际截止日。
-- 日事实取 @day_begin 至 @snapshot，不能把每天的 mon 快照相加。
-- 重要：原 SQL 把业务汇总 NULL 和真实“其他”均转换成“其他”。
-- 因此两张业务产能表暂不导入“其他”，需要从带 GROUPING 标识的上游重算补齐。
-- 源表不含拒绝量/原因、真实原始客群：不造数。收入字段沿用源表命名口径，使用前业务确认。
-- 渠道维度要求一个名称或编码只对应一个启用编码；未匹配或歧义会被排除，先检查下方结果。

SET @snapshot = '2026-10-31';
SET @day_begin = DATE_FORMAT(@snapshot, '%Y-%m-01');
SET @stat_month = DATE_FORMAT(@snapshot, '%Y-%m-01');

DROP TEMPORARY TABLE IF EXISTS tmp_sr_channel_map;
CREATE TEMPORARY TABLE tmp_sr_channel_map AS
SELECT alias_name, MIN(key_code) AS key_code, COUNT(DISTINCT key_code) AS code_count
FROM (
 SELECT key_name AS alias_name, key_code FROM t_sr_dim_channel WHERE status=1 AND is_deleted=0
 UNION ALL
 SELECT key_code, key_code FROM t_sr_dim_channel WHERE status=1 AND is_deleted=0
) m GROUP BY alias_name;

-- 必须检查此查询；只有无缺失、无歧义才能保证拆分完整。
SELECT s.CHANNEL, COALESCE(m.code_count,0) AS matching_codes, COUNT(*) AS rows_affected
FROM ST_PHOTO_STRATEGY_EVALUATE_DM s
LEFT JOIN tmp_sr_channel_map m ON s.CHANNEL=m.alias_name
WHERE s.OP_TIME BETWEEN @day_begin AND @snapshot AND s.STRATEGY_TYPE IN ('升接','稳')
  AND s.CHANNEL <> '全部' AND (m.code_count IS NULL OR m.code_count <> 1)
GROUP BY s.CHANNEL, m.code_count;

DROP TEMPORARY TABLE IF EXISTS tmp_sr_photo;
CREATE TEMPORARY TABLE tmp_sr_photo AS
SELECT s.*, CASE WHEN s.CHANNEL='全部' THEN '全部' ELSE m.key_code END AS mapped_channel
FROM ST_PHOTO_STRATEGY_EVALUATE_DM s
LEFT JOIN tmp_sr_channel_map m ON s.CHANNEL=m.alias_name AND m.code_count=1
WHERE s.STRATEGY_TYPE IN ('升接','稳')
  AND ((s.PERIOD_TYPE='mon' AND s.OP_TIME=@snapshot)
    OR (s.PERIOD_TYPE='day' AND s.OP_TIME BETWEEN @day_begin AND @snapshot))
  AND (s.CHANNEL='全部' OR m.key_code IS NOT NULL);

-- 汇总层级被写为“其他”；真实其他业务也用同一标记。
-- 对策略+渠道+大小类层级，原 GROUPING SETS 没有额外的业务维度，可用此层级。
-- 检查重复：每组应只出现一行；出现重复时不可执行下面写入。
SELECT OP_TIME, PERIOD_TYPE, CITY_ID, COUNTY_ID, UNIT_ID, STRATEGY_TYPE, mapped_channel,
       BIG_CATEGORY, SMALL_CATEGORY, STRATEGY_ID, COUNT(*) AS n
FROM tmp_sr_photo
WHERE STRATEGY_ID <> '999' AND mapped_channel <> '全部'
  AND BIG_CATEGORY <> '全部' AND SMALL_CATEGORY <> '全部' AND BUSI_TYPE_DL='其他'
GROUP BY OP_TIME, PERIOD_TYPE, CITY_ID, COUNTY_ID, UNIT_ID, STRATEGY_TYPE, mapped_channel,
         BIG_CATEGORY, SMALL_CATEGORY, STRATEGY_ID HAVING COUNT(*)>1;

-- 策略主表：同一编码若有多个名称或分类，先人工核对。目标主表已存在者不覆盖。
SELECT STRATEGY_ID, COUNT(DISTINCT STRATEGY_NAME) names, COUNT(DISTINCT STRATEGY_TYPE) classes
FROM tmp_sr_photo WHERE STRATEGY_ID <> '999'
GROUP BY STRATEGY_ID HAVING COUNT(DISTINCT STRATEGY_NAME)>1 OR COUNT(DISTINCT STRATEGY_TYPE)>1;

-- 以下为写入语句：执行前先检查上面结果、目标范围是否已有数据并备份。
-- 此脚本不自动提交。实际环境请在同一会话中检查结果后 COMMIT 或 ROLLBACK。
START TRANSACTION;

INSERT INTO t_sr_strategy (strategy_code,strategy_name,tab_type,strategy_class,create_time,update_time,is_deleted)
SELECT s.STRATEGY_ID, MAX(s.STRATEGY_NAME), 'active', s.STRATEGY_TYPE, NOW(), NOW(), 0
FROM tmp_sr_photo s
WHERE s.STRATEGY_ID <> '999' AND s.STRATEGY_NAME <> '全部'
  AND NOT EXISTS (SELECT 1 FROM t_sr_strategy t WHERE t.strategy_code=s.STRATEGY_ID AND t.tab_type='active' AND t.is_deleted=0)
GROUP BY s.STRATEGY_ID, s.STRATEGY_TYPE
HAVING COUNT(DISTINCT s.STRATEGY_NAME)=1;

INSERT INTO t_sr_strategy_period_summary_ap
(strategy_id,strategy_code,strategy_name,strategy_count,tab_type,strategy_class,channel,big_category,small_category,stat_month,
 original_cust,push_count,usage_count,usage_rate,reach_count,target_conv_num,target_conv_rate,product_conv_num,product_conv_rate,
 expected_income,actual_income,push_count_qoq,usage_count_qoq,usage_rate_qoq,reach_count_qoq,target_conv_num_qoq,
 target_conv_rate_qoq,product_conv_num_qoq,product_conv_rate_qoq,expected_income_qoq,actual_income_qoq,city_id,county_id,create_time,update_time,is_deleted)
SELECT STRATEGY_ID,STRATEGY_ID,STRATEGY_NAME,STRATEGY_CNT,'active',STRATEGY_TYPE,mapped_channel,BIG_CATEGORY,SMALL_CATEGORY,@stat_month,
 NULL,PUSH_CNT,USAGE_CNT,USAGE_RATE*100,REACH_CNT,TARGET_PRODUCT_CONV_CNT,TARGET_PRODUCT_CONV_RATE*100,ALL_PRODUCT_CONV_CNT,ALL_PRODUCT_CONV_RATE*100,
 THEO_INCOME,REAL_INCOME,PUSH_CNT_MOM*100,USAGE_CNT_MOM*100,USAGE_RATE_MOM*100,REACH_CNT_MOM*100,TARGET_PRODUCT_CONV_CNT_MOM*100,
 TARGET_PRODUCT_CONV_RATE_MOM*100,ALL_PRODUCT_CONV_CNT_MOM*100,ALL_PRODUCT_CONV_RATE_MOM*100,THEO_INCOME_MOM*100,REAL_INCOME_MOM*100,CAST(CITY_ID AS CHAR),CAST(COUNTY_ID AS CHAR),NOW(),NOW(),0
FROM tmp_sr_photo WHERE PERIOD_TYPE='mon' AND STRATEGY_ID <> '999' AND mapped_channel <> '全部'
 AND BIG_CATEGORY <> '全部' AND SMALL_CATEGORY <> '全部' AND BUSI_TYPE_DL='其他';

INSERT INTO t_sr_strategy_daily_ap
(strategy_id,strategy_code,strategy_name,tab_type,strategy_class,channel,big_category,small_category,stat_month,
 original_cust,push_count,usage_count,usage_rate,reach_count,target_conv_num,target_conv_rate,product_conv_num,product_conv_rate,
 expected_income,actual_income,reject_count,reject_rate,city_id,county_id,create_time,update_time,is_deleted)
SELECT STRATEGY_ID,STRATEGY_ID,STRATEGY_NAME,'active',STRATEGY_TYPE,mapped_channel,BIG_CATEGORY,SMALL_CATEGORY,OP_TIME,
 NULL,PUSH_CNT,USAGE_CNT,USAGE_RATE*100,REACH_CNT,TARGET_PRODUCT_CONV_CNT,TARGET_PRODUCT_CONV_RATE*100,ALL_PRODUCT_CONV_CNT,ALL_PRODUCT_CONV_RATE*100,
 THEO_INCOME,REAL_INCOME,NULL,NULL,CAST(CITY_ID AS CHAR),CAST(COUNTY_ID AS CHAR),NOW(),NOW(),0
FROM tmp_sr_photo WHERE PERIOD_TYPE='day' AND STRATEGY_ID <> '999' AND mapped_channel <> '全部'
 AND BIG_CATEGORY <> '全部' AND SMALL_CATEGORY <> '全部' AND BUSI_TYPE_DL='其他';

-- 渠道趋势：汇总“其他”可能与真实“其他”业务重名，仅导入该键唯一的行；
-- 重名的范围必须从带 GROUPING 标识的上游补齐。stat_month 格式须核对目标库。
INSERT INTO t_sr_channel_monthly_capacity_ap
(tab_type,strategy_class,channel,big_category,small_category,stat_month,capacity,qoq,yoy,city_id,county_id,create_time,update_time,is_deleted)
SELECT 'active',STRATEGY_TYPE,mapped_channel,BIG_CATEGORY,SMALL_CATEGORY,DATE_FORMAT(@snapshot,'%Y-%m'),
 ALL_PRODUCT_CONV_CNT,ALL_PRODUCT_CONV_CNT_MOM*100,NULL,CAST(CITY_ID AS CHAR),CAST(COUNTY_ID AS CHAR),NOW(),NOW(),0
FROM tmp_sr_photo s WHERE PERIOD_TYPE='mon' AND STRATEGY_ID='999' AND BUSI_TYPE_DL='其他'
 AND 1=(SELECT COUNT(*) FROM tmp_sr_photo x WHERE x.PERIOD_TYPE=s.PERIOD_TYPE AND x.OP_TIME=s.OP_TIME
   AND x.STRATEGY_TYPE=s.STRATEGY_TYPE AND x.CITY_ID=s.CITY_ID AND x.COUNTY_ID=s.COUNTY_ID AND x.UNIT_ID=s.UNIT_ID
   AND x.mapped_channel=s.mapped_channel AND x.BIG_CATEGORY=s.BIG_CATEGORY AND x.SMALL_CATEGORY=s.SMALL_CATEGORY
   AND x.STRATEGY_ID=s.STRATEGY_ID AND x.BUSI_TYPE_DL='其他');

-- 具体业务：排除“不区分”和无法区分的“其他”，不得用这些行推算其他业务。
INSERT INTO t_sr_channel_biz_capacity_ap
(tab_type,strategy_class,channel,big_category,small_category,biz_name,stat_month,capacity,qoq,city_id,county_id,create_time,update_time,is_deleted)
SELECT 'active',STRATEGY_TYPE,mapped_channel,BIG_CATEGORY,SMALL_CATEGORY,BUSI_TYPE_DL,@stat_month,
 ALL_PRODUCT_CONV_CNT,ALL_PRODUCT_CONV_CNT_MOM*100,CAST(CITY_ID AS CHAR),CAST(COUNTY_ID AS CHAR),NOW(),NOW(),0
FROM tmp_sr_photo WHERE PERIOD_TYPE='mon' AND STRATEGY_ID='999' AND mapped_channel<>'全部'
 AND BIG_CATEGORY<>'全部' AND SMALL_CATEGORY<>'全部' AND BUSI_TYPE_DL NOT IN ('其他','不区分','全部');

-- 源表没有业务编码，用名称作为临时编码；超过 64 字符或发生编码冲突必须先建立业务编码映射。
INSERT INTO t_sr_strategy_biz_capacity
(strategy_id,strategy_class,biz_code,biz_name,stat_month,`count`,mom_ratio,yoy_ratio,city_id,county_id,create_time,update_time,is_deleted)
SELECT STRATEGY_ID,STRATEGY_TYPE,BUSI_TYPE_DL,BUSI_TYPE_DL,@stat_month,ALL_PRODUCT_CONV_CNT,ALL_PRODUCT_CONV_CNT_MOM*100,NULL,
 CAST(CITY_ID AS CHAR),CAST(COUNTY_ID AS CHAR),NOW(),NOW(),0
FROM tmp_sr_photo WHERE PERIOD_TYPE='mon' AND STRATEGY_ID<>'999' AND mapped_channel='全部'
 AND BIG_CATEGORY='全部' AND SMALL_CATEGORY='全部' AND BUSI_TYPE_DL NOT IN ('其他','不区分','全部')
 AND CHAR_LENGTH(BUSI_TYPE_DL)<=64;

-- 检查各表新增条数与源层级、地区、渠道及日期对账；确认后手动 COMMIT，否则 ROLLBACK。
