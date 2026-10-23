-- =====================================================================
-- strategy_review 测试数据脚本
-- 覆盖：策略整体情况 / 触点执行 / 执行明细 / 预警规则 / 收藏
-- 注意：本文件为基础量级种子数据。2026-10-08 已在数据库中按
--       「渠道系数 {01:12,02:9,03:6,05:4,06:7} × 月份系数 {07:1,08:1.6,09:6}」
--       放大为百万级大数字测试数据（含 +475%/+168.5% 极端环比），
--       用于千分位展示测试；同日将库内 9 月数据整体平移至 10 月
--       （stat_month/stat_date +1 MONTH），重新导入本文件将回到基础量级+9月口径。
-- 2026-10-10：signToken 单点登录联调，全库事实表 city_id 回填 '999'
--       （见文件末尾 UPDATE 段）。
-- =====================================================================

USE strategy_review;

-- ---------------------------------------------------------------------
-- 1. 触点渠道维度
-- ---------------------------------------------------------------------
INSERT INTO t_sr_dim_channel (key_code, key_name, tab_type, status, sort_no, is_deleted) VALUES
('01', '短信', 'active,passive,control', 1, 1, 0),
('02', '中国移动APP', 'active,passive,control', 1, 2, 0),
('03', '视频彩铃', 'active,passive,control', 1, 3, 0),
('04', '权益小站', 'active,passive,control', 1, 4, 0),
('05', '企业微信', 'active,passive,control', 1, 5, 0),
('06', '客户经理', 'active,passive,control', 1, 6, 0);

-- ---------------------------------------------------------------------
-- 2. 预警指标维度
-- ---------------------------------------------------------------------
INSERT INTO t_sr_dim_metric (metric_code, metric_name, tab_type, status, sort_no, is_deleted) VALUES
('strategy_count', '策略数', 'active,passive', 1, 1, 0),
('push_count', '推送量', 'active,passive', 1, 2, 0),
('usage_count', '使用量', 'active,passive', 1, 3, 0),
('reach_count', '触达量', 'active,passive', 1, 4, 0),
('product_conv_num', '转化量', 'active,passive', 1, 5, 0),
('product_conv_rate', '转化率', 'active,passive', 1, 6, 0),
('actual_income', '转收', 'active,passive', 1, 7, 0),
('consult_count', '咨询量', 'control', 1, 1, 0),
('retain_count', '挽留量', 'control', 1, 2, 0),
('retain_rate', '挽留率', 'control', 1, 3, 0),
('dispatch_count', '派单量', 'control', 1, 4, 0),
('success_count', '成功量', 'control', 1, 5, 0),
('success_rate', '成功率', 'control', 1, 6, 0),
('income', '收入', 'control', 1, 7, 0);

-- ---------------------------------------------------------------------
-- 3. 策略主表（strategy_code 与 id 一致，供执行明细按 strategy_code 命中）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy
(strategy_code, strategy_name, tab_type, channel, strategy_level, caliber, iteration, owner, status, start_date, end_date, create_time, is_deleted) VALUES
('STR001', '5G套餐升档提醒', 'active', '01', '一级', '近3月流量超套且未升档目标用户', 3, '张伟', '生效中', '2026-01-01', '2026-12-31', '2026-01-05 10:00:00', 0),
('STR002', '流量权益推荐', 'active', '02', '二级', '月均流量使用占比超70%用户', 2, '李娜', '生效中', '2026-01-01', '2026-12-31', '2026-01-06 10:00:00', 0),
('STR003', '视频彩铃体验', 'active', '03', '三级', '未开通视频彩铃的高活跃用户', 1, '王强', '生效中', '2026-02-01', '2026-12-31', '2026-02-01 09:30:00', 0),
('STR004', '客户咨询挽留', 'passive', '06', '一级', '近7天咨询后未转化用户', 2, '赵敏', '生效中', '2026-01-01', '2026-12-31', '2026-01-10 11:00:00', 0),
('STR005', '宽带续约关怀', 'passive', '01', '二级', '宽带到期前60天用户', 3, '孙磊', '生效中', '2026-01-01', '2026-12-31', '2026-01-12 14:00:00', 0),
('STR006', '资费答疑引导', 'passive', '02', '三级', '资费类咨询高频用户', 1, '周芳', '生效中', '2026-03-01', '2026-12-31', '2026-03-01 10:00:00', 0),
('STR007', '高价值用户挽留', 'control', '06', '一级', '近3月流失风险高价值用户', 3, '吴刚', '生效中', '2026-01-01', '2026-12-31', '2026-01-08 15:00:00', 0),
('STR008', '欠费停机挽留', 'control', '01', '二级', '已停机未缴费用户', 2, '郑洁', '生效中', '2026-01-01', '2026-12-31', '2026-01-10 09:00:00', 0),
('STR009', '宽带拆机挽留', 'control', '05', '三级', '提交拆机申请用户', 1, '刘洋', '生效中', '2026-02-01', '2026-12-31', '2026-02-02 10:00:00', 0);

