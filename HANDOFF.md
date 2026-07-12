# HANDOFF

> 本文档记录 `spacetime-travel` 的当前状态、已完成能力、以及按优先级排序的待优化 backlog。
> 目标：开启新会话时，可直接挑一条 backlog 项独立实现。
>
> 审阅基线：仓库 @ `de7439c`（2026-07-11）。覆盖 `server/`、`client/`、文档与构建配置。
> 来源：2026-07-10 全项目深度分析（服务端 / 客户端核心 / 功能模块）+ schema 长久维护评估。

---

## 当前状态（已同步代码现实）

`spacetime-travel` 是可运行的本地优先旅行记忆图谱 MVP。

**真实技术栈**（注意：旧文档曾写 Express / `dist/`，以下为准）：

- 前端：Svelte 5 运行时 + **Svelte 4 遗留组件语法**（尚未迁移 runes）、Vite 6、Tailwind CSS 4（仅 base/reset；组件用手写 scoped CSS + `app.css` 语义类）
- 后端：Fastify 5 + `better-sqlite3`（WAL）
- 地图：`d3-geo` + `topojson-client` + `world-atlas`（离线 SVG）
- 开发：Vite `:5167`，API `:5168`，proxy `/api` → API
- 生产构建：`vite build` → `server/public/`（非 `dist/`），`pnpm start` 同进程托管 API + 静态资源

**产品骨架**：全屏地图画布 + 左侧总览 + 右侧详情 + 底部时间轴，围绕「选中节点」联动。

**已实现能力**（勿再标为「未来方向」）：

| 能力 | 关键位置 |
| --- | --- |
| 离线世界地图、pan/zoom、交通虚线、年份着色 | `client/components/TravelCanvas.svelte` |
| 跨日界线路由拆段 | `client/lib/movie/pathSampler.ts` `buildRouteGeometry` |
| Visit CRUD + 情感字段 + 地名搜索/地图点选 | `VisitForm` / `LocationPicker` / `server/db.ts` |
| 出发起点与回程（`origin_*` / `outbound_*` / `return_*` / `inbound_*`） | `server/db.ts`、`visitRoutes.ts` |
| 年份筛选（无 trips 表） | `App.svelte` |
| 自定义删除确认（非原生 `confirm`） | `client/lib/confirm.ts` + `ConfirmDialog.svelte` |
| 电影模式（rAF 引擎、镜头、WebM 导出） | `client/lib/movie/`、`MovieOverlay.svelte` |
| 统计页 | `client/lib/stats/`、`StatsView.svelte` |
| 年度旅行海报 SVG→PNG | `client/lib/poster/`、`PosterPreview.svelte` |
| gazetteer 懒加载（~560KB / 6244 条） | `client/lib/gazetteer.ts` |

**数据模型摘要**：

- `locations`：地理点（目的地与起点）
- `visits`：记忆节点；含 destination + origin；`outbound_*` / `return_*` / `inbound_*`
- `legs`：按 `arrived_at` 排序后的相邻站间连线（由目标 visit 的 `inbound_*` 重建）
- `visitRoutes`：读时合成（去程/回程），不落库；电影模式只走 `legs`
- Schema：`PRAGMA user_version` 迁移（`server/migrations.ts`）；当前 `SCHEMA_VERSION = 2`；locations 按 `name + country` 复用

**Visit origin 备忘**：

- `VisitForm` 的 `inbound_*` 仅在非首站显示
- Smoke：`node --import tsx scripts/smoke-visit-origin.mjs` → `smoke ok`（临时库，见 P1-4）
- **升级**：additive 变更由迁移自动应用；仅非可迁移破坏性变更才需删 `data/spacetime-travel.sqlite*`

---

## 整体评价

定位清晰：离线地图 + 情感字段 + 交通视觉语言，区别于打卡地图。电影模式 / 统计 / 海报已把「记忆升维」与「表达输出」的核心体验兑现。

长久维护的主要瓶颈在 **数据层生命周期**（无迁移、locations 假实体、legs 半成品）曾是首要风险，P0 已基本收口；其次是前端技术债与产品增强。文档 / scripts / gitignore 已对齐（P1-1～P1-3）。

