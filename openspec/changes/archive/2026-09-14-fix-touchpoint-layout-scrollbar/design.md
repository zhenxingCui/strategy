## Context

探查结论（详见探查记录）：

**对齐问题**（`TouchpointExecution.vue`）：
- 左栏 `.left-panel` 为 flex column；右栏 `.right-panel` **无任何样式规则**，普通块级堆叠。
- 右栏顶部多一条 filter-bar（约 30px），左栏表格直接开始 → 左右首表起点天然错位约 30px。
- 左表 `max-height="280"` 动态高度 vs 右表 `height="160"/"200"` 固定 + `.table-footer` 分页行。
- 主 grid `gap: 10px` vs 内部 `.channel-bottom-grid` `gap: 8px`；左栏用 margin 分隔、右栏用虚线 border 分隔。

**滚动条问题**：
- 全 `front/src` 仅 `styles/index.less` 有 `.scrollbar-thin` 工具类（需手动挂 class），无全局 `::-webkit-scrollbar` 规则。
- el-table 滚动条在内部子元素上，scoped 样式无法覆盖；页面级 `.strategy-review-page`（index.vue）为浏览器默认滚动条。
- `App.vue` 存在唯一的非 scoped 全局 `<style>` 块，是改动最小的落点。

## Goals / Non-Goals

**Goals:**
- 左右两栏首块起点与分界线视觉对齐，间距/分隔统一。
- 全站滚动条统一为 6px 细条样式。

**Non-Goals:**
- 不改触点执行的任何数据逻辑与接口。
- 不重构整个页面栅格系统，仅处理本组件两栏与全局滚动条。

## Decisions

### Decision 1: 优先「样式层对齐」，不做模板大重构

不动「左栏套子 grid、右栏堆叠」的大结构（重构收益需回归整个组件），采用最小侵入组合：

1. `.right-panel` 补 `display:flex; flex-direction:column; min-width:0`，与左栏对称。
2. 消除首块高度差：右栏 filter-bar 行改为一行内紧凑布局（或与标题同行），使左右首表起点接近同一水平线；若保留 filter-bar，则左栏标题下补等高占位。实现时以实际渲染效果取更简单方案。
3. 表格高度策略统一：左表与右表统一为固定 `height`（或统一动态），保证上块底边可预期。
4. 统一 gap 为 10px、分隔方式统一（右栏虚线保留、左栏对应位置补同款虚线或统一用间距）。

### Decision 2: 滚动条规则加在 App.vue 全局 style 块

在 `App.vue` 非 scoped `<style>` 追加：

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
::-webkit-scrollbar-track { background: transparent; }
```

- 备选：仅在本组件非 scoped 块写 `.strategy-review-page::-webkit-scrollbar` → 覆盖不到其他页面的 el-table，且客户反馈是通用观感问题。
- Element UI 表头 gutter 宽度为运行时实测，收窄滚动条无需额外处理。

## Risks / Trade-offs

- [样式对齐依赖实际渲染效果] → 不同分辨率/数据行数下两栏高度可能仍有细微差；以「首块起点对齐 + 分界线对齐」为验收标准，实施时需在 1920 宽度下目检。
- [全局滚动条影响其他页面] → 预期即统一观感；若后续某页需要不同样式，可局部覆盖。