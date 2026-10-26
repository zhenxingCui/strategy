# 存量策略页面迁移与本地联调

2026-10-26：增量策略月度趋势使用独立人工维护表：`t_sr_passive_monthly_trend_manual` 支持整体 KPI 月趋势及分类执行产能趋势，`t_sr_passive_strategy_monthly_trend_manual` 支持单策略产能趋势。数据由 `t_sr_strategy_period_summary_ap_passive` 聚合生成；单策略环比使用同表相邻月值，来源月为部分月时按截至日折算日均。新增本地补种命令 `npm run db:seed-passive-trend-manual`、`npm run db:seed-passive-strategy-trend-manual`。

2026-10-25：存量各分类的“策略分类执行情况”统一从当前策略月度事实聚合，使用与产能趋势、业务产能相同的分类维度，避免主数据分类名称更新后，旧 `strategy_id=999` 预汇总行的分类在联动查询中匹配不到事实。升接、稳不再从旧分类预汇总读取列表。

2026-10-25：存量升接、稳、离、重点客群及“全部”的成功量统一显示 `product_conv_num`，成功率统一显示 `product_conv_rate`；分类、逐策略、分日、预警命中、收藏、导出和列排序使用对应的 `productConvNum/productConvRate` 接口字段。存量渠道/单策略产能趋势及业务产能汇总对齐 `product_conv_num`。降拆继续使用既有 product 成功量和按咨询量计算的成功率口径。增量、重点产品仍使用各自既有字段。

2026-10-26：升接、稳、重点客群和增量策略的“策略分类执行情况-业务产能明细”环比读取 `t_sr_strategy_biz_capacity_qoq_manual.manual_qoq`；增量策略使用 `tab_type='passive'`、`strategy_class='全部'`。无已发布的人工环比时返回空值，不回退到计算环比。`manual_qoq` 按百分数存储（例如 `1` 显示为 `1%`）。结构见 `back/src/main/resources/sql/strategy_review_add_biz_capacity_qoq_manual.sql`；运行 `cd front && npm run db:seed-manual-biz-qoq` 会补齐演示和增量模拟值。

2026-10-22：将 `策略复盘与预警/` 原型的四模块布局迁入 Vue，存量策略、增量策略和重点产品共用入口 `/strategyReview`。

2026-10-23：重点产品参照增量策略的布局、分类与策略名称入口；接口参数继续使用 `tab_type=control`，接口展示仍沿用咨询、挽留、派单、成功及收入指标编码。

2026-10-23：重点客群在“触点切换”前增加“客群切换”，默认全部客群。策略主表保存客群名称（如高价值客群、校园客群、家庭客群、银龄客群），不新增字典表。

2026-10-23：重点产品在“触点切换”前增加“产品切换”，默认全部产品。产品分组和事实筛选使用 `_ctrl` 月表的 `small_category`；`t_sr_strategy.product_name` 不参与该查询口径。

2026-10-24：存量“降拆、离”按独立业务口径拆到 `_special` 专用表族，不再写入普通 active/passive 事实表。现有查询通过 `v_sr_*_read` 视图兼容读取；`strategy_class='全部'` 的合并汇总仍由共用表保存。存量库执行 `back/src/main/resources/sql/strategy_review_split_nonstandard_classes.sql` 完成建表、迁移和视图创建。