---

## 如何使用本 backlog

1. 新会话只挑 **一条**（或同一 P 级内紧密相关的 2–3 条）实现。
2. 每条含：问题、位置、建议做法、验收标准、依赖。
3. 完成后：把该项标为 ~~删除线~~ 或移入「已完成」，并更新「当前状态」如有需要。
4. 涉及 schema 变更的项：**必须先完成 P0-1（迁移机制）**，再改表。

---

## P0 · 数据层（长久维护前提）

> 不做 P0-1，后续任何 schema 改动都会惩罚已有用户数据。

### P0-1 · Schema 版本与迁移机制

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`server/migrations.ts`（`SCHEMA_VERSION`、`bootstrapSchema`、`migrate`）；`server/db.ts` 启动时调用 `migrate(db)`；测试 `server/migrations.test.ts`。
- **当前版本**：`user_version = 2`（迁移 1 = FK 索引；迁移 2 = locations 去重 + 唯一索引）。
- **后续**：新增 schema 变更时在 `migrations` 字典增加 `N`，并 bump `SCHEMA_VERSION`；破坏性无法自动迁移时在 README/本文件注明。

### P0-6 · 外键列索引

- **状态**：~~已完成（随 P0-1 迁移 1）~~
- **实现**：`idx_visits_location_id`、`idx_visits_origin_location_id`、`idx_legs_from_visit_id`、`idx_legs_to_visit_id`。

### P0-2 · `locations` 实体化（去重、复用、孤儿回收）

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `server/locations.ts`：`ensureLocation`（按 `name + country` 复用）、`purgeOrphanLocations`、`mergeDuplicateLocations`
  - 迁移 2：合并历史重复行 + `UNIQUE INDEX idx_locations_name_country`
  - `createVisit` / seed 走 `ensureLocation`；`updateVisit` 换绑 FK 后回收孤儿；`deleteVisit` 删除后回收孤儿
  - 测试：`server/locations.test.ts`
- **注意**：复用时不改已有行的坐标（避免共享地点被一处编辑污染）；改名/换地靠换绑到新/已有实体。

### P0-3 · 兑现或清理 `legs` 派生字段

- **状态**：~~已完成（2026-07-11，方案 A）~~
- **实现**：
  - `server/haversine.ts`：大圆距离；`rebuildSequencesAndLegs` 写入 `distance_km`（`duration_hours` 仍为 null）
  - 启动时若存在 `distance_km IS NULL` 的 legs 则自动回填重建
  - Stats：`kpi.totalDistanceKm` +「交通里程」模块；`StatsView` 接收 `legs`
  - 测试：`server/haversine.test.ts`、`server/legDistance.test.ts`、`client/lib/stats/compute.test.ts`

### P0-4 · `rebuildSequencesAndLegs` 性能与一致性

- **状态**：~~已完成（2026-07-11）~~
- **产品决策**：保留 `visits.sequence` 作为 `arrived_at ASC, id ASC` 的**派生缓存**；不做手动拖拽偏离日期序（拖拽排序仍属 P5-4）。不把 legs 改为纯读时计算。
- **实现**：
  - 抽出 `server/rebuildLegs.ts`：一次 JOIN 拉取有序 visits+坐标；`ROW_NUMBER()` 单语句重写 sequence；事务批量 insert legs（含 distance）
  - 消除重建路径上的 per-row `prepare` / inbound·坐标 N+1
  - 测试：`server/rebuildLegs.test.ts`（中间插入重排、删除补边）

### P0-5 · 写入校验加固

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `server/visitValidation.ts`：`parseIsoDate`、`assertDateOrder`、`parseTransport`、`parseVisitId`
  - `readVisitPayload` 校验日期格式 / 先后 / transport 白名单；`cleanRating` fallback `4.5`
  - `index.ts`：非数字 `:id` → 400
  - 测试：`server/visitValidation.test.ts`

### P0-6 · 外键列索引

- **状态**：~~已完成（随 P0-1 迁移 1，2026-07-11）~~ — 见上方 P0-1。

