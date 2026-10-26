// 策略复盘与预警 - 接口 URL 集中定义
// 注意：所有列表导出均由前端 CSV 实现，不提供后端导出接口
const baseUrl = '/plan-svc-lj/strategyReview'
export default {
  // ===== 通用枚举 =====
  dim: `${baseUrl}/dim`,                       // 下拉枚举（触点渠道/策略名称/预警指标/规则状态）
  latestDate: `${baseUrl}/latestDate`,         // 获取最新数据日期（用于前端初始化日期范围）

  // ===== 1. 策略整体情况 =====
  overviewKpi: `${baseUrl}/overview/kpi`,              // KPI 卡片（含环比/同比）
  overviewTrend: `${baseUrl}/overview/trend`,          // KPI 指标近 12 月趋势（柱+环比线）

  // ===== 2. 触点执行情况 =====
  touchpointChannelSummary: `${baseUrl}/touchpoint/channelSummary`,   // 左侧按渠道汇总
  touchpointStrategyList: `${baseUrl}/touchpoint/strategyList`,       // 右侧策略明细列表（含环比，查 t_sr_strategy_period_summary）
  strategyCategoryOptions: `${baseUrl}/touchpoint/strategyCategoryOptions`, // 逐策略明细中实际存在的大类、小类
  touchpointChannelCapacityTrend: `${baseUrl}/touchpoint/channelCapacityTrend`, // 触点产能趋势（按渠道联动，近6月柱+线）
  touchpointChannelBizCapacity: `${baseUrl}/touchpoint/channelBizCapacity`,     // 触点业务产能明细（按渠道+周期联动）
  touchpointCategorySummary: `${baseUrl}/touchpoint/categorySummary`,           // 策略分类执行情况（按大类+小类聚合，不展示策略名称）

  // ===== 3. 策略执行明细 =====
  strategyInfo: `${baseUrl}/execution/strategyInfo`,           // 策略头部信息
  strategyCapacityTrend: `${baseUrl}/execution/capacityTrend`, // 策略产能趋势（近 N 月柱+环比线）
  strategyBizCapacity: `${baseUrl}/execution/bizCapacity`,     // 业务产能明细列表
  strategyDailyDetail: `${baseUrl}/execution/dailyDetail`,     // 分日执行明细
  strategyRejectReason: `${baseUrl}/execution/rejectReason`,   // 拒绝原因分布（环形图）

  // ===== 4. 策略自动预警 =====
  warningRuleList: `${baseUrl}/warning/ruleList`,              // 历史规则列表
  warningRuleCreate: `${baseUrl}/warning/ruleCreate`,          // 新增规则
  warningRuleUpdate: `${baseUrl}/warning/ruleUpdate`,          // 编辑规则
  warningRuleDelete: `${baseUrl}/warning/ruleDelete`,          // 删除规则
  warningRuleDetail: `${baseUrl}/warning/ruleDetail`,          // 规则详情（含指标配置）
  warningRuleUpdateStatus: `${baseUrl}/warning/ruleUpdateStatus`, // 启用/停用规则
  warningHitStrategyList: `${baseUrl}/warning/hitStrategyList`, // 命中策略列表
  warningToggleFollow: `${baseUrl}/warning/toggleFollow`,     // 关注/取消关注命中策略

  // ===== 5. 收藏 =====
  favoriteAdd: `${baseUrl}/favorite/add`,
  favoriteRemove: `${baseUrl}/favorite/remove`,
  favoriteList: `${baseUrl}/favorite/list`
}
