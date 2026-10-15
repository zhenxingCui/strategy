# Delta Spec: 策略名称远程搜索

## 修改需求：rule-dialog

### 场景：打开新增规则弹窗

**Given** 用户点击"新增规则"按钮
**When** 弹窗打开
**Then** 不发"策略名称"全量请求（原 6 万+ 条）
**And** 策略名称下拉框显示 placeholder "请输入关键字搜索策略名称"

### 场景：输入关键字搜索策略名称

**Given** 用户在策略名称下拉框输入关键字
**When** 输入长度 > 0
**Then** 调用 `getDim({ type: '策略名称', keyword })` 接口
**And** 后端返回 ≤10 条匹配结果
**And** 下拉框显示匹配的策略名称选项

### 场景：无关键字查询

**Given** 前端调用 `getDim({ type: '策略名称' })` 不传 keyword
**When** 后端收到请求
**Then** 返回空数组（`AND 1=0`）
**And** 不再全量下发 6 万+ 条数据

### 场景：新增规则提交

**Given** 用户填写完规则表单并提交
**When** 调用 `ruleCreate` 接口
**Then** 接口返回 HTTP 200（`hutool-json` 依赖已补全，`UserUtil.getUser()` 正常）