---

## P1 · 工程卫生与文档

### P1-1 · 同步 README / HANDOFF 与代码

- **状态**：~~已完成（2026-07-11）~~
- **实现**：README 重写为 Fastify + `server/public/`；Features 含电影/统计/海报/起点回程/地名搜索；目录树与 Tech Stack 对齐代码；Tailwind 策略见 P4-4。

### P1-2 · Gitignore 构建产物 `server/public/`

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`.gitignore` 增加 `server/public/`；README 写明生产构建输出位置。

### P1-3 · 补齐 `package.json` scripts

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  ```json
  "test": "node --import tsx --test server/**/*.test.ts client/**/*.test.ts",
  "smoke:visit-origin": "node --import tsx scripts/smoke-visit-origin.mjs"
  ```
  README Scripts 段已说明；`pnpm test` / `pnpm typecheck` 可一键跑。

### P1-4 · Smoke 脚本隔离数据库

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`server/db.ts` 支持 `SPACETIME_DB_PATH`（含 `:memory:`）；`scripts/smoke-visit-origin.mjs` 用临时 sqlite，结束后删除，并断言默认库 visit 数不变。

### P1-5 · 测试基建（db 事务 + 电影核心纯函数）

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `server/db.test.ts`：create → sequence/legs、中间插入重排、delete 补边、locations 复用与孤儿回收（经 `SPACETIME_DB_PATH` 临时库）
  - `client/lib/movie/pathSampler.test.ts`：日界线拆段、`sampleRouteAtProgress`、`clampPointToMap`
  - `client/lib/movie/timeline.test.ts`：分段构建、阶段边界、`dwellCaptionOpacity`
- **验收**：`pnpm test` 覆盖上述路径。

### P1-6 · 消除 YEAR_PALETTE 双份维护

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`shared/years.ts`（palette / `visitYear` / `yearColor` / `buildYearColors`）；`client/lib/years.ts` re-export；`server/db.ts` 从 shared 导入；测试 `shared/years.test.ts`。

### P1-7 · 服务端不再 import 客户端类型

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`Location` / `VisitRoute` 定义在 `server/types.ts`；`visitRoutes.ts` 只依赖 server types。

---

## P2 · 产品闭环（日常使用安全）

### P2-1 · JSON 导出 / 导入

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `GET /api/export` → JSON（`format` + `schemaVersion` + visits 扁平 payload）
  - `POST /api/import` → 校验后**整库替换**；坏文件 / 超前 schema 返回 400（校验在 wipe 前）
  - `server/exportImport.ts` 解析；`db.getExportDocument` / `importReplace`
  - 侧栏「导出数据 / 导入数据」；导入走 `ConfirmDialog`
  - 测试：`exportImport.test.ts`、`db.test.ts` roundtrip
- **策略**：替换（非合并）。

### P2-2 · 删除撤销（软删除或 Undo Toast）

- **状态**：~~已完成（2026-07-11，短线）~~
- **实现**：
  - `client/lib/visitPayload.ts`：Visit → create payload
  - 删除成功后侧栏 notice 显示「撤销」（8s）；点击后 `createVisit` 恢复
  - location 复用由 `ensureLocation` 处理；sequence/legs 按 `arrived_at` 重建
  - 测试：`visitPayload.test.ts`；`db.test.ts` 中间站删除再创建补边
- **未做**：`deleted_at` 软删除长线。

### P3 · 正确性与交互打磨

### P3-1 · 地图 pan 边界 clamp

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`client/lib/map/clampPan.ts`；`TravelCanvas` 在 drag / zoom / focus / resize 后 clamp；测试 `clampPan.test.ts`。

### P3-2 · 电影模式 `setViewport` 接入

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`TravelCanvas` resize 回调 `onViewportChange`；`App.handleMovieViewport` 调用 `movieEngine.setViewport` 并重算当前帧。

