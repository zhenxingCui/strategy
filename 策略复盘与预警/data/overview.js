/* 概览（主动策略）数据 · 原型 mock
 * 来源：现有系统截图 页面1/2.png 逐项抄录；截图未覆盖的行/字段按同口径 mock（行内注释标 [mock]）。
 * envelope：{ code, message, data }
 * 上线交接：把本文件换成 GET /api/strategy/overview 的返回体即可（结构不变）。
 */
window.__PROTO_DATA__ = window.__PROTO_DATA__ || {};
window.__PROTO_DATA__.overview = {
  code: 0,
  message: 'ok',
  data: {
    // ── 策略整体情况：7 张 KPI 卡（截图 页面1 顶部）──────────────
    kpi: [
      { key: 'strategyCount', label: '策略数',   value: '961',     unit: '个',   icon: 'layers',      ring: '−1.94%',  ringDir: 'down', yoy: '+0%', yoyDir: 'up', active: true },
      { key: 'push',          label: '推送量',   value: '1523.07', unit: '万户', icon: 'send',        ring: '−35.14%', ringDir: 'down', yoy: '+0%', yoyDir: 'up' },
      { key: 'use',           label: '使用量',   value: '551.85',  unit: '万户', icon: 'check-circle',ring: '−2.26%',  ringDir: 'down', yoy: '+0%', yoyDir: 'up' },
      { key: 'reach',         label: '触达量',   value: '125.72',  unit: '万户', icon: 'eye',         ring: '−14.95%', ringDir: 'down', yoy: '+0%', yoyDir: 'up' },
      { key: 'convert',       label: '转化量',   value: '15.05',   unit: '万户', icon: 'trending-up', ring: '−10.31%', ringDir: 'down', yoy: '+0%', yoyDir: 'up' },
      { key: 'convertRate',   label: '转化率',   value: '11.97',   unit: '%',    icon: 'database',    ring: '+0.62%',  ringDir: 'up',   yoy: '+0%', yoyDir: 'up' },
      { key: 'revenue',       label: '转收',     value: '104.43',  unit: '万元', icon: 'banknote',    ring: '−6.6%',   ringDir: 'down', yoy: '+0%', yoyDir: 'up' }
    ],
    // 策略整体情况的 5 个漏斗指标按钮（推送量→使用量→触达量→转化量 + 策略数）
    funnel: [
      { key: 'strategyCount', label: '策略数' },
      { key: 'push',          label: '推送量' },
      { key: 'use',           label: '使用量' },
      { key: 'reach',         label: '触达量' },
      { key: 'convert',       label: '转化量' }
    ],
    // 策略数(柱) + 环比(线) 组合图（截图 页面1；柱值抄录，环比线为 mock）
    strategyTrend: {
      categories: ['08月', '09月', '10月'],
      bars: [1282, 1159, 1039],
      barLabel: '策略数',
      line: [2.9, -9.6, -10.4],
      lineLabel: '环比'
    },
    // ── 触点执行（截图 页面2 左上）────────────────────────────
    touchExec: {
      columns: [
        { key: 'touch',      label: '触点渠道',     type: 'tag' },
        { key: 'strategy',   label: '策略量',       type: 'metric' },
        { key: 'push',       label: '推送量',       type: 'metric' },
        { key: 'use',        label: '使用量',       type: 'metric' },
        { key: 'useRate',    label: '使用率',       type: 'metric' },
        { key: 'reach',      label: '触达量',       type: 'metric' },
        { key: 'targetConv', label: '目标转化量',   type: 'metric' },
        { key: 'targetRate', label: '目标转化率',   type: 'metric' },
        { key: 'allConv',    label: '全产品转化量', type: 'metric' },
        { key: 'allRate',    label: '全产品转化率', type: 'metric' }
      ],
      rows: [
        { touch: '热线-瞬时', strategy: { v: '184', d: '+8.9%', dir: 'up' }, push: { v: '5,682,663', d: '−14.7%', dir: 'down' }, use: { v: '3,483,509', d: '+18.6%', dir: 'up' }, useRate: { v: '61.3', d: '+17.2%', dir: 'up' }, reach: { v: '618,260', d: '−3.5%', dir: 'down' }, targetConv: { v: '40,174', d: '−4.8%', dir: 'down' }, targetRate: { v: '6.5', d: '−0.1%', dir: 'down' }, allConv: { v: '69,942', d: '−3.5%', dir: 'down' }, allRate: { v: '3.22', d: '+0.4%', dir: 'up' } },
        { touch: '商机团队', strategy: { v: '420', d: '−3.9%', dir: 'down' }, push: { v: '3,019,074', d: '+20.9%', dir: 'up' }, use: { v: '623,859', d: '−34.4%', dir: 'down' }, useRate: { v: '20.66', d: '−17.4%', dir: 'down' }, reach: { v: '194,572', d: '−34.9%', dir: 'down' }, targetConv: { v: '9,405', d: '−29.9%', dir: 'down' }, targetRate: { v: '4.83', d: '+0.3%', dir: 'up' }, allConv: { v: '36,188', d: '−29.0%', dir: 'down' }, allRate: { v: '4.55', d: '−22.8%', dir: 'down' } },
        { touch: '热线-外呼', strategy: { v: '61', d: '−14.1%', dir: 'down' }, push: { v: '1,169,926', d: '−51.5%', dir: 'down' }, use: { v: '875,138', d: '−32.1%', dir: 'down' }, useRate: { v: '74.8', d: '+21.3%', dir: 'up' }, reach: { v: '265,903', d: '−16.7%', dir: 'down' }, targetConv: { v: '16,246', d: '−18.3%', dir: 'down' }, targetRate: { v: '6.11', d: '−0.1%', dir: 'down' }, allConv: { v: '22,829', d: '+9.4%', dir: 'up' }, allRate: { v: '8.61', d: '+37.1%', dir: 'up' } },
        { touch: '工作号服务平台', strategy: { v: '299', d: '+1.7%', dir: 'up' }, push: { v: '5,359,041', d: '+58.0%', dir: 'up' }, use: { v: '536,017', d: '+14.6%', dir: 'up' }, useRate: { v: '10', d: '−3.8%', dir: 'down' }, reach: { v: '178,497', d: '−18.6%', dir: 'down' }, targetConv: { v: '11,875', d: '−15.0%', dir: 'down' }, targetRate: { v: '6.65', d: '+0.3%', dir: 'up' }, allConv: { v: '21,546', d: '−8.4%', dir: 'down' }, allRate: { v: '12.07', d: '+19.9%', dir: 'up' } }
      ],
      summary: { touch: '合计', strategy: { v: '961' }, push: { v: '15,230,704' }, use: { v: '5,518,523' }, useRate: { v: '36.23' }, reach: { v: '1,257,232' }, targetConv: { v: '77,700' }, targetRate: { v: '6.18' }, allConv: { v: '150,505' }, allRate: { v: '4.95' } }
    },
    // ── 策略分类执行情况（截图 页面1/2 右上）共 33 条 ────────────
    categoryExec: {
      columns: [
        { key: 'big',        label: '策略大类',     type: 'link' },
        { key: 'sub',        label: '策略小类',     type: 'link' },
        { key: 'strategy',   label: '策略量',       type: 'metric' },
        { key: 'push',       label: '推送量',       type: 'metric' },
        { key: 'use',        label: '使用量',       type: 'metric' },
        { key: 'useRate',    label: '使用率',       type: 'metric' },
        { key: 'reach',      label: '触达量',       type: 'metric' },
        { key: 'targetConv', label: '目标转化量',   type: 'metric' },
        { key: 'targetRate', label: '目标转化率',   type: 'metric' },
        { key: 'allConv',    label: '全产品转化量', type: 'metric' }
      ],
      filters: {
        months: ['2026-10', '2026-09', '2026-08'],
        bigs: ['升档', '其他', '风险修复', '接盘'],
        subs: ['套餐升档', '其他', '中高端风险修复', '模组焕新', '流量包', '模组/关怀包至福包', '到期接盘'],
        touches: ['热线-瞬时', '商机团队', '热线-外呼', '工作号服务平台']
      },
      rows: [
        { cat: '升接', touch: '热线-瞬时', big: '升档',   sub: '套餐升档',       strategy: { v: '265', d: '−5.8%', dir: 'down' }, push: { v: '4,288,804', d: '−17.2%', dir: 'down' }, use: { v: '2,141,671', d: '−17.2%', dir: 'down' }, useRate: { v: '49.94', d: '−6.8%', dir: 'down' }, reach: { v: '672,457', d: '−15.5%', dir: 'down' }, targetConv: { v: '41,697', d: '+0.9%', dir: 'up' }, targetRate: { v: '6.2', d: '+1.0%', dir: 'up' }, allConv: { v: '74,812', d: '−2.3%', dir: 'down' } },
        { cat: '降拆', touch: '商机团队', big: '其他',   sub: '其他',           strategy: { v: '187', d: '−56.7%', dir: 'down' }, push: { v: '5,950,995', d: '+51.2%', dir: 'up' }, use: { v: '1,923,102', d: '+51.2%', dir: 'up' }, useRate: { v: '32.32', d: '+23.1%', dir: 'up' }, reach: { v: '111,676', d: '+36.5%', dir: 'up' }, targetConv: { v: '0', d: '+0.0%', dir: 'up' }, targetRate: { v: '0', d: '+0.0%', dir: 'up' }, allConv: { v: '12,504', d: '+19.0%', dir: 'up' } },
        { cat: '稳',   touch: '热线-外呼', big: '风险修复', sub: '中高端风险修复', strategy: { v: '118', d: '+0.5%', dir: 'up' }, push: { v: '1,296,396', d: '−18.9%', dir: 'down' }, use: { v: '467,085', d: '−18.9%', dir: 'down' }, useRate: { v: '36.03', d: '−8.6%', dir: 'down' }, reach: { v: '138,025', d: '−28.3%', dir: 'down' }, targetConv: { v: '9,720', d: '−19.1%', dir: 'down' }, targetRate: { v: '7.04', d: '+0.8%', dir: 'up' }, allConv: { v: '14,269', d: '−20.5%', dir: 'down' } },
        // [mock] 以下 2 行按同口径补齐，凑足首屏 5 条（共 33 条）
        { cat: '升接', touch: '工作号服务平台', big: '升档',   sub: '模组焕新',       strategy: { v: '50', d: '+2.1%', dir: 'up' }, push: { v: '191,771', d: '−5.6%', dir: 'down' }, use: { v: '189,909', d: '−5.6%', dir: 'down' }, useRate: { v: '99.03', d: '+0.4%', dir: 'up' }, reach: { v: '54,222', d: '−7.2%', dir: 'down' }, targetConv: { v: '1,505', d: '+3.9%', dir: 'up' }, targetRate: { v: '2.78', d: '+0.6%', dir: 'up' }, allConv: { v: '6,204', d: '+1.4%', dir: 'up' } },
        { cat: '离',   touch: '热线-瞬时', big: '升档',   sub: '流量包',         strategy: { v: '60', d: '−1.2%', dir: 'down' }, push: { v: '160,963', d: '−8.9%', dir: 'down' }, use: { v: '158,655', d: '−8.9%', dir: 'down' }, useRate: { v: '98.57', d: '−0.3%', dir: 'down' }, reach: { v: '35,935', d: '−11.4%', dir: 'down' }, targetConv: { v: '610', d: '−6.7%', dir: 'down' }, targetRate: { v: '1.70', d: '+0.2%', dir: 'up' }, allConv: { v: '4,118', d: '−5.9%', dir: 'down' } }
      ],
      total: 33,
      size: 5
    },
    // 触点产能趋势（截图 页面2 左下）— 随全局触点切换刷新；分类级联系数 [mock]
    touchCapacity: {
      catFactors: { '全部': 1, '升接': 0.29, '稳': 0.26, '降拆': 0.20, '离': 0.25 },
      byTouch: {
        '全部渠道':   { categories: ['8月', '9月', '10月'], bars: [9860, 9420, 6180], line: [0, -4.5, -34.4] },
        '热线-瞬时':  { categories: ['8月', '9月', '10月'], bars: [3620, 3510, 3180], line: [0, -3.0, -9.4] },
        '商机团队':   { categories: ['8月', '9月', '10月'], bars: [2660, 2480, 1520], line: [0, -6.8, -38.7] },
        '热线-外呼':  { categories: ['8月', '9月', '10月'], bars: [1420, 1560, 640],  line: [0, 9.9, -59.0] },
        '工作号服务平台': { categories: ['8月', '9月', '10月'], bars: [3420, 3610, 4790], line: [0, 5.6, 32.7] }
      }
    },
    // ── 业务产能明细（截图 页面2 中下）共 15 条 ─────────────────
    bizCapacity: {
      columns: [
        { key: 'biz',  label: '业务', type: 'text' },
        { key: 'cap',  label: '产能', type: 'num' },
        { key: 'ring', label: '环比', type: 'delta' }
      ],
      rows: [
        { cat: '升接', biz: '套餐焕新',    cap: '69017', ring: '−5.2%',  dir: 'down' },
        { cat: '升接', biz: '会员权益',    cap: '31899', ring: '−6.0%',  dir: 'down' },
        { cat: '稳',   biz: '中视频现有',  cap: '16529', ring: '−22.1%', dir: 'down' },
        { cat: '降拆', biz: '裸盈拉新',    cap: '13195', ring: '−21.4%', dir: 'down' },
        { cat: '降拆', biz: '裸盈拉新',    cap: '11031', ring: '−9.9%',  dir: 'down' },
        { cat: '稳',   biz: '异网双卡互营', cap: '2499', ring: '−21.3%', dir: 'down' },
        { cat: '离',   biz: '语音包',      cap: '1991',  ring: '−30.9%', dir: 'down' },
        { cat: '离',   biz: '常客常稀有',  cap: '1761',  ring: '−5.4%',  dir: 'down' },
        // [mock] 后 7 行按同口径补齐
        { cat: '升接', biz: '宽带新装',    cap: '1486',  ring: '−3.1%',  dir: 'down' },
        { cat: '升接', biz: '百G包',       cap: '1205',  ring: '+6.8%',  dir: 'up' },
        { cat: '稳',   biz: '全能包',      cap: '968',   ring: '−12.2%', dir: 'down' },
        { cat: '稳',   biz: '修复',        cap: '842',   ring: '+2.4%',  dir: 'up' },
        { cat: '离',   biz: '流量包',      cap: '736',   ring: '−8.9%',  dir: 'down' },
        { cat: '降拆', biz: '中高端保有',  cap: '615',   ring: '−4.5%',  dir: 'down' },
        { cat: '稳',   biz: '接盘运营',    cap: '512',   ring: '+11.3%', dir: 'up' }
      ],
      total: 15,
      size: 5
    },
    // ── 策略执行情况（截图 策略执行情况1.png）共 7947 条，每页 5 条 ─────
    // 第十一轮 R54：按新参考图恢复「渠道」列（tag 徽标，置于策略大类前）＋「选择月份」筛选；
    //   「渠道」列此前 R16 曾移除，本轮以最新参考图为权威恢复。
    strategyExec: {
      columns: [
        { key: 'touch',      label: '渠道',        type: 'tag' },
        { key: 'big',        label: '策略大类',    type: 'link' },
        { key: 'sub',        label: '策略小类',    type: 'link' },
        { key: 'name',       label: '策略名称',    type: 'detail' },
        { key: 'push',       label: '推送量',      type: 'metric' },
        { key: 'use',        label: '使用量',      type: 'metric' },
        { key: 'useRate',    label: '使用率',      type: 'metric' },
        { key: 'reach',      label: '触达量',      type: 'metric' },
        { key: 'targetConv', label: '目标转化量',  type: 'metric' },
        { key: 'targetRate', label: '目标转化率',  type: 'metric' },
        { key: 'allConv',    label: '全产品转化量', type: 'metric' },
        { key: 'allRate',    label: '全产品转化率', type: 'metric' }
      ],
      filters: {
        months: ['2026-10', '2026-09', '2026-08'],
        touches: ['热线-瞬时', '商机团队', '热线-外呼', '工作号服务平台'],
        bigs: ['升档', '其他', '风险修复', '接盘'],
        subs: ['套餐升档', '其他', '中高端风险修复', '模组/关怀包至福包']
      },
      rows: [
        { cat: '升接', touch: '热线-瞬时', big: '升档', sub: '套餐升档', name: '手厅客户咨询合适的套餐（商）', push: { v: '165,976', d: '−3.7%', dir: 'down' }, use: { v: '165,324', d: '−3.9%', dir: 'down' }, useRate: { v: '99.61', d: '−0.2%', dir: 'down' }, reach: { v: '107,026', d: '+2.2%', dir: 'up' }, targetConv: { v: '6,942', d: '+13.5%', dir: 'up' }, targetRate: { v: '6.49', d: '+1.2%', dir: 'up' }, allConv: { v: '74,812', d: '−2.3%', dir: 'down' }, allRate: { v: '45.06', d: '+0.8%', dir: 'up' } },
        { cat: '升接', touch: '热线-外呼', big: '升档', sub: '套餐升档', name: '升档运营智能触发-优质', push: { v: '286,277', d: '+11.6%', dir: 'up' }, use: { v: '220,177', d: '+22.3%', dir: 'up' }, useRate: { v: '76.91', d: '+6.7%', dir: 'up' }, reach: { v: '70,439', d: '+24.5%', dir: 'up' }, targetConv: { v: '7,320', d: '+54.8%', dir: 'up' }, targetRate: { v: '3.32', d: '+30.1%', dir: 'up' }, allConv: { v: '61,200', d: '−3.3%', dir: 'down' }, allRate: { v: '27.79', d: '+1.1%', dir: 'up' } },
        { cat: '稳',   touch: '热线-瞬时', big: '接盘', sub: '模组/关怀包至福包', name: '模组接盘福包即将到期场景-福包', push: { v: '133,965', d: '−15.7%', dir: 'down' }, use: { v: '57,490', d: '−20.5%', dir: 'down' }, useRate: { v: '42.91', d: '−2.6%', dir: 'down' }, reach: { v: '21,736', d: '−17.9%', dir: 'down' }, targetConv: { v: '3,965', d: '−4.7%', dir: 'down' }, targetRate: { v: '18.24', d: '+1.0%', dir: 'up' }, allConv: { v: '19,011', d: '−5.2%', dir: 'down' }, allRate: { v: '33.07', d: '+2.9%', dir: 'up' } },
        // [mock] 后 7 行按同口径补齐（第九轮：每页 12 条，扩充首屏样例以消除底部留白）
        { cat: '离',   touch: '热线-瞬时', big: '升档', sub: '套餐升档', name: '高饱和客群升10元', push: { v: '86,276', d: '−8.7%', dir: 'down' }, use: { v: '82,494', d: '−5.4%', dir: 'down' }, useRate: { v: '95.61', d: '−0.1%', dir: 'down' }, reach: { v: '27,360', d: '+6.2%', dir: 'up' }, targetConv: { v: '2,018', d: '+9.6%', dir: 'up' }, targetRate: { v: '7.38', d: '+0.4%', dir: 'up' }, allConv: { v: '12,458', d: '+1.7%', dir: 'up' }, allRate: { v: '45.53', d: '+0.6%', dir: 'up' } },
        { cat: '降拆', touch: '商机团队', big: '其他', sub: '其他', name: '会员权益到期提醒', push: { v: '21,739', d: '−12.4%', dir: 'down' }, use: { v: '20,373', d: '+8.4%', dir: 'up' }, useRate: { v: '93.72', d: '−0.4%', dir: 'down' }, reach: { v: '12,885', d: '+13.3%', dir: 'up' }, targetConv: { v: '1,281', d: '+27.4%', dir: 'up' }, targetRate: { v: '9.94', d: '+0.9%', dir: 'up' }, allConv: { v: '16,423', d: '+10.5%', dir: 'up' }, allRate: { v: '80.64', d: '+1.7%', dir: 'up' } },
        { cat: '稳',   touch: '热线-外呼', big: '接盘', sub: '模组/关怀包至福包', name: '模组接盘福包到期关怀-热线', push: { v: '98,421', d: '−6.1%', dir: 'down' }, use: { v: '91,830', d: '−8.2%', dir: 'down' }, useRate: { v: '93.30', d: '−0.6%', dir: 'down' }, reach: { v: '38,150', d: '+4.8%', dir: 'up' }, targetConv: { v: '4,882', d: '+11.2%', dir: 'up' }, targetRate: { v: '12.80', d: '+0.9%', dir: 'up' }, allConv: { v: '27,901', d: '−1.5%', dir: 'down' }, allRate: { v: '44.37', d: '+1.3%', dir: 'up' } },
        { cat: '升接', touch: '工作号服务平台', big: '升档', sub: '套餐升档', name: '工作号场景升档推荐-中端', push: { v: '73,582', d: '+7.8%', dir: 'up' }, use: { v: '68,115', d: '+9.4%', dir: 'up' }, useRate: { v: '92.57', d: '+1.1%', dir: 'up' }, reach: { v: '52,307', d: '+5.3%', dir: 'up' }, targetConv: { v: '3,104', d: '+8.7%', dir: 'up' }, targetRate: { v: '5.94', d: '+0.3%', dir: 'up' }, allConv: { v: '33,662', d: '−0.8%', dir: 'down' }, allRate: { v: '42.18', d: '+0.5%', dir: 'up' } },
        { cat: '离',   touch: '热线-瞬时', big: '风险修复', sub: '中高端风险修复', name: '离网高价值客群修复-中高端', push: { v: '41,926', d: '−10.5%', dir: 'down' }, use: { v: '35,808', d: '−12.7%', dir: 'down' }, useRate: { v: '85.42', d: '−0.9%', dir: 'down' }, reach: { v: '29,415', d: '+3.1%', dir: 'up' }, targetConv: { v: '1,976', d: '+6.4%', dir: 'up' }, targetRate: { v: '6.72', d: '+0.2%', dir: 'up' }, allConv: { v: '18,203', d: '−1.1%', dir: 'down' }, allRate: { v: '44.83', d: '+0.7%', dir: 'up' } },
        { cat: '升接', touch: '热线-外呼', big: '升档', sub: '套餐升档', name: '外呼场景升档-个人家庭市场', push: { v: '152,048', d: '+14.2%', dir: 'up' }, use: { v: '148,932', d: '+15.8%', dir: 'up' }, useRate: { v: '97.95', d: '+1.2%', dir: 'up' }, reach: { v: '88,417', d: '+9.6%', dir: 'up' }, targetConv: { v: '5,268', d: '+18.9%', dir: 'up' }, targetRate: { v: '5.96', d: '+0.7%', dir: 'up' }, allConv: { v: '56,119', d: '+2.1%', dir: 'up' }, allRate: { v: '43.58', d: '+0.9%', dir: 'up' } },
        { cat: '稳',   touch: '商机团队', big: '其他', sub: '其他', name: '商机团队签约跟进-标准策略', push: { v: '17,620', d: '−5.8%', dir: 'down' }, use: { v: '14,993', d: '−6.9%', dir: 'down' }, useRate: { v: '85.10', d: '−0.5%', dir: 'down' }, reach: { v: '11,284', d: '+7.2%', dir: 'up' }, targetConv: { v: '902', d: '+13.8%', dir: 'up' }, targetRate: { v: '7.99', d: '+0.6%', dir: 'up' }, allConv: { v: '8,154', d: '+2.6%', dir: 'up' }, allRate: { v: '48.21', d: '+1.1%', dir: 'up' } },
        { cat: '降拆', touch: '热线-外呼', big: '风险修复', sub: '中高端风险修复', name: '降档客群修复-宽带融合', push: { v: '11,295', d: '−3.4%', dir: 'down' }, use: { v: '9,018', d: '−4.8%', dir: 'down' }, useRate: { v: '79.84', d: '−0.7%', dir: 'down' }, reach: { v: '8,037', d: '+5.9%', dir: 'up' }, targetConv: { v: '648', d: '+9.2%', dir: 'up' }, targetRate: { v: '8.06', d: '+0.4%', dir: 'up' }, allConv: { v: '5,760', d: '−0.6%', dir: 'down' }, allRate: { v: '47.35', d: '+0.8%', dir: 'up' } }
      ],
      total: 7947,
      size: 5
    },
    alertSummary: { rules: 7 }
  }
};