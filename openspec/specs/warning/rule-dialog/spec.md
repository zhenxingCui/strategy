# warning/rule-dialog Specification

## Purpose

定义预警规则弹窗的行为契约。该能力确保规则弹窗由独立子组件承载、按需挂载，策略名称下拉框使用远程搜索避免全量加载，且新增规则提交时依赖完整。

## Requirements

### Requirement: 规则弹窗独立组件承载

预警规则的新增/编辑弹窗 SHALL 由独立子组件承载，并按需挂载（v-if），弹窗内输入引发的重渲染范围 MUST 限定在弹窗组件内部。

#### Scenario: 弹窗内输入

- **WHEN** 用户在规则弹窗的输入框中连续输入
- **THEN** 仅弹窗组件重新渲染，页面其余区块（表格、规则卡片列表）不发生 vnode 重建

### Requirement: 弹窗开关无冗余重置

弹窗关闭时 SHALL 完成表单重置；再次打开时 MUST NOT 重复执行整对象级别的表单重置。

#### Scenario: 打开弹窗

- **WHEN** 用户点击「新增规则」
- **THEN** 弹窗展示空表单，打开过程不执行多余的表单整体替换

### Requirement: 功能行为保持不变

弹窗的字段、下拉数据来源、校验与保存/编辑接口调用 SHALL 与重构前一致。

#### Scenario: 保存规则

- **WHEN** 用户在弹窗中填写完整并保存
- **THEN** 请求参数与重构前一致，保存成功后列表正常刷新

### Requirement: 策略名称远程搜索

策略名称下拉框 SHALL 使用远程搜索模式，输入关键字才调用接口，后端返回 ≤10 条匹配结果；SHALL NOT 在弹窗打开时全量加载策略名称（生产 6 万+ 条）。

#### Scenario: 打开弹窗

- **WHEN** 用户点击「新增规则」
- **THEN** 不发"策略名称"全量请求
- **AND** 策略名称下拉框显示 placeholder "请输入关键字搜索策略名称"

#### Scenario: 输入关键字搜索

- **WHEN** 用户在策略名称下拉框输入关键字
- **THEN** 调用 `getDim({ type: '策略名称', keyword })` 接口
- **AND** 后端返回 ≤10 条匹配结果
- **AND** 下拉框显示匹配的策略名称选项

#### Scenario: 无关键字查询

- **WHEN** 前端调用 `getDim({ type: '策略名称' })` 不传 keyword
- **THEN** 后端返回空数组（`AND 1=0`）
- **AND** 不再全量下发 6 万+ 条数据

### Requirement: 新增规则依赖完整

新增规则提交时 SHALL 正常调用 `UserUtil.getUser()`（`hutool-json` 依赖已补全），接口返回 HTTP 200。

#### Scenario: 提交新增规则

- **WHEN** 用户填写完规则表单并提交
- **THEN** 接口返回 HTTP 200（`{"status":"SUCCESS","data":<id>,"message":"成功"}`）