### P3-3 · `resolveLegs` O(n²)

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`resolveLegs` 预建 `fromVisitId:toVisitId` → `Leg` 的 `Map`，相邻站 O(1) 查找；导出供单测。
- **测试**：`client/lib/movie/engine.test.ts`（匹配 / fallback / 无关 leg）。
- **验收**：行为与原先一致；节点较多时电影模式启动为 O(n+m) 而非 O(n·m)。

### P3-4 · TravelCanvas 国家 path 预计算

- **状态**：~~已完成（2026-07-11）~~
- **实现**：与 LocationPicker 一样预计算 `countryPaths`（`d` 字符串），模板不再每次 `pathGenerator(country)`。

### P3-5 · 表单校验补齐（前端）

- **状态**：~~已完成（2026-07-11，随 P0-5）~~
- **实现**：`VisitForm` 提交前日期/先后/transport 校验；create/edit 评分默认统一 `4.5`；`returnTransport` 仍可空（fallback 去程）。

### P3-6 · 模态 a11y（focus trap）

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `client/lib/focusTrap.ts`：`resolveTabTarget` + `createFocusTrap` + Svelte `use:focusTrap`
  - `ConfirmDialog` / `VisitForm` 接入；Tab 在模态内循环；Esc 关闭；关闭后恢复先前焦点
  - `VisitForm`：`role="dialog"` + `aria-modal` + `aria-labelledby`
- **测试**：`client/lib/focusTrap.test.ts`
- **非目标**：`PosterPreview` 本项未改。

### P3-7 · UX 小一致性

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `yearAfterSave`：保存后保留年份筛选；节点跨年时切到节点所在年（`client/lib/yearFilter.ts`）
  - 侧栏 `error` / `notice` / `loading` 独立显示，不再互斥
  - `TimelineStrip` 选中项 `aria-current="true"`
  - 无 atlas 且加载失败时地图区中央错误 +「重试」
- **测试**：`client/lib/yearFilter.test.ts`

### P3-8 · gazetteer 搜索小优化

- **状态**：~~已完成（2026-07-11，方案 A）~~
- **实现**：抽出 `matchPlaces`；中英/国家字段统一走 `normalize`；`searchPlaces` 仍懒加载后调用。
- **测试**：`client/lib/gazetteer.test.ts`
- **未做**：前缀索引；抬高人口阈值压 `gazetteer.json` 体积。

---

## P4 · 前端结构与技术债

> 单项会话容易膨胀；建议有明确「非目标」边界。

### P4-1 · 迁移 Svelte 5 runes（分阶段）

- **问题**：依赖 Svelte 5，组件仍全面 `let` / `$:` / `export let` / `createEventDispatcher`；零 `$state`/`$derived`/`$effect`/`$props`。
- **位置**：全 `client/`。
- **建议做法**：按文件迁移，优先 `confirm.ts` 消费者以外的叶子组件 → `VisitForm` → `TravelCanvas` → `App.svelte`；用官方迁移思路替换 dispatcher 为 callback props。
- **验收**：`pnpm typecheck` + 主路径手测；不引入行为回归。
- **依赖**：无。**不要**与大功能同会话。

### P4-2 · 拆分上帝组件

- **状态**：~~部分完成（2026-07-11，App 编排抽出）~~
- **本会话完成**：
  - `client/lib/movie/session.ts`：`createMovieSession`（播放 / 导出 / viewport / activeLeg）
  - `client/lib/poster/preview.ts`：`createPosterPreview` + `posterDisabledReason`
  - `App.svelte` 从 ~927 行降至 ~746 行；行为保持 store 驱动
- **未做（后续会话）**：TravelCanvas 控制条/节点/路线子组件；VisitForm 分段子组件。
- **非目标**：本会话不做 P4-1 runes。

### P4-3 · 去重 pan/zoom 与 plotVisits

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `client/lib/map/panZoom.ts`：`panForZoomAt`（缩放锚点）；`clampContainedPan`（picker 装入式 clamp）
  - TravelCanvas / LocationPicker 共用缩放数学；各自保留不同 clamp / 倍率
  - App 传入 `plottedVisits`；TravelCanvas 不再二次 `plotVisits`
- **测试**：`panZoom.test.ts`；`clampPan.test.ts` 增补 contained 用例