-- ---------------------------------------------------------------------
-- 4. KPI 汇总长表（6个月：2026-04 ~ 2026-09）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_kpi_summary
(tab_type, metric_code, metric_name, value, unit, qoq, yoy, icon, sort_no, stat_month, city_id, county_id, is_deleted) VALUES
-- active
('active','strategy_count','策略数',90,'个',6.7,15.3,'grid',1,'2026-04',NULL,NULL,0),
('active','strategy_count','策略数',92,'个',6.7,15.3,'grid',1,'2026-05',NULL,NULL,0),
('active','strategy_count','策略数',94,'个',6.7,15.3,'grid',1,'2026-06',NULL,NULL,0),
('active','strategy_count','策略数',96,'个',6.7,15.3,'grid',1,'2026-07',NULL,NULL,0),
('active','strategy_count','策略数',98,'个',6.7,15.3,'grid',1,'2026-08',NULL,NULL,0),
('active','strategy_count','策略数',102,'个',6.7,15.3,'grid',1,'2026-09',NULL,NULL,0),
('active','push_count','推送量',298,'万',12.5,26.8,'send',2,'2026-04',NULL,NULL,0),
('active','push_count','推送量',303,'万',12.5,26.8,'send',2,'2026-05',NULL,NULL,0),
('active','push_count','推送量',309,'万',12.5,26.8,'send',2,'2026-06',NULL,NULL,0),
('active','push_count','推送量',314,'万',12.5,26.8,'send',2,'2026-07',NULL,NULL,0),
('active','push_count','推送量',320,'万',12.5,26.8,'send',2,'2026-08',NULL,NULL,0),
('active','push_count','推送量',326,'万',12.5,26.8,'send',2,'2026-09',NULL,NULL,0),
('active','usage_count','使用量',281,'万',11.8,27.2,'user-check',3,'2026-04',NULL,NULL,0),
('active','usage_count','使用量',287,'万',11.8,27.2,'user-check',3,'2026-05',NULL,NULL,0),
('active','usage_count','使用量',293,'万',11.8,27.2,'user-check',3,'2026-06',NULL,NULL,0),
('active','usage_count','使用量',299,'万',11.8,27.2,'user-check',3,'2026-07',NULL,NULL,0),
('active','usage_count','使用量',306,'万',11.8,27.2,'user-check',3,'2026-08',NULL,NULL,0),
('active','usage_count','使用量',312,'万',11.8,27.2,'user-check',3,'2026-09',NULL,NULL,0),
('active','reach_count','触达量',78,'万',-7.2,19.4,'eye',4,'2026-04',NULL,NULL,0),
('active','reach_count','触达量',80,'万',-7.2,19.4,'eye',4,'2026-05',NULL,NULL,0),
('active','reach_count','触达量',82,'万',-7.2,19.4,'eye',4,'2026-06',NULL,NULL,0),
('active','reach_count','触达量',84,'万',-7.2,19.4,'eye',4,'2026-07',NULL,NULL,0),
('active','reach_count','触达量',87,'万',-7.2,19.4,'eye',4,'2026-08',NULL,NULL,0),
('active','reach_count','触达量',90,'万',-7.2,19.4,'eye',4,'2026-09',NULL,NULL,0),
('active','product_conv_num','转化量',30.2,'万',15.3,32.8,'trending',5,'2026-04',NULL,NULL,0),
('active','product_conv_num','转化量',30.8,'万',15.3,32.8,'trending',5,'2026-05',NULL,NULL,0),
('active','product_conv_num','转化量',31.5,'万',15.3,32.8,'trending',5,'2026-06',NULL,NULL,0),
('active','product_conv_num','转化量',32.1,'万',15.3,32.8,'trending',5,'2026-07',NULL,NULL,0),
('active','product_conv_num','转化量',32.8,'万',15.3,32.8,'trending',5,'2026-08',NULL,NULL,0),
('active','product_conv_num','转化量',33.6,'万',15.3,32.8,'trending',5,'2026-09',NULL,NULL,0),
('active','product_conv_rate','转化率',3.72,'%',0.39,1.2,'percent',6,'2026-04',NULL,NULL,0),
('active','product_conv_rate','转化率',3.75,'%',0.39,1.2,'percent',6,'2026-05',NULL,NULL,0),
('active','product_conv_rate','转化率',3.79,'%',0.39,1.2,'percent',6,'2026-06',NULL,NULL,0),
('active','product_conv_rate','转化率',3.82,'%',0.39,1.2,'percent',6,'2026-07',NULL,NULL,0),
('active','product_conv_rate','转化率',3.86,'%',0.39,1.2,'percent',6,'2026-08',NULL,NULL,0),
('active','product_conv_rate','转化率',3.90,'%',0.39,1.2,'percent',6,'2026-09',NULL,NULL,0),
('active','actual_income','转收',78.5,'万元',18.5,42.3,'dollar',7,'2026-04',NULL,NULL,0),
('active','actual_income','转收',80.2,'万元',18.5,42.3,'dollar',7,'2026-05',NULL,NULL,0),
('active','actual_income','转收',82.4,'万元',18.5,42.3,'dollar',7,'2026-06',NULL,NULL,0),
('active','actual_income','转收',84.1,'万元',18.5,42.3,'dollar',7,'2026-07',NULL,NULL,0),
('active','actual_income','转收',86.3,'万元',18.5,42.3,'dollar',7,'2026-08',NULL,NULL,0),
('active','actual_income','转收',88.9,'万元',18.5,42.3,'dollar',7,'2026-09',NULL,NULL,0),
-- passive
('passive','strategy_count','策略数',70,'个',4.2,10.1,'grid',1,'2026-04',NULL,NULL,0),
('passive','strategy_count','策略数',71,'个',4.2,10.1,'grid',1,'2026-05',NULL,NULL,0),
('passive','strategy_count','策略数',73,'个',4.2,10.1,'grid',1,'2026-06',NULL,NULL,0),
('passive','strategy_count','策略数',74,'个',4.2,10.1,'grid',1,'2026-07',NULL,NULL,0),
('passive','strategy_count','策略数',76,'个',4.2,10.1,'grid',1,'2026-08',NULL,NULL,0),
('passive','strategy_count','策略数',78,'个',4.2,10.1,'grid',1,'2026-09',NULL,NULL,0),
('passive','push_count','推送量',246,'万',-1.5,6.3,'send',2,'2026-04',NULL,NULL,0),
('passive','push_count','推送量',249,'万',-1.5,6.3,'send',2,'2026-05',NULL,NULL,0),
('passive','push_count','推送量',253,'万',-1.5,6.3,'send',2,'2026-06',NULL,NULL,0),
('passive','push_count','推送量',257,'万',-1.5,6.3,'send',2,'2026-07',NULL,NULL,0),
('passive','push_count','推送量',261,'万',-1.5,6.3,'send',2,'2026-08',NULL,NULL,0),
('passive','push_count','推送量',266,'万',-1.5,6.3,'send',2,'2026-09',NULL,NULL,0),
('passive','usage_count','使用量',224,'万',4.2,8.7,'user-check',3,'2026-04',NULL,NULL,0),
('passive','usage_count','使用量',228,'万',4.2,8.7,'user-check',3,'2026-05',NULL,NULL,0),
('passive','usage_count','使用量',232,'万',4.2,8.7,'user-check',3,'2026-06',NULL,NULL,0),
('passive','usage_count','使用量',236,'万',4.2,8.7,'user-check',3,'2026-07',NULL,NULL,0),
('passive','usage_count','使用量',241,'万',4.2,8.7,'user-check',3,'2026-08',NULL,NULL,0),
('passive','usage_count','使用量',245,'万',4.2,8.7,'user-check',3,'2026-09',NULL,NULL,0),
('passive','reach_count','触达量',64,'万',3.6,7.4,'eye',4,'2026-04',NULL,NULL,0),
('passive','reach_count','触达量',65,'万',3.6,7.4,'eye',4,'2026-05',NULL,NULL,0),
('passive','reach_count','触达量',67,'万',3.6,7.4,'eye',4,'2026-06',NULL,NULL,0),
('passive','reach_count','触达量',68,'万',3.6,7.4,'eye',4,'2026-07',NULL,NULL,0),
('passive','reach_count','触达量',70,'万',3.6,7.4,'eye',4,'2026-08',NULL,NULL,0),
('passive','reach_count','触达量',72,'万',3.6,7.4,'eye',4,'2026-09',NULL,NULL,0),
('passive','product_conv_num','转化量',24.6,'万',8.7,15.6,'trending',5,'2026-04',NULL,NULL,0),
('passive','product_conv_num','转化量',25.0,'万',8.7,15.6,'trending',5,'2026-05',NULL,NULL,0),
('passive','product_conv_num','转化量',25.4,'万',8.7,15.6,'trending',5,'2026-06',NULL,NULL,0),
('passive','product_conv_num','转化量',25.8,'万',8.7,15.6,'trending',5,'2026-07',NULL,NULL,0),
('passive','product_conv_num','转化量',26.3,'万',8.7,15.6,'trending',5,'2026-08',NULL,NULL,0),
('passive','product_conv_num','转化量',26.8,'万',8.7,15.6,'trending',5,'2026-09',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.61,'%',0.5,1.1,'percent',6,'2026-04',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.64,'%',0.5,1.1,'percent',6,'2026-05',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.67,'%',0.5,1.1,'percent',6,'2026-06',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.71,'%',0.5,1.1,'percent',6,'2026-07',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.74,'%',0.5,1.1,'percent',6,'2026-08',NULL,NULL,0),
('passive','product_conv_rate','转化率',3.78,'%',0.5,1.1,'percent',6,'2026-09',NULL,NULL,0),
('passive','actual_income','转收',58.2,'万元',12.3,25.8,'dollar',7,'2026-04',NULL,NULL,0),
('passive','actual_income','转收',59.5,'万元',12.3,25.8,'dollar',7,'2026-05',NULL,NULL,0),
('passive','actual_income','转收',60.8,'万元',12.3,25.8,'dollar',7,'2026-06',NULL,NULL,0),
('passive','actual_income','转收',62.0,'万元',12.3,25.8,'dollar',7,'2026-07',NULL,NULL,0),
('passive','actual_income','转收',63.5,'万元',12.3,25.8,'dollar',7,'2026-08',NULL,NULL,0),
('passive','actual_income','转收',65.1,'万元',12.3,25.8,'dollar',7,'2026-09',NULL,NULL,0),
-- control
('control','consult_count','咨询量',42000,'次',10.2,15.3,'eye',1,'2026-04',NULL,NULL,0),
('control','consult_count','咨询量',42500,'次',10.2,15.3,'eye',1,'2026-05',NULL,NULL,0),
('control','consult_count','咨询量',43200,'次',10.2,15.3,'eye',1,'2026-06',NULL,NULL,0),
('control','consult_count','咨询量',43800,'次',10.2,15.3,'eye',1,'2026-07',NULL,NULL,0),
('control','consult_count','咨询量',44500,'次',10.2,15.3,'eye',1,'2026-08',NULL,NULL,0),
('control','consult_count','咨询量',45200,'次',10.2,15.3,'eye',1,'2026-09',NULL,NULL,0),
('control','retain_count','挽留量',26400,'个',8.7,12.6,'user-check',2,'2026-04',NULL,NULL,0),
('control','retain_count','挽留量',26800,'个',8.7,12.6,'user-check',2,'2026-05',NULL,NULL,0),
('control','retain_count','挽留量',27200,'个',8.7,12.6,'user-check',2,'2026-06',NULL,NULL,0),
('control','retain_count','挽留量',27600,'个',8.7,12.6,'user-check',2,'2026-07',NULL,NULL,0),
('control','retain_count','挽留量',28100,'个',8.7,12.6,'user-check',2,'2026-08',NULL,NULL,0),
('control','retain_count','挽留量',28600,'个',8.7,12.6,'user-check',2,'2026-09',NULL,NULL,0),
('control','retain_rate','挽留率',61.2,'%',2.1,3.8,'percent',3,'2026-04',NULL,NULL,0),
('control','retain_rate','挽留率',61.6,'%',2.1,3.8,'percent',3,'2026-05',NULL,NULL,0),
('control','retain_rate','挽留率',62.0,'%',2.1,3.8,'percent',3,'2026-06',NULL,NULL,0),
('control','retain_rate','挽留率',62.4,'%',2.1,3.8,'percent',3,'2026-07',NULL,NULL,0),
('control','retain_rate','挽留率',62.9,'%',2.1,3.8,'percent',3,'2026-08',NULL,NULL,0),
('control','retain_rate','挽留率',63.4,'%',2.1,3.8,'percent',3,'2026-09',NULL,NULL,0),
('control','dispatch_count','派单量',11200,'单',15.3,22.1,'send',4,'2026-04',NULL,NULL,0),
('control','dispatch_count','派单量',11400,'单',15.3,22.1,'send',4,'2026-05',NULL,NULL,0),
('control','dispatch_count','派单量',11600,'单',15.3,22.1,'send',4,'2026-06',NULL,NULL,0),
('control','dispatch_count','派单量',11800,'单',15.3,22.1,'send',4,'2026-07',NULL,NULL,0),
('control','dispatch_count','派单量',12050,'单',15.3,22.1,'send',4,'2026-08',NULL,NULL,0),
('control','dispatch_count','派单量',12300,'单',15.3,22.1,'send',4,'2026-09',NULL,NULL,0),
('control','success_count','成功量',7900,'个',18.6,26.4,'trending',5,'2026-04',NULL,NULL,0),
('control','success_count','成功量',8050,'个',18.6,26.4,'trending',5,'2026-05',NULL,NULL,0),
('control','success_count','成功量',8200,'个',18.6,26.4,'trending',5,'2026-06',NULL,NULL,0),
('control','success_count','成功量',8350,'个',18.6,26.4,'trending',5,'2026-07',NULL,NULL,0),
('control','success_count','成功量',8520,'个',18.6,26.4,'trending',5,'2026-08',NULL,NULL,0),
('control','success_count','成功量',8700,'个',18.6,26.4,'trending',5,'2026-09',NULL,NULL,0),
('control','success_rate','成功率',70.5,'%',3.2,5.1,'percent',6,'2026-04',NULL,NULL,0),
('control','success_rate','成功率',70.8,'%',3.2,5.1,'percent',6,'2026-05',NULL,NULL,0),
('control','success_rate','成功率',71.2,'%',3.2,5.1,'percent',6,'2026-06',NULL,NULL,0),
('control','success_rate','成功率',71.6,'%',3.2,5.1,'percent',6,'2026-07',NULL,NULL,0),
('control','success_rate','成功率',72.0,'%',3.2,5.1,'percent',6,'2026-08',NULL,NULL,0),
('control','success_rate','成功率',72.4,'%',3.2,5.1,'percent',6,'2026-09',NULL,NULL,0),
('control','income','收入',396000,'元',22.1,32.8,'dollar',7,'2026-04',NULL,NULL,0),
('control','income','收入',402000,'元',22.1,32.8,'dollar',7,'2026-05',NULL,NULL,0),
('control','income','收入',408000,'元',22.1,32.8,'dollar',7,'2026-06',NULL,NULL,0),
('control','income','收入',415000,'元',22.1,32.8,'dollar',7,'2026-07',NULL,NULL,0),
('control','income','收入',422000,'元',22.1,32.8,'dollar',7,'2026-08',NULL,NULL,0),
('control','income','收入',430000,'元',22.1,32.8,'dollar',7,'2026-09',NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 5. 渠道执行汇总（近3个月，各渠道 + 1条“全部”合计行）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_channel_summary_ctrl
(stat_month, channel, strategy_count, strategy_count_qoq, consult_count, consult_count_qoq, retain_count, retain_count_qoq, retain_rate, retain_rate_qoq, dispatch_count, dispatch_count_qoq, success_count, success_count_qoq, success_rate, success_rate_qoq, income, income_qoq, city_id, county_id, is_deleted) VALUES
('2026-07-01','全部',9,5.0,43800,10.2,27600,8.7,63.0,2.1,11800,15.3,8350,18.6,70.8,3.2,415000,22.1,NULL,NULL,0),
('2026-07-01','01',3,4.0,14200,9.8,9100,8.2,64.1,2.0,3900,14.8,2760,17.9,70.8,3.0,138000,21.5,NULL,NULL,0),
('2026-07-01','02',2,5.5,10100,10.5,6400,9.1,63.4,2.3,2700,15.9,1950,19.2,72.2,3.4,97000,22.8,NULL,NULL,0),
('2026-07-01','05',2,6.0,9800,10.7,6100,8.9,62.2,2.0,2600,15.1,1850,18.7,71.2,3.1,93000,22.2,NULL,NULL,0),
('2026-07-01','06',2,4.5,9700,10.0,6000,8.5,61.9,2.1,2600,15.0,1790,18.4,68.8,3.0,87000,21.9,NULL,NULL,0),
('2026-08-01','全部',9,5.2,44500,10.4,28100,8.9,63.2,2.2,12050,15.5,8520,18.8,70.7,3.3,422000,22.3,NULL,NULL,0),
('2026-08-01','01',3,4.2,14400,9.9,9250,8.4,64.2,2.1,3980,15.0,2820,18.1,70.9,3.1,141000,21.7,NULL,NULL,0),
('2026-08-01','02',2,5.7,10250,10.7,6520,9.3,63.6,2.4,2760,16.1,1990,19.5,72.1,3.5,99000,23.0,NULL,NULL,0),
('2026-08-01','05',2,6.2,9950,10.9,6220,9.1,62.5,2.1,2650,15.3,1890,19.0,71.3,3.2,95000,22.4,NULL,NULL,0),
('2026-08-01','06',2,4.7,9900,10.2,6110,8.7,61.7,2.2,2660,15.2,1830,18.6,68.8,3.1,89000,22.1,NULL,NULL,0),
('2026-09-01','全部',9,5.4,45200,10.6,28600,9.1,63.3,2.4,12300,15.7,8700,19.0,70.7,3.4,430000,22.5,NULL,NULL,0),
('2026-09-01','01',3,4.4,14700,10.1,9400,8.6,64.0,2.3,4050,15.2,2880,18.3,71.1,3.2,144000,21.9,NULL,NULL,0),
('2026-09-01','02',2,5.9,10450,10.9,6650,9.5,63.6,2.5,2820,16.3,2030,19.7,72.0,3.6,101000,23.2,NULL,NULL,0),
('2026-09-01','05',2,6.4,10100,11.1,6340,9.3,62.8,2.2,2700,15.5,1930,19.2,71.5,3.3,97000,22.6,NULL,NULL,0),
('2026-09-01','06',2,4.9,9950,10.4,6210,8.9,62.4,2.3,2730,15.4,1860,18.8,68.1,3.2,90000,22.3,NULL,NULL,0);

INSERT INTO t_sr_channel_summary_ap
(tab_type, stat_month, channel, strategy_count, strategy_count_qoq, original_cust, original_cust_qoq, push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq, actual_income, actual_income_qoq, city_id, county_id, is_deleted) VALUES
('active','2026-07-01','全部',3,4.0,246000,8.5,176000,11.5,166000,11.0,94.3,1.2,52000,5.5,18000,13.2,6.5,0.4,15800,14.8,3.8,0.3,760000,16.5,512000,18.2,NULL,NULL,0),
('active','2026-07-01','01',1,3.2,82000,8.0,59000,11.0,56000,10.5,94.9,1.1,17500,5.2,6100,12.9,6.4,0.4,5400,14.2,3.7,0.3,255000,16.0,172000,17.8,NULL,NULL,0),
('active','2026-07-01','02',1,4.1,86000,8.7,61000,11.8,58000,11.3,95.1,1.2,18100,5.7,6300,13.4,6.6,0.4,5500,15.0,3.9,0.3,262000,16.8,176000,18.4,NULL,NULL,0),
('active','2026-07-01','03',1,3.9,78000,8.2,56000,11.2,52000,10.8,92.9,1.0,16400,5.0,5600,12.8,6.3,0.3,4900,14.0,3.6,0.3,243000,15.8,164000,17.6,NULL,NULL,0),
('active','2026-08-01','全部',3,4.2,250000,8.7,180000,11.7,169000,11.2,93.9,1.3,53000,5.6,18300,13.4,6.4,0.4,16100,15.0,3.8,0.3,774000,16.7,522000,18.4,NULL,NULL,0),
('active','2026-08-01','01',1,3.4,83500,8.2,60500,11.2,57000,10.7,94.2,1.2,17850,5.3,6250,13.1,6.5,0.4,5520,14.4,3.7,0.3,260000,16.2,176000,18.0,NULL,NULL,0),
('active','2026-08-01','02',1,4.3,87500,8.9,62500,12.0,59000,11.5,94.4,1.3,18450,5.8,6450,13.6,6.7,0.4,5620,15.2,3.9,0.3,268000,17.0,180000,18.6,NULL,NULL,0),
('active','2026-08-01','03',1,4.1,79000,8.4,57000,11.4,53000,11.0,93.0,1.1,16700,5.1,5750,13.0,6.4,0.3,5000,14.2,3.6,0.3,246000,16.0,166000,17.8,NULL,NULL,0),
('active','2026-09-01','全部',3,4.4,255000,8.9,184000,11.9,173000,11.4,94.0,1.4,54000,5.8,18700,13.6,6.3,0.4,16500,15.2,3.8,0.3,790000,16.9,533000,18.6,NULL,NULL,0),
('active','2026-09-01','01',1,3.6,85200,8.4,61800,11.4,58200,10.9,94.2,1.3,18200,5.4,6400,13.3,6.6,0.4,5650,14.6,3.7,0.3,266000,16.4,180000,18.2,NULL,NULL,0),
('active','2026-09-01','02',1,4.5,89300,9.1,63800,12.2,60400,11.7,94.6,1.4,18850,6.0,6600,13.8,6.8,0.4,5750,15.4,3.9,0.3,274000,17.2,184000,18.8,NULL,NULL,0),
('active','2026-09-01','03',1,4.3,80500,8.6,58400,11.6,54300,11.2,93.3,1.2,17050,5.3,5900,13.2,6.5,0.4,5120,14.4,3.6,0.3,250000,16.2,169000,18.0,NULL,NULL,0);

INSERT INTO t_sr_channel_summary_ap
(tab_type, stat_month, channel, strategy_count, strategy_count_qoq, original_cust, original_cust_qoq, push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq, actual_income, actual_income_qoq, city_id, county_id, is_deleted) VALUES
('passive','2026-07-01','全部',3,3.5,188000,6.5,132000,9.5,125000,9.0,94.7,1.0,39000,4.5,13200,11.2,6.2,0.3,11800,12.8,3.6,0.3,540000,14.5,362000,16.2,NULL,NULL,0),
('passive','2026-07-01','02',1,3.8,70000,6.8,49000,9.8,46500,9.3,94.9,1.1,14500,4.7,4900,11.5,6.3,0.3,4400,13.1,3.7,0.3,200000,14.8,135000,16.5,NULL,NULL,0),
('passive','2026-07-01','06',1,3.2,62000,6.2,44000,9.2,42000,8.7,95.5,0.9,13000,4.3,4400,10.9,6.1,0.3,3950,12.5,3.5,0.3,183000,14.2,122000,15.9,NULL,NULL,0),
('passive','2026-08-01','全部',3,3.7,191000,6.7,135000,9.7,128000,9.2,94.8,1.1,39800,4.6,13500,11.4,6.1,0.3,12000,13.0,3.6,0.3,552000,14.7,370000,16.4,NULL,NULL,0),
('passive','2026-08-01','02',1,4.0,71300,7.0,50200,10.0,47600,9.5,94.8,1.2,14800,4.8,5050,11.7,6.4,0.3,4510,13.3,3.7,0.3,205000,15.0,138000,16.7,NULL,NULL,0),
('passive','2026-08-01','06',1,3.4,63000,6.4,45000,9.4,43000,8.9,95.6,1.0,13300,4.4,4500,11.1,6.2,0.3,4050,12.7,3.5,0.3,187000,14.4,125000,16.1,NULL,NULL,0),
('passive','2026-09-01','全部',3,3.9,195000,6.9,138000,9.9,131000,9.4,94.9,1.2,40600,4.8,13800,11.6,6.0,0.3,12300,13.2,3.6,0.3,565000,14.9,379000,16.6,NULL,NULL,0),
('passive','2026-09-01','02',1,4.2,72800,7.2,51400,10.2,48700,9.7,94.8,1.3,15100,5.0,5180,11.9,6.5,0.3,4620,13.5,3.7,0.3,210000,15.2,141000,16.9,NULL,NULL,0),
('passive','2026-09-01','06',1,3.6,64200,6.6,46000,9.6,44000,9.1,95.7,1.1,13600,4.6,4620,11.3,6.3,0.3,4150,12.9,3.5,0.3,191000,14.6,128000,16.3,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 6. 策略周期汇总（近3个月）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month, strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq, actual_income, actual_income_qoq, reject_rate, reject_rate_qoq, reject_count, city_id, county_id, is_deleted) VALUES
('active','STR001','5G套餐升档提醒','01','流量经营','套餐升档','2026-07-01',1,82000,8.0,59000,11.0,56000,10.5,94.9,1.1,17500,5.2,6100,12.9,6.4,0.4,5400,14.2,3.7,0.3,255000,16.0,172000,17.8,6.8,0.5,367,NULL,NULL,0),
('active','STR001','5G套餐升档提醒','01','流量经营','套餐升档','2026-08-01',1,83500,8.2,60500,11.2,57000,10.7,94.2,1.2,17850,5.3,6250,13.1,6.5,0.4,5520,14.4,3.7,0.3,260000,16.2,176000,18.0,6.5,0.4,359,NULL,NULL,0),
('active','STR001','5G套餐升档提醒','01','流量经营','套餐升档','2026-09-01',1,85200,8.4,61800,11.4,58200,10.9,94.2,1.3,18200,5.4,6400,13.3,6.6,0.4,5650,14.6,3.7,0.3,266000,16.4,180000,18.2,6.3,0.4,356,NULL,NULL,0),
('active','STR002','流量权益推荐','02','权益运营','权益领取','2026-07-01',1,86000,8.7,61000,11.8,58000,11.3,95.1,1.2,18100,5.7,6300,13.4,6.6,0.4,5500,15.0,3.9,0.3,262000,16.8,176000,18.4,5.2,0.3,286,NULL,NULL,0),
('active','STR002','流量权益推荐','02','权益运营','权益领取','2026-08-01',1,87500,8.9,62500,12.0,59000,11.5,94.4,1.3,18450,5.8,6450,13.6,6.7,0.4,5620,15.2,3.9,0.3,268000,17.0,180000,18.6,5.0,0.3,281,NULL,NULL,0),
('active','STR002','流量权益推荐','02','权益运营','权益领取','2026-09-01',1,89300,9.1,63800,12.2,60400,11.7,94.6,1.4,18850,6.0,6600,13.8,6.8,0.4,5750,15.4,3.9,0.3,274000,17.2,184000,18.8,4.8,0.3,276,NULL,NULL,0),
('active','STR003','视频彩铃体验','03','增值业务','彩铃','2026-07-01',1,78000,8.2,56000,11.2,52000,10.8,92.9,1.0,16400,5.0,5600,12.8,6.3,0.3,4900,14.0,3.6,0.3,243000,15.8,164000,17.6,7.4,0.6,363,NULL,NULL,0),
('active','STR003','视频彩铃体验','03','增值业务','彩铃','2026-08-01',1,79000,8.4,57000,11.4,53000,11.0,93.0,1.1,16700,5.1,5750,13.0,6.4,0.3,5000,14.2,3.6,0.3,246000,16.0,166000,17.8,7.1,0.5,355,NULL,NULL,0),
('active','STR003','视频彩铃体验','03','增值业务','彩铃','2026-09-01',1,80500,8.6,58400,11.6,54300,11.2,93.3,1.2,17050,5.3,5900,13.2,6.5,0.4,5120,14.4,3.6,0.3,250000,16.2,169000,18.0,6.9,0.5,353,NULL,NULL,0);

INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month, strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq, actual_income, actual_income_qoq, reject_rate, reject_rate_qoq, reject_count, city_id, county_id, is_deleted) VALUES
('passive','STR004','客户咨询挽留','06','存量经营','咨询挽留','2026-07-01',1,62000,6.2,44000,9.2,42000,8.7,95.5,0.9,13000,4.3,4400,10.9,6.1,0.3,3950,12.5,3.5,0.3,183000,14.2,122000,15.9,5.6,0.4,221,NULL,NULL,0),
('passive','STR004','客户咨询挽留','06','存量经营','咨询挽留','2026-08-01',1,63000,6.4,45000,9.4,43000,8.9,95.6,1.0,13300,4.4,4500,11.1,6.2,0.3,4050,12.7,3.5,0.3,187000,14.4,125000,16.1,5.4,0.4,219,NULL,NULL,0),
('passive','STR004','客户咨询挽留','06','存量经营','咨询挽留','2026-09-01',1,64200,6.6,46000,9.6,44000,9.1,95.7,1.1,13600,4.6,4620,11.3,6.3,0.3,4150,12.9,3.5,0.3,191000,14.6,128000,16.3,5.2,0.4,216,NULL,NULL,0),
('passive','STR005','宽带续约关怀','01','家庭业务','宽带续约','2026-07-01',1,58000,5.8,41000,9.0,39000,8.5,95.1,0.8,12000,4.0,4000,10.5,5.9,0.3,3600,12.0,3.4,0.3,168000,13.8,112000,15.5,4.9,0.3,176,NULL,NULL,0),
('passive','STR005','宽带续约关怀','01','家庭业务','宽带续约','2026-08-01',1,59000,6.0,42000,9.2,40000,8.7,95.2,0.9,12300,4.1,4100,10.7,6.0,0.3,3680,12.2,3.4,0.3,172000,14.0,115000,15.7,4.7,0.3,173,NULL,NULL,0),
('passive','STR005','宽带续约关怀','01','家庭业务','宽带续约','2026-09-01',1,60200,6.2,43000,9.4,41000,8.9,95.4,1.0,12600,4.3,4200,10.9,6.1,0.3,3760,12.4,3.4,0.3,176000,14.2,118000,15.9,4.5,0.3,169,NULL,NULL,0),
('passive','STR006','资费答疑引导','02','存量经营','资费答疑','2026-07-01',1,48000,5.2,34000,8.6,32000,8.2,94.1,0.7,10500,3.7,3500,9.9,5.7,0.3,3100,11.4,3.3,0.3,145000,13.2,97000,14.9,4.1,0.3,127,NULL,NULL,0),
('passive','STR006','资费答疑引导','02','存量经营','资费答疑','2026-08-01',1,49000,5.4,35000,8.8,33000,8.4,94.3,0.8,10800,3.8,3600,10.1,5.8,0.3,3180,11.6,3.3,0.3,149000,13.4,99000,15.1,3.9,0.3,124,NULL,NULL,0),
('passive','STR006','资费答疑引导','02','存量经营','资费答疑','2026-09-01',1,50000,5.6,36000,9.0,34000,8.6,94.4,0.9,11000,4.0,3700,10.3,5.9,0.3,3260,11.8,3.3,0.3,153000,13.6,101000,15.3,3.7,0.3,121,NULL,NULL,0);

