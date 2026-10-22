/* 状态演示数据 · 原型 mock
 * 用途：供 #state=empty / #state=error 手动演示「空态 / 错误态」（见 prototype-design.md §3 全局状态覆盖）。
 * envelope 与业务数据一致：{ code, message, data }
 * 上线交接：这两个文件仅用于原型演示，正式环境由接口真实返回。
 */
window.__PROTO_DATA__ = window.__PROTO_DATA__ || {};

// 空态：列表/表格无数据 → 触发页面空态引导
window.__PROTO_DATA__.empty = {
  code: 0,
  message: 'ok',
  data: { rows: [], list: [], pagination: { page: 1, size: 10, total: 0 } }
};

// 错误态：code!=0 → app.js 走 catch 分支渲染错误文案 + 重试
window.__PROTO_DATA__.error = {
  code: 500,
  message: '数据服务暂不可用，请稍后重试',
  data: null
};