2026-10-24：增量策略（`tab_type='passive'`）整体迁到独立的 `*_passive` 表族，包含主表、KPI、月度/日明细、渠道汇总、产能、逐策略业务明细和拒绝原因；不再与 active 或 control 数据共表。现有接口仍通过 `v_sr_*_read` 视图读取。存量库先备份，再执行同一 `strategy_review_split_nonstandard_classes.sql` 完成建表、迁移和视图更新；重点产品继续使用原有 control 表。
2026-10-24：重点客群（`tab_type='active', strategy_class='重点客群'`）整体迁到独立的 `*_key_audience` 表族，覆盖策略主表、KPI、月度/日明细、渠道汇总、产能和拒绝原因；客群筛选、策略列表、执行明细、收藏、预警等接口按策略分类直读专表。`strategy_class='全部'` 的合并汇总仍保留在共用表。
2026-10-26：重点客群“策略整体情况”KPI 卡片及可切换月趋势、“策略分类执行情况”产能趋势统一读取 `t_sr_key_audience_monthly_trend_manual`。历史指标值由 `t_sr_strategy_period_summary_ap_key_audience` 按客群、触点、策略大/小类和地区生成；`manual_qoq` 不自动计算，NULL 在页面显示为空。新增本地初始化/补种命令 `npm run db:seed-key-audience-trend-manual`，可重算指标值并保留已有手工环比。
2026-10-26：重点客群“策略执行明细”的单策略产能趋势改读 `t_sr_key_audience_strategy_monthly_trend_manual`，按策略ID、月份、触点和地域存储多指标月汇总及环比。历史数据来自 `t_sr_strategy_period_summary_ap_key_audience`；当前图表使用 `product_conv_num`，2026-10 环比按 10-21 日日均折算。新增本地补种命令 `npm run db:seed-key-audience-strategy-trend-manual`。
2026-10-26：重点产品整体 KPI/月趋势及渠道产能趋势读取 `t_sr_control_monthly_trend_manual`，单策略产能趋势读取 `t_sr_control_strategy_monthly_trend_manual`。整体月表按产品（control 月表 `small_category`）、策略大类、触点和地域存储重点产品指标，环比留空供人工维护；单策略月表按策略、触点和地域存储多指标及环比，未完月按 control 日表 `stat_month` 的最新日折算。历史数据来自 `t_sr_strategy_period_summary_ctrl`。新增本地补种命令 `npm run db:seed-control-trend-manual` 和 `npm run db:seed-control-strategy-trend-manual`；重新运行 `npm run db:seed-passive-control` 也会补种这两张表。已有环境先执行 `strategy_review_add_control_monthly_trend_manual.sql` 和 `strategy_review_add_control_strategy_monthly_trend_manual.sql` 建表。
2026-10-26：升接、稳的整体KPI卡片和趋势、策略分类产能趋势与单策略产能趋势改读两张专用手工趋势表，分别用 `strategy_class` 区分升接和稳。源数据从 `t_sr_strategy_period_summary_ap` 按策略与维度聚合；月度表的环比留给人工维护，单策略表按相邻月计算环比，日数据对应的未完月按日均折算。新增结构脚本 `strategy_review_add_upgrade_stable_monthly_trend_manual.sql`、`strategy_review_add_upgrade_stable_strategy_monthly_trend_manual.sql`，本地补种命令为 `npm run db:seed-upgrade-stable-trend-manual` 与 `npm run db:seed-upgrade-stable-strategy-trend-manual`。
2026-10-26：升接、稳、重点客群和增量策略“策略执行明细-业务产能明细”的环比读取 `t_sr_strategy_detail_biz_capacity_qoq_manual`，按策略分类、策略ID、月份、业务编码/名称和地域维护；增量策略使用 `strategy_class='全部'`。未录入手工值时显示空值，不回退源表环比；增量本地模拟值见 `back/src/main/resources/sql/strategy_review_seed_passive_business_qoq_manual.sql`，由 `npm run db:seed-manual-biz-qoq` 补入。

2026-10-24：重点产品查询以 control 专用事实表为准，产品维度取 `t_sr_strategy_period_summary_ctrl.small_category`；策略主表 `tab_type='control'` 用于限定策略归属。逐策略业务产能从带 `tab_type='control'` 的 `t_sr_strategy_biz_capacity` 读取。