INSERT INTO t_sr_strategy_period_summary_ctrl
(strategy_id, strategy_code, strategy_name, channel, big_category, small_category, stat_month, strategy_count, consult_count, consult_count_qoq, retain_count, retain_count_qoq, retain_rate, retain_rate_qoq, dispatch_count, dispatch_count_qoq, success_count, success_count_qoq, success_rate, success_rate_qoq, income, income_qoq, city_id, county_id, is_deleted) VALUES
(STR007,'STR007','高价值用户挽留','06','存量经营','高价值挽留','2026-07-01',1,9800,10.0,6100,8.5,62.2,2.1,2650,15.1,1850,18.4,69.8,3.0,92000,21.9,NULL,NULL,0),
(STR007,'STR007','高价值用户挽留','06','存量经营','高价值挽留','2026-08-01',1,9950,10.2,6200,8.7,62.3,2.2,2700,15.3,1890,18.6,70.0,3.1,94000,22.1,NULL,NULL,0),
(STR007,'STR007','高价值用户挽留','06','存量经营','高价值挽留','2026-09-01',1,10100,10.4,6300,8.9,62.4,2.3,2750,15.5,1930,18.8,70.2,3.2,96000,22.3,NULL,NULL,0),
(STR008,'STR008','欠费停机挽留','01','存量经营','欠费挽留','2026-07-01',1,14700,10.1,9400,8.6,63.9,2.3,4050,15.2,2880,18.3,71.1,3.2,144000,21.9,NULL,NULL,0),
(STR008,'STR008','欠费停机挽留','01','存量经营','欠费挽留','2026-08-01',1,14900,10.3,9550,8.8,64.1,2.4,4120,15.4,2930,18.5,71.2,3.3,147000,22.1,NULL,NULL,0),
(STR008,'STR008','欠费停机挽留','01','存量经营','欠费挽留','2026-09-01',1,15100,10.5,9700,9.0,64.3,2.5,4200,15.6,2980,18.7,71.0,3.4,150000,22.3,NULL,NULL,0),
(STR009,'STR009','宽带拆机挽留','05','家庭业务','拆机挽留','2026-07-01',1,9300,10.7,5900,8.9,63.4,2.0,2550,15.1,1790,18.6,70.2,3.1,90000,22.2,NULL,NULL,0),
(STR009,'STR009','宽带拆机挽留','05','家庭业务','拆机挽留','2026-08-01',1,9450,10.9,6000,9.1,63.5,2.1,2600,15.3,1820,18.8,70.0,3.2,92000,22.4,NULL,NULL,0),
(STR009,'STR009','宽带拆机挽留','05','家庭业务','拆机挽留','2026-09-01',1,9600,11.1,6100,9.3,63.5,2.2,2650,15.5,1850,19.0,69.8,3.3,94000,22.6,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 6.1 策略分类汇总数据（strategy_id='999'，供 selectCategorySummary 使用）
-- 与 6 中策略明细的大类+小类组合一致；含"全部"合计行（channel/big/small 全为'全部'）
-- 以下为 2026-09 单月，其余月份可按相同结构平移 stat_month
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month, strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq, usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq, target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq, product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq, expected_income, expected_income_qoq, actual_income, actual_income_qoq, reject_rate, reject_rate_qoq, reject_count, city_id, county_id, is_deleted) VALUES
('active','999','分类汇总','01','流量经营','套餐升档','2026-09-01',1,85200,8.4,61800,11.4,58200,10.9,94.2,1.3,18200,5.4,6400,13.3,6.6,0.4,5650,14.6,3.7,0.3,266000,16.4,180000,18.2,6.3,0.4,356,NULL,NULL,0),
('active','999','分类汇总','02','权益运营','权益领取','2026-09-01',1,89300,9.1,63800,12.2,60400,11.7,94.6,1.4,18850,6.0,6600,13.8,6.8,0.4,5750,15.4,3.9,0.3,274000,17.2,184000,18.8,4.8,0.3,276,NULL,NULL,0),
('active','999','分类汇总','03','增值业务','彩铃','2026-09-01',1,80500,8.6,58400,11.6,54300,11.2,93.3,1.2,17050,5.3,5900,13.2,6.5,0.4,5120,14.4,3.6,0.3,250000,16.2,169000,18.0,6.9,0.5,353,NULL,NULL,0),
('passive','999','分类汇总','06','存量经营','咨询挽留','2026-09-01',1,64200,6.6,46000,9.6,44000,9.1,95.7,1.1,13600,4.6,4620,11.3,6.3,0.3,4150,12.9,3.5,0.3,191000,14.6,128000,16.3,5.2,0.4,216,NULL,NULL,0),
('passive','999','分类汇总','01','家庭业务','宽带续约','2026-09-01',1,60200,6.2,43000,9.4,41000,8.9,95.4,1.0,12600,4.3,4200,10.9,6.1,0.3,3760,12.4,3.4,0.3,176000,14.2,118000,15.9,4.5,0.3,169,NULL,NULL,0),
('passive','999','分类汇总','02','存量经营','资费答疑','2026-09-01',1,50000,5.6,36000,9.0,34000,8.6,94.4,0.9,11000,4.0,3700,10.3,5.9,0.3,3260,11.8,3.3,0.3,153000,13.6,101000,15.3,3.7,0.3,121,NULL,NULL,0),
('active','999','分类汇总','全部','全部','全部','2026-09-01',3,255000,8.7,184000,11.7,172900,11.3,94.0,1.3,54100,5.6,18900,13.4,6.6,0.4,16520,14.8,3.7,0.3,790000,16.6,533000,18.3,5.5,0.4,985,NULL,NULL,0),
('passive','999','分类汇总','全部','全部','全部','2026-09-01',3,174400,6.1,125000,9.3,119000,8.9,95.2,1.0,37200,4.3,12520,10.8,6.1,0.3,11170,12.4,3.4,0.3,520000,14.1,347000,15.8,4.5,0.3,506,NULL,NULL,0);

