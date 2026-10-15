# Delta Spec: 策略执行详情修复

## 修改需求：daily-detail

### 场景：被动/控损策略详情加载

**Given** 用户切换到被动策略或控损策略
**When** 策略执行详情区域加载
**Then** 策略名称、策略拒绝原因等信息正常显示
**And** 不显示"暂无数据"

### 场景：策略联动

**Given** 用户切换 tab_type（主动/被动/控损）
**When** tab_type 变化
**Then** 策略详情区域重新加载对应 tab_type 的数据
**And** 策略信息随 tab_type 切换而更新

### 场景：执行明细表格不错列

**Given** 用户切换 tab_type
**When** 执行明细表格重新渲染
**Then** 表格列定义与数据字段匹配
**And** 表格不错列
