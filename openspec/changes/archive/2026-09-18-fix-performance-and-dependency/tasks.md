# 任务清单

## 后端
- [x] `SrStrategyReviewMapper.xml`：无 keyword 返回空 + LIMIT 10
- [x] `pom.xml`：新增 `hutool-json` 依赖
- [x] 重新打包并验证接口

## 前端
- [x] `EChart.vue`：新增 `renderer` prop，默认 `'svg'`
- [x] `AutoWarning.vue`：`fetchDimOptions` 不再拉取策略名称
- [x] `RuleCreateDialog.vue`：策略名称 select 改远程搜索
- [x] 浏览器验证：打开弹窗不发全量请求，输入关键字才请求

## 验证
- [x] 后端接口：无 keyword 返回 0 条，带 keyword 返回 ≤10 条
- [x] 前端浏览器：策略名称远程搜索正常
- [x] 新增规则接口：HTTP 200 成功
