# Proposal: add-signtoken-login

## 背景 / Why

系统目前**没有独立登录页面**，前端无用户身份概念；后端 `StrategyFavoriteController` / `StrategyWarningController` 通过 `UserUtilJx.getUser().getUserId()` 取登录用户，取不到一律兜底 `"admin"`。收藏、预警规则等数据全部挂在 `admin` 名下，无法区分真实用户。

外部系统（省门户/4A）现已提供单点登录跳转约定：

```js
var timeStamp = Math.floor(new Date().getTime());
var params = "cityId=" + cityid + "&userId=" + strEnc(userAccount) + "&timestamp=" + timeStamp;
signToken = encodeBase64(params);
url + "?signToken=" + signToken;
```

即外部系统用 **DES(strEnc) 加密用户账号 + Base64 编码** 生成 `signToken`，拼在跳转 URL 上进入本系统。本系统需从 URL 解析 `signToken`，还原 `cityId` 与 `userId`，建立会话身份，并作为查询条件传给后台。

## 变更内容 / What Changes

### 1. 前端：登录引导页 + signToken 解析

- 新增登录/引导页 `Login.vue`（路由 `/login`），作为带 `signToken` 进入的落地页
- 引入项目根目录已有的 `base64Util.js`（`encodeBase64`/`decodeBase64`）与 `desEnc.js`（`strEnc`/`strDec`），复制到 `front/src/utils/`
- Login.vue 逻辑：
  1. 从 `window.location.search` 取 `signToken` 参数
  2. `decodeBase64(signToken)` → 还原字符串 `cityId=xxx&userId=xxx&timestamp=xxx`
  3. 按各自 key 解析出 `cityId`、`userId`（DES 密文），`strDec(userId)` 得到明文账号
  4. 校验 `timestamp` 有效性（可选，±10 分钟内有效，防止链接被长期盗用）
  5. 将 `cityId`、`userId` 写入会话存储（`sessionStorage`）并跳转主页 `/`
- 防护：`signToken` 缺失/解析失败/超时 → 显示友好的"无权访问"提示页，不进入系统

### 2. 前端：身份透传查询条件

- 新建 `src/utils/auth.js`：统一从 `sessionStorage` 读取 `cityId` / `userId`，提供 `getCityId()` / `getUserId()` / `isLogin()`
- 主页各查询接口（overview / touchpoint / detail / warning 的请求）在参数中追加 `cityId`、`userId`，作为查询条件传给后台

### 3. 后端：接收并应用 cityId / userId

- `DimQueryReq`（或新增公共入参对象）增加 `cityId`、`userId` 字段
- 各 Controller（favorite / warning / 主查询）优先使用请求参数中的 `userId` / `cityId`；**取不到时维持现有 `UserUtilJx → "admin"` 兜底链**，保证老入口不受影响
- 收藏、预警规则等按用户隔离的查询，从"全部归 admin"变为"按传入 userId 隔离"

## 影响 / Impact

- **影响范围**：前端路由与入口、请求参数拼装；后端 Controller 入参与用户取值逻辑
- **兼容性**：后端对 `cityId`/`userId` 参数均做"缺省则不过滤/兜底"处理，老调用方（不带新参数）行为不变；前端无 signToken 直接访问将引导至 IOP 登录提示页
- **安全边界**：strEnc 密钥为公开 JS 常量（"1"/"2"/"3"），仅做防明文暴露，不构成强认证；timestamp 做 ±5 分钟时效校验降低链接被盗用风险

## 已确认决策

1. **过滤规则**：所有接口中，后台主表带 `city_id` 的统一按传入 `cityId` 过滤；带 `user_id` 的统一按传入 `userId` 过滤；两者都存在的表两个条件都加。详见下方接口梳理。
2. **登录页形态**：纯"解析跳转"引导页，无账号输入框
3. **timestamp**：token 有效期 5 分钟——`|当前时间 - timestamp| ≤ 5 分钟` 方可登录；超时/无 token/解析失败均统一跳转"无法访问应用，请从 IOP 平台登录"提示页，页面仅静态提示，不带任何按钮/链接
4. **存储方式**：sessionStorage（关浏览器/标签页即失效）

## 接口/主表过滤梳理（基于 strategy_review.sql 表结构）

### 有 city_id 的主表（12 张，全部加 cityId 过滤）

| 表 | 关联接口 |
|---|---|
| t_sr_kpi_summary | KPI 概览四卡 |
| t_sr_channel_summary_ctrl / _ap | 渠道触点执行行况（左表/右表） |
| t_sr_strategy_period_summary_ctrl / _ap | 策略分类执行情况、策略执行情况 |
| t_sr_channel_monthly_capacity_ctrl / _ap | 策略产能趋势 |
| t_sr_channel_biz_capacity_ctrl / _ap | 业务产能明细 |
| t_sr_strategy_biz_capacity | 策略业务产能 |
| t_sr_strategy_daily_ctrl / _ap | 执行明细（分日表） |
| t_sr_strategy_reject_reason | 策略拒绝原因 |

### 有 user_id 的主表

| 表 | 关联接口 | 现状 |
|---|---|---|
| t_sr_favorite | 收藏列表、重点关注列表 | 已按 userId 过滤，改为使用传入 userId |

### 都没有的表（不过滤）

- `t_sr_dim_channel`、`t_sr_dim_metric`、`t_sr_strategy`（维度/主数据，全局共享）
- `t_sr_warning_rule`（仅有 `creator` 姓名，非 user_id，暂不过滤）、`t_sr_warning_rule_condition`、`t_sr_warning_hit`（通过 favorite 关联间接受 userId 约束）
