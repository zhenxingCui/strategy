# Tasks: add-signtoken-login

## 1. 前端：算法与身份工具

- [x] 1.1 复制 `base64Util.js`、`desEnc.js` 到 `front/src/utils/` 并追加 export（函数体不改）
- [x] 1.2 新增 `front/src/utils/auth.js`（getCityId/getUserId/isLogin/setAuth，sessionStorage key：sr_cityId、sr_userId）

## 2. 前端：登录引导页与路由

- [x] 2.1 新增 `front/src/views/login/Login.vue`：解析 signToken → 校验 timestamp（|当前时间-token时间| ≤ 5 分钟，超时/缺失/非法 → IOP 提示页）→ 存 sessionStorage → 跳主页；无 token/解析失败同样显示"无法访问应用，请从 IOP 平台登录"静态提示（无按钮）
- [x] 2.2 注册 `/login` 路由；全局路由守卫（sessionStorage 无身份 → 重定向 /login）
- [ ] 2.3 验证：手工构造 signToken（strEnc 加密测试账号）访问 /login 能进入主页；将 timestamp 改为 6 分钟前访问显示 IOP 提示页；直接访问 / 和 /login（无 token）显示 IOP 提示页

## 3. 前端：查询参数透传

- [x] 3.1 index.vue / StrategyOverview / TouchpointExecution / ExecutionDetail / AutoWarning（含规则列表、命中列表、收藏列表共 7 处请求）统一追加 `cityId`、`userId`（来自 auth.js）
- [ ] 3.2 验证：Network 面板确认各接口请求参数带 cityId/userId

## 4. 后端：入参与 SQL 过滤

- [x] 4.1 `BaseRegionReq` 加 `userId` 字段（`cityId` 原本已存在，全部 req 继承即获得两字段）
- [x] 4.2 city_id 过滤：经核实 `SrStrategyReviewMapper.xml` 48 处 `<if test="cityId">` 过滤**已预置**（Mapper 接口/Service/Controller 全链路支持），无需新增；本次补齐缺口——`SrWarningMapper.xml` 的 `hitStrategyWhere`/`hitStrategyWhereCtrl` 片段加 cityId 条件，接口签名与 Service 调用同步加参
- [x] 4.3 StrategyFavoriteController / StrategyWarningController：userId 取值链改为 `req.userId → UserUtilJx → "admin"`（resolveUserId 私有方法）
- [ ] 4.4 验证：带 cityId 查询只返回该地市数据；不带 cityId 行为与现在一致；收藏按传入 userId 隔离

## 5. 回归与收尾

- [x] 5.1 mvn compile 通过；babel parse 5 个前端文件通过
- [ ] 5.2 全页面回归（四页签 + 全屏弹窗 + 收藏/预警），确认千分位、环比等既有功能不受影响
- [ ] 5.3 验证测试地市数据（可选，测试数据 city_id 与登录 cityId 一致时才有数据）
