/**
 * 策略整体情况 StrategyOverview —— 趋势图
 * 复刻自 StrategyOverview.vue 的 chartOption（双 Y 轴：柱状图 + 环比折线），
 * 数据为写死的 9 条随机策略数据（推送量千万级，环比含 +475% 极端值）。
 * 依赖：全局 echarts（页面先加载 lib/echarts.min.js）
 */
(function () {
  function render () {
    var chartEl = document.getElementById('chart-overview-trend')
    if (!chartEl || typeof echarts === 'undefined') return

    var activeMetric = '推送量'
    var unit = '次'

    // 9 条随机策略数据
    var strategyNames = ['流失预警唤回', '高价值客户续约', '沉默用户唤醒', '合约到期挽留', '新客首购转化', '流量包升档推荐', '5G套餐升级', '宽带融合礼包', '权益积分推送']
    var values = [17280000, 15364200, 12856400, 11032800, 9675000, 8412600, 6538200, 5124800, 3986500]
    var qoq = [12.0, 8.6, -8.5, 475.0, 23.6, -15.2, 9.8, 31.4, -5.6]

    // 千分位格式化
    function fmtNum (val) {
      return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    // 万级紧凑格式（柱内标签/坐标轴用，避免长数字溢出）
    function fmtWan (val) {
      return fmtNum(Math.round(val / 10000)) + '万'
    }

    // 柱状图Y轴自然范围
    var barMax = Math.max.apply(null, values) * 1.12

    // 环比Y轴：按数据实际范围自适应，上下各留25%标签余量，0必须在区间内
    var qoqMax = Math.max.apply(null, [0].concat(qoq))
    var qoqMin = Math.min.apply(null, [0].concat(qoq))
    var qoqPadding = Math.max(8, (qoqMax - qoqMin) * 0.25)
    var rightMax = qoqMax + qoqPadding
    var rightMin = qoqMin - qoqPadding

    var chart = echarts.init(chartEl, null, { renderer: 'svg' })

    var option = {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#374151', fontSize: 12 },
        formatter: function (params) {
          var idx = params[0].dataIndex
          var html = '<div style="font-weight:500;margin-bottom:4px;">' + strategyNames[idx] + '</div>'
          params.forEach(function (p) {
            var val = p.seriesName === '环比' ? p.value.toFixed(1) + '%' : fmtNum(p.value) + unit
            html += '<div style="display:flex;justify-content:space-between;gap:16px;"><span>' + p.marker + p.seriesName + '</span><span style="font-weight:600;">' + val + '</span></div>'
          })
          return html
        }
      },
      legend: { show: false },
      grid: { left: 40, right: 50, bottom: 24, top: 40, containLabel: false },
      xAxis: {
        type: 'category',
        data: strategyNames,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#9ca3af', fontSize: 11, interval: 0 },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          name: activeMetric,
          nameTextStyle: { color: '#9ca3af', fontSize: 10, padding: [0, 30, 0, 0] },
          max: barMax,
          axisLine: { show: false },
          axisLabel: {
            color: '#9ca3af',
            fontSize: 10,
            formatter: function (val) {
              return fmtWan(val)
            }
          },
          splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }
        },
        {
          type: 'value',
          name: '环比',
          nameTextStyle: { color: '#9ca3af', fontSize: 10, padding: [0, 0, 0, 10] },
          axisLine: { show: false },
          axisLabel: { color: '#9ca3af', fontSize: 10, formatter: '{value}%' },
          splitLine: { show: false },
          min: rightMin,
          max: rightMax
        }
      ],
      series: [
        {
          name: activeMetric,
          type: 'bar',
          data: values,
          itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
          barWidth: '40%',
          label: {
            show: true,
            position: 'top',
            distance: 6,
            color: '#475569',
            fontSize: 10,
            formatter: function (p) {
              return fmtWan(p.value)
            }
          }
        },
        {
          name: '环比',
          type: 'line',
          yAxisIndex: 1,
          data: qoq,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: '#0ea5e9', width: 2 },
          itemStyle: { color: '#0ea5e9', borderWidth: 2, borderColor: '#fff' },
          label: {
            show: true,
            position: 'top',
            distance: 8,
            color: '#0369a1',
            fontSize: 10,
            fontWeight: 600,
            // 白色描边：标签落在蓝色柱子上时依然清晰可读
            textBorderColor: '#fff',
            textBorderWidth: 3,
            formatter: function (p) {
              return (p.value >= 0 ? '+' : '') + p.value.toFixed(1) + '%'
            }
          },
          // 所有环比点都显示具体数值，不因标签接近而自动隐藏。
          labelLayout: { hideOverlap: false }
        }
      ]
    }

    chart.setOption(option)

    // 防抖 resize（与组件内 EChart 包装行为一致）
    var resizeTimer = null
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(function () { chart.resize() }, 150)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render)
  } else {
    render()
  }
})()
