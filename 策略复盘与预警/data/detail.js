/* 策略执行详情数据 · 原型 mock
 * 来源：现有系统截图 页面3.png（策略详情 / 策略产能 / 策略拒绝原因 / 业务产能明细 / 执行明细）；
 * xlsx 内嵌图补充拒绝原因分类；截图未覆盖的行按同口径 mock（行内注释标 [mock]）。
 * envelope：{ code, message, data }
 * 上线交接：换成 GET /api/strategy/detail?id=<策略名> 的返回体即可（结构不变）。
 */
window.__PROTO_DATA__ = window.__PROTO_DATA__ || {};
window.__PROTO_DATA__.detail = {
  code: 0,
  message: 'ok',
  data: {
    // ── 策略详情（截图 页面3 左上；精简为 5 个核心属性）〔R17〕─────
    info: {
      策略名称: '手厅客户咨询合适的套餐（商）',
      所属渠道: '热线-瞬时',
      策略级别: '省级',
      客群口径: '规则创建',
      创建时间: '2022-06-17'
    },
    // ── 策略产能（截图 页面3 中上）：柱(产能) + 线(环比) ────────
    capacity: {
      categories: ['08月', '09月', '10月'],
      bars: [24600, 26150, 24830],
      barLabel: '产能',
      line: [0, 6.3, -5.0],
      lineLabel: '环比'
    },
    // ── 策略拒绝原因环形图（截图 页面3 左下 + xlsx 内嵌图）；value 即拒绝占比(%)，short 为环上短标签 ─
    rejectReasons: [
      { label: '表示价格太贵不划算', short: '价格贵',   value: 23 },
      { label: '表示不需要/无需求',  short: '无需求',   value: 15 },
      { label: '表示当前套餐够用',   short: '套餐够用', value: 12 },
      { label: '表示流量/通话不够用', short: '不够用',   value: 10 },
      { label: '表示对服务不满意',   short: '服务不满', value: 9 },
      { label: '表示已有他网产品',   short: '有他网',   value: 8 },
      { label: '表示资费不清晰',     short: '资费不清', value: 7 },
      { label: '表示想后期再考虑',   short: '再考虑',   value: 6 },
      { label: '表示不接受外呼营销', short: '拒营销',   value: 5 },
      { label: '其他原因',           short: '其他',     value: 5 }
    ],
    // ── 业务产能明细（截图 页面3 中下）共 15 条 ──────────────────
    bizCapacity: {
      columns: [
        { key: 'biz',  label: '业务', type: 'text' },
        { key: 'cap',  label: '产能', type: 'num' },
        { key: 'ring', label: '环比', type: 'delta' }
      ],
      rows: [
        { cat: '升接', biz: '套餐升档',    cap: '6924', ring: '+13.5%', dir: 'up' },
        { cat: '升接', biz: '会员权益',    cap: '3677', ring: '+22.4%', dir: 'up' },
        { cat: '稳',   biz: '中视频现有',  cap: '704',  ring: '−10.3%', dir: 'down' },
        { cat: '降拆', biz: '裸盈拉新',    cap: '573',  ring: '+44.0%', dir: 'up' },
        { cat: '稳',   biz: '全靠包',      cap: '438',  ring: '−0.7%',  dir: 'down' },
        // [mock] 后 10 行按同口径补齐
        { cat: '离',   biz: '流量包',      cap: '392',  ring: '+6.2%',  dir: 'up' },
        { cat: '离',   biz: '语音包',      cap: '286',  ring: '−4.1%',  dir: 'down' },
        { cat: '升接', biz: '宽带新装',    cap: '241',  ring: '+9.8%',  dir: 'up' },
        { cat: '升接', biz: '百G包',       cap: '198',  ring: '+2.5%',  dir: 'up' },
        { cat: '稳',   biz: '全能包',      cap: '163',  ring: '−7.4%',  dir: 'down' },
        { cat: '稳',   biz: '异网双卡互营', cap: '121',  ring: '−12.0%', dir: 'down' },
        { cat: '降拆', biz: '中高端保有',  cap: '96',   ring: '+3.3%',  dir: 'up' },
        { cat: '稳',   biz: '修复',        cap: '74',   ring: '−5.6%',  dir: 'down' },
        { cat: '稳',   biz: '接盘运营',    cap: '52',   ring: '+11.3%', dir: 'up' },
        { cat: '离',   biz: '常客常稀有',  cap: '38',   ring: '−1.9%',  dir: 'down' }
      ],
      total: 15,
      size: 5
    },
    // ── 执行明细 · 分日（截图 页面3 右）共 11 条 ─────────────────
    execDaily: {
      columns: [
        { key: 'date',       label: '日期',          type: 'text' },
        { key: 'big',        label: '策略大类',      type: 'text' },
        { key: 'sub',        label: '策略小类',      type: 'text' },
        { key: 'name',       label: '策略名称',      type: 'text' },
        { key: 'push',       label: '推送量',        type: 'num' },
        { key: 'use',        label: '使用量',        type: 'num' },
        { key: 'useRate',    label: '使用率',        type: 'num' },
        { key: 'reach',      label: '触达量',        type: 'num' },
        { key: 'targetConv', label: '目标转化量',    type: 'num' },
        { key: 'targetRate', label: '目标转化率',    type: 'num' },
        { key: 'allConv',    label: '全产品转化量',  type: 'num' }
      ],
      rows: [
        { cat: '升接', date: '2026-10-11', big: '升档', sub: '套餐升档', name: '手厅客户咨询合适的套餐（商）', push: '8,424', use: '8,031', useRate: '95.33', reach: '5,232', targetConv: '378', targetRate: '7.22', allConv: '712' },
        { cat: '稳',   date: '2026-10-10', big: '接盘', sub: '模组/关怀包至福包', name: '模组接盘福包即将到期场景-福包', push: '9,140', use: '8,702', useRate: '95.21', reach: '5,608', targetConv: '402', targetRate: '7.17', allConv: '768' },
        { cat: '升接', date: '2026-10-09', big: '升档', sub: '套餐升档', name: '升档运营智能触发-优质', push: '8,876', use: '8,455', useRate: '95.26', reach: '5,401', targetConv: '389', targetRate: '7.20', allConv: '735' },
        { cat: '降拆', date: '2026-10-08', big: '其他', sub: '其他', name: '会员权益到期提醒', push: '0', use: '0', useRate: '0', reach: '0', targetConv: '0', targetRate: '0', allConv: '0' },
        { cat: '升接', date: '2026-10-07', big: '升档', sub: '套餐升档', name: '手厅客户咨询合适的套餐（商）', push: '7,982', use: '7,610', useRate: '95.34', reach: '4,948', targetConv: '356', targetRate: '7.19', allConv: '681' },
        { cat: '离',   date: '2026-10-06', big: '升档', sub: '套餐升档', name: '高饱和客群升10元', push: '8,331', use: '7,946', useRate: '95.38', reach: '5,120', targetConv: '369', targetRate: '7.22', allConv: '698' },
        { cat: '升接', date: '2026-10-05', big: '升档', sub: '套餐升档', name: '升档运营智能触发-优质', push: '8,015', use: '7,642', useRate: '95.35', reach: '4,973', targetConv: '358', targetRate: '7.20', allConv: '686' },
        { cat: '稳',   date: '2026-10-04', big: '接盘', sub: '模组/关怀包至福包', name: '模组接盘福包即将到期场景-福包', push: '7,644', use: '7,286', useRate: '95.32', reach: '4,712', targetConv: '341', targetRate: '7.24', allConv: '652' },
        { cat: '升接', date: '2026-10-03', big: '升档', sub: '套餐升档', name: '手厅客户咨询合适的套餐（商）', push: '7,208', use: '6,868', useRate: '95.28', reach: '4,455', targetConv: '322', targetRate: '7.23', allConv: '618' },
        { cat: '降拆', date: '2026-10-02', big: '其他', sub: '其他', name: '会员权益到期提醒', push: '6,975', use: '6,648', useRate: '95.31', reach: '4,301', targetConv: '311', targetRate: '7.23', allConv: '594' },
        { cat: '升接', date: '2026-10-01', big: '升档', sub: '套餐升档', name: '手厅客户咨询合适的套餐（商）', push: '6,742', use: '6,423', useRate: '95.27', reach: '4,158', targetConv: '300', targetRate: '7.22', allConv: '576' }
      ],
      total: 11,
      size: 10
    },
    // ── 执行明细 · 对照（非上线）（截图 页面3 右标签二）：截图为空表 ──
    execNonOnline: {
      columns: [
        { key: 'date',    label: '日期',       type: 'text' },
        { key: 'name',    label: '策略名称',   type: 'text' },
        { key: 'push',    label: '推送量',     type: 'num' },
        { key: 'use',     label: '使用量',     type: 'num' },
        { key: 'useRate', label: '使用率',     type: 'num' },
        { key: 'reach',   label: '触达量',     type: 'num' },
        { key: 'conv',    label: '转化量',     type: 'num' }
      ],
      rows: [],
      total: 0,
      size: 10
    }
  }
};