2026-10-25：重点产品月度事实表字段与升接/稳月表对齐，日表采用相同指标字段并将日期列统一为 `stat_month`。接口继续兼容旧的 control 指标编码；事实列对应关系为 `consult_count→push_count`、`retain_count→usage_count`、`retain_rate→usage_rate`、`dispatch_count→reach_count`、`success_count→product_conv_num`、`success_rate→product_conv_rate`、`income→actual_income`。产品维度仍取 `small_category`，忽略 `product_name`。本地旧表迁移脚本为 `front/scripts/align-control-product-tables-local.cjs`，保留旧表副本。

2026-10-25：重点产品拒绝原因存入 `t_sr_strategy_reject_reason_ctrl`，执行明细接口按 `tab_type='control'` 查询该表。本地已有环境执行 `strategy_review_split_nonstandard_classes.sql` 建表并迁移旧联调样例；需要生成重点产品联调原因时重新运行 `npm run db:seed-passive-control`。

重点产品拒绝原因单独升级时，可执行 `back/src/main/resources/sql/strategy_review_add_control_reject_reasons.sql`；该脚本从旧公共表迁移仅属于 control 的策略原因，并刷新拒绝原因兼容视图。

## 运行

- 后端：在 `back/` 执行 `mvn spring-boot:run`，端口 8080。
- 前端：在 `front/` 执行 `npm run serve`，端口 8081。
- 本机直接打开 `http://127.0.0.1:8081/strategyReview`。

`.env.development` 开启本机开发免登录，默认身份为 `cityId=999`、`userId=root`。
仅 `development` 构建且域名为 `localhost` / `127.0.0.1` / IPv6 loopback 时生效。
生产构建不执行前端登录校验，接口默认身份为 `cityId=999`、`userId=root`。

## MySQL

默认连接本机 `127.0.0.1:3306/strategy_review_active_class_local`。
后端可通过 `SR_DB_URL`、`SR_DB_USER`、`SR_DB_PASSWORD` 覆盖连接配置。

本次已创建独立联调库。页面通过 REST 接口读取 MySQL；数据为本地生成的联调样例，不代表线上业务数据。

- 20 条存量策略：8 条重点客群独立样例（`strategy_class=重点客群`），另 12 条按策略主表中的 `strategy_class` 字段随机均分为升接、稳、降拆、离，每类 3 条；4 个触点，4 组业务大类/小类。
- 2025-11 至 2026-10 共 12 个月，策略按不同月份上线和结束；每月策略数随活动周期变化。
- 月度客群、推送、使用、触达、转化和收入之间保持漏斗及汇总关系；加入淡旺季、策略差异和稳定的轻微波动。
- 日数据按工作日、周末和月内活动时点分配，逐月汇总仍与月度指标一致。
- 7 条预警规则，包括生效、过期和停用示例。
- 规则、收藏和关注通过接口写入 MySQL。
- 增量策略和重点产品使用独立策略编码及 2025-11 至 2026-10 月度数据，不覆盖存量策略。
- 增量策略设置 `tab_type='passive'`、`strategy_class='全部'` 并写入 `_passive` 表族；重点产品继续使用 `_ctrl` 表。
- `t_sr_strategy_biz_capacity` 增加 `tab_type` 字段，以隔离存量、增量、重点产品的逐策略业务明细。
- 增量策略和重点产品各生成 30+ 条策略、月度/按日指标、渠道及业务明细，以及 4 条预警规则。

新环境在 `front/` 执行 `npm run db:init-local`。脚本复用后端建表 SQL，新建独立数据库；如果目标库已经存在，会拒绝覆盖。
初始化脚本支持 `SR_DB_HOST`、`SR_DB_PORT`、`SR_DB_USER`、`SR_DB_PASSWORD`、`SR_DB_NAME`、`SR_SEED_MONTH`。
自定义库名后，后端的 `SR_DB_URL` 也应指向同一个库。