INSERT INTO t_sr_strategy_period_summary_ctrl
(strategy_id, strategy_code, strategy_name, channel, big_category, small_category, stat_month, strategy_count, consult_count, consult_count_qoq, retain_count, retain_count_qoq, retain_rate, retain_rate_qoq, dispatch_count, dispatch_count_qoq, success_count, success_count_qoq, success_rate, success_rate_qoq, income, income_qoq, city_id, county_id, is_deleted) VALUES
('999','999','分类汇总','06','存量经营','高价值挽留','2026-09-01',1,10100,10.4,6300,8.9,62.4,2.3,2750,15.5,1930,18.8,70.2,3.2,96000,22.3,NULL,NULL,0),
('999','999','分类汇总','01','存量经营','欠费挽留','2026-09-01',1,15100,10.5,9700,9.0,64.3,2.5,4200,15.6,2980,18.7,71.0,3.4,150000,22.3,NULL,NULL,0),
('999','999','分类汇总','05','家庭业务','拆机挽留','2026-09-01',1,9600,11.1,6100,9.3,63.5,2.2,2650,15.5,1850,19.0,69.8,3.3,94000,22.6,NULL,NULL,0),
('999','999','分类汇总','全部','全部','全部','2026-09-01',3,34800,10.6,22100,9.1,63.5,2.3,9600,15.5,6760,18.8,70.3,3.3,340000,22.4,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 7. 渠道月度产能（近3个月，各渠道 + 全部）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_channel_monthly_capacity_ctrl
(stat_month, channel, big_category, small_category, capacity, qoq, city_id, county_id, is_deleted) VALUES
('2026-07-01','全部','全部','全部',8350,18.6,NULL,NULL,0),
('2026-07-01','01','全部','全部',2760,17.9,NULL,NULL,0),
('2026-07-01','02','全部','全部',1950,19.2,NULL,NULL,0),
('2026-07-01','05','全部','全部',1850,18.7,NULL,NULL,0),
('2026-07-01','06','全部','全部',1790,18.4,NULL,NULL,0),
('2026-08-01','全部','全部','全部',8520,18.8,NULL,NULL,0),
('2026-08-01','01','全部','全部',2820,18.1,NULL,NULL,0),
('2026-08-01','02','全部','全部',1990,19.5,NULL,NULL,0),
('2026-08-01','05','全部','全部',1890,19.0,NULL,NULL,0),
('2026-08-01','06','全部','全部',1830,18.6,NULL,NULL,0),
('2026-09-01','全部','全部','全部',8700,19.0,NULL,NULL,0),
('2026-09-01','01','全部','全部',2880,18.3,NULL,NULL,0),
('2026-09-01','02','全部','全部',2030,19.7,NULL,NULL,0),
('2026-09-01','05','全部','全部',1930,19.2,NULL,NULL,0),
('2026-09-01','06','全部','全部',1860,18.8,NULL,NULL,0);

INSERT INTO t_sr_channel_monthly_capacity_ap
(tab_type, stat_month, channel, big_category, small_category, capacity, qoq, city_id, county_id, is_deleted) VALUES
('active','2026-07-01','全部','全部','全部',15800,14.8,NULL,NULL,0),
('active','2026-07-01','01','全部','全部',5400,14.2,NULL,NULL,0),
('active','2026-07-01','02','全部','全部',5500,15.0,NULL,NULL,0),
('active','2026-07-01','03','全部','全部',4900,14.0,NULL,NULL,0),
('active','2026-08-01','全部','全部','全部',16100,15.0,NULL,NULL,0),
('active','2026-08-01','01','全部','全部',5520,14.4,NULL,NULL,0),
('active','2026-08-01','02','全部','全部',5620,15.2,NULL,NULL,0),
('active','2026-08-01','03','全部','全部',5000,14.2,NULL,NULL,0),
('active','2026-09-01','全部','全部','全部',16500,15.2,NULL,NULL,0),
('active','2026-09-01','01','全部','全部',5650,14.6,NULL,NULL,0),
('active','2026-09-01','02','全部','全部',5750,15.4,NULL,NULL,0),
('active','2026-09-01','03','全部','全部',5120,14.4,NULL,NULL,0),
('passive','2026-07-01','全部','全部','全部',11800,12.8,NULL,NULL,0),
('passive','2026-07-01','01','全部','全部',3600,12.0,NULL,NULL,0),
('passive','2026-07-01','02','全部','全部',4400,13.1,NULL,NULL,0),
('passive','2026-07-01','06','全部','全部',3950,12.5,NULL,NULL,0),
('passive','2026-08-01','全部','全部','全部',12000,13.0,NULL,NULL,0),
('passive','2026-08-01','01','全部','全部',3680,12.2,NULL,NULL,0),
('passive','2026-08-01','02','全部','全部',4510,13.3,NULL,NULL,0),
('passive','2026-08-01','06','全部','全部',4050,12.7,NULL,NULL,0),
('passive','2026-09-01','全部','全部','全部',12300,13.2,NULL,NULL,0),
('passive','2026-09-01','01','全部','全部',3760,12.4,NULL,NULL,0),
('passive','2026-09-01','02','全部','全部',4620,13.5,NULL,NULL,0),
('passive','2026-09-01','06','全部','全部',4150,12.9,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 8. 渠道业务产能（当前月）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_channel_biz_capacity_ctrl
(stat_month, channel, big_category, small_category, biz_name, capacity, qoq, city_id, county_id, is_deleted) VALUES
('2026-09-01','01','存量经营','欠费挽留','话费补缴',5100,12.5,NULL,NULL,0),
('2026-09-01','01','存量经营','欠费挽留','合约续期',3800,10.8,NULL,NULL,0),
('2026-09-01','02','存量经营','资费答疑','套餐变更',2600,9.6,NULL,NULL,0),
('2026-09-01','05','家庭业务','拆机挽留','宽带续约',2700,11.2,NULL,NULL,0);

INSERT INTO t_sr_channel_biz_capacity_ap
(tab_type, stat_month, channel, big_category, small_category, biz_name, capacity, qoq, city_id, county_id, is_deleted) VALUES
('active','2026-09-01','01','流量经营','套餐升档','5G套餐',4200,14.2,NULL,NULL,0),
('active','2026-09-01','02','权益运营','权益领取','权益包',3600,15.0,NULL,NULL,0),
('active','2026-09-01','03','增值业务','彩铃','视频彩铃',2900,12.8,NULL,NULL,0),
('passive','2026-09-01','06','存量经营','咨询挽留','话费套餐',3100,12.5,NULL,NULL,0),
('passive','2026-09-01','01','家庭业务','宽带续约','宽带包年',2700,11.8,NULL,NULL,0);

-- 8.1 渠道业务产能-全部渠道汇总行（channel='全部'，业务产能明细选"全部渠道"时查询）
INSERT INTO t_sr_channel_biz_capacity_ctrl
(stat_month, channel, big_category, small_category, biz_name, capacity, qoq, city_id, county_id, is_deleted) VALUES
('2026-09-01','全部','全部','全部','全部',14200,11.0,NULL,NULL,0);

INSERT INTO t_sr_channel_biz_capacity_ap
(tab_type, stat_month, channel, big_category, small_category, biz_name, capacity, qoq, city_id, county_id, is_deleted) VALUES
('active','2026-09-01','全部','全部','全部','全部',10700,14.0,NULL,NULL,0),
('passive','2026-09-01','全部','全部','全部','全部',5800,12.2,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 9. 策略业务产能（当前月）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_biz_capacity
(strategy_id, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, is_deleted) VALUES
(STR001,'2026-09-01','B01','5G畅享套餐',2150,12.4,18.2,NULL,NULL,0),
(STR001,'2026-09-01','B02','5G尊享套餐',1780,10.6,15.8,NULL,NULL,0),
(STR001,'2026-09-01','B03','流量加油包',960,8.2,9.4,NULL,NULL,0),
(STR002,'2026-09-01','B04','流量权益包',1520,13.1,17.6,NULL,NULL,0),
(STR002,'2026-09-01','B05','视频会员包',1840,14.5,19.2,NULL,NULL,0),
(STR003,'2026-09-01','B06','视频彩铃包',4200,168.5,21.4,NULL,NULL,0),
(STR003,'2026-09-01','B07','彩铃DIY',230,-86.2,11.5,NULL,NULL,0),
(STR004,'2026-09-01','B08','话费套餐升级',1650,11.2,14.6,NULL,NULL,0),
(STR004,'2026-09-01','B09','合约续期',1320,10.3,13.1,NULL,NULL,0),
(STR005,'2026-09-01','B10','宽带包年',1880,13.4,16.8,NULL,NULL,0),
(STR005,'2026-09-01','B11','家庭融合包',1120,9.5,12.2,NULL,NULL,0),
(STR006,'2026-09-01','B12','资费优化包',1490,11.8,15.1,NULL,NULL,0),
(STR007,'2026-09-01','B13','高价值维系包',1420,16.2,20.5,NULL,NULL,0),
(STR008,'2026-09-01','B14','欠费补缴包',2890,18.4,22.8,NULL,NULL,0),
(STR009,'2026-09-01','B15','宽带续约包',1740,15.6,19.3,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 9.1 业务产能明细分页验证数据（当页 pageSize=5，多造数据以出现多页）
-- strategy_id='STR001' 补 40 条（原有 3 条，合计 43 条 → 9 页）
-- strategy_id='STR002'~'STR009' 各补 12 条（合计 12 条以上 → 3 页）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_biz_capacity
(strategy_id, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, is_deleted)
SELECT 'STR001', '2026-09-01',
       CONCAT('B', LPAD((a.n - 1) * 10 + b.n + 2, 3, '0')),
       CONCAT('分页测试业务', LPAD((a.n - 1) * 10 + b.n, 2, '0')),
       1000 + ((a.n - 1) * 10 + b.n) * 137,
       10 + ((a.n - 1) * 10 + b.n) * 0.4,
       15 + ((a.n - 1) * 10 + b.n) * 0.2,
       NULL, NULL, 0
FROM (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) a
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10) b;

INSERT INTO t_sr_strategy_biz_capacity
(strategy_id, stat_date, biz_code, biz_name, count, mom_ratio, yoy_ratio, city_id, county_id, is_deleted)
SELECT CONCAT('STR', LPAD(s.sid, 3, '0')), '2026-09-01',
       CONCAT('C', LPAD(s.sid * 100 + b.n, 3, '0')),
       CONCAT('业务', s.sid, '-', LPAD(b.n, 2, '0')),
       800 + (s.sid * 100 + b.n) * 23,
       8 + (s.sid + b.n) % 20,
       12 + (s.sid * 3 + b.n) % 18,
       NULL, NULL, 0
FROM (SELECT 2 sid UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
      UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) s
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
            UNION ALL SELECT 11 UNION ALL SELECT 12) b;

-- ---------------------------------------------------------------------
-- 10. 策略日粒度明细（基础数据 09-01~09-05，末尾平移补齐至 09-18）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_daily_ap
(tab_type, strategy_id, stat_date, channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, is_deleted) VALUES
('active','STR001','2026-09-01','01','流量经营','套餐升档','5G套餐升档提醒',3300,2450,2320,94.7,720,262,6.4,232,3.8,10500,7300,15,6.5,NULL,NULL,0),
('active','STR001','2026-09-02','01','流量经营','套餐升档','5G套餐升档提醒',3420,2530,2400,94.7,745,271,6.6,240,3.7,10900,7550,14,6.3,NULL,NULL,0),
('active','STR001','2026-09-03','01','流量经营','套餐升档','5G套餐升档提醒',3380,2500,2370,94.8,738,268,6.5,238,3.8,10800,7480,16,6.4,NULL,NULL,0),
('active','STR001','2026-09-04','01','流量经营','套餐升档','5G套餐升档提醒',3510,2600,2470,95.0,762,278,6.7,246,3.7,11200,7750,14,6.2,NULL,NULL,0),
('active','STR001','2026-09-05','01','流量经营','套餐升档','5G套餐升档提醒',3460,2560,2430,94.9,755,275,6.6,243,3.8,11000,7620,15,6.3,NULL,NULL,0),
('active','STR002','2026-09-01','02','权益运营','权益领取','流量权益推荐',3500,2580,2450,94.9,756,274,6.7,242,3.9,11100,7700,12,4.9,NULL,NULL,0),
('active','STR002','2026-09-02','02','权益运营','权益领取','流量权益推荐',3560,2630,2500,95.0,768,279,6.8,247,3.9,11300,7820,11,4.8,NULL,NULL,0),
('active','STR003','2026-09-01','03','增值业务','彩铃','视频彩铃体验',3100,2280,2150,94.3,680,245,6.3,218,3.6,10200,7000,20,6.9,NULL,NULL,0),
('active','STR003','2026-09-02','03','增值业务','彩铃','视频彩铃体验',3150,2320,2190,94.4,692,250,6.4,222,3.6,10400,7120,19,6.8,NULL,NULL,0);

INSERT INTO t_sr_strategy_daily_ap
(tab_type, strategy_id, stat_date, channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, is_deleted) VALUES
('passive','STR004','2026-09-01','06','存量经营','咨询挽留','客户咨询挽留',2600,1850,1760,95.1,545,196,6.1,174,3.5,7600,5100,12,5.2,NULL,NULL,0),
('passive','STR004','2026-09-02','06','存量经营','咨询挽留','客户咨询挽留',2680,1910,1820,95.3,558,201,6.2,179,3.5,7800,5220,11,5.0,NULL,NULL,0),
('passive','STR005','2026-09-01','01','家庭业务','宽带续约','宽带续约关怀',2400,1720,1630,94.7,502,178,5.9,158,3.4,7000,4700,10,4.5,NULL,NULL,0),
('passive','STR005','2026-09-02','01','家庭业务','宽带续约','宽带续约关怀',2460,1760,1670,94.9,515,182,6.0,162,3.4,7160,4800,9,4.3,NULL,NULL,0),
('passive','STR006','2026-09-01','02','存量经营','资费答疑','资费答疑引导',2050,1460,1380,94.5,438,156,5.8,139,3.3,6100,4100,8,3.7,NULL,NULL,0),
('passive','STR006','2026-09-02','02','存量经营','资费答疑','资费答疑引导',2100,1500,1420,94.6,448,160,5.9,143,3.3,6250,4200,7,3.5,NULL,NULL,0);

-- 日明细平移补齐：将基础日期复制平移，保证覆盖到当月（避免"默认日期范围内无日明细"）。
-- active/passive：+5 ~ +13 天（09-06 ~ 09-18）；passive 另补 +2 ~ +4 天（09-03 ~ 09-05）。
INSERT INTO t_sr_strategy_daily_ap
(tab_type, strategy_id, stat_date, channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, is_deleted)
SELECT tab_type, strategy_id, DATE_ADD(stat_date, INTERVAL n DAY), channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, 0
FROM t_sr_strategy_daily_ap
CROSS JOIN (SELECT 5 AS n UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13) nums
WHERE tab_type IS NOT NULL;

INSERT INTO t_sr_strategy_daily_ap
(tab_type, strategy_id, stat_date, channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, is_deleted)
SELECT tab_type, strategy_id, DATE_ADD(stat_date, INTERVAL n DAY), channel, big_category, small_category, strategy_name, original_cust, push_count, usage_count, usage_rate, reach_count, target_conv_num, target_conv_rate, product_conv_num, product_conv_rate, expected_income, actual_income, reject_count, reject_rate, city_id, county_id, 0
FROM t_sr_strategy_daily_ap
CROSS JOIN (SELECT 2 AS n UNION SELECT 3 UNION SELECT 4) nums
WHERE stat_date = '2026-09-01' AND tab_type = 'passive';

INSERT INTO t_sr_strategy_daily_ctrl
(strategy_id, stat_date, channel, big_category, small_category, strategy_name, consult_count, retain_count, retain_rate, dispatch_count, success_count, success_rate, city_id, county_id, is_deleted) VALUES
(STR007,'2026-09-01','06','存量经营','高价值挽留','高价值用户挽留',410,255,62.2,115,79,70.2,NULL,NULL,0),
(STR007,'2026-09-02','06','存量经营','高价值挽留','高价值用户挽留',425,262,61.6,118,81,70.3,NULL,NULL,0),
(STR008,'2026-09-01','01','存量经营','欠费挽留','欠费停机挽留',610,395,64.7,168,120,71.4,NULL,NULL,0),
(STR008,'2026-09-02','01','存量经营','欠费挽留','欠费停机挽留',630,405,64.3,172,123,71.5,NULL,NULL,0),
(STR009,'2026-09-01','05','家庭业务','拆机挽留','宽带拆机挽留',390,250,64.1,110,78,70.9,NULL,NULL,0),
(STR009,'2026-09-02','05','家庭业务','拆机挽留','宽带拆机挽留',400,258,64.5,113,80,70.8,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 11. 策略拒绝原因（active）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_strategy_reject_reason
(strategy_id, stat_month, reason_code, reason_name, reject_count, reject_ratio, color, sort_no, city_id, county_id, is_deleted) VALUES
('STR001','2026-09-01','R01','用户已办理同类业务',148,40.1,'#F56C6C',1,NULL,NULL,0),
('STR001','2026-09-01','R02','用户无办理意向',112,30.3,'#E6A23C',2,NULL,NULL,0),
('STR001','2026-09-01','R03','联系不上用户',66,17.8,'#409EFF',3,NULL,NULL,0),
('STR001','2026-09-01','R04','其他原因',44,11.8,'#909399',4,NULL,NULL,0),
('STR002','2026-09-01','R01','用户已办理同类业务',130,38.5,'#F56C6C',1,NULL,NULL,0),
('STR002','2026-09-01','R02','用户无办理意向',105,31.1,'#E6A23C',2,NULL,NULL,0),
('STR002','2026-09-01','R03','联系不上用户',58,17.2,'#409EFF',3,NULL,NULL,0),
('STR002','2026-09-01','R04','其他原因',45,13.2,'#909399',4,NULL,NULL,0);

-- ---------------------------------------------------------------------
-- 12. 预警规则 + 条件 + 命中
-- ---------------------------------------------------------------------
INSERT INTO t_sr_warning_rule
(rule_name, rule_desc, tab_type, status, start_date, end_date, data_start_date, data_end_date, channels, strategies, logic, create_by, creator, create_time, update_time, is_deleted) VALUES
('推送量过低预警', '主动策略推送量低于阈值时提醒', 'active', '生效中', '2026-01-01', '2026-12-31', '2026-09-01', '2026-09-30', '01,02,03', 'STR001,STR002,STR003', 'or', 'admin', '管理员', '2026-06-01 10:00:00', '2026-06-01 10:00:00', 0),
('转化率下降预警', '被动策略产品转化率低于阈值时提醒', 'passive', '生效中', '2026-01-01', '2026-12-31', '2026-09-01', '2026-09-30', '01,02,06', 'STR004,STR005,STR006', 'and', 'admin', '管理员', '2026-06-02 10:00:00', '2026-06-02 10:00:00', 0),
('挽留成功率预警', '控损策略挽留成功率低于阈值时提醒', 'control', '生效中', '2026-01-01', '2026-12-31', '2026-09-01', '2026-09-30', '01,05,06', 'STR007,STR008,STR009', 'or', 'admin', '管理员', '2026-06-03 10:00:00', '2026-06-03 10:00:00', 0);

INSERT INTO t_sr_warning_rule_condition
(rule_id, metric_code, metric_name, operator, threshold, unit, sort_no, create_time, update_time, is_deleted) VALUES
(1,'push_count','推送量','<',300000,'次',1,'2026-06-01 10:00:00','2026-06-01 10:00:00',0),
(1,'product_conv_rate','转化率','<',3.6,'%',2,'2026-06-01 10:00:00','2026-06-01 10:00:00',0),
(2,'product_conv_rate','转化率','<',3.5,'%',1,'2026-06-02 10:00:00','2026-06-02 10:00:00',0),
(2,'usage_rate','使用率','<',94,'%',2,'2026-06-02 10:00:00','2026-06-02 10:00:00',0),
(3,'success_rate','成功率','<',70,'%',1,'2026-06-03 10:00:00','2026-06-03 10:00:00',0),
(3,'retain_rate','挽留率','<',62,'%',2,'2026-06-03 10:00:00','2026-06-03 10:00:00',0);

INSERT INTO t_sr_warning_hit
(rule_id, strategy_id, tab_type, followed, create_time, update_time, is_deleted) VALUES
(1,'STR001','active',0,'2026-09-05 10:00:00','2026-09-05 10:00:00',0),
(1,'STR002','active',1,'2026-09-05 10:00:00','2026-09-05 10:00:00',0),
(2,'STR004','passive',0,'2026-09-05 10:00:00','2026-09-05 10:00:00',0),
(3,'STR007','control',0,'2026-09-05 10:00:00','2026-09-05 10:00:00',0);

-- ---------------------------------------------------------------------
-- 13. 收藏（示例）
-- ---------------------------------------------------------------------
INSERT INTO t_sr_favorite
(user_id, tab_type, strategy_id, strategy_name, channel, source, create_time, update_time, is_deleted) VALUES
('admin','active','STR001','5G套餐升档提醒','01','manual','2026-09-01 10:00:00','2026-09-01 10:00:00',0),
('admin','control','STR007','高价值用户挽留','06','follow','2026-09-02 10:00:00','2026-09-02 10:00:00',0);

-- ---------------------------------------------------------------------
-- 14. 极端环比验证数据（验证趋势图环比轴自适应：大正/大负环比标签不被裁剪）
-- strategy_count（active 页签默认指标）改为大幅震荡环比 +480/-320/+260/-95/+410/-185
-- ---------------------------------------------------------------------
UPDATE t_sr_kpi_summary
SET qoq = CASE stat_month
    WHEN '2026-04' THEN 480
    WHEN '2026-05' THEN -320
    WHEN '2026-06' THEN 260
    WHEN '2026-07' THEN -95
    WHEN '2026-08' THEN 410
    ELSE -185 END
WHERE tab_type = 'active'
  AND metric_code = 'strategy_count'
  AND stat_month LIKE '2026%';

-- 策略产能趋势（策略详情面板）：视频彩铃体验（strategy_id='STR003'）改为极端数据——
-- 柱状图（product_conv_num）850/5600/2100 大落差，环比（product_conv_num_qoq）5/-140/+500 大幅震荡，
-- 验证策略产能图的柱值与环比轴/标签在极端数据下正常显示
UPDATE t_sr_strategy_period_summary_ap
SET product_conv_num = CASE stat_month
        WHEN '2026-07-01' THEN 850
        WHEN '2026-08-01' THEN 5600
        ELSE 2100 END,
    product_conv_num_qoq = CASE stat_month
        WHEN '2026-07-01' THEN 5
        WHEN '2026-08-01' THEN -140
        ELSE 500 END
WHERE strategy_id = 'STR003'
  AND tab_type = 'active';
-- ---------------------------------------------------------------------
-- 2026-10-10 signToken 单点登录：事实表 city_id 回填（登录后按 cityId 过滤）
-- ---------------------------------------------------------------------
UPDATE t_sr_kpi_summary                    SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_summary_ctrl           SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_summary_ap             SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_period_summary_ctrl   SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_period_summary_ap     SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_monthly_capacity_ctrl  SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_monthly_capacity_ap    SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_biz_capacity_ctrl      SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_channel_biz_capacity_ap        SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_biz_capacity          SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_daily_ctrl            SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_daily_ap              SET city_id = '999' WHERE city_id IS NULL;
UPDATE t_sr_strategy_reject_reason         SET city_id = '999' WHERE city_id IS NULL;

-- ---------------------------------------------------------------------
-- 2026-10-10 策略分类汇总行（strategy_id='999'）重建：
-- 分类执行情况 SQL 过滤 strategy_id='999'；本段从策略明细行聚合出三个层级——
--   a) 分类×渠道  b) 渠道='全部'×分类  c) 总计行（全部/全部/全部）
-- 并把中旬日期（如平移产生的 10-15）归一到当月 1 号后去重。
-- 幂等，可重复执行
-- ---------------------------------------------------------------------
UPDATE t_sr_strategy_period_summary_ap   SET stat_month = DATE_FORMAT(stat_month, '%Y-%m-01');
UPDATE t_sr_strategy_period_summary_ctrl SET stat_month = DATE_FORMAT(stat_month, '%Y-%m-01');

