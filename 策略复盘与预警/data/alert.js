/* 策略自动预警数据 · 原型 mock
 * 来源：现有系统截图 页面4.png（历史预警规则 7 条 / 预警策略表 15 列 / 重点关注策略表）；xlsx 补规则字段。
 * envelope：{ code, message, data }
 * 上线交接：换成 GET /api/strategy/alert 的返回体即可（结构不变）。
 */
window.__PROTO_DATA__ = window.__PROTO_DATA__ || {};
window.__PROTO_DATA__.alert = {
  code: 0,
  message: 'ok',
  data: {
    // ── 历史预警规则（截图 页面4 左）共 7 条 ────────────────────
    rules: [
      { id: 'r1', name: 'test111', metric: '目标转化率', operator: '≥', threshold: '5', start: '2026-10-01', end: '2026-10-09', expired: true, created: '2026-10-09 15:01:31' },
      { id: 'r2', name: '093022', metric: '推送量', operator: '≥', threshold: '10000', start: '2026-09-30', end: '2026-10-08', expired: true, created: '2026-09-30 22:14:05' },
      { id: 'r3', name: '0930',    metric: '使用率', operator: '≥', threshold: '30',    start: '2026-09-30', end: '2026-10-07', expired: true, created: '2026-09-30 10:26:41' },
      { id: 'r4', name: '低效策略', metric: '全产品转化率', operator: '≥', threshold: '2', start: '2026-09-29', end: '2026-10-06', expired: true, created: '2026-09-29 17:03:12' },
      { id: 'r5', name: '1111',    metric: '推送量', operator: '≥', threshold: '100',   start: '2026-09-28', end: '2026-10-05', expired: true, created: '2026-09-28 09:41:57' },
      { id: 'r6', name: '1122',    metric: '推送量', operator: '≥', threshold: '10000', start: '2026-09-27', end: '2026-10-04', expired: true, created: '2026-09-27 14:52:30' },
      { id: 'r7', name: 'test0929', metric: '全产品转化量', operator: '≥', threshold: '100', start: '2026-09-29', end: '2026-10-06', expired: true, created: '2026-09-29 11:18:09' }
    ],
    // 规则可选指标（截图 页面4 新增规则表单下拉）
    ruleMetrics: ['策略名称', '推送量', '使用量', '使用率', '触达量', '目标转化量', '目标转化率', '全产品转化量', '全产品转化率', '预期收入', '实际收入'],
    operators: ['≥', '≤', '>', '<', '='],
    // ── 预警策略表（截图 页面4 右上）15 列；截图默认空 ────────────
    alertColumns: [
      { key: 'date',       label: '日期',          type: 'text' },
      { key: 'touch',      label: '触点',          type: 'tag' },
      { key: 'big',        label: '策略大类',      type: 'text' },
      { key: 'sub',        label: '策略小类',      type: 'text' },
      { key: 'name',       label: '策略名称',      type: 'text' },
      { key: 'push',       label: '推送量',        type: 'num' },
      { key: 'use',        label: '使用量',        type: 'num' },
      { key: 'useRate',    label: '使用率',        type: 'num' },
      { key: 'reach',      label: '触达量',        type: 'num' },
      { key: 'targetConv', label: '目标转化量',    type: 'num' },
      { key: 'targetRate', label: '目标转化率',    type: 'num' },
      { key: 'allConv',    label: '全产品转化量',  type: 'num' },
      { key: 'allRate',    label: '全产品转化率',  type: 'num' },
      { key: 'expRevenue', label: '预期收入(元)',  type: 'num' },
      { key: 'actRevenue', label: '实际收入(元)',  type: 'num' }
    ],
    alerts: { rows: [], total: 0, size: 10 },
    focus:  { rows: [], total: 0, size: 10 }
  }
};