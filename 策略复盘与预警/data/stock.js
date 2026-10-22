/* 存量策略页专属数据 · 原型 mock
 * 来源：用户需求规格（5 分类筛选按钮 全部/升接/稳/降拆/离、图表1 指标块+漏斗、柱线组合图 维度/周期、
 *       预警策略严重程度）。模块二/四的数据取自 overview.js / detail.js，本文件不再重复。
 * 硬事实取自现有系统截图 页面1~3.png 与 策略评估.xlsx；截图未覆盖处按同口径 mock（行内标 [mock]）。
 * envelope：{ code, message, data }
 * 上线交接：换成 GET /api/strategy/stock 的返回体即可（结构不变）。
 */
window.__PROTO_DATA__ = window.__PROTO_DATA__ || {};
window.__PROTO_DATA__.stock = {
  code: 0,
  message: 'ok',
  data: {
    // ── 5 个分类筛选按钮（横向排列；与触点下拉级联）〔R02/R03〕──────
    categories: ['全部', '升接', '稳', '降拆', '离'],

    // ── 柱状图：趋势指标导航（11 项，与左栏指标块一一对应；已移除维度/周期下拉）〔R07/R09/R10〕
    metricDims: [
      { key: 'strategyCount', label: '策略数' },
      { key: 'capacity',      label: '产能' },
      { key: 'revenue',       label: '收入' },
      { key: 'audience',      label: '客群' },
      { key: 'push',          label: '推送量' },
      { key: 'use',           label: '使用量' },
      { key: 'reach',         label: '触达量' },
      { key: 'convert',       label: '转化量' },
      { key: 'useRate',       label: '使用率' },
      { key: 'reachRate',     label: '触达率' },
      { key: 'convertRate',   label: '转化率' }
    ],
    // 统计周期固定近 12 个月（移除周期下拉）〔R10〕
    months: ['11月', '12月', '01月', '02月', '03月', '04月', '05月', '06月', '07月', '08月', '09月', '10月'],
    // 各维度 12 个月柱值（末月与概览口径一致）＋环比线；rateKeys 为百分比类指标（不随分类/触点缩放）
    rateKeys: ['useRate', 'reachRate', 'convertRate'],
    trends: {
      strategyCount: { bars: [1120, 1085, 1310, 1240, 1180, 1362, 1298, 1204, 1282, 1159, 1039, 961], line: [1.2, -3.1, 20.7, -5.3, -4.8, 15.4, -4.7, -7.2, 6.5, -9.6, -10.4, -1.9] },
      capacity:      { bars: [5600, 5480, 6120, 5900, 5680, 6350, 6020, 5760, 5980, 5610, 6410, 6200], line: [1.0, -2.1, 11.7, -3.6, -3.7, 11.8, -5.2, -4.3, 3.8, -6.2, 14.3, -3.3] },
      revenue:       { bars: [92.5, 90.1, 102.3, 98.4, 95.2, 108.6, 101.2, 96.8, 99.5, 94.1, 112.4, 104.43], line: [1.3, -2.6, 13.5, -3.8, -3.3, 14.1, -6.8, -4.3, 2.8, -5.4, 19.4, -7.1] },
      audience:      { bars: [812.4, 806.2, 845.6, 833.1, 820.5, 869.3, 851.2, 838.4, 856.7, 829.3, 878.9, 863.2], line: [0.7, -0.8, 4.9, -1.5, -1.5, 5.9, -2.1, -1.5, 2.2, -3.2, 6.0, -1.8] },
      push:          { bars: [1450, 1390, 1610, 1520, 1480, 1690, 1580, 1512, 1560, 1470, 1620, 1523], line: [0.8, -4.1, 15.8, -5.6, -2.6, 14.2, -6.5, -4.3, 3.2, -5.8, 10.2, -6.0] },
      use:           { bars: [520, 505, 580, 540, 560, 610, 575, 548, 566, 531, 572, 552], line: [1.1, -2.9, 14.9, -6.9, 3.7, 8.9, -5.7, -4.7, 3.3, -6.2, 7.7, -3.5] },
      reach:         { bars: [118, 112, 131, 126, 120, 140, 133, 121, 129, 117, 147, 126], line: [0.9, -5.1, 17.0, -3.8, -4.8, 16.7, -5.0, -9.0, 6.6, -9.3, 25.6, -14.3] },
      convert:       { bars: [14.1, 13.6, 15.8, 15.0, 14.4, 16.9, 15.6, 14.2, 15.1, 13.9, 16.8, 15.1], line: [1.4, -3.5, 16.2, -5.1, -4.0, 17.4, -7.7, -9.0, 6.3, -7.9, 20.9, -10.1] },
      useRate:       { bars: [34.9, 34.6, 37.1, 36.4, 35.6, 38.2, 36.9, 35.8, 37.0, 35.2, 38.6, 36.23], line: [0.4, -0.9, 7.2, -1.9, -2.2, 7.3, -3.4, -3.0, 3.4, -4.9, 9.7, -6.1] },
      reachRate:     { bars: [23.5, 23.1, 24.8, 24.1, 23.4, 25.6, 24.3, 23.0, 24.2, 22.9, 26.1, 22.78], line: [0.5, -1.7, 7.4, -2.8, -2.9, 9.4, -5.1, -5.3, 5.2, -5.4, 14.0, -12.7] },
      convertRate:   { bars: [11.4, 11.2, 12.1, 11.8, 11.5, 12.6, 12.0, 11.5, 11.9, 11.3, 13.0, 11.97], line: [0.6, -1.8, 8.0, -2.5, -2.5, 9.6, -4.8, -4.2, 3.5, -5.0, 15.0, -7.9] }
    },

    // 触点级联系数 [mock]：分类 × 触点组合实时刷新时用于按触点缩放（1 = 全部渠道原值）
    touchFactors: { '全部渠道': 1, '热线-瞬时': 1.12, '商机团队': 0.86, '热线-外呼': 0.78, '工作号服务平台': 1.24 },
    // 分类级联系数 [mock]：全局分类筛选时用于缩放趋势（1 = 全部；按各分类推送量占比近似）
    catFactors: { '全部': 1, '升接': 0.288, '稳': 0.264, '降拆': 0.196, '离': 0.252 },

    // ── 指标快照（按分类；供「策略整体情况」左栏 = 表格1.png 指标块）〔R07〕──
    // 每项 key 对应 表格1.png 的 11 个指标；「产能」「客群」原系统未见 → [mock]
    // 分组（供左栏三段式布局）：left 左指标块 ｜ mid 中部指标块 ｜ rate 右率值块
    metricGroups: {
      left: ['strategyCount', 'capacity', 'revenue'],
      mid:  ['audience', 'push', 'use', 'reach', 'convert'],
      rate: ['useRate', 'reachRate', 'convertRate']
    },
    byCategory: {
      '全部': [
        { key: 'strategyCount', label: '策略数', value: 961,     unit: '个',   ring: '−1.94%',  ringDir: 'down' },
        { key: 'capacity',      label: '产能',   value: 620,    unit: '万',   ring: '+3.2%',   ringDir: 'up'   },
        { key: 'revenue',       label: '收入',   value: 104,  unit: '万', ring: '−6.6%',   ringDir: 'down' },
        { key: 'audience',      label: '客群',   value: 863.2,   unit: '万',   ring: '+1.4%',   ringDir: 'up'   },
        { key: 'push',          label: '推送量', value: 1523.07, unit: '万',   ring: '−35.14%', ringDir: 'down' },
        { key: 'use',           label: '使用量', value: 551.85,  unit: '万',   ring: '−2.26%',  ringDir: 'down' },
        { key: 'reach',         label: '触达量', value: 125.72,  unit: '万',   ring: '−14.95%', ringDir: 'down' },
        { key: 'convert',       label: '转化量', value: 15.05,   unit: '万',   ring: '−10.31%', ringDir: 'down' },
        { key: 'useRate',       label: '使用率', value: 36.23,   unit: '%',    ring: '+2.1%',   ringDir: 'up'   },
        { key: 'reachRate',     label: '触达率', value: 22.78,   unit: '%',    ring: '−3.4%',   ringDir: 'down' },
        { key: 'convertRate',   label: '转化率', value: 11.97,   unit: '%',    ring: '+0.62%',  ringDir: 'up'   }
      ],
      '升接': [
        { key: 'strategyCount', label: '策略数', value: 326,     unit: '个',   ring: '+2.7%',   ringDir: 'up'   },
        { key: 'capacity',      label: '产能',   value: 1850,    unit: '万',   ring: '+4.1%',   ringDir: 'up'   },
        { key: 'revenue',       label: '收入',   value: 37.15,   unit: '万元', ring: '+3.1%',   ringDir: 'up'   },
        { key: 'audience',      label: '客群',   value: 246.5,   unit: '万',   ring: '+2.2%',   ringDir: 'up'   },
        { key: 'push',          label: '推送量', value: 438.66,  unit: '万',   ring: '+8.3%',   ringDir: 'up'   },
        { key: 'use',           label: '使用量', value: 182.41,  unit: '万',   ring: '+6.9%',   ringDir: 'up'   },
        { key: 'reach',         label: '触达量', value: 41.28,   unit: '万',   ring: '+3.4%',   ringDir: 'up'   },
        { key: 'convert',       label: '转化量', value: 5.42,    unit: '万',   ring: '+1.9%',   ringDir: 'up'   },
        { key: 'useRate',       label: '使用率', value: 41.58,   unit: '%',    ring: '+1.1%',   ringDir: 'up'   },
        { key: 'reachRate',     label: '触达率', value: 22.63,   unit: '%',    ring: '+0.8%',   ringDir: 'up'   },
        { key: 'convertRate',   label: '转化率', value: 13.13,   unit: '%',    ring: '+0.31%',  ringDir: 'up'   }
      ],
      '稳': [
        { key: 'strategyCount', label: '策略数', value: 248,     unit: '个',   ring: '−0.8%',   ringDir: 'down' },
        { key: 'capacity',      label: '产能',   value: 1520,    unit: '万',   ring: '−1.9%',   ringDir: 'down' },
        { key: 'revenue',       label: '收入',   value: 26.88,   unit: '万元', ring: '−2.7%',   ringDir: 'down' },
        { key: 'audience',      label: '客群',   value: 208.9,   unit: '万',   ring: '−0.6%',   ringDir: 'down' },
        { key: 'push',          label: '推送量', value: 402.19,  unit: '万',   ring: '−4.2%',   ringDir: 'down' },
        { key: 'use',           label: '使用量', value: 151.07,  unit: '万',   ring: '−1.6%',   ringDir: 'down' },
        { key: 'reach',         label: '触达量', value: 33.64,   unit: '万',   ring: '−6.1%',   ringDir: 'down' },
        { key: 'convert',       label: '转化量', value: 3.68,    unit: '万',   ring: '−3.9%',   ringDir: 'down' },
        { key: 'useRate',       label: '使用率', value: 37.56,   unit: '%',    ring: '+0.4%',   ringDir: 'up'   },
        { key: 'reachRate',     label: '触达率', value: 22.27,   unit: '%',    ring: '−2.1%',   ringDir: 'down' },
        { key: 'convertRate',   label: '转化率', value: 10.94,   unit: '%',    ring: '+0.18%',  ringDir: 'up'   }
      ],
      '降拆': [
        { key: 'strategyCount', label: '策略数', value: 212,     unit: '个',   ring: '−3.5%',   ringDir: 'down' },
        { key: 'capacity',      label: '产能',   value: 1140,    unit: '万',   ring: '−6.4%',   ringDir: 'down' },
        { key: 'revenue',       label: '收入',   value: 17.06,   unit: '万元', ring: '−14.3%',  ringDir: 'down' },
        { key: 'audience',      label: '客群',   value: 151.3,   unit: '万',   ring: '−5.2%',   ringDir: 'down' },
        { key: 'push',          label: '推送量', value: 298.54,  unit: '万',   ring: '−12.7%',  ringDir: 'down' },
        { key: 'use',           label: '使用量', value: 98.32,   unit: '万',   ring: '−9.4%',   ringDir: 'down' },
        { key: 'reach',         label: '触达量', value: 21.47,   unit: '万',   ring: '−15.2%',  ringDir: 'down' },
        { key: 'convert',       label: '转化量', value: 2.31,    unit: '万',   ring: '−18.6%',  ringDir: 'down' },
        { key: 'useRate',       label: '使用率', value: 32.93,   unit: '%',    ring: '−1.4%',   ringDir: 'down' },
        { key: 'reachRate',     label: '触达率', value: 21.84,   unit: '%',    ring: '−3.2%',   ringDir: 'down' },
        { key: 'convertRate',   label: '转化率', value: 10.76,   unit: '%',    ring: '−1.07%',  ringDir: 'down' }
      ],
      '离': [
        { key: 'strategyCount', label: '策略数', value: 175,     unit: '个',   ring: '−5.1%',   ringDir: 'down' },
        { key: 'capacity',      label: '产能',   value: 1690,    unit: '万',   ring: '−2.8%',   ringDir: 'down' },
        { key: 'revenue',       label: '收入',   value: 23.34,   unit: '万元', ring: '−4.9%',   ringDir: 'down' },
        { key: 'audience',      label: '客群',   value: 256.5,   unit: '万',   ring: '−2.4%',   ringDir: 'down' },
        { key: 'push',          label: '推送量', value: 383.68,  unit: '万',   ring: '−9.8%',   ringDir: 'down' },
        { key: 'use',           label: '使用量', value: 120.05,  unit: '万',   ring: '−7.3%',   ringDir: 'down' },
        { key: 'reach',         label: '触达量', value: 29.33,   unit: '万',   ring: '−12.4%',  ringDir: 'down' },
        { key: 'convert',       label: '转化量', value: 3.64,    unit: '万',   ring: '−6.2%',   ringDir: 'down' },
        { key: 'useRate',       label: '使用率', value: 31.29,   unit: '%',    ring: '+0.9%',   ringDir: 'up'   },
        { key: 'reachRate',     label: '触达率', value: 24.43,   unit: '%',    ring: '−2.6%',   ringDir: 'down' },
        { key: 'convertRate',   label: '转化率', value: 12.41,   unit: '%',    ring: '+1.24%',  ringDir: 'up'   }
      ]
    },
    // 指标漏斗（按分类；顺序即漏斗层级：推送量 → 使用量 → 触达量 → 转化量；单位 万户）
    funnelByCategory: {
      '全部': [{ label: '推送量', value: 1523.07 }, { label: '使用量', value: 551.85 }, { label: '触达量', value: 125.72 }, { label: '转化量', value: 15.05 }],
      '升接': [{ label: '推送量', value: 438.66 }, { label: '使用量', value: 182.41 }, { label: '触达量', value: 41.28 }, { label: '转化量', value: 5.42 }],
      '稳':   [{ label: '推送量', value: 402.19 }, { label: '使用量', value: 151.07 }, { label: '触达量', value: 33.64 }, { label: '转化量', value: 3.68 }],
      '降拆': [{ label: '推送量', value: 298.54 }, { label: '使用量', value: 98.32 },  { label: '触达量', value: 21.47 }, { label: '转化量', value: 2.31 }],
      '离':   [{ label: '推送量', value: 383.68 }, { label: '使用量', value: 120.05 }, { label: '触达量', value: 29.33 }, { label: '转化量', value: 3.64 }]
    },

    // ── 预警策略查看（模块三右栏；列头 100% 对齐 页面4.png，已删除「严重程度」列）〔R15/R28〕──
    // 页面4 该表为空（暂无数据）；此处填 mock 行用于演示勾选/全屏（行内标 [mock]）。
    // 全局分类筛选：各行带 cat 字段（升接/稳/降拆/离）；触点沿用 touch 字段。
    alertStrategies: {
      columns: [
        { key: 'date',       label: '日期',         type: 'text' },
        { key: 'touch',      label: '触点',         type: 'tag' },
        { key: 'strategyCat', label: '策略分类',    type: 'text' },
        { key: 'big',        label: '策略大类',     type: 'text' },
        { key: 'sub',        label: '策略小类',     type: 'text' },
        { key: 'name',       label: '策略名称',     type: 'text' },
        { key: 'push',       label: '推送量',       type: 'num' },
        { key: 'use',        label: '使用量',       type: 'num' },
        { key: 'useRate',    label: '使用率',       type: 'num' },
        { key: 'reach',      label: '触达量',       type: 'num' },
        { key: 'targetConv', label: '目标转化量',   type: 'num' },
        { key: 'targetRate', label: '目标转化率',   type: 'num' },
        { key: 'allConv',    label: '全产品转化量', type: 'num' },
        { key: 'allRate',    label: '全产品转化率', type: 'num' },
        { key: 'expRevenue', label: '预期收入(元)', type: 'num' },
        { key: 'actRevenue', label: '实际收入(元)', type: 'num' }
      ],
      rows: [
        { cat: '升接', date: '202610', touch: '热线-外呼', strategyCat: 'test111', big: '升档',   sub: '套餐升档',          name: '升档运营智能触发-优质',        push: '286,277', use: '220,177', useRate: '76.91', reach: '70,439', targetConv: '7,320', targetRate: '3.32',  allConv: '61,200', allRate: '27.79', expRevenue: '1,024.60', actRevenue: '986.42' },
        { cat: '升接', date: '202610', touch: '热线-瞬时', strategyCat: '093022', big: '升档',   sub: '套餐升档',          name: '手厅客户咨询合适的套餐（商）', push: '165,976', use: '165,324', useRate: '99.61', reach: '107,026', targetConv: '6,942', targetRate: '6.49',  allConv: '74,812', allRate: '45.06', expRevenue: '812.30', actRevenue: '795.18' },
        { cat: '稳',   date: '202610', touch: '热线-瞬时', strategyCat: '低效策略', big: '接盘',   sub: '模组/关怀包至福包', name: '模组接盘福包即将到期场景-福包', push: '133,965', use: '57,490',  useRate: '42.91', reach: '21,736', targetConv: '3,965', targetRate: '18.24', allConv: '19,011', allRate: '33.07', expRevenue: '268.44', actRevenue: '259.07' },
        { cat: '降拆', date: '202610', touch: '商机团队', strategyCat: 'test0929', big: '其他',   sub: '其他',              name: '会员权益到期提醒',            push: '21,739',  use: '20,373',  useRate: '93.72', reach: '12,885', targetConv: '1,281', targetRate: '9.94',  allConv: '16,423', allRate: '80.64', expRevenue: '96.72',  actRevenue: '88.31' },
        { cat: '离',   date: '202610', touch: '热线-瞬时', strategyCat: '1122', big: '升档',   sub: '套餐升档',          name: '高饱和客群升10元',            push: '86,276',  use: '82,494',  useRate: '95.61', reach: '27,360', targetConv: '2,018', targetRate: '7.38',  allConv: '12,458', allRate: '45.53', expRevenue: '54.21',  actRevenue: '51.86' }
      ],
      total: 5,
      size: 10
    }
  }
};