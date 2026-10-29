import provenance from './leaveSimulation.json'
import incremental from './incrementalSimulation.json'
import decline from './declineSimulation.json'
import customerGroup from './customerGroupSimulation.json'
import networkDiversion from './networkDiversionSimulation.json'
import overage from './overageSimulation.json'
import oldTariff from './oldTariffSimulation.json'
import zeroLowFlow from './zeroLowFlowSimulation.json'
import stable from './stableSimulation.json'
import upgrade from './upgradeSimulation.json'

const keyAudienceSources = [customerGroup, networkDiversion, overage, oldTariff, zeroLowFlow]

function keyAudienceSource(query) {
  if (!query || query.tabType !== 'active' || query.strategyClass !== '重点客群') return null
  const selected = query.customerGroup
    ? keyAudienceSources.find(source => source.customerGroup === query.customerGroup ||
      (source.customerGroups || []).includes(query.customerGroup))
    : null
  return selected || keyAudienceSources.find(source => source.baselineMonth) || null
}

export function keyAudienceDataNote(query) {
  const source = keyAudienceSource(query)
  if (!source || !source.sourceMonth) return ''
  const months = (source.monthlySimulationMonths || []).filter(month => month >= '2026-01' && month < source.sourceMonth)
  const history = months.length ? `${months[0]}—${months[months.length - 1]}为模拟月数据` : ''
  const baseline = source.baselineMonth ? `，${source.baselineMonth}为模拟环比基期` : ''
  const dailyEnd = source.dailyEndDate || source.sourceCutoff
  const dailyRange = source.dailyStartDate ? `，日模拟范围${source.dailyStartDate}至${dailyEnd}` : ''
  return `${history}${baseline}；${source.sourceMonth}月来源数据截至${source.sourceCutoff}${dailyRange}；日数据为模拟分摊，客群汇总转化率相对来源月波动±2pp，逐策略日推送量相对日均波动±10%，不代表实际逐日业绩。`
}

export function passiveDataNote(query) {
  if (!query || query.tabType !== 'passive' || !incremental.sourceMonth) return ''
  const history = incremental.startMonth && incremental.endMonth
    ? `${incremental.startMonth}—${incremental.endMonth}为模拟月数据`
    : ''
  const baseline = incremental.baselineMonth ? `，${incremental.baselineMonth}为模拟环比基期` : ''
  const dailyEnd = incremental.dailyEndDate || incremental.sourceCutoff
  const dailyRange = incremental.dailyStartDate ? `；${incremental.dailyStartDate}至${dailyEnd}为模拟日数据` : ''
  return `${history}${baseline}；${incremental.sourceMonth}月来源数据截至${incremental.sourceCutoff}${dailyRange}，不代表实际逐日业绩。`
}

export function stableDataNote(query) {
  if (!query || query.tabType !== 'active' || query.strategyClass !== '稳' || !stable.sourceMonth) return ''
  const months = (stable.monthlySimulationMonths || []).filter(month => month >= `${stable.sourceMonth.slice(0, 4)}-01` && month < stable.sourceMonth)
  const history = months.length ? `${months[0]}—${months[months.length - 1]}为模拟月数据` : ''
  const baseline = stable.baselineMonth ? `，${stable.baselineMonth}为模拟环比基期` : ''
  const dailyEnd = stable.dailyEndDate || stable.sourceCutoff
  const daily = stable.dailyIsSimulated ? '日数据为模拟分摊' : `日明细来自 Excel 逐日记录，截至${dailyEnd}`
  const mismatch = stable.sourceMonthlyDailyMismatchCount
    ? `；月行与日行有${stable.sourceMonthlyDailyMismatchCount}项指标合计差异，按各自来源行保留`
    : ''
  return `${history}${baseline}；${stable.sourceMonth}月月度指标按 Excel 月行，${daily}${mismatch}。`
}

export function upgradeDataNote(query) {
  if (!query || query.tabType !== 'active' || query.strategyClass !== '升接' || !upgrade.sourceMonth) return ''
  const source = (upgrade.supplementalSources || []).slice(-1)[0]
  const months = (upgrade.monthlySimulationMonths || []).filter(month => month >= upgrade.startMonth && month < upgrade.sourceMonth)
  const history = months.length ? `${months[0]}—${months[months.length - 1]}为模拟月数据` : ''
  const oldDaily = upgrade.dailyIsSimulated && !source?.dailyWeightMode
    ? `日数据为模拟分摊，截至${upgrade.sourceCutoff}` : ''
  if (!source) return `${history}${history ? '；' : ''}${oldDaily}`
  const mismatch = source.sourceMonthlyDailyComparison && source.sourceMonthlyDailyComparison.mismatchCount
  const counts = source.counts || {}
  const supplement = `${source.sourceFile || '补充Excel'}档案${counts.strategies || 0}条，其中${counts.dailyStrategies || 0}条有日报、${counts.archiveOnlyStrategies || 0}条仅有档案；月事实${counts.monthlyFacts || 0}条，原始日报${counts.dailyRows || 0}条至${source.sourceCutoff}`
  const sourceRule = source.dailyWeightMode
    ? `采用${counts.sourceMonthlyRows || 0}条月行作为总量，逐日数值按策略和指标作权重拆分；${counts.dailyOnlyStrategies || 0}条无月行策略按可加日报汇总；日数据为模拟分摊，不代表实际逐日业绩`
    : `月度优先采用Excel月行，缺月策略按日报汇总可加指标；月行与日报有${mismatch || 0}项指标差异，页面分别按来源展示`
  return [history, oldDaily, `${supplement}；${sourceRule}`].filter(Boolean).join('；') + '。'
}

// Baseline data stays queryable for comparison; presentation starts at the declared simulation month.
export function visibleSimulationTrend(query, trend, valueKey = 'values', strategyId = '') {
  const audienceSource = keyAudienceSource(query)
  const source = audienceSource || [decline, provenance, incremental, upgrade, stable].find(p => query.tabType === p.tabType && query.cityId === p.cityId &&
    (query.strategyClass === p.strategyClass || (p.dailyStrategyIds || []).includes(strategyId)))
  if (!source || !source.baselineMonth || !Array.isArray(trend.months)) return trend
  const [year, endMonth] = query.statMonth.split('-').map(Number)
  const indexes = trend.months.reduce((result, label, index) => {
    const raw = String(label)
    const m = raw.match(/^(\d{4})-(\d{2})/) || raw.match(/^(\d{4})(\d{2})$/)
    const n = Number(raw.replace('月', ''))
    const month = m ? `${m[1]}-${m[2]}` : `${n > endMonth ? year - 1 : year}-${String(n).padStart(2, '0')}`
    if (month >= source.startMonth) result.push(index)
    return result
  }, [])
  return { ...trend, months: indexes.map(i => trend.months[i]),
    [valueKey]: indexes.map(i => (trend[valueKey] || [])[i]), qoq: indexes.map(i => (trend.qoq || [])[i]) }
}
