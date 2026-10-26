import { postAction, getAction } from './manage'
import api from './StrategyReviewApi'
import { getCityId, getUserId } from '@/utils/auth'

// 公共参数（城市/区县）合并
const formatParams = (params) => {
  if (typeof params !== 'object') return params
  return {
    cityId: getCityId() || sessionStorage.getItem('cityId') || '999',
    userId: getUserId(),
    countyId: sessionStorage.getItem('countyId') || '',
    ...params
  }
}

// ===== 通用枚举 =====
// 下拉枚举：'触点渠道' / '策略名称' / '预警指标' / '规则状态' / '客群分类' / '产品名称'
export function getDim (params) {
  return postAction(api.dim, params)
}

// 获取最新数据日期（用于前端初始化日期范围，需要带上 region 参数）
export function getLatestDate (params) {
  return postAction(api.latestDate, formatParams(params))
}

// ===== 1. 策略整体情况 =====
// KPI 卡片：tabType=active|passive|control
export function getOverviewKpi (params) {
  return postAction(api.overviewKpi, formatParams(params))
}
// KPI 趋势图：metricCode=指标编码（来自 KPI 卡片点击回传）
export function getOverviewTrend (params) {
  return postAction(api.overviewTrend, formatParams(params))
}

// ===== 2. 触点执行情况 =====
// 左侧渠道汇总列表
export function getChannelSummary (params) {
  return postAction(api.touchpointChannelSummary, formatParams(params))
}
// 右侧策略明细列表（支持分页、排序、筛选，含各指标环比值）
export function getStrategyList (params) {
  return postAction(api.touchpointStrategyList, formatParams(params))
}
// 使用与逐策略列表一致的过滤条件，返回所有匹配明细的分类，不受分页限制。
export function getStrategyCategoryOptions (params) {
  return postAction(api.strategyCategoryOptions, formatParams(params))
}
// 触点产能趋势（按渠道联动，近6月柱+线）
export function getChannelCapacityTrend (params) {
  return postAction(api.touchpointChannelCapacityTrend, formatParams(params))
}
// 触点业务产能明细（按渠道+周期联动）
export function getChannelBizCapacity (params) {
  return postAction(api.touchpointChannelBizCapacity, formatParams(params))
}
// 策略分类执行情况（按大类+小类聚合，不展示策略名称）
export function getCategorySummary (params) {
  return postAction(api.touchpointCategorySummary, formatParams(params))
}

// ===== 3. 策略执行明细 =====
export function getStrategyInfo (params) {
  return postAction(api.strategyInfo, formatParams(params))
}
export function getStrategyCapacityTrend (params) {
  return postAction(api.strategyCapacityTrend, formatParams(params))
}
export function getStrategyBizCapacity (params) {
  return postAction(api.strategyBizCapacity, formatParams(params))
}
export function getStrategyDailyDetail (params) {
  return postAction(api.strategyDailyDetail, formatParams(params))
}
// 拒绝原因分布（环形图数据）
export function getStrategyRejectReason (params) {
  return postAction(api.strategyRejectReason, formatParams(params))
}

// ===== 4. 策略自动预警 =====
export function getWarningRuleList (params) {
  return postAction(api.warningRuleList, formatParams(params))
}
export function createWarningRule (params) {
  return postAction(api.warningRuleCreate, formatParams(params))
}
export function updateWarningRule (params) {
  return postAction(api.warningRuleUpdate, formatParams(params))
}
// 聚合方法：ruleId 为空走 create，否则走 update
export function saveWarningRule (params) {
  return params.ruleId ? updateWarningRule(params) : createWarningRule(params)
}
export function deleteWarningRule (params) {
  return postAction(api.warningRuleDelete, formatParams(params))
}
export function getWarningRuleDetail (params) {
  return postAction(api.warningRuleDetail, formatParams(params))
}
// 启用/停用规则
export function toggleWarningRuleStatus (params) {
  return postAction(api.warningRuleUpdateStatus, formatParams(params))
}
// 命中策略列表
export function getWarningHitList (params) {
  return postAction(api.warningHitStrategyList, formatParams(params))
}
export function getWarningHitStrategyList (params) {
  return postAction(api.warningHitStrategyList, formatParams(params))
}
// 关注/取消关注命中策略
export function toggleFollowStrategy (params) {
  return postAction(api.warningToggleFollow, formatParams(params))
}

// ===== 5. 收藏 =====
export function addFavorite (params) {
  return postAction(api.favoriteAdd, formatParams(params))
}
export function removeFavorite (params) {
  return postAction(api.favoriteRemove, formatParams(params))
}
export function getFavoriteList (params) {
  return postAction(api.favoriteList, formatParams(params))
}
