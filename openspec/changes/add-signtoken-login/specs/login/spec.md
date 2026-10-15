# Delta Spec: add-signtoken-login

## ADDED Requirements

### Requirement: 登录引导页（signToken 解析）

系统 SHALL 提供 `/login` 路由作为 IOP 平台单点登录的落地引导页。

#### Scenario: 携带合法 signToken 进入

- **WHEN** 用户访问 `/login?signToken=<token>`，其中 token 经 `decodeBase64` 还原为 `cityId=<cid>&userId=<des加密账号>&timestamp=<毫秒>`
- **THEN** 页面解析出 `cityId` 与 `userId` 密文，校验 `|当前时间 - timestamp| ≤ 5 分钟`，用 `strDec` 还原明文账号
- **AND** 将 `cityId`、`userId` 写入 sessionStorage 后自动跳转主页 `/`
- **AND** 跳转前展示简短的"正在进入系统"过渡态

#### Scenario: timestamp 超时

- **WHEN** signToken 解析成功但 `|当前时间 - timestamp| > 5 分钟`（或 timestamp 缺失/非法数字）
- **THEN** 跳转"无法访问应用，请从 IOP 平台登录"提示页（仅静态提示，不含任何按钮/链接）

#### Scenario: 无 signToken 或解析失败

- **WHEN** 用户直接访问 `/login`（无 signToken）或 token 解析失败/缺少 cityId、userId 任一项
- **THEN** 同样跳转"请从 IOP 平台登录"提示页（与超时共用同一提示页，仅静态提示），不进入系统

#### Scenario: 会话保持

- **WHEN** 用户在主页刷新页面
- **THEN** 系统（主页入口或路由守卫）从 sessionStorage 读取身份，正常使用，无需重新登录
- **AND** sessionStorage 为空（如关浏览器后重开直接访问主页）时跳转 `/login` 并展示 IOP 登录提示

### Requirement: 前端身份透传

前端所有业务查询接口 SHALL 在请求参数中携带 `cityId` 与 `userId`（来自 sessionStorage），通过统一的 `utils/auth.js` 取值。

#### Scenario: 查询参数携带身份

- **WHEN** 主页任一组件（overview/touchpoint/detail/warning）发起查询请求
- **THEN** 请求参数中包含 `cityId`、`userId` 字段

### Requirement: 后端按 cityId / userId 过滤

后端查询接口 SHALL 支持按主表字段过滤：主表含 `city_id` 的加 `cityId` 过滤，含 `user_id` 的加 `userId` 过滤，两者都有的表同时过滤两个条件。参数缺省时保持现有行为。

#### Scenario: 事实表按 cityId 过滤

- **WHEN** 查询请求携带 `cityId=<cid>`，目标 SQL 主表含 `city_id` 列（12 张事实表：kpi_summary、channel_summary_ctrl/ap、strategy_period_summary_ctrl/ap、channel_monthly_capacity_ctrl/ap、channel_biz_capacity_ctrl/ap、strategy_biz_capacity、strategy_daily_ctrl/ap、strategy_reject_reason）
- **THEN** SQL 追加 `AND city_id = #{cityId}` 条件，仅返回该地市数据

#### Scenario: 收藏按传入 userId 隔离

- **WHEN** 收藏/重点关注查询请求携带 `userId=<uid>`
- **THEN** 以传入 userId（而非兜底 admin）查询 `t_sr_favorite`

#### Scenario: 参数缺省不过滤

- **WHEN** 请求未携带 `cityId`（或为空串）
- **THEN** SQL 不追加 city_id 条件，返回结果与现有行为一致

#### Scenario: 维度表不过滤

- **WHEN** 查询 `t_sr_dim_channel`、`t_sr_dim_metric`、`t_sr_strategy`、`t_sr_warning_rule`、`t_sr_warning_rule_condition`、`t_sr_warning_hit`
- **THEN** 不追加 city_id/user_id 过滤（表无该字段；warning_hit 经 favorite 关联间接受 userId 约束）
