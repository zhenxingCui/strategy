# Design: add-signtoken-login

## 决策

### D1. signToken 解析与算法依赖

- 将根目录 `base64Util.js`、`desEnc.js` 复制到 `front/src/utils/`（保持原文件不动），用 ES module 包装导出：`export function encodeBase64/decodeBase64`、`export function strEnc/strDec`；原文件是全局函数声明，包装时在文件头 import 不现实，直接复制内容并追加 export，函数体零改动（`strDec` 可用于反解验证）
- Login.vue 解析顺序：`this.$route.query.signToken` → `decodeBase64` → 字符串按 `&`、`=` 拆 key/value → 取 `cityId`、`userId`（密文）→ `strDec(userId)` 还原明文。注意 userId 密文在 URL 中是 hex 字符串（strEnc 输出），无需再 URL-decode，但 cityId 明文可能含中文，需 `decodeURIComponent`
- **timestamp 时效校验（用户决策）**：解析出 timestamp（毫秒）后校验 `Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000`；超时、缺失或非数字 → 渲染 IOP 登录提示页，不写入 sessionStorage 不跳转

### D2. 无 signToken 场景（用户决策：提示从 IOP 登录）

- **无 signToken / 解析失败 / timestamp 超时 → 统一进入 IOP 登录提示页（用户决策）**：提示页**仅静态提示**"无法访问应用，请从 IOP 平台登录"，不带任何按钮/链接，用户自行回 IOP 重新登录拿新 token 回到本系统
- 主页 `/` 增加路由守卫（router.beforeEach）：sessionStorage 无身份 → 重定向 `/login`。sessionStorage 关浏览器即失效，与"刷新会话保持、重开必须走 IOP"的语义一致

### D3. 身份透传（前端）

- 新增 `front/src/utils/auth.js`：`getCityId()` / `getUserId()` / `isLogin()`，统一读 sessionStorage（key：`sr_cityId`、`sr_userId`）
- 透传方式：在各组件现有 `buildParams()` / 请求参数拼装处追加两个字段（touchpoint/overview/detail/warning 共 4 个组件 + index.vue 全局查询），**不引入 axios 拦截器**——现有请求是分散的 api 模块函数，逐处加参数比全局拦截器更直观、对现有代码侵入最小

### D4. 后端过滤（city_id / user_id）

- `DimQueryReq` 加 `cityId`、`userId` 字段（String）；favorite/warning 已有的 req 对象同理
- Mapper XML：12 张含 `city_id` 的事实表查询 SQL 统一追加
  `<if test="cityId != null and cityId != ''"> AND t.city_id = #{cityId} </if>`（别名按各 SQL 实际调整）；favorite 相关沿用现有 `#{userId}` 条件不动
- Controller：查询类接口把 `req.getCityId()` 透传 SQL；favorite/warning 的 userId 取值链改为 `req.userId → UserUtilJx → "admin"`（传入优先）
- `t_sr_warning_rule` 仅有 creator 姓名字段，不做过滤（已与用户确认口径：只过滤有 city_id/user_id 的主表）

### D5. 兼容与回滚

- 所有新参数可选：不带参数的老调用 = 现行为不变
- 前端路由守卫上线后直接访问主页会被重定向到 /login 提示页——这是预期行为（用户决策 3）
- 回滚：还原 router 守卫与 4 个组件的参数追加即可，后端 SQL 条件缺省不生效无需回滚

## 风险

| 风险 | 缓解 |
|---|---|
| strEnc 输出 hex 大写字母进 URL | signToken 已 Base64（含 +/= 需 encodeURIComponent），跳转方负责编码；解析端用 decodeURIComponent 容错 |
| cityId 含中文 | decodeURIComponent 后再存储 |
| 12 张表 SQL 逐个加条件遗漏 | tasks.md 按 mapper 文件逐条列 checklist，完成后全局 grep `city_id =` 核对 |
