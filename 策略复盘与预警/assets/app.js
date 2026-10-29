/* ============================================================
 * 策略复盘与预警 · 原型交互脚本（原生 JS，无框架、无构建）
 * 职责：取数（data/*.js 注入 window.__PROTO_DATA__）→ 渲染 → 绑定交互 → 切换状态
 *
 * 交接说明（给前端）：
 *  - 数据来源：原型用 data/*.js 经 <script> 注入 window.__PROTO_DATA__（file:// 双击即开，无需 http server），
 *    结构已对齐后端 envelope {code,message,data}。上线时把 env() 换成一层的 fetch 即可，渲染逻辑无需改。
 *  - 状态机：#state=loading|empty|error|data 手动演示各状态（用 location.hash，file:// 下无安全限制）。
 *  - 页面路由：body[data-page] ∈ stock | increment | product（三个物理 HTML 同构，非 hash 路由）。
 *  - 单页结构：每个页面按「策略整体情况 → 策略执行情况 → 重点关注策略 → 策略执行明细」垂直堆叠。
 *  - 本文件所有 data-action 取值 = req/prototype-design.md §3 交互流表 #交互名；基线能力（切换主题/取消）除外。
 *  - 原型级实现：写操作（新增/删除规则、导出）仅内存 + 提示，不做真实持久化。
 * ============================================================ */

const DATA = window.__PROTO_DATA__ || {};

/* ── 常量 ─────────────────────────────────────────────────── */
// 触点渠道：与截图 触点执行表 完全一致（含默认「全部渠道」）
const TOUCHES = ['全部渠道', '热线-瞬时', '商机团队', '热线-外呼', '工作号服务平台'];
// 环形图 10 色分类板（蓝/琥珀/绿/青/靛延展，避开语义涨跌色，且不含 AI 紫）
const DONUT_COLORS = ['#409EFF', '#E6A23C', '#10B981', '#F56C6C', '#22D3EE', '#60A5FA', '#FBBF24', '#4ADE80', '#A5B4FC', '#38BDF8'];
// 漏斗 4 级同色阶（深→浅，蓝主色延展）
const FUNNEL_COLORS = ['#1D4ED8', '#2563EB', '#3B82F6', '#93C5FD'];
// 模块一 漏斗：青→蓝渐变（第七轮 UI1.png 实测，自上而下，替代灰色阶）〔R36/USR-18〕
const FUNNEL_CYAN = ['#9FE4F1', '#5AC4D1', '#4BB2DE', '#4289E9'];
const THEME_KEY = 'proto-theme';

// 全局控制器匹配：行携带 cat（分类）/ touch（触点）字段；「全部」「全部渠道」或字段缺省 = 命中
const matchCat = (row, cat) => (!cat || cat === '全部' || !row.cat || row.cat === cat);
const matchTouch = (row, touch) => (!touch || touch === '全部渠道' || !row.touch || row.touch === touch);

/* ── 小工具 ───────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dirClass = (d) => (d === 'up' ? 'up' : d === 'down' ? 'down' : 'muted');
// 判断 hex 底色是否需要深色文字（白字 vs 深字，取值 0~1；≥0.5 用深字）
function needsDarkText(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum >= 0.5;
}

function toast(msg) {
  const t = $('[data-toast]');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2400);
}

// 取 envelope.data（上线替换为：const e = await (await fetch(url)).json(); if(e.code!==0) throw...; return e.data;）
function env(key) {
  const e = DATA[key];
  if (!e) throw new Error('缺少数据源 data/' + key + '.js');
  if (e.code !== 0) throw new Error(e.message || '业务错误');
  return e.data;
}

// #state=loading|empty|error|data
function demoState() {
  const m = /(?:^|&)state=([^&]+)/.exec(location.hash.replace(/^#/, ''));
  return m ? decodeURIComponent(m[1]) : null;
}

// 数值格式化：个/无量纲 → 千分位整数；% → 两位小数；其他单位最多两位小数，不补尾零
function fmtMetric(v, unit) {
  if (unit === '个' || unit === '') return Math.round(v).toLocaleString('zh-CN');
  if (unit === '%') return Number(v).toFixed(2);
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

/* ── 主题切换（基线能力 · 看板类默认启用）───────────────────── */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (_) {}
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', 'dark');
  try { localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark'); } catch (_) {}
}

/* ── 导航选中态 + 页面标题 ─────────────────────────────────── */
const PAGE_TITLES = { stock: '存量策略', increment: '增量策略', product: '重点产品' };
function markNav() {
  const page = document.body.dataset.page;
  $$('.app-nav a').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const h = $('[data-page-title]');
  if (h && PAGE_TITLES[page]) h.textContent = PAGE_TITLES[page];
}

/* ── 状态容器 ─────────────────────────────────────────────── */
function setWrap(wrap, name, msg) {
  if (!wrap) return;
  ['loading', 'empty', 'error', 'data'].forEach((s) => {
    const el = wrap.querySelector('.state-' + s);
    if (el) el.hidden = s !== name;
  });
  if (name === 'error' && msg) {
    const em = wrap.querySelector('.error-msg');
    if (em) em.textContent = msg;
  }
}
// 有状态包裹器 → 按 #state= 切换（区块内所有 [data-statewrap] 统一联动）；无包裹器 → 直接渲染
function stateful(sectionEl, renderFn) {
  const wraps = sectionEl ? $$('[data-statewrap]', sectionEl) : [];
  const q = demoState();
  if (!wraps.length) { renderFn(); return; }
  if (q === 'loading') { wraps.forEach((w) => setWrap(w, 'loading')); return; }
  if (q === 'empty') { wraps.forEach((w) => setWrap(w, 'empty')); return; }
  if (q === 'error') { wraps.forEach((w) => setWrap(w, 'error', (DATA.error && DATA.error.message) || '加载失败')); return; }
  wraps.forEach((w) => setWrap(w, 'data'));
  renderFn();
}

// 分类 / 触点切换时的平滑过渡（§2 需求：全页数据平滑切换）
function smoothSwap(el, fn) {
  if (!el) { fn(); return; }
  el.classList.add('is-swapping');
  setTimeout(() => { fn(); el.classList.remove('is-swapping'); }, 160);
}