当前联调库更新样例数据时，在 `front/` 执行 `npm run db:refresh-local`。刷新脚本只允许更新 `strategy_review_active_class_local`，并要求库内策略均为本地联调样例；只替换这些样例策略和统计事实，保留收藏与预警规则。刷新前应确认该库仍仅用于本地测试。

存量“降拆、离”的策略主表、月度/日明细、KPI、渠道汇总、产能及拒绝原因分别存入对应的 `*_special` 表；重点客群的同类数据分别存入 `*_key_audience` 表；普通存量分类和 `全部` 汇总仍存放在原表。增量策略的同类数据分别存入对应的 `*_passive` 表，重点产品继续使用 control 表。兼容视图 `v_sr_*_read` 汇总读取原表与专用表。现有环境升级先完整备份，再执行 `strategy_review_split_nonstandard_classes.sql`；本地初始化、种子脚本和 Excel 导入均遵循分表规则。

给现有联调库补充增量和重点产品数据时执行 `npm run db:seed-passive-control`。脚本只允许目标库为 `strategy_review_active_class_local`，只清理带本脚本专属标记的增量/重点产品样例，支持重复执行，不删除表，也不重建存量数据；会按需创建 `_passive` 专用表并迁移已有增量数据。现有环境的字段迁移见 `back/src/main/resources/sql/strategy_review_add_strategy_biz_tab_type.sql`；新环境建表 DDL 已包含该字段。

现有环境升级时，先备份目标数据库，再执行 `back/src/main/resources/sql/strategy_review_add_customer_group.sql` 和 `strategy_review_split_nonstandard_classes.sql`，可重复执行，后者会将重点客群数据迁入专表并刷新兼容视图。已有重点客群策略的分类名称由数据提供方填充；NULL/空白归属仍计入“全部客群”，不出现在下拉选项中。本地执行 `npm run db:seed-customer-groups` 可为 STR013–STR020 中尚无分组的重点客群样例填充四类客群，不覆盖已有归属。新建和刷新本地库也包含这些客群名称。

接口 `POST /dim` 的 `type=客群分类, tabType=active` 从重点客群专表返回不重复的非空名称，`keyCode` 与 `keyName` 都是名称。查询参数 `customerGroup` 按名称精确匹配并去除首尾空格；仅在 `tabType=active, strategyClass=重点客群` 时生效，空值表示全部客群，其他视角忽略此参数。切换分类会清空客群选择，切换客群会重置列表分页和所选策略详情，保留当前触点条件。

具体客群的 KPI、趋势、渠道与分类汇总从重点客群专表中的策略月度事实按客群归属聚合，排除 `strategy_id=999` 等预计算汇总行；策略数按策略编码去重，比率使用聚合后的分子/分母计算，数量环比按相邻自然月计算，率值环比为百分点。缺少上月或分母为零时返回空值。SQL 先聚合最多 13 个月的数据，再计算环比及近 12/6 期趋势，不把策略明细全量传到前端。业务产能使用逐策略业务明细聚合，缺少上月明细时环比为空。策略分页、收藏列表、预警命中列表均按重点客群专表中的客群归属筛选；全部客群继续走现有汇总查询。

此方案约定一条策略固定归属一类客群。修改主表中的客群名称会改变其历史查询归属；需要一策略多客群效果拆分或历史归属快照时，应另行扩展事实数据维度。

现有环境的主表元数据字段迁移：选择目标数据库后执行 `back/src/main/resources/sql/strategy_review_add_product_name.sql` 和 `strategy_review_split_nonstandard_classes.sql`，可重复执行，不修改统计；后者会刷新兼容视图。`product_name` 保留为兼容元数据字段，重点产品查询不依赖该字段。本地 `npm run db:seed-products` 仅为尚无产品名的 CTL 样例补齐演示元数据，不重建统计。

