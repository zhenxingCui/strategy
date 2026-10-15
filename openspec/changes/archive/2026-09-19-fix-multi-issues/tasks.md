# 任务清单

## 后端
- [x] 检查并修复被动/控损策略详情查询逻辑 — `selectStrategyInfo` SQL 已验证，tabType 正确传递
- [x] 检查并修复收藏接口参数校验 — 移除 `FavoriteOpReq.ruleId` 的 `@NotBlank`
- [x] 检查并修复数据查询日期范围 — 新增 `/latestDate` 接口 + `selectLatestStrategyMonth` 兜底查询
- [x] 新增规则配置用户编码过滤接口 — `WarningRuleQueryReq` 新增 `userCode`，Mapper/Service 已适配
- [x] 检查并修复新增规则接口参数接收 — 修复前端 `onRuleCreated` 响应解析（处理数字类型）

## 前端
- [x] 修复 ExecutionDetail.vue 策略详情加载逻辑 — `tabType` watcher 不再用旧 strategyId 调 fetchAll
- [x] 修复 TouchpointExecution.vue 表头对齐问题 — `white-space: nowrap`
- [x] 修复收藏功能参数传递 — 后端移除 `@NotBlank`，前端传参已正确
- [x] 修复前端日期范围查询条件 — `getLatestDate` 改用 `formatParams` 带上 region 参数
- [x] 修复策略联动逻辑（tab_type 切换触发重新加载） — `handleTabChange` 清空新 tab 的 strategyStateMap
- [x] 修复 RuleCreateDialog.vue 表单提交逻辑 — 前端校验+后端 `@Validated` 已对齐
- [x] 调整策略小类 CSS 颜色 — `#c0c4cc` → `#606266`
- [x] 新增规则配置用户编码筛选 UI — AutoWarning 筛选栏新增用户编码输入框
- [x] 修复执行明细表格错列问题 — el-table 添加 `:key` 绑定 tabType

## 验证
- [x] 被动/控损策略详情正常显示
- [x] 表头在不同缩放比例下对齐
- [x] 收藏功能正常
- [x] 数据显示到最新日期
- [x] 策略联动正常
- [x] 新增规则功能正常
- [x] 策略小类可读性良好
- [x] 规则配置支持用户编码过滤
- [x] 表格切换不错列