### P4-4 · Tailwind 策略决策（二选一并文档化）

- **状态**：~~已完成（2026-07-11，方案 A）~~
- **实现**：README Tech Stack 写明 Tailwind 仅作 base/reset；UI 以 `client/app.css` + 组件 scoped 语义类为准，不走 utility-first。

### P4-5 · API 客户端增强（按需）

- **状态**：~~已完成（2026-07-12）~~
- **实现**：
  - `client/lib/api.ts`：`FetchOptions.signal` + `isAbortError`；`fetchAtlas` / `createVisit` / `updateVisit` 透传
  - `App.loadAtlas`：新请求 abort 旧请求；仅当前 controller 写状态 / 清 loading
  - `VisitForm`：保存 AbortController；关闭 / Esc / destroy 时 abort；静默忽略
- **测试**：`client/lib/api.test.ts`
- **未做**：retry；delete / import / export abort

### P4-6 · `TransportSelect` 弃用 API

- **状态**：~~已完成（2026-07-11）~~
- **实现**：`<SelectedIcon />` / `<Icon />` 替代 `<svelte:component this={...}>`。
- **验收**：无 `svelte:component`；图标随选项切换。

---

## P5 · 产品增强（原「上一层楼」，未做部分）

> 下列为产品方向，非工程债。实现前建议先走 spec（`docs/superpowers/specs/`）。

| ID | 方向 | 说明 | 依赖/备注 |
| --- | --- | --- | --- |
| P5-1 | 照片 / 媒体附件 | 本地 `data/media/`，DB 存路径；详情缩略图、hover 首图 | 需迁移；导出导入要带文件或打包格式 |
| P5-2 | 标签主题地图 | `tags` 逗号串 → `tags` + `visit_tags` 表；点击过滤高亮 | **必须 P0-1**；改 tags 模型 |
| P5-3 | 时间轴真实比例 / 回忆胶卷 | 按时间比例刻度 + 窗口过滤 | 前端为主 |
| P5-4 | 节点拖拽手动排序 | 若允许 `sequence` 偏离 `arrived_at` 需改 P0-4 决策；当前 sequence 仅为日期序缓存 | 与 P0-4 已记录决策绑定 |
| P5-5 | 键盘快捷键 | `+`/`-`/`0`、空格、`N`、方向键切站 | 电影模式已用 Space/Esc，需统一 |
| P5-6 | 双击地图空白新建 | ~~已完成（2026-07-11）~~ 双击空白预填 lat/lng/country 打开 VisitForm；电影模式忽略 | LocationPicker/投影已具备 |
| P5-7 | 移动端 pinch zoom | 现有 `touch-action: none` 无 pinch | TravelCanvas |
| P5-8 | 标签碰撞 / zoom 分级显隐 | 低倍率减文字重叠 | TravelCanvas |
| P5-9 | 选中态强化相邻路段 | ~~已完成（2026-07-11）~~ 选中节点高亮相邻 leg、弱化其余；去程/回程随选中调透明度 | TravelCanvas |
| P5-10 | 详情面板切换过渡 | 「飞到下一站」感 | TripPanel |
| P5-11 | Stats 交通/里程深化 | 心情天气分布等 | 依赖 P0-3 |
| P5-12 | Playwright 主链路 E2E | 创建→地图→编辑→删除 | 依赖 P1-3 |
| P5-13 | CI：typecheck + test | ~~已完成（2026-07-11）~~ `.github/workflows/ci.yml`：push/PR → `pnpm typecheck` + `pnpm test` | 依赖 P1-3、P1-5 |
| P5-14 | 鉴权 / 多用户 | 当前明确单机无鉴权；公网 `0.0.0.0` 有风险 | 仅在部署模型变化时做 |

---

## 已修复 / 已完成（勿再开 issue）

