// Product labels for local demonstration data only; real assignments come from the data provider.
module.exports = function productForStrategy(name) {
  if (/宽带/.test(name)) return '宽带'
  if (/权益/.test(name)) return '会员权益'
  if (/家庭|融合|副卡/.test(name)) return '家庭融合'
  if (/套餐|合约/.test(name)) return '移动套餐'
  return '服务保障'
}
