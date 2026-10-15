# Delta Spec: 策略执行

## ADDED Requirements

### Requirement: 数字千分位展示

策略执行详情（主表、分日表）的量级/收入数字必须以千分位格式展示。

#### 场景：主表千分位

**Given** 主表单元格数值为 294000
**When** 渲染单元格
**Then** 显示为 294,000

#### 场景：分日表千分位

**Given** 分日表单元格数值为 876000
**When** 渲染单元格
**Then** 显示为 876,000

### Requirement: 分类汇总 ALLSUM 口径

策略分类执行情况查询必须使用字母编号口径的分类汇总行。

#### 场景：分类汇总可查

**Given** 库内分类汇总行 strategy_id 为 'ALLSUM'
**When** 查询策略分类执行情况
**Then** 返回分类汇总数据（不再写死数字 ID 999）

## REMOVED Requirements

### Requirement: 原始客群列展示

**理由**：业务侧不再需要原始客群口径列，全站表格与导出均已移除该列。