DELETE a FROM t_sr_strategy_period_summary_ap a
JOIN t_sr_strategy_period_summary_ap b
  ON a.tab_type=b.tab_type AND a.strategy_id=b.strategy_id AND a.channel=b.channel
 AND a.big_category=b.big_category AND a.small_category=b.small_category AND a.stat_month=b.stat_month
 AND a.id <> b.id
WHERE a.strategy_id LIKE 'STR%'
  AND (COALESCE(a.push_count,0) < COALESCE(b.push_count,0)
       OR (COALESCE(a.push_count,0) = COALESCE(b.push_count,0) AND a.id < b.id));

DELETE FROM t_sr_strategy_period_summary_ap WHERE strategy_id = '999';

INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month,
 strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq,
 usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq,
 target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq,
 product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq,
 expected_income, expected_income_qoq, actual_income, actual_income_qoq,
 reject_rate, reject_rate_qoq, reject_count, city_id, is_deleted)
SELECT tab_type, '999', '分类汇总', channel, big_category, small_category, MAX(stat_month),
       SUM(strategy_count), SUM(original_cust), MAX(original_cust_qoq),
       SUM(push_count), MAX(push_count_qoq), SUM(usage_count), MAX(usage_count_qoq),
       MAX(usage_rate), MAX(usage_rate_qoq), SUM(reach_count), MAX(reach_count_qoq),
       SUM(target_conv_num), MAX(target_conv_num_qoq), MAX(target_conv_rate), MAX(target_conv_rate_qoq),
       SUM(product_conv_num), MAX(product_conv_num_qoq), MAX(product_conv_rate), MAX(product_conv_rate_qoq),
       SUM(expected_income), MAX(expected_income_qoq), SUM(actual_income), MAX(actual_income_qoq),
       MAX(reject_rate), MAX(reject_rate_qoq), SUM(reject_count), MAX(city_id), 0