/* ── 表格渲染 ─────────────────────────────────────────────── */
function cellHTML(col, row) {
  if (col.type === 'pick') {
    const nm = row.name ? ` data-name="${esc(row.name)}"` : '';
    return `<td><input type="checkbox" class="checkbox" data-pick${nm} aria-label="选择该行"></td>`;
  }
  const val = row[col.key];
  if (val == null || val === '') return '<td>—</td>';
  if (typeof val === 'object') { // metric 单元格：{v,d,dir}
    const cls = dirClass(val.dir);
    return `<td class="num metric-cell"><span class="v">${esc(val.v)}</span>${val.d ? `<span class="d ${cls}">${esc(val.d)}</span>` : ''}</td>`;
  }
  switch (col.type) {
    case 'link': return `<td><span class="link-text">${esc(val)}</span></td>`;
    case 'tag': return `<td><span class="badge tag-touch">${esc(val)}</span></td>`;
    case 'detail':
      return `<td class="link"><button class="btn-link" data-action="展开策略详情" data-name="${esc(val)}">${esc(val)}<svg class="icon"><use href="#i-chevron-right"/></svg></button></td>`;
    case 'num': return `<td class="num">${esc(val)}</td>`;
    case 'pct': { const d = row[col.key + 'Dir']; return `<td class="num ${dirClass(d)}">${esc(val)}</td>`; }
    case 'delta': { const c = row.dir === 'up' ? 'up' : 'down'; return `<td class="num ${c}">${esc(val)}</td>`; }
    default: return `<td>${esc(val)}</td>`;
  }
}
function renderTable(sec, columns, rows, opts = {}) {
  const table = sec && sec.querySelector('table[data-table]');
  if (!table) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody[data-rows]');
  const isNum = (c) => c.type === 'num' || c.type === 'metric' || c.type === 'delta' || c.type === 'pct';
  // 排序（第十一轮 R53/R54）：数值列表头可点击 ⇅，按当前 sec._sortKey/_sortDir 排序后再渲染
  let data = rows;
  if (sec._sortKey) {
    const col = columns.find((c) => c.key === sec._sortKey);
    if (col) {
      const dir = sec._sortDir === 'asc' ? 1 : -1;
      data = rows.slice().sort((a, b) => dir * (sortVal(a[col.key]) - sortVal(b[col.key])));
    }
  }
  thead.innerHTML = '<tr>' + columns.map((c) => {
    const cls = isNum(c) ? ' class="num"' : '';
    const sortable = opts.sortable && isNum(c) && c.type !== 'pick';
    if (!sortable) return `<th${cls}>${esc(c.label)}</th>`;
    const on = sec._sortKey === c.key;
    const mark = on ? (sec._sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th${cls}><button class="th-sort${on ? ' is-sorted' : ''}" data-action="排序" data-key="${esc(c.key)}">${esc(c.label)}${mark}<svg class="icon"><use href="#i-arrow-up-down"/></svg></button></th>`;
  }).join('') + '</tr>';
  tbody.innerHTML = data.map((r) => '<tr>' + columns.map((c) => cellHTML(c, r)).join('') + '</tr>').join('');
  if (opts.empty && !data.length) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="empty-cell">${esc(opts.empty)}</td></tr>`;
  }
  if (opts.summary) {
    const cells = columns.map((c) => {
      const v = opts.summary[c.key];
      if (v == null) return '<td></td>';
      if (typeof v === 'object') return `<td class="num metric-cell"><span class="v">${esc(v.v)}</span></td>`;
      return isNum(c) ? `<td class="num">${esc(v)}</td>` : `<td>${esc(v)}</td>`;
    }).join('');
    tbody.innerHTML += `<tr class="summary-row">${cells}</tr>`;
  }
}
// 排序取值：metric 对象取 .v；数值字符串去千分位/百分号/负号后转数字
function sortVal(v) {
  if (v == null) return -Infinity;
  if (typeof v === 'object') v = v.v;
  const n = parseFloat(String(v).replace(/[,\s%]/g, '').replace(/[−–—]/g, '-'));
  return isNaN(n) ? -Infinity : n;
}

/* ── 分页 ─────────────────────────────────────────────────── */
function pagerHTML(page, size, total, key) {
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);
  const btn = (n, label, disabled) =>
    `<button class="page${n === cur && !disabled ? ' is-active' : ''}" data-action="翻页" data-pagerkey="${esc(key)}" data-page="${n}"${disabled ? ' disabled' : ''}>${label || n}</button>`;
  const parts = [btn(cur - 1, '‹', cur <= 1)];
  const nums = [];
  if (pages <= 7) { for (let i = 1; i <= pages; i++) nums.push(i); }
  else {
    nums.push(1);
    if (cur > 3) nums.push('…');
    for (let i = Math.max(2, cur - 1); i <= Math.min(pages - 1, cur + 1); i++) nums.push(i);
    if (cur < pages - 2) nums.push('…');
    nums.push(pages);
  }
  nums.forEach((n) => parts.push(n === '…' ? '<span class="ellipsis">…</span>' : btn(n)));
  parts.push(btn(cur + 1, '›', cur >= pages));
  return parts.join('');
}
function renderPager(sec, key, p) {
  const nav = sec && sec.querySelector(`[data-pager="${key}"]`);
  if (!nav) return;
  nav.dataset.pagerkey = key;
  nav.dataset.total = p.total;
  nav.dataset.size = p.size;
  nav.dataset.page = p.page;
  nav.dataset.rows = p.rows != null ? p.rows : '';
  paintPager(nav);
}
function paintPager(nav) {
  nav.innerHTML = pagerHTML(+nav.dataset.page, +nav.dataset.size, +nav.dataset.total, nav.dataset.pagerkey);
}
function refreshNote(sec) {
  const el = sec && sec.querySelector('[data-note]');
  if (!el || sec._total == null) return;
  const pages = Math.max(1, Math.ceil(sec._total / (sec._size || 10)));
  const notes = [];
  if (pages > 1) notes.push(`第 ${sec._page || 1}/${pages} 页`);
  if (sec._sampleLimited) notes.push('原型仅内置首屏样例数据，翻页重复展示');
  else if (sec._filtered) notes.push('按当前筛选条件');
  const s = notes.join(' · ');
  el.textContent = s;
}

/* ── 图表：柱 + 折线（双 Y 轴）────────────────────────────── */
function niceTicks(max, count) {
  if (!(max > 0)) return [1, 0.75, 0.5, 0.25, 0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const out = [];
  for (let v = top; v >= 0 && out.length < 8; v -= step) out.push(Math.round(v * 100) / 100);
  return out;
}
const fmtTick = (v) => (Math.abs(v) >= 1000 ? Number(v).toLocaleString('zh-CN') : String(v));
function renderBarLine(svg, cfg) {
  if (!svg) return;
  const W = cfg.w || 760, H = cfg.h || 232, m = { t: 18, r: 52, b: 28, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const cats = cfg.categories || [];
  const bars = cfg.bars || [];
  const line = cfg.line || [];
  const n = cats.length || 1;
  // lineAbove：柱体限制在下部，折线独占顶部带，二者永不重叠（模块一需求）
  const above = !!cfg.lineAbove;
  const barBand = above ? ih * 0.60 : ih;   // 柱体可用高度
  const lineBand = ih * 0.30;               // 折线带高度（顶部）
  const ticks = niceTicks(Math.max(...bars, 0), 4);
  const top = ticks[0] || 1;
  const lmax = line.length ? Math.max(...line) : 1;
  const lmin = line.length ? Math.min(...line) : 0;
  const lpad = (lmax - lmin) * 0.3 || Math.max(Math.abs(lmax) * 0.3, 1);
  const lTop = lmax + lpad, lBot = lmin - lpad;
  const yBar = (v) => m.t + ih - (v / top) * barBand;
  const yLine = (v) => (above
    ? m.t + lineBand - ((v - lBot) / (lTop - lBot)) * lineBand
    : m.t + ih - ((v - lBot) / (lTop - lBot)) * ih);
  const xc = (i) => m.l + iw * (i + 0.5) / n;
  const bw = Math.min(48, (iw / n) * 0.44);
  let s = '';
  ticks.forEach((t) => {
    const y = yBar(t);
    s += `<line x1="${m.l}" y1="${y.toFixed(1)}" x2="${W - m.r}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
    s += `<text x="${m.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="11">${fmtTick(t)}</text>`;
  });
  if (line.length) {
    for (let k = 0; k <= 2; k++) {
      const v = lTop - (lTop - lBot) * k / 2;
      s += `<text x="${W - m.r + 8}" y="${(yLine(v) + 4).toFixed(1)}" text-anchor="start" fill="var(--chart-line)" font-size="11">${v.toFixed(1)}%</text>`;
    }
  }
  bars.forEach((v, i) => {
    const x = xc(i) - bw / 2, y = yBar(v), h = Math.max(1, m.t + ih - y);
    const drill = cfg.drill ? ` data-action="指标下钻" data-month="${esc(cats[i])}" data-dim="${esc(cfg.drillDim || '')}"` : '';
    s += `<rect class="bar"${drill} x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3"><title>${esc(cats[i])} ${esc(cfg.barLabel || '')} ${fmtTick(v)}</title></rect>`;
    s += `<text x="${xc(i).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="var(--text-2)" font-size="11">${fmtTick(v)}</text>`;
  });
  if (line.length) {
    const pts = line.map((v, i) => [xc(i), yLine(v)]);
    s += `<polyline fill="none" stroke="var(--chart-line)" stroke-width="2" points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`;
    pts.forEach((p, i) => {
      s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--surface)" stroke="var(--chart-line)" stroke-width="2"><title>${esc(cats[i])} ${esc(cfg.lineLabel || '')} ${line[i]}%</title></circle>`;
    });
  }
  cats.forEach((c, i) => {
    s += `<text x="${xc(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="11">${esc(c)}</text>`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

function renderOverviewTrend(svg, cfg) {
  if (!svg) return;
  const W = 1200, H = 600, m = { top: 55, right: 24, bottom: 55, left: 92 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const cats = cfg.categories || [], bars = cfg.bars || [], line = cfg.line || [];
  const n = cats.length || 1;
  const ticks = niceTicks(cfg.axisMax || Math.max(...bars, 0), 4);
  const maxBar = ticks[0] || 1;
  const xc = (i) => m.left + iw * (i + 0.5) / n;
  const plotY = (y) => m.top + (y - m.top) * 0.84;
  const barY = (v) => m.top + ih - (v / maxBar) * ih * 0.78;
  const lmax = Math.max(...line, 1), lmin = Math.min(...line, 0), span = Math.max(lmax - lmin, 1);
  const lineY = (v) => m.top + 40 + (lmax - v) / span * 70;
  const bw = Math.min(44, iw / n * 0.44);
  let s = `<defs><linearGradient id="overview-bars" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#67aaf5"/><stop offset=".58" stop-color="#438cf0"/><stop offset="1" stop-color="#2d6be8"/></linearGradient></defs>`;
  s += `<text x="22" y="36" fill="var(--muted)" font-size="24">${esc(cfg.axisLabel || '成功量')}</text>`;
  ticks.forEach((tick) => {
    const y = plotY(m.top + ih * (1 - tick / maxBar));
    s += `<line x1="${m.left}" y1="${y.toFixed(1)}" x2="${W - m.right}" y2="${y.toFixed(1)}" stroke="#e8edf4" stroke-width="1" stroke-dasharray="2 6"/>`;
    s += `<text x="${m.left - 14}" y="${(y + 7).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="19">${esc(fmtTick(tick))}</text>`;
  });
  bars.forEach((value, i) => {
    const x = xc(i) - bw / 2, y = plotY(barY(value)), base = plotY(m.top + ih), height = base - y;
    const radius = Math.min(5, bw * .22, height);
    const barPath = `M${x.toFixed(1)} ${base.toFixed(1)} L${x.toFixed(1)} ${(y + radius).toFixed(1)} Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + radius).toFixed(1)} ${y.toFixed(1)} L${(x + bw - radius).toFixed(1)} ${y.toFixed(1)} Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y + radius).toFixed(1)} L${(x + bw).toFixed(1)} ${base.toFixed(1)} Z`;
    s += `<path class="bar" data-action="指标下钻" data-month="${esc(cats[i])}" data-dim="${esc(cfg.drillDim || '')}" d="${barPath}" style="fill:url(#overview-bars)"><title>${esc(cats[i])} ${esc(cfg.barLabel || '')} ${esc(fmtTick(value))}</title></path>`;
    s += `<text x="${xc(i).toFixed(1)}" y="${plotY(barY(value) - 9).toFixed(1)}" text-anchor="middle" fill="#64748b" font-size="18">${esc(fmtTick(value))}</text>`;
    s += `<text x="${xc(i).toFixed(1)}" y="${plotY(H - 10).toFixed(1)}" text-anchor="middle" fill="var(--muted)" font-size="18">${esc(cats[i])}</text>`;
  });
  if (line.length) {
    const pts = line.map((value, i) => [xc(i), plotY(lineY(value))]);
    let path = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const mid = (pts[i - 1][0] + pts[i][0]) / 2;
      path += ` C${mid.toFixed(1)} ${pts[i - 1][1].toFixed(1)} ${mid.toFixed(1)} ${pts[i][1].toFixed(1)} ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    s += `<path d="${path}" fill="none" stroke="var(--chart-line)" stroke-width="3" stroke-linecap="round"/>`;
    pts.forEach(([x, y], i) => { s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--chart-line)" stroke="var(--surface)" stroke-width="1.5"><title>${esc(cats[i])} 环比 ${esc(line[i])}%</title></circle>`; });
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

/* ── 图表：漏斗（四层立体图）─────────────────────────────── */
function renderFunnel(svg, items, opts = {}) {
  if (!svg) return;
  const stages = (items || []).slice(0, 4);
  if (!stages.length) { svg.innerHTML = ''; return; }
  const shapes = [
    { top: 74, bottom: 178, topWidth: 400, bottomWidth: 306, topRy: 30, bottomRy: 22, grad: 'funnel-cyan', cap: '#b5eef4', rim: '#78d2de' },
    { top: 178, bottom: 271, topWidth: 306, bottomWidth: 232, topRy: 22, bottomRy: 20, grad: 'funnel-sky', cap: '#82d0f4', rim: '#54b7e8' },
    { top: 271, bottom: 353, topWidth: 232, bottomWidth: 180, topRy: 20, bottomRy: 19, grad: 'funnel-blue', cap: '#83b5fc', rim: '#578fe9' },
    { top: 353, bottom: 418, topWidth: 180, bottomWidth: 146, topRy: 19, bottomRy: 18, grad: 'funnel-violet', cap: '#b79af4', rim: '#9a78e8' }
  ];
  let s = `<defs>
    <radialGradient id="funnel-halo" cx="50%" cy="52%" r="58%"><stop stop-color="#c9f3ff" stop-opacity=".34"/><stop offset=".72" stop-color="#e7f8ff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="funnel-soft-shadow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
    <linearGradient id="funnel-cyan" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#70d5e1"/><stop offset="1" stop-color="#38c4ce"/></linearGradient>
    <linearGradient id="funnel-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#72c9f3"/><stop offset="1" stop-color="#45b3ee"/></linearGradient>
    <linearGradient id="funnel-blue" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#72a8f8"/><stop offset="1" stop-color="#4385ed"/></linearGradient>
    <linearGradient id="funnel-violet" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b395f1"/><stop offset="1" stop-color="#9669e9"/></linearGradient>
  </defs>
  <ellipse cx="225" cy="247" rx="208" ry="190" fill="url(#funnel-halo)"/>
  <ellipse cx="225" cy="430" rx="133" ry="19" fill="#73d5ed" opacity=".18" filter="url(#funnel-soft-shadow)"/>
  <ellipse cx="225" cy="432" rx="145" ry="22" fill="#e8f7fc" opacity=".88"/>
  <ellipse cx="225" cy="432" rx="176" ry="34" fill="none" stroke="#d9efff" stroke-width="2"/>`;
  shapes.forEach((shape, i) => {
    const topLeft = 225 - shape.topWidth / 2, topRight = 225 + shape.topWidth / 2;
    const bottomLeft = 225 - shape.bottomWidth / 2, bottomRight = 225 + shape.bottomWidth / 2;
    const top = shape.top, bottom = shape.bottom;
    s += `<path d="M${topLeft} ${top} Q225 ${top + shape.topRy * 1.5} ${topRight} ${top} L${bottomRight} ${bottom} Q225 ${bottom + shape.bottomRy * 1.35} ${bottomLeft} ${bottom} Z" fill="url(#${shape.grad})"/>`;
    if (stages[i]) s += `<title>${esc(stages[i].label)} ${esc(fmtMetric(stages[i].value, opts.unit))}${esc(opts.unit || '')}</title>`;
  });
  shapes.forEach((shape, i) => {
    s += `<ellipse cx="225" cy="${shape.top}" rx="${shape.topWidth / 2}" ry="${shape.topRy}" fill="${shape.cap}" stroke="${shape.rim}" stroke-opacity=".72" stroke-width="1.5"/>`;
    if (i === 0) s += `<ellipse cx="225" cy="${shape.top - 5}" rx="${shape.topWidth / 2 - 13}" ry="${shape.topRy * .54}" fill="#dfffff" opacity=".12"/>`;
  });
  [143, 235, 318, 408].forEach((y, i) => {
    s += `<text x="225" y="${y}" text-anchor="middle" fill="#fff" font-size="25" font-weight="600" letter-spacing=".3">${esc(stages[i] ? stages[i].label : '')}</text>`;
  });
  s += `<path d="M58 266 v37 m-8 -9 8 10 8 -10 M392 266 v37 m-8 -9 8 10 8 -10" fill="none" stroke="#c6eaff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".62"/>`;
  svg.setAttribute('viewBox', '0 0 450 470');
  svg.innerHTML = s;
}

/* ── 图表：环形图（去图例 · 原因名称直接标注在环上 · 悬浮显示完整名称+占比）── */
function donutArc(cx, cy, rOut, rIn, a0, a1) {
  const pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = pt(rOut, a0), [x1, y1] = pt(rOut, a1);
  const [x2, y2] = pt(rIn, a1), [x3, y3] = pt(rIn, a0);
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${rOut},${rOut} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${rIn},${rIn} 0 ${large} 0 ${x3.toFixed(1)},${y3.toFixed(1)} Z`;
}
function renderDonut(svg, items) {
  if (!svg) return;
  const list = items || [];
  const total = list.reduce((a, b) => a + b.value, 0) || 1;
  const W = 340, H = 220, cx = 170, cy = 110, rOut = 62, rIn = 40;
  const start = -Math.PI / 2; // 12 点方向起
  let a = start, s = '';
  list.forEach((it, i) => {
    const frac = it.value / total;
    const a1 = a + frac * Math.PI * 2;
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    const name = it.short || it.label;
    s += `<path d="${donutArc(cx, cy, rOut, rIn, a, a1)}" fill="${color}" stroke="var(--surface)" stroke-width="1.5" class="donut-seg" data-label="${esc(it.label)}" data-value="${it.value}" tabindex="0" role="listitem" aria-label="${esc(it.label)} ${it.value}%"/>`;
    // 环上直接标注原因名称（短名）
    const mid = (a + a1) / 2;
    const lr = rOut + 14;
    const lx = cx + lr * Math.cos(mid), ly = cy + lr * Math.sin(mid);
    const anchor = Math.cos(mid) > 0.25 ? 'start' : Math.cos(mid) < -0.25 ? 'end' : 'middle';
    s += `<text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" text-anchor="${anchor}" fill="var(--text-2)" font-size="10">${esc(name)}</text>`;
    a = a1;
  });
  s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="var(--text)" font-size="16" font-weight="700">${list.length}</text>`;
  s += `<text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="var(--muted)" font-size="11">类原因</text>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  bindDonutTooltip(svg);
}
// 悬浮交互：鼠标悬停环上各区域 → 显示完整原因名称 + 拒绝占比
function bindDonutTooltip(svg) {
  const wrap = svg.closest('.donut-wrap') || svg.parentElement;
  if (!wrap) return;
  let tip = wrap.querySelector('.donut-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'donut-tip'; tip.hidden = true; wrap.appendChild(tip); }
  const show = (seg, ev) => {
    tip.innerHTML = `<b>${esc(seg.dataset.label)}</b><span>拒绝占比 ${esc(seg.dataset.value)}%</span>`;
    tip.hidden = false;
    const r = wrap.getBoundingClientRect();
    const x = (ev.clientX || 0) - r.left, y = (ev.clientY || 0) - r.top;
    tip.style.left = Math.min(Math.max(8, x + 12), r.width - 8) + 'px';
    tip.style.top = Math.max(8, y - 10) + 'px';
  };
  svg.onmousemove = (ev) => { const s = ev.target.closest && ev.target.closest('.donut-seg'); if (s) show(s, ev); else tip.hidden = true; };
  svg.onmouseleave = () => { tip.hidden = true; };
}

/* ── 下拉填充 ─────────────────────────────────────────────── */
function fillSelect(sel, options, placeholder) {
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = (placeholder ? [`<option value="">${esc(placeholder)}</option>`] : [])
    .concat(options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`)).join('');
  if (cur && options.includes(cur)) sel.value = cur;
}
const selVal = (sec, name) => { const el = sec.querySelector(`[data-filter="${name}"]`); return el ? el.value : ''; };

/* ── 全屏遮罩 ─────────────────────────────────────────────── */
function openFullscreen(sec) {
  const table = sec && sec.querySelector('table[data-table]');
  if (!table) return;
  const titleEl = sec.querySelector('[data-title]') || sec.querySelector('.sub-title');
  const title = (titleEl && titleEl.textContent.trim()) || '列表';
  const ov = document.createElement('div');
  ov.className = 'fs-overlay';
  ov.setAttribute('data-fs', '1');
  ov.innerHTML = `<div class="fs-panel"><div class="fs-head"><h3>${esc(title)}</h3><span class="spacer"></span><button class="icon-btn" data-action="取消" title="关闭" aria-label="关闭全屏"><svg class="icon"><use href="#i-x"/></svg></button></div><div class="fs-body"><div class="table-wrap"></div></div></div>`;
  ov.querySelector('.fs-body .table-wrap').appendChild(table.cloneNode(true));
  ov.addEventListener('click', (e) => { if (e.target === ov) closeFullscreen(); });
  document.body.appendChild(ov);
}
function closeFullscreen() { $$('[data-fs]').forEach((n) => n.remove()); }

/* ── 二次确认（原生 <dialog>）─────────────────────────────── */
function confirmDialog(text) {
  const dlg = $('#confirm-dialog');
  if (!dlg) return Promise.resolve(false);
  dlg.querySelector('[data-confirm-text]').textContent = text;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'confirm'), { once: true }));
}

/* ============================================================
 *  通用渲染件
 * ============================================================ */
/* 模块一 左栏 · 表格1 三段指标块（左指标块 / 中部指标块 / 右率值块）
 * 11 个指标块同时充当右栏趋势图导航（可点击、高亮当前项）〔R07/R09〕 */
function renderMetricGroups(stock, cat, factor) {
  const byKey = {};
  (stock.byCategory[cat] || []).forEach((m) => (byKey[m.key] = m));
  const cur = (window.__STOCK__ && window.__STOCK__.dim) || 'strategyCount';
  ['left', 'mid', 'rate'].forEach((group) => {
    const el = $(`[data-metric-group="${group}"]`);
    if (!el) return;
    el.innerHTML = (stock.metricGroups[group] || []).map((key) => {
      const m = byKey[key];
      if (!m) return '';
      const value = m.unit === '%' ? m.value : m.value * factor;
      const display = esc(fmtMetric(value, m.unit));
      const ring = `<span class="mt1-ring">环比 <em class="${dirClass(m.ringDir)}">${esc(m.ring)}</em></span>`;
      const valueHTML = `<span class="mt1-value num">${display}<span class="unit">${esc(m.unit)}</span></span>`;
      let inner;
      if (group === 'mid') {
        inner = `<span class="mt1-icon" aria-hidden="true"></span><span class="mt1-mid-line"><span class="mt1-label">${esc(m.label)}</span>${valueHTML}${ring}</span>`;
      } else if (group === 'rate') {
        inner = `<span class="mt1-rate-content"><span class="mt1-rate-head">${valueHTML}<span class="mt1-label">${esc(m.label)}</span></span>${ring}</span>`;
      } else {
        inner = `<span class="mt1-label">${esc(m.label)}</span><span class="mt1-left-bottom">${valueHTML}${ring}</span>`;
      }
      return `<button type="button" class="mt1-item mt1-item--${group}${key === cur ? ' is-active' : ''}" data-action="切换指标" data-metric="${esc(key)}" aria-pressed="${key === cur}" title="点击查看「${esc(m.label)}」近 12 个月趋势">${inner}</button>`;
    }).join('');
  });
}

/* ============================================================
 *  页面：存量策略（index.html / passive.html / control-loss.html 同构）
 *  结构：策略整体情况 → 策略执行情况 → 重点关注策略 → 策略执行明细
 * ============================================================ */
function initStock() {
  let stock = null, ovd = null;
  try { stock = env('stock'); } catch (e) { stock = null; }
  try { ovd = env('overview'); } catch (e) { ovd = null; }
  if (!stock || !ovd) { $$('[data-statewrap]').forEach((w) => setWrap(w, 'error', (DATA.error && DATA.error.message) || '数据源缺失')); return; }
  window.__OVERVIEW__ = ovd;

  window.__STOCK__ = { category: '全部', touch: '全部渠道', dim: 'strategyCount' };
  window.__ALERT_CATEGORY__ = '全部';

  // ── 模块一 · 策略整体情况（左右分栏）─────────────────────
  const secOv = $('[data-section="stockOverview"]');
  stateful(secOv, () => {
    renderCategorySeg(stock.categories);
    fillSelect($('[data-filter="touchSwitch"]', secOv), TOUCHES, null);
    const sel = $('[data-filter="touchSwitch"]', secOv);
    if (sel) sel.value = '全部渠道';
    // 第九轮 R45：重点客群下拉（默认隐藏；选项 mock）
    const crowdf = $('[data-key-crowd-field]', secOv);
    const crowd = $('[data-key-crowd]', secOv);
    if (crowd) fillSelect(crowd, ['全部客群', '高价值客群', '高活跃客群', '高流量客群', '低活跃客群'], null), (crowd.value = '全部客群');
    if (crowdf) crowdf.hidden = false;
    applyStockOverview();
  });

  // ── 模块二 · 策略执行情况（左：策略分类执行情况；中：触点产能趋势；右：业务产能明细）──
  const secExec = $('[data-section="stockExec"]');
  stateful(secExec, () => {
    renderCategoryExec();
    renderTouchCapacity();
    renderBizCapacity($('[data-section="bizCapacity2"]'), 'bizCapacity2', ovd.bizCapacity);
  });

  // ── 模块三 · 重点关注策略 ───────────────────────────────
  let alert = null;
  try { alert = env('alert'); } catch (e) { alert = null; }
  if (alert) {
    window.__ALERT__ = alert;
    window.__RULES__ = alert.rules.slice();
    const cnt = $('[data-alert-count]');
    if (cnt) cnt.textContent = `预警规则 ${alert.rules.length} 条 · 触发 ${stock.alertStrategies.rows.length} 条`;
    stateful($('[data-section="alertRules"]'), () => renderRules(''));
    stateful($('[data-section="alerts"]'), () => renderAlertStrategies());
    const form = $('#rule-dialog');
    if (form) {
      fillSelect(form.querySelector('[name="metric"]'), alert.ruleMetrics, '请选择指标');
      fillSelect(form.querySelector('[name="operator"]'), alert.operators, null);
      const op = form.querySelector('[name="operator"]'); if (op) op.value = '≥';
    }
  }

  // ── 模块四 · 策略执行明细 ───────────────────────────────
  initDetailModule();
}

/* 模块二 左栏 · 策略分类执行情况（复刻 策略分类执行情况1.png）共 33 条 / 每页 5 条；
   第十一轮 R53：新增「选择月份」「全部渠道」筛选 + 数值列表头可排序；随全局分类/触点刷新 */
function renderCategoryExec() {
  const sec = $('[data-section="categoryExec"]');
  const ce = window.__OVERVIEW__ && window.__OVERVIEW__.categoryExec;
  if (!sec || !ce) return;
  const st = window.__STOCK__ || {};
  fillSelect($('[data-filter="month"]', sec), (ce.filters && ce.filters.months) || [], '选择月份');
  fillSelect($('[data-filter="big"]', sec), ce.filters.bigs, '全部策略大类');
  fillSelect($('[data-filter="sub"]', sec), ce.filters.subs, '全部策略小类');
  fillSelect($('[data-filter="touch"]', sec), (ce.filters && ce.filters.touches) || TOUCHES.slice(1), '全部渠道');
  const big = selVal(sec, 'big'), sub = selVal(sec, 'sub'), touch = selVal(sec, 'touch');
  const rows = ce.rows.filter((r) => matchCat(r, st.category) && matchTouch(r, st.touch)
    && (!big || r.big === big) && (!sub || r.sub === sub) && (!touch || r.touch === touch));
  renderTable(sec, ce.columns, rows, { empty: '暂无执行数据', sortable: true });
  const globalActive = (st.category && st.category !== '全部') || (st.touch && st.touch !== '全部渠道');
  const active = !!(big || sub || touch || globalActive);
  const total = active ? rows.length : ce.total;
  sec._total = total; sec._size = ce.size; sec._page = 1;
  sec._sampleLimited = !active && ce.total > rows.length; sec._filtered = active;
  renderPager(sec, 'categoryExec', { page: 1, size: ce.size, total, rows: rows.length });
  refreshNote(sec);
}
function resetCategoryExec() {
  const sec = $('[data-section="categoryExec"]');
  if (!sec) return;
  $$('[data-filter]', sec).forEach((f) => { f.value = ''; });
  renderCategoryExec();
}

/* 模块二 中栏 · 触点产能趋势（柱线组合·折线在柱上方）——随全局触点/分类刷新，卡头显示当前触点名 */
function renderTouchCapacity() {
  const sec = $('[data-section="touchCapacity"]');
  const tc = window.__OVERVIEW__ && window.__OVERVIEW__.touchCapacity;
  if (!sec || !tc) return;
  const st = window.__STOCK__ || {};
  const key = st.touch || '全部渠道';
  const note = $('[data-cap-touch]', sec); if (note) note.textContent = key;
  const cf = (tc.catFactors && tc.catFactors[st.category]) || 1;
  const cfg = tc.byTouch[key] || tc.byTouch['全部渠道'];
  const bars = cfg.bars.map((v) => Math.round(v * cf));
  // 柱线组合图：折线独占顶部带、柱体占下部，二者不重叠；加高画布减少左右留白
  renderBarLine($('[data-chart="touchCapacity"]', sec), { categories: cfg.categories, bars, line: cfg.line, barLabel: '产能', lineLabel: '环比', lineAbove: true, w: 520, h: 320 });
}

/* 模块二 右栏 / 模块四 右栏 · 业务产能明细（页面2 / 页面3 同口径；随全局分类刷新）*/
function renderBizCapacity(sec, key, conf) {
  if (!sec || !conf) return;
  const st = window.__STOCK__ || {};
  const rows = conf.rows.filter((r) => matchCat(r, st.category));
  renderTable(sec, conf.columns, rows, { empty: '暂无业务产能数据' });
  const active = st.category && st.category !== '全部';
  sec._total = active ? rows.length : conf.total; sec._size = conf.size; sec._page = 1;
  sec._sampleLimited = !active && conf.total > rows.length; sec._filtered = active;
  renderPager(sec, key, { page: 1, size: conf.size, total: sec._total, rows: rows.length });
  refreshNote(sec);
}

/* ── 模块一 分类按钮组 × 重点客群：互斥 + 联动 + 三节点校验（第十轮 R47-R50）── */
function segButtons() {
  return Array.from(document.querySelectorAll('[data-seg="category"] .seg-btn'));
}
function crowdButton() { return document.querySelector('[data-seg="category"] .seg-btn[data-crowd-toggle]'); }
function crowdField() { return document.querySelector('[data-key-crowd-field]'); }

/* 互斥入口：唯一授权点——active = 目标按钮元素（null 即全部取消）。
   规则：任一时刻至多一个选中（R47）；选分类→下拉隐藏、选重点客群→下拉显示（R48）。 */
function applySegMutex(active) {
  segButtons().forEach((b) => b.setAttribute('aria-pressed', String(b === active)));
  const cf = crowdField();
  if (cf) cf.hidden = false;
  validateSegState('applySegMutex');
}

/* 第十三轮 R57-R60：模块一左侧导航按钮 统一联动入口。
   左侧按钮 = 分类按钮组 `.seg-btn`（含「重点客群」）+ 指标块导航 `.mt1-item`。
   规则：除「重点客群」外，点击任一左侧按钮 → 立即隐藏右侧「重点客群」下拉（并清其选中态，保持 R48 不变式）。
   返回 true = 已按规则执行隐藏；false = 重点客群按钮，交由 `case '重点客群'` 处理。 */
function onLeftNavClick(btn) {
  if (!btn || btn.hasAttribute('data-crowd-toggle')) return false;
  const cb = crowdButton();
  if (cb && cb.getAttribute('aria-pressed') === 'true') cb.setAttribute('aria-pressed', 'false');
  const cf = crowdField();
  if (cf) cf.hidden = false;
  validateSegState('左侧导航·非重点客群');                       // 复核互斥/联动一致性
  return true;
}

/* 三节点校验（R49）：互斥（选中数 ≤ 1）且 下拉可见 ⇔ 重点客群选中；失败自动自愈收敛 + 暴露快照 */
function validateSegState(where) {
  const on = (b) => b.getAttribute('aria-pressed') === 'true';
  const cb = crowdButton();
  const cf = crowdField();
  let sel = segButtons().filter(on);
  let crowdOn = !!(cb && on(cb));
  let visible = !!(cf && !cf.hidden);
  let ok = sel.length <= 1 && visible;
  const repaired = !ok; // 自愈发生与否（修复前状态）
  if (!ok) { // 自愈回滚〔R49〕：多选→仅保留首个选中；下拉可见性强制对齐「重点客群」选中态
    const keep = sel[0] || null;
    segButtons().forEach((b) => b.setAttribute('aria-pressed', String(b === keep)));
    if (cf) cf.hidden = false;
    sel = segButtons().filter(on);
    crowdOn = !!(cb && on(cb));
    visible = !!(cf && !cf.hidden);
    ok = sel.length <= 1 && visible;
  }
  try { window.__SEG_STATE__ = { sel: sel.map((b) => b.textContent.trim()), crowdOn, visible, ok, repaired, at: where, ts: Date.now() }; }
  catch (_) { /* 非浏览器环境忽略 */ }
  if (!ok) console.warn('[seg] 状态校验失败 @', where);
  return ok;
}

/* 5 个分类筛选按钮（横向）+ 触点下拉 → 级联刷新（平滑过渡）
   第九轮 R45：分类组末端（「离」后）追加「重点客群」显隐按钮 */
function renderCategorySeg(categories) {
  const seg = $('[data-seg="category"]');
  if (!seg) return;
  seg.innerHTML = categories.map((c, i) =>
    `<button class="seg-btn" type="button" data-action="切换策略分类" data-category="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`
  ).join('') +
    `<button class="seg-btn seg-btn--crowd" type="button" data-action="重点客群" data-crowd-toggle aria-pressed="false">重点客群</button>`;
  validateSegState('页面初始化'); // 三节点①：渲染后即校验默认态（全部选中、下拉隐藏）
}

function setCategory(cat) {
  const st = window.__STOCK__;
  if (!st) return;
  const changed = st.category !== cat;
  st.category = cat;
  const target = segButtons().find((b) => b.dataset.category === cat);
  applySegMutex(target); // 选分类 → 清重点客群选中 + 隐藏下拉（含「重点客群选中时点当前分类」同样收敛，消死区）〔R47〕
  if (!changed) { validateSegState('点击切换·分类不变'); return; } // 数据未变、仅选中态收敛 → 不整页刷新
  smoothSwap($('.page-main'), refreshAll); // 全局控制器：整页四大模块同步刷新
  validateSegState('组件状态更新');
}
function setTouch(value) {
  const st = window.__STOCK__;
  const touchLabel = document.querySelector('[data-touch-switch-label]');
  if (touchLabel) touchLabel.textContent = value === '全部渠道' ? '触点切换' : value;
  if (!st || st.touch === value) return;
  st.touch = value;
  const ss = $('[data-filter="touchSwitch"]'); if (ss) ss.value = value;
  smoothSwap($('.page-main'), refreshAll); // 全局控制器：整页四大模块同步刷新
}

/* 全局级联：分类 + 触点变化 → 刷新整页四大模块所有相关数据 〔R05/R27〕*/
function refreshAll() {
  if (!window.__STOCK__) return;
  applyStockOverview();                                   // 模块一：指标块 + 漏斗 + 趋势
  renderCategoryExec();                                   // 模块二：策略分类执行情况
  renderTouchCapacity();                                  // 模块二：触点产能趋势
  renderBizCapacity($('[data-section="bizCapacity2"]'), 'bizCapacity2', (window.__OVERVIEW__ || {}).bizCapacity);
  renderAlertStrategies();                                // 模块三：预警策略
  renderExecTable();                                      // 模块四：逐策略表
  renderBizCapacity($('[data-section="bizCapacity4"]'), 'bizCapacity4', (window.__DETAIL__ || {}).bizCapacity);
  renderDailyExec(currentDailyTab());                     // 模块四：分日明细
  validateSegState('组件状态更新·refreshAll');            // 三节点③：全局刷新后复核互斥/联动
}

/* 分类 × 触点组合 → 左栏指标块 + 灰色漏斗 + 右栏柱线图统一刷新（数据一致）*/
function applyStockOverview() {
  const st = window.__STOCK__;
  const stock = env('stock');
  const cat = st.category;
  const factor = stock.touchFactors[st.touch] || 1;

  // 左栏 · 三段指标块（表格1：左指标块 / 中部指标块 / 右率值块）
  renderMetricGroups(stock, cat, factor);

  // 左栏 · 指标漏斗（青→蓝渐变 · 段内仅标签，与指标块同源）〔R36/USR-18〕
  const fitems = (stock.funnelByCategory[cat] || []).map((f) => ({ label: f.label, value: f.value * factor }));
  renderFunnel($('[data-chart="metricFunnel"]'), fitems, { unit: '万户', labelsOnly: true, colors: FUNNEL_CYAN });

  const note = $('[data-combo-note]');
  if (note) note.textContent = `分类：${cat} · 触点：${st.touch}`;

  // 右栏 · 柱线组合图
  applyStockTrend();
}

/* 柱状图：点击左侧指标块切换维度（已移除维度/周期下拉，周期固定近 12 个月）〔R07/R09/R10〕*/
function applyStockTrend() {
  const st = window.__STOCK__;
  const stock = env('stock');
  const isRate = (stock.rateKeys || []).indexOf(st.dim) >= 0;
  const cf = stock.catFactors[st.category] || 1;
  const tf = stock.touchFactors[st.touch] || 1;
  const factor = isRate ? 1 : cf * tf; // 率值类指标不随分类/触点缩放
  const t = stock.trends[st.dim] || stock.trends.strategyCount;
  const months = stock.months.slice();
  const bars = t.bars.map((v) => Math.round(v * factor * 100) / 100);
  const line = t.line.slice();
  const dimLabel = (stock.metricDims.find((d) => d.key === st.dim) || {}).label || '';
  const dl = $('[data-dim-label]'); if (dl) dl.textContent = dimLabel;
  renderOverviewTrend($('[data-chart="stockTrend"]'), {
    categories: months,
    bars,
    line,
    barLabel: dimLabel,
    drillDim: st.dim,
    axisLabel: st.dim === 'strategyCount' ? '成功量' : dimLabel,
    axisMax: st.dim === 'strategyCount' ? 2000 : Math.max(...bars, 0)
  });
}
/* 点击左侧指标导航栏的指标项 → 切换趋势维度并同步高亮 */
function setDim(key) {
  const st = window.__STOCK__; if (!st || !key) return;
  st.dim = key;
  const stock = env('stock');
  renderMetricGroups(stock, st.category, stock.touchFactors[st.touch] || 1);
  applyStockTrend();
}

/* 图表下钻：点击柱体 → 该月各维度明细（全屏遮罩）*/
function openDrillFullscreen(month, dimKey) {
  const stock = env('stock');
  const st = window.__STOCK__;
  const idx = stock.months.indexOf(month);
  if (idx < 0) { toast('该月份暂无明细'); return; }
  const cf = stock.catFactors[st.category] || 1;
  const tf = stock.touchFactors[st.touch] || 1;
  const dimLabel = (stock.metricDims.find((d) => d.key === dimKey) || {}).label || '';
  const cols = [
    { key: 'label', label: '指标维度', type: 'text' },
    { key: 'v',     label: '数值',     type: 'num' },
    { key: 'ring',  label: '环比',     type: 'pct' }
  ];
  const rows = stock.metricDims.map((d) => {
    const t = stock.trends[d.key];
    const isRate = (stock.rateKeys || []).indexOf(d.key) >= 0;
    const f = isRate ? 1 : cf * tf;
    const lv = t.line[idx];
    return { label: d.label, v: fmtTick(Math.round(t.bars[idx] * f * 100) / 100), ring: (lv > 0 ? '+' : '') + lv + '%', ringDir: lv >= 0 ? 'up' : 'down' };
  });
  const ov = document.createElement('div');
  ov.className = 'fs-overlay';
  ov.setAttribute('data-fs', '1');
  ov.innerHTML = `
    <div class="fs-panel">
      <div class="fs-head">
        <h3>趋势下钻 · ${esc(month)} · ${esc(dimLabel)}</h3><span class="spacer"></span>
        <span class="muted" style="font-size:12px">分类：${esc(st.category)} · 触点：${esc(st.touch)}</span>
        <button class="icon-btn" data-action="取消" title="关闭" aria-label="关闭全屏"><svg class="icon"><use href="#i-x"/></svg></button>
      </div>
      <div class="fs-body">
        <div class="table-wrap"><table class="data-table" data-table="drill"><thead></thead><tbody data-rows></tbody></table></div>
        <div class="table-note"><span>点击柱体下钻得到的该月各指标维度明细（原型：由 12 个月趋势数据同源取值）</span></div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeFullscreen(); });
  renderTable(ov, cols, rows);
}

function renderAlertCategoryFilters(categories, selected) {
  const wrap = $('[data-alert-categories]');
  if (!wrap) return;
  const options = ['全部', ...categories];
  wrap.innerHTML = options.map((category) =>
    `<button type="button" data-action="切换预警策略分类" data-alert-category="${esc(category)}" aria-pressed="${category === selected}">${esc(category)}</button>`
  ).join('');
}
/* 预警策略查看：随全局分类/触点刷新，并支持策略分类筛选。*/
function renderAlertStrategies() {
  const sec = $('[data-section="alerts"]');
  const stock = env('stock');
  const cfg = stock.alertStrategies;
  const st = window.__STOCK__ || {};
  const selectedCategory = window.__ALERT_CATEGORY__ || '全部';
  const categories = Array.from(new Set(cfg.rows.map((r) => r.strategyCat).filter(Boolean)));
  renderAlertCategoryFilters(categories, selectedCategory);
  const cols = [{ key: '__pick', label: '', type: 'pick' }].concat(
    cfg.columns.filter((column) => column.key !== 'strategyCat')
  );
  const globalActive = selectedCategory !== '全部' || (st.category && st.category !== '全部') || (st.touch && st.touch !== '全部渠道');
  const rows = cfg.rows.filter((r) =>
    (selectedCategory === '全部' || r.strategyCat === selectedCategory) && matchCat(r, st.category) && matchTouch(r, st.touch)
  );
  renderTable(sec, cols, rows, { empty: '当前无触发预警的策略' });
  const total = globalActive ? rows.length : cfg.total;
  sec._total = total; sec._size = cfg.size; sec._page = 1;
  sec._sampleLimited = !globalActive && cfg.total > rows.length; sec._filtered = globalActive;
  renderPager(sec, 'alerts', { page: 1, size: cfg.size, total, rows: rows.length });
  refreshNote(sec);
  updateSelectedCount(sec);
  const cnt = $('[data-alert-count]');
  if (cnt) cnt.textContent = `预警规则 ${((window.__ALERT__ || {}).rules || []).length} 条 · 触发 ${rows.length} 条`;
}

/* ── 模块四：策略执行明细（五个子区域）────────────────────── */
function initDetailModule() {
  let d = null;
  try { d = env('detail'); } catch (e) { d = null; }
  if (!d) { $$('[data-statewrap]').forEach((w) => setWrap(w, 'error', '数据源缺失')); return; }
  window.__DETAIL__ = d;

  // ① 策略执行情况（逐策略表：筛选 / 排序 / 导出）—— 触点/渠道由模块一全局控制器统一控制
  //   第十一轮 R54：按新参考图改为「选择月份 + 策略名 + 渠道 + 搜索 + 重置 + 导出」工具条，表头可排序
  const secT = $('[data-section="execTable"]');
  const se = (DATA.overview && DATA.overview.data.strategyExec) || null;
  stateful(secT, () => {
    if (!se) { setWrap(secT.querySelector('[data-statewrap]'), 'error', '缺少策略执行数据'); return; }
    fillSelect($('[data-filter="month"]', secT), (se.filters && se.filters.months) || [], '选择月份');
    fillSelect($('[data-filter="touch"]', secT), (se.filters && se.filters.touches) || TOUCHES.slice(1), '全部渠道');
    renderExecTable();
  });

  // ② 策略详情（无「展开/收起」按钮，字段全部默认常显〔R44〕）—— 精简为 5 个核心属性
  stateful($('[data-section="strategyInfo"]'), () => {
    const list = $('[data-detail-list]');
    if (!list) return;
    list.innerHTML = Object.keys(d.info).map((k) => `<dt>${esc(k)}</dt><dd>${esc(d.info[k])}</dd>`).join('');
    const nm = $('[data-detail-name]'); if (nm) nm.textContent = d.info['策略名称'];
  });

  // ③ 策略拒绝原因（去图例 · 原因名称直接标注在环上 · 悬浮显示完整名称+占比）
  stateful($('[data-section="rejectReason"]'), () => {
    renderDonut($('[data-chart="rejectReasons"]'), d.rejectReasons);
  });

  // ④ 策略产能（第十一轮 R51：去滚动条——画布比例贴合四宫格单元格，柱线无滚动完整展示）
  stateful($('[data-section="capacity"]'), () => {
    renderBarLine($('[data-chart="capacity"]'), Object.assign({ w: 320, h: 168 }, d.capacity));
  });

  // ⑤ 业务产能明细（模块四右栏）
  stateful($('[data-section="bizCapacity4"]'), () => {
    renderBizCapacity($('[data-section="bizCapacity4"]'), 'bizCapacity4', d.bizCapacity);
  });

  // ⑥ 分日执行明细（分日 / 非上线 两标签）
  stateful($('[data-section="dailyExec"]'), () => {
    window.__DAILY__ = { daily: d.execDaily, nononline: d.execNonOnline };
    renderDailyExec('daily');
  });
}

function renderExecTable() {
  const sec = $('[data-section="execTable"]');
  const se = (DATA.overview && DATA.overview.data.strategyExec) || null;
  if (!sec || !se) return;
  const st = window.__STOCK__ || {};
  const touch = selVal(sec, 'touch');
  const nameEl = $('[data-filter="name"]', sec);
  const kw = (nameEl ? nameEl.value : '').trim().toLowerCase();
  const globalActive = (st.category && st.category !== '全部') || (st.touch && st.touch !== '全部渠道');
  const active = !!(touch || kw || globalActive);
  const rows = se.rows.filter((r) => matchCat(r, st.category) && matchTouch(r, st.touch)
    && (!touch || r.touch === touch)
    && (!kw || String(r.name).toLowerCase().includes(kw)));
  // 第十一轮 R54：首列复选（pick），与参考图一致
  const cols = [{ key: '__pick', label: '', type: 'pick' }].concat(se.columns);
  renderTable(sec, cols, rows, { empty: '没有符合筛选条件的策略', sortable: true });
  const total = active ? rows.length : (se.total || rows.length);
  sec._total = total; sec._size = se.size; sec._page = 1;
  sec._sampleLimited = !active && total > rows.length; sec._filtered = active;
  renderPager(sec, 'execTable', { page: 1, size: se.size, total, rows: rows.length });
  refreshNote(sec);
  updateSelectedCount(sec);      // 复选计数
  updatePickedNote(sec);         // 「已选策略：… 查看全部」提示
}
function resetExecTable() {
  const sec = $('[data-section="execTable"]');
  if (!sec) return;
  $$('[data-filter]', sec).forEach((f) => { f.value = ''; });
  renderExecTable();
}

/* 当前「执行明细」标签（分日 / 非上线）*/
function currentDailyTab() {
  const b = $('[data-action="执行明细标签切换"][aria-selected="true"]');
  return (b && b.dataset.tab) || 'daily';
}
function renderDailyExec(which) {
  const sec = $('[data-section="dailyExec"]');
  const conf = window.__DAILY__ && window.__DAILY__[which];
  if (!sec || !conf) return;
  $$('[data-action="执行明细标签切换"]', sec).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === which)));
  const st = window.__STOCK__ || {};
  const active = !!(st.category && st.category !== '全部');
  const rows = (conf.rows || []).filter((r) => matchCat(r, st.category));
  renderTable(sec, conf.columns, rows, { empty: '暂无数据' });
  const total = active ? rows.length : conf.total;
  sec._total = total; sec._size = conf.size; sec._page = 1;
  sec._sampleLimited = !active && conf.total > rows.length; sec._filtered = active;
  renderPager(sec, 'dailyExec', { page: 1, size: conf.size, total, rows: rows.length });
  refreshNote(sec);
}

/* 策略详情：从执行表选中某策略 → 定位到详情卡片（字段全部默认常显，无折叠） */
function selectStrategy(name) {
  const d = window.__DETAIL__;
  if (!d || !name) return;
  const list = $('[data-detail-list]');
  if (list) {
    const info = Object.assign({}, d.info, { '策略名称': name });
    list.innerHTML = Object.keys(info).map((k) => `<dt>${esc(k)}</dt><dd>${esc(info[k])}</dd>`).join('');
  }
  const nm = $('[data-detail-name]'); if (nm) nm.textContent = name;
  const card = $('[data-section="strategyInfo"]');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast(`已加载策略「${name}」详情`);
}

/* ============================================================
 *  预警规则配置（新增 / 编辑 / 删除）
 * ============================================================ */
function ruleItemHTML(r) {
  return `<div class="rule-item" data-rule="${esc(r.id)}">
      <div class="top">
        <span class="name">${esc(r.name)}</span>
        ${r.expired ? '<span class="badge expired">已过期</span>' : '<span class="badge tag-touch">生效中</span>'}
        <span class="spacer"></span>
        <button class="icon-btn" data-action="编辑规则" data-id="${esc(r.id)}" title="编辑" aria-label="编辑规则"><svg class="icon"><use href="#i-pencil"/></svg></button>
        <button class="icon-btn" data-action="删除规则" data-id="${esc(r.id)}" title="删除" aria-label="删除规则"><svg class="icon"><use href="#i-trash-2"/></svg></button>
      </div>
      <div class="cond">触发条件：${esc(r.metric)} ${esc(r.operator)} ${esc(r.threshold)}</div>
      <div class="meta"><span>生效：${esc(r.start)} ~ ${esc(r.end)}</span><span>${esc(r.created)}</span></div>
    </div>`;
}
function renderRules(keyword) {
  const sec = $('[data-section="alertRules"]');
  const list = $('[data-rules]', sec);
  if (!list) return;
  const kw = (keyword || '').trim().toLowerCase();
  const rules = window.__RULES__ || [];
  const rows = rules.filter((r) => !kw || r.name.toLowerCase().includes(kw) || r.metric.toLowerCase().includes(kw));
  list.innerHTML = rows.length ? rows.map(ruleItemHTML).join('') : '<p class="muted" style="padding:12px">无匹配规则</p>';
  const cnt = $('[data-alert-count]');
  if (cnt && window.__STOCK__) cnt.textContent = `预警规则 ${rules.length} 条 · 触发 ${env('stock').alertStrategies.rows.length} 条`;
}
function openRuleDialog(id) {
  const dlg = $('#rule-dialog');
  if (!dlg) return;
  const editing = !!id;
  dlg.dataset.editing = id || '';
  dlg.querySelector('[data-dialog-title]').textContent = editing ? '编辑预警规则' : '新增预警规则';
  const r = editing ? (window.__RULES__ || []).find((x) => x.id === id) : null;
  dlg.querySelector('[name="name"]').value = r ? r.name : '';
  dlg.querySelector('[name="metric"]').value = r ? r.metric : '';
  dlg.querySelector('[name="operator"]').value = r ? r.operator : '≥';
  dlg.querySelector('[name="threshold"]').value = r ? r.threshold : '';
  dlg.querySelector('[name="start"]').value = r ? r.start : '';
  dlg.querySelector('[name="end"]').value = r ? r.end : '';
  $$('.err', dlg).forEach((el) => (el.textContent = ''));
  $$('.invalid', dlg).forEach((el) => el.classList.remove('invalid'));
  dlg.showModal();
}
function submitRule(btn) {
  const dlg = btn.closest('dialog');
  if (!dlg) return;
  const name = dlg.querySelector('[name="name"]');
  const metric = dlg.querySelector('[name="metric"]');
  const operator = dlg.querySelector('[name="operator"]');
  const threshold = dlg.querySelector('[name="threshold"]');
  const start = dlg.querySelector('[name="start"]');
  const end = dlg.querySelector('[name="end"]');
  const setErr = (el, msg) => { const e = el.closest('.field').querySelector('.err'); if (e) e.textContent = msg; el.classList.toggle('invalid', !!msg); };
  let ok = true;
  if (!name.value.trim()) { setErr(name, '规则名称必填'); ok = false; } else setErr(name, '');
  if (!metric.value) { setErr(metric, '请选择指标条件'); ok = false; } else setErr(metric, '');
  if (!threshold.value.trim()) { setErr(threshold, '阈值必填'); ok = false; } else setErr(threshold, '');
  if (start.value && end.value && end.value < start.value) { setErr(end, '结束时间须晚于开始时间'); ok = false; } else setErr(end, '');
  if (!ok) return;

  const editing = dlg.dataset.editing;
  const startV = start.value || '2026-10-01';
  const endV = end.value || '2026-10-08';
  if (editing) {
    const r = (window.__RULES__ || []).find((x) => x.id === editing);
    if (r) Object.assign(r, { name: name.value.trim(), metric: metric.value, operator: operator.value, threshold: threshold.value.trim(), start: startV, end: endV });
  } else {
    window.__RULES__.unshift({
      id: 'r' + Date.now(), name: name.value.trim(), metric: metric.value, operator: operator.value,
      threshold: threshold.value.trim(), start: startV, end: endV, expired: false,
      created: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
  }
  renderRules($('#rule-search') ? $('#rule-search').value : '');
  dlg.close('submit');
  toast(editing ? '已保存修改（原型：仅内存更新）' : '新增规则成功（原型：仅内存新增）');
}

/* ── 收藏计数（表头「已选 N 项」）─────────────────────────── */
function updateSelectedCount(sec) {
  if (!sec) return;
  const el = sec.querySelector('[data-selected]');
  if (el) el.textContent = `已选 ${$$('input[data-pick]:checked', sec).length} 项`;
}

/* 第十一轮 R54：逐策略表「已选策略：<名> 查看全部」提示（选中行内策略名）。
   复选或行内点策略名均可触发；仅单条时显示其名。 */
function updatePickedNote(sec) {
  if (!sec) return;
  const wrap = sec.querySelector('[data-picked-note]');
  if (!wrap) return;
  const picked = $$('input[data-pick]:checked', sec);
  const nameEl = wrap.querySelector('[data-picked-name]');
  const allBtn = wrap.querySelector('[data-action="查看全部"]');
  const show = picked.length > 0;
  wrap.hidden = !show;
  if (nameEl) nameEl.textContent = sec.dataset.pickedName || `已选 ${picked.length} 条`;
  if (allBtn) allBtn.hidden = picked.length <= 1;
}

/* ============================================================
 *  启动 + 事件委托
 * ============================================================ */
function boot() {
  initTheme();
  markNav();
  const page = document.body.dataset.page;
  try {
    if (page === 'stock' || page === 'increment' || page === 'product') initStock();
  } catch (e) {
    toast(e.message || '加载失败');
  }
}

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('hashchange', boot);

/* 点击委托：所有 data-action 在此分发（值 = prototype-design.md §3 #交互名）── */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const act = btn.dataset.action;
  const sec = btn.closest('[data-section]');
  // 第十三轮 R57-R60：模块一左侧导航按钮统一联动——点击非「重点客群」左侧按钮 → 立即隐藏右侧重点客群下拉；
  //   在此统一拦截（分类按钮 `.seg-btn` + 指标块导航 `.mt1-item`），随后仍走下方 switch 完成各自业务动作。
  if (btn.classList.contains('mt1-item') || btn.classList.contains('seg-btn')) onLeftNavClick(btn);
  switch (act) {
    case '切换主题': toggleTheme(); break;
    case '取消':
      if (btn.closest('dialog')) btn.closest('dialog').close('cancel');
      closeFullscreen();
      break;

    case '加载列表': // error 态「重试」：清掉 #state= 重新加载
      if (location.hash) location.hash = '';
      else boot();
      break;

    case '导出':
      toast('已导出（原型：仅提示，未生成文件）');
      break;

    case '重点客群': { // 第十轮 R47/R48：点击「重点客群」→ 互斥选中 + 下拉显隐（再点取消）
      e.preventDefault();
      const cb = crowdButton();
      if (!cb) break;
      const wasOn = cb.getAttribute('aria-pressed') === 'true';
      applySegMutex(wasOn ? null : cb); // 已选中→取消（下拉隐藏）；未选中→选中（下拉显示）
      validateSegState('点击切换·重点客群');
      break;
    }

    case '列表全屏': {
      const target = btn.dataset.target ? $(`[data-section="${btn.dataset.target}"]`) : sec;
      if (target) openFullscreen(target);
      break;
    }

    case '搜索':
      if (btn.dataset.scope === 'execTable') renderExecTable();
      else if (btn.dataset.scope === 'categoryExec') renderCategoryExec();
      else if (btn.dataset.scope === 'alertRules') renderRules($('#rule-search').value);
      break;

    case '重置':
      if (btn.dataset.scope === 'execTable') resetExecTable();
      else if (btn.dataset.scope === 'categoryExec') resetCategoryExec();
      else if (btn.dataset.scope === 'alertRules') { $('#rule-search').value = ''; renderRules(''); }
      break;

    case '翻页': {
      const nav = document.querySelector(`[data-pager="${btn.dataset.pagerkey}"]`);
      if (!nav) break;
      nav.dataset.page = btn.dataset.page;
      paintPager(nav);
      const secEl = nav.closest('[data-section]');
      if (secEl) { secEl._page = +btn.dataset.page; secEl._total = +nav.dataset.total; secEl._size = +nav.dataset.size; refreshNote(secEl); }
      break;
    }

    case '切换策略分类':
      setCategory(btn.dataset.category);
      break;

    case '切换预警策略分类':
      window.__ALERT_CATEGORY__ = btn.dataset.alertCategory || '全部';
      renderAlertStrategies();
      break;

    case '切换指标':
      setDim(btn.dataset.metric);
      break;

    case '指标下钻':
      openDrillFullscreen(btn.dataset.month, btn.dataset.dim);
      break;

    case '展开策略详情':
      if (btn.dataset.name) selectStrategy(btn.dataset.name);
      break;

    case '执行明细标签切换':
      renderDailyExec(btn.dataset.tab);
      break;

    case '新增预警规则':
      openRuleDialog(null);
      break;

    case '编辑规则':
      openRuleDialog(btn.dataset.id);
      break;

    case '删除规则': {
      const r = (window.__RULES__ || []).find((x) => x.id === btn.dataset.id);
      if (await confirmDialog(`确认删除该预警规则${r ? `「${r.name}」` : ''}？`)) {
        window.__RULES__ = window.__RULES__.filter((x) => x.id !== btn.dataset.id);
        renderRules($('#rule-search') ? $('#rule-search').value : '');
        toast('已删除（原型：仅内存更新，未持久化）');
      }
      break;
    }

    case '确认删除': // 二次确认弹窗的确认键（returnValue=confirm 由 confirmDialog 读取）
      break;

    case '提交规则':
      e.preventDefault(); // 阻止 method="dialog" 的原生关闭，交由校验决定
      submitRule(btn);
      break;

    case '排序': { // 第十一轮 R53/R54：数值列表头点击 → 切换升/降序并重渲
      const s = btn.closest('[data-section]');
      if (s) {
        if (s._sortKey === btn.dataset.key) s._sortDir = s._sortDir === 'asc' ? 'desc' : 'asc';
        else { s._sortKey = btn.dataset.key; s._sortDir = 'desc'; }
        if (s.dataset.section === 'categoryExec') renderCategoryExec();
        else if (s.dataset.section === 'execTable') renderExecTable();
      }
      break;
    }

    case '收藏': // 第十一轮 R54：收藏（原型：仅提示）
      toast('已收藏该策略（原型：仅提示）');
      break;

    case '查看全部': { // 第十一轮 R54：展开全部已选策略（原型：仅提示）
      const s = btn.closest('[data-section]');
      const n = s ? $$('input[data-pick]:checked', s).length : 0;
      toast(`已选 ${n} 条策略（原型：仅提示）`);
      break;
    }
  }
});

/* 下拉 / 复选 change 联动 */
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('[data-key-crowd]')) {
    const label = document.querySelector('[data-key-crowd-label]');
    if (label) label.textContent = t.value === '全部客群' ? '重点客群' : t.value;
    return;
  }
  if (t.dataset.action === '切换触点') { setTouch(t.value); return; }
  if (t.matches('[data-pick]')) {
    const sec = t.closest('[data-section]');
    updateSelectedCount(sec);
    if (sec && sec.dataset.section === 'execTable') {
      if (t.checked && t.dataset.name) sec.dataset.pickedName = t.dataset.name;
      updatePickedNote(sec);
    }
    return;
  }
  if (t.closest('[data-section="categoryExec"]')) renderCategoryExec();
  else if (t.closest('[data-section="execTable"]')) renderExecTable();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'rule-search') renderRules(e.target.value);
});

/* Esc 关闭全屏遮罩 */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFullscreen(); });
