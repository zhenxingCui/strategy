## 1. 触点执行左右两栏对齐

- [x] 1.1 `TouchpointExecution.vue`：给 `.right-panel` 补与 `.left-panel` 对称的 flex column 样式 —— verify：右栏内部区块按列布局、min-width:0 生效
- [x] 1.2 消除左右首块起点高度差：左右各设固定 280px 的 `.top-block`（标题+表格弹性填充），右侧 filter-bar/footer 收纳进同一块内 —— verify：左右第一张表格顶部边缘处于同一水平线（1920 宽度目检）
- [x] 1.3 统一两栏 gap（10px）与分隔方式（统一虚线分界），三张表格统一 `height="100%"` 弹性填充（左表原 max-height、右表固定 160/200 已移除）—— verify：左右区块分界线视觉对齐，间距一致

## 2. 全局滚动条样式

- [x] 2.1 `App.vue` 非 scoped `<style>` 追加全局 `::-webkit-scrollbar` 细条规则（6px、圆角、浅灰 thumb、透明 track）—— verify：页面级滚动条与 el-table 内部滚动条均为细条样式

## 3. 回归验证

- [x] 3.1 `npm run serve` 启动，1920 宽度下查看策略触点执行情况（active/passive 两个 tab）—— verify：左右对齐达标、无横向溢出布局破坏
- [x] 3.2 页面滚动与表格滚动目检滚动条样式 —— verify：全站滚动条统一为细条