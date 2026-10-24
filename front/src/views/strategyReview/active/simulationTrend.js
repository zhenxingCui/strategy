import provenance from './leaveSimulation.json'
import incremental from './incrementalSimulation.json'
import decline from './declineSimulation.json'

// Baseline data stays queryable for comparison; presentation starts at the declared simulation month.
export function visibleSimulationTrend(query, trend, valueKey = 'values', strategyId = '') {
  const source = [decline, provenance, incremental].find(p => query.tabType === p.tabType && query.cityId === p.cityId &&
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