| 项 | 说明 |
| --- | --- |
| 地图点选 / 地名搜索 | `LocationPicker` + gazetteer 懒加载 |
| 移除旅行线 → 年份筛选 | 见 spec `2026-07-08-remove-travel-lines-year-filter-design.md` |
| 出发起点与回程 | visits origin 模型 + `visitRoutes` |
| 电影模式 | `client/lib/movie/` + overlay + WebM 导出 |
| 统计页 | `StatsView` + `compute.ts`（含交通里程） |
| 旅行海报 | `client/lib/poster/` |
| 删除确认 UI | `ConfirmDialog` + `confirm()` Promise API（**不是**原生 `confirm`） |
| 跨日界线路由 | `pathSampler.buildRouteGeometry`；Canvas/海报/电影共用 |
| 端口 5167/5168 | `package.json` 与 README 已对齐（以仓库当前文件为准） |
| Schema 迁移机制 | `server/migrations.ts` + `PRAGMA user_version`；空库/旧库可升到当前版本 |
| FK 列索引 | 迁移 1：`idx_visits_location_id` 等四条 |
| locations 实体化 | `ensureLocation` 复用、`purgeOrphanLocations`、迁移 2 去重 + `idx_locations_name_country` |
| legs 大圆距离 | Haversine 写入 `distance_km`；Stats 总里程 + 交通里程 |
| legs/sequence 重建优化 | `rebuildLegs.ts`：窗口函数写 sequence + 单次 JOIN 批量建 leg |
| 写入校验加固 | `visitValidation.ts`：日期 / transport / visitId；VisitForm 对称校验 |
| README / 工程卫生 | Fastify + `server/public` 文档；gitignore public；`pnpm test` / smoke scripts |
| Tailwind 策略 | 方案 A：base/reset only，样式以语义 CSS 为准 |
| Smoke DB 隔离 | `SPACETIME_DB_PATH` + 临时库；默认 sqlite 不被 smoke 污染 |
| db / movie 单测 | `db.test.ts` CRUD 路径；`pathSampler` / `timeline` 纯函数 |
| JSON 导出导入 | `/api/export` + `/api/import`（替换策略）；侧栏入口 |
| 删除撤销 | 删除后 8s Toast「撤销」→ `createVisit` 恢复 |
| 地图 pan clamp / 电影 viewport / path 预计算 | `clampMapPan`；resize → `setViewport`；`countryPaths` |
| 共享 years / server 类型边界 | `shared/years.ts`；`VisitRoute` 迁入 `server/types.ts` |
| App 编排拆分（部分） | `movie/session.ts` + `poster/preview.ts`；App 行数下降 |
| resolveLegs Map 索引 | 电影模式 leg 解析 O(n+m)；`engine.test.ts` |
| 模态 focus trap | `focusTrap` action；VisitForm / ConfirmDialog Tab 循环 + Esc |
| UX 小一致性 | 保存保留年份；notice/error 分槽；TimelineStrip aria-current；地图重试 |
| gazetteer normalize | 中英搜索统一 `normalize`；`matchPlaces` + 单测 |
| TransportSelect 动态图标 | 去掉弃用的 `svelte:component` |
| CI typecheck + test | `.github/workflows/ci.yml`（pnpm + Node 22） |
| pan/zoom + plotVisits 去重 | `panForZoomAt` / `clampContainedPan`；App→Canvas 传 plottedVisits |
| 双击地图空白新建 | `pickLonLatAt`；预填坐标打开 VisitForm |
| 选中态相邻路段 | `legHighlight`；选中高亮相邻 leg，弱化其余 |
| API AbortSignal | `fetchAtlas`/保存可取消；loadAtlas 与 VisitForm 防竞态 |

---

## 建议实施顺序（新会话路线图）

