# Spec: 预警规则

## 需求：rule-dialog

### 场景：收藏功能

**Given** 用户点击收藏按钮
**When** 提交收藏请求
**Then** 接口返回成功（HTTP 200）
**And** 不提示"不能为空"

### 场景：新增规则

**Given** 用户填写完规则表单并提交
**When** 调用 ruleCreate 接口
**Then** 接口返回成功（HTTP 200）
**And** 规则创建成功

### 场景：规则配置按用户编码过滤

**Given** 用户在规则配置查询页面输入用户编码
**When** 点击搜索
**Then** 列表只显示该用户编码的规则
**And** 支持清空用户编码查看全部

### 场景：重复收藏先删后插

**Given** 用户对同一策略重复点击收藏/关注
**When** 提交收藏请求
**Then** 服务端先物理删除该 (user_id, tab_type, strategy_id) 记录（含逻辑删除历史行）再纯 INSERT
**And** 不产生唯一索引冲突（GreatDB 不支持 ON DUPLICATE KEY UPDATE）

## 需求：hit-list-format

### 场景：命中列表千分位

**Given** 命中策略行 pushCount 为 726000
**When** 渲染推送量单元格
**Then** 显示为 726,000

### 场景：formatter 参数兼容

**Given** el-table `:formatter` 以 (row, column, cellValue) 调用 formatNum
**When** 渲染数字列
**Then** 单元格取 cellValue 格式化，不显示 undefined

## 需求：date-init

### 场景：latestDate 返回 data

**Given** KPI 最新月为 2026-09
**When** 前端调用 /latestDate
**Then** 响应 `data` 字段为 "2026-09-01"（不得落入 message）
**And** 前端日期范围初始化为该月而非当前系统月
