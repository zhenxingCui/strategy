# Delta Spec: 预警规则

## ADDED Requirements

### Requirement: 预警列表数字千分位展示

预警命中列表与重点关注列表的数字列必须以千分位格式展示，且不得因 formatter 参数错位显示 undefined。

#### 场景：命中列表千分位

**Given** 命中策略行 pushCount 为 726000
**When** 渲染推送量单元格
**Then** 显示为 726,000

#### 场景：formatter 参数兼容

**Given** el-table `:formatter` 以 (row, column, cellValue) 调用 formatNum
**When** 渲染数字列
**Then** 单元格取 cellValue 格式化，不显示 undefined

### Requirement: 收藏 GreatDB 兼容

收藏操作不得使用 GreatDB 不支持的 ON DUPLICATE KEY UPDATE 语法。

#### 场景：重复收藏

**Given** 用户对同一策略重复点击收藏/关注
**When** 提交收藏请求
**Then** 服务端先物理删除该 (user_id, tab_type, strategy_id) 记录（含逻辑删除历史行）再纯 INSERT
**And** 不产生唯一索引冲突

## MODIFIED Requirements

### Requirement: 数据日期初始化

#### 场景：latestDate 返回 data

**Given** KPI 最新月为 2026-09
**When** 前端调用 /latestDate
**Then** 响应 `data` 字段为 "2026-09-01"（不得落入 message）
**And** 前端日期范围初始化为该月而非当前系统月