FROM t_sr_strategy_period_summary_ap
WHERE strategy_id LIKE 'STR%' AND is_deleted = 0
GROUP BY tab_type, channel, big_category, small_category, DATE_FORMAT(stat_month, '%Y-%m');

INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month,
 strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq,
 usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq,
 target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq,
 product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq,
 expected_income, expected_income_qoq, actual_income, actual_income_qoq,
 reject_rate, reject_rate_qoq, reject_count, city_id, is_deleted)
SELECT tab_type, '999', '分类汇总', '全部', big_category, small_category, MAX(stat_month),
       SUM(strategy_count), SUM(original_cust), MAX(original_cust_qoq),
       SUM(push_count), MAX(push_count_qoq), SUM(usage_count), MAX(usage_count_qoq),
       MAX(usage_rate), MAX(usage_rate_qoq), SUM(reach_count), MAX(reach_count_qoq),
       SUM(target_conv_num), MAX(target_conv_num_qoq), MAX(target_conv_rate), MAX(target_conv_rate_qoq),
       SUM(product_conv_num), MAX(product_conv_num_qoq), MAX(product_conv_rate), MAX(product_conv_rate_qoq),
       SUM(expected_income), MAX(expected_income_qoq), SUM(actual_income), MAX(actual_income_qoq),
       MAX(reject_rate), MAX(reject_rate_qoq), SUM(reject_count), MAX(city_id), 0