产品下拉接口为 `POST /dim`，参数 `type=产品名称, tabType=control`，从 control 月度事实中读取不重复的非空 `small_category`（排除 `全部` 和汇总策略 `strategy_id=999`），并要求对应策略主表为 `tab_type='control'`。查询参数 `productName` 仅在 `tabType=control` 时生效，去除首尾空格后与事实表 `small_category` 精确匹配，其他视角忽略。产品切换会重置各模块分页和所选策略详情，保留当前触点；切换主 Tab 会清空产品条件。下拉加载失败可重试，当前维持全部产品。

具体产品的整体指标、近 12 期趋势、渠道/分类汇总及近 6 期产能趋势按 control 月度事实的 `small_category` 筛选并聚合；挽留率=挽留量/咨询量，成功率=成功量/派单量，产能=成功量，数量环比按相邻自然月计算，率值环比为百分点。业务产能读取 `t_sr_strategy_biz_capacity` 中 `tab_type='control'` 的逐策略记录，并通过 control 月度事实聚合；策略列表、收藏及预警命中同样按 `small_category` 筛选。聚合服务/Mapper 使用 `StrategyScopeAggregationService` / `SrStrategyScopeMapper`。

全部产品继续读取 control 的现有汇总。具体产品下拉和筛选依赖逐策略事实里的 `small_category`；空白或 `全部` 不会成为具体产品选项。一个策略固定归属一个产品；若同一策略需要拆分到多个产品，须先扩展事实数据粒度。

示例数据的使用率=使用量/推送量、触达率=触达量/使用量、转化率=全产品转化量/触达量。率值环比显示为百分点 `pp`。
渠道汇总无需新增触达率字段：单个触点的存量/增量触达率按触达量/使用量计算，卡片与近12期趋势均支持；环比比较上个自然月的率值（pp），缺少上月或分母为零时为空。

## 页面与接口

`src/views/strategyReview/active/` 是本阶段的 Vue 实现：

| 文件 | 职责 |
| --- | --- |
| ActiveReview.vue | 本地身份、最新账期、全局触点/月度筛选、跨模块策略联动 |
| StockOverview.vue | 指标快照、漏斗、最近 12 期柱线趋势、月份下钻 |
| StockExecution.vue | 分类汇总、触点产能趋势、业务产能明细 |
| StockWarning.vue | 规则分页/搜索/新增/编辑/删除/启停、命中列表、关注 |
| StockDetail.vue | 逐策略分页/排序/搜索/收藏、五项属性、产能、拒绝原因、业务及分日明细 |
| ReviewTable.vue | 表格、选择、当前页 CSV 导出、全屏和 Esc 退出 |
| ReviewState.vue | 每个区域的加载、空数据、失败及重试 |
| reviewData.js | 数据格式、图表配置、忽略过期请求响应 |

所有取数沿用 `src/api/strategyReview.js`，不加载原型 `data/*.js`，不使用按系数缩放的模拟数据。
三个视角都使用该 Vue 实现；增量策略仅展示“全部”分类，重点产品也仅展示“全部”分类，并使用控制类指标字段。

为接通实际数据补齐了后端触点 KPI、趋势截止月份、命中策略的触点/地区/账期筛选，
修复业务产能条件冲突、分类汇总混入策略分页、规则业务 ID 类型，以及 OR 条件绕过筛选的问题。
规则编辑使用完整字段提交，避免后端必填校验失败和条件被清空。

## 当前业务边界

- 存量策略分类值为 `升接`、`稳`、`降拆`、`离`、`重点客群`；增量策略、重点产品只展示全部。
- “重点客群”与“升接”共用界面和指标口径，通过 `strategy_class=重点客群` 联动查询四个模块，具备独立的月度、日明细、渠道及业务产能数据；已计入“全部”汇总。
- “对照执行情况（非上线）”保留禁用标签，等待后端提供对应数据接口。

## 验证

在 `front/` 使用 Node 20+：