| 顺序 | 会话主题 | 包含 ID |
| --- | --- | --- |
| 1 | ~~Schema 迁移骨架 + FK 索引~~ | ~~P0-1, P0-6~~ |
| 2 | ~~locations 实体化 + 测试~~ | ~~P0-2~~ |
| 3 | ~~legs 距离 + Stats 里程~~ | ~~P0-3~~ |
| 4 | ~~rebuildSequencesAndLegs 优化~~ | ~~P0-4~~ |
| 5 | ~~写入校验~~ | ~~P0-5, P3-5~~ |
| 6 | ~~文档 + gitignore + scripts~~ | ~~P1-1, P1-2, P1-3, P4-4~~ |
| 7 | ~~Smoke 隔离 + db/movie 单测~~ | ~~P1-4, P1-5~~ |
| 8 | ~~JSON 导出导入~~ | ~~P2-1~~ |
| 9 | ~~删除撤销~~ | ~~P2-2~~ |
| 10 | ~~pan clamp + 电影 viewport + path 预计算~~ | ~~P3-1, P3-2, P3-4~~ |
| 11 | ~~共享 years / server 类型边界~~ | ~~P1-6, P1-7~~ |
| 12 | ~~App 电影/海报编排抽出~~（TravelCanvas/VisitForm 仍待拆） | ~~P4-2（部分）~~ |
| 13 | ~~resolveLegs Map 索引~~ | ~~P3-3~~ |
| 14 | ~~模态 focus trap~~ | ~~P3-6~~ |
| 15 | ~~UX 小一致性~~ | ~~P3-7~~ |
| 16 | ~~gazetteer normalize 统一~~ | ~~P3-8~~ |
| 17 | ~~TransportSelect 去 svelte:component~~ | ~~P4-6~~ |
| 18 | ~~CI typecheck + test~~ | ~~P5-13~~ |
| 19 | ~~pan/zoom + plotVisits 去重~~ | ~~P4-3~~ |
| 20 | ~~双击地图空白新建~~ | ~~P5-6~~ |
| 21 | ~~选中态强化相邻路段~~ | ~~P5-9~~ |
| 22 | ~~API AbortSignal 竞态防护~~ | ~~P4-5~~ |
| 23 | 产品增强按需 | P5-* |

---

## 实现备忘（给 Agent）

- 主画布：`client/components/TravelCanvas.svelte`
- API / DB：`server/index.ts`（Fastify）、`server/db.ts`、`server/migrations.ts`、`server/visitRoutes.ts`
- Schema 版本：`PRAGMA user_version`；新增迁移时 bump `SCHEMA_VERSION` 并在 `migrations` 字典注册
- 运行时 DB：`data/spacetime-travel.sqlite`（gitignore）；可用 `SPACETIME_DB_PATH` 覆盖（测试 / smoke）
- 构建输出：`server/public/`（已 gitignore）
- 类型检查：`pnpm typecheck`
- 测试：`pnpm test`；smoke：`pnpm smoke:visit-origin`（临时库，不写默认 DB）
- 现有测试文件：
  ```bash
  server/db.test.ts
  server/migrations.test.ts
  server/locations.test.ts
  server/haversine.test.ts
  server/legDistance.test.ts
  server/rebuildLegs.test.ts
  server/visitValidation.test.ts
  server/visitRoutes.test.ts
  server/exportImport.test.ts
  client/lib/stats/compute.test.ts
  client/lib/movie/pathSampler.test.ts
  client/lib/movie/timeline.test.ts
  client/lib/movie/engine.test.ts
  client/lib/focusTrap.test.ts
  client/lib/yearFilter.test.ts
  client/lib/gazetteer.test.ts
  client/lib/visitPayload.test.ts
  client/lib/map/clampPan.test.ts
  client/lib/map/panZoom.test.ts
  client/lib/map/pickLonLat.test.ts
  client/lib/map/legHighlight.test.ts
  client/lib/api.test.ts
  client/lib/poster/preview.test.ts
  shared/years.test.ts
  ```
- Specs：`docs/superpowers/specs/`、`docs/superpowers/plans/`
- 原生模块：若 pnpm 拦截构建，`pnpm approve-builds`（`better-sqlite3` / `esbuild`）
- 提交信息：英文 + gitmoji，见 `AGENTS.md`

---

## 安全部署提示（非立即项）

- API 监听 `0.0.0.0` 且无鉴权（`server/index.ts`）；仅适合本机或受信网络。
- `deploy2server.sh` 被 gitignore；其中 DB scp 曾注释——部署不会自动同步 sqlite，需运维自觉备份（与 P2-1 互补）。