FROM t_sr_strategy_period_summary_ap
WHERE strategy_id LIKE 'STR%' AND is_deleted = 0
GROUP BY tab_type, big_category, small_category, DATE_FORMAT(stat_month, '%Y-%m');

INSERT INTO t_sr_strategy_period_summary_ap
(tab_type, strategy_id, strategy_name, channel, big_category, small_category, stat_month,
 strategy_count, original_cust, original_cust_qoq, push_count, push_count_qoq,
 usage_count, usage_count_qoq, usage_rate, usage_rate_qoq, reach_count, reach_count_qoq,
 target_conv_num, target_conv_num_qoq, target_conv_rate, target_conv_rate_qoq,
 product_conv_num, product_conv_num_qoq, product_conv_rate, product_conv_rate_qoq,
 expected_income, expected_income_qoq, actual_income, actual_income_qoq,
 reject_rate, reject_rate_qoq, reject_count, city_id, is_deleted)
SELECT tab_type, '999', '分类汇总', '全部', '全部', '全部', MAX(stat_month),
       SUM(strategy_count), SUM(original_cust), MAX(original_cust_qoq),
       SUM(push_count), MAX(push_count_qoq), SUM(usage_count), MAX(usage_count_qoq),
       MAX(usage_rate), MAX(usage_rate_qoq), SUM(reach_count), MAX(reach_count_qoq),
       SUM(target_conv_num), MAX(target_conv_num_qoq), MAX(target_conv_rate), MAX(target_conv_rate_qoq),
       SUM(product_conv_num), MAX(product_conv_num_qoq), MAX(product_conv_rate), MAX(product_conv_rate_qoq),
       SUM(expected_income), MAX(expected_income_qoq), SUM(actual_income), MAX(actual_income_qoq),
       MAX(reject_rate), MAX(reject_rate_qoq), SUM(reject_count), MAX(city_id), 0