```powershell
node scripts/verify-active-api.cjs
node scripts/verify-key-audience-data.cjs
node scripts/verify-customer-groups.cjs
node scripts/verify-products.cjs
$env:SR_VERIFY_STRATEGY_CLASS='重点客群'
node scripts/verify-active-api.cjs
Remove-Item Env:SR_VERIFY_STRATEGY_CLASS
node scripts/verify-active-api.cjs --write-checks
npm run build
```

默认只读检查；`--write-checks` 仅允许本地服务，创建自己的验证规则并在 finally 中删除，清理自己的收藏。
覆盖四模块查询、分页、业务 ID、触点/地区过滤、规则编辑及启停、收藏与用户间关注隔离。
本次 40 次 API 请求检查通过；浏览器确认免登录直达、触点联动和策略详情联动。

在 `back/` 执行 `mvn -DskipTests compile` 检查 Java 与 Mapper 接口编译。

存量 strategy_class 直接存“升接/稳/降拆/离/重点客群”，预计算汇总存“全部”。已有英文分类数据执行 back/src/main/resources/sql/strategy_review_strategy_class_chinese.sql。

增量和重点产品的已有 `strategy_class` 字段统一为“全部”（包括主表和明细）；执行 `back/src/main/resources/sql/strategy_review_non_active_class_all.sql`。不带该字段的 `_ctrl` 专用表无需加列。汇总查询未传分类或传空串均读取“全部”。


2026-10-23 指标名称修正：重点产品统一显示推送量、使用量、触达量、转化量，使用率与转化率同步更名；整体卡片、漏斗、趋势图例、分类/逐策略/分日表格、业务产能、预警指标及规则条件均使用新名称。兼容既有控损字段：consult_count→推送量、retain_count→使用量、dispatch_count→触达量、success_count→转化量；retain_rate→使用率、success_rate→转化率。数据库结构及历史数值不变，旧 KPI/指标字典/预警条件的显示名称由接口按代码规范化。本条取代上文保留咨询/挽留/派单/成功名称的约定。

重点产品整体情况补齐三项比率：使用率=使用量/推送量，触达率=触达量/使用量，转化率=转化量/触达量。新增的 reach_rate 通过 dispatch_count/retain_count 聚合计算；全部产品、具体产品及触点筛选均支持，环比为相邻自然月率值之差（pp），缺少上月或分母为零时为空。点击触达率可查看近12期趋势，无需新增数据库列或重写历史汇总。

存量降拆页面文案：漏斗及趋势使用咨询量、挽留量、派单量、成功量；分类汇总、预警命中、逐策略、收藏、分日表格及导出统一采用该口径，目标转化指标显示为目标成功量/目标成功率，业务产能列显示成功量。仅在 active + 降拆 生效，接口字段和数值不变。

## BQQData 本地快照适配

`front/scripts/adapt-bqqdata-local.cjs` 读取 `D:\工作数据\BQQData\sql` 的 9 张 MySQL 表格导出。先在 `front/` 执行 `npm run db:adapt-bqqdata` 查看来源月份、行数、待补列和替换范围；确认后执行 `npm run db:adapt-bqqdata -- --apply`。导入脚本只允许写入本地库 `strategy_review_active_class_local`，执行前会生成完整 `mysqldump` 到 `outputs/local-db-adapt-20261024/`。

导入会整体替换 `t_sr_strategy` 的 active 主表记录，并替换各事实表对应月份的 active 快照；其它月份、control/passive 数据、收藏和预警表保留。源文件中的自增 `id` 不导入，由本地库重新生成。现有表缺少的源列可通过 `back/src/main/resources/sql/strategy_review_add_bqqdata_compat_columns.sql` 补齐，重复执行安全。

源快照的渠道值是展示名称、KPI 指标编码使用大写源编码，策略汇总包含按渠道/分类拆出的维度行，拒因城市码也不同于页面根级城市码。Mapper 已兼容这些形态；策略明细请求附带所选渠道，按月趋势合并多渠道记录，业务产能相同输出行去重。分类和客群字段值不做映射，按当前来源值原样返回。