FROM t_sr_strategy_period_summary_ap
WHERE strategy_id LIKE 'STR%' AND is_deleted = 0
GROUP BY tab_type, DATE_FORMAT(stat_month, '%Y-%m');

-- ctrl 表：已有分类×渠道 '999' 行，只补 渠道='全部'×分类 与 总计行
DELETE FROM t_sr_strategy_period_summary_ctrl
WHERE strategy_id = '999' AND (channel = '全部' OR big_category = '全部' OR small_category = '全部');

INSERT INTO t_sr_strategy_period_summary_ctrl
(strategy_id, strategy_code, strategy_name, channel, big_category, small_category, stat_month,
 strategy_count, consult_count, consult_count_qoq, retain_count, retain_count_qoq,
 retain_rate, retain_rate_qoq, dispatch_count, dispatch_count_qoq,
 success_count, success_count_qoq, success_rate, success_rate_qoq,
 income, income_qoq, city_id, is_deleted)
SELECT '999', '999', '分类汇总', '全部', big_category, small_category, MAX(stat_month),
       SUM(strategy_count), SUM(consult_count), MAX(consult_count_qoq),
       SUM(retain_count), MAX(retain_count_qoq), MAX(retain_rate), MAX(retain_rate_qoq),
       SUM(dispatch_count), MAX(dispatch_count_qoq), SUM(success_count), MAX(success_count_qoq),
       MAX(success_rate), MAX(success_rate_qoq), SUM(income), MAX(income_qoq), MAX(city_id), 0
FROM t_sr_strategy_period_summary_ctrl
WHERE strategy_id LIKE 'STR%' AND is_deleted = 0
GROUP BY big_category, small_category, DATE_FORMAT(stat_month, '%Y-%m');

INSERT INTO t_sr_strategy_period_summary_ctrl
(strategy_id, strategy_code, strategy_name, channel, big_category, small_category, stat_month,
 strategy_count, consult_count, consult_count_qoq, retain_count, retain_count_qoq,
 retain_rate, retain_rate_qoq, dispatch_count, dispatch_count_qoq,
 success_count, success_count_qoq, success_rate, success_rate_qoq,
 income, income_qoq, city_id, is_deleted)
SELECT '999', '999', '分类汇总', '全部', '全部', '全部', MAX(stat_month),
       SUM(strategy_count), SUM(consult_count), MAX(consult_count_qoq),
       SUM(retain_count), MAX(retain_count_qoq), MAX(retain_rate), MAX(retain_rate_qoq),
       SUM(dispatch_count), MAX(dispatch_count_qoq), SUM(success_count), MAX(success_count_qoq),
       MAX(success_rate), MAX(success_rate_qoq), SUM(income), MAX(income_qoq), MAX(city_id), 0
FROM t_sr_strategy_period_summary_ctrl
WHERE strategy_id LIKE 'STR%' AND is_deleted = 0
GROUP BY DATE_FORMAT(stat_month, '%Y-%m');

-- 存量预计算总计显式存“全部”；原始种子未提供真实策略分类，需由业务映射补齐。
UPDATE t_sr_kpi_summary SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;
UPDATE t_sr_channel_summary_ap SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;
UPDATE t_sr_channel_monthly_capacity_ap SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;
UPDATE t_sr_channel_biz_capacity_ap SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL;
UPDATE t_sr_strategy_period_summary_ap SET strategy_class = '全部'
WHERE tab_type = 'active' AND strategy_class IS NULL AND strategy_id = '999';

-- 增量及重点产品使用显式分类“全部”。
-- 增量、重点产品已有 strategy_class 字段统一存全部；无此字段的专用表无需修改。
-- 与新应用、ETL 一起切换；仅更新 NULL，不覆盖已有非空分类。
SET NAMES utf8mb4;

UPDATE t_sr_strategy
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_kpi_summary
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_summary_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_strategy_period_summary_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_monthly_capacity_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_channel_biz_capacity_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;

UPDATE t_sr_strategy_daily_ap
SET strategy_class = '全部'
WHERE tab_type IN ('passive', 'control') AND strategy_class IS NULL;
