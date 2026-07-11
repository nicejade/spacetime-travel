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

- 前端：Svelte 5 运行时 + **Svelte 4 遗留组件语法**（尚未迁移 runes）、Vite 6、Tailwind CSS 4（已安装，但组件几乎全用手写 scoped CSS + `app.css` 语义类）
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
- Smoke：`node --import tsx scripts/smoke-visit-origin.mjs` → `smoke ok`（会写真实 DB，见 backlog）
- **升级**：additive 变更由迁移自动应用；仅非可迁移破坏性变更才需删 `data/spacetime-travel.sqlite*`

---

## 整体评价

定位清晰：离线地图 + 情感字段 + 交通视觉语言，区别于打卡地图。电影模式 / 统计 / 海报已把「记忆升维」与「表达输出」的核心体验兑现。

长久维护的主要瓶颈在 **数据层生命周期**（无迁移、locations 假实体、legs 半成品）与 **文档/工程卫生滞后**，其次才是前端技术债与产品增强。

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

- **问题**：
  - `arrivedAt` 只校验非空，无日期格式（~692）；`visitYear` 靠 `slice(0, 4)`。
  - `departedAt` 与 `arrivedAt` 无先后关系校验（前后端皆无）。
  - `transport` 字段无枚举白名单（~699, 703）。
  - 路由 `:id`：`Number("abc")` → NaN → 404 而非 400（`server/index.ts` ~35, 40）。
  - 无 Fastify JSON Schema（靠 `as VisitPayloadInput`）。
- **位置**：`server/db.ts` `readVisitPayload`；`server/index.ts`；可选 `VisitForm.svelte`。
- **建议做法**：
  1. 服务端校验 ISO 日期（至少 `YYYY-MM-DD`）；`departedAt >= arrivedAt`。
  2. transport 白名单与前端 `Transport` 类型对齐。
  3. `:id` 解析失败返回 400。
  4. （可选）Fastify schema 或共享 zod；SQLite `CHECK` 作第二道防线。
- **验收**：非法日期 / 颠倒离站日 / 非法 transport / 非数字 id → 明确 400；合法路径回归通过。
- **依赖**：无。可与 P0-2 同会话末尾顺手做，或独立小会话。

### P0-6 · 外键列索引

- **状态**：~~已完成（随 P0-1 迁移 1，2026-07-11）~~ — 见上方 P0-1。

---

## P1 · 工程卫生与文档

### P1-1 · 同步 README / HANDOFF 与代码

- **问题**（部分已在本文修正，README 仍滞后）：
  - README 仍可能写 Express、`dist/`、`db.js`/`index.js`、过时目录树。
  - Features 未列：电影模式、统计页、海报、起点/回程、地名搜索。
  - 旧 HANDOFF 把已完成功能标为「未来」、把已修复 bug 仍列「已知」。
- **位置**：`README.md`；本文。
- **建议做法**：按「当前状态」表重写 README Features / Structure / Tech Stack / 构建输出路径；删除 Express/`dist` 表述。
- **验收**：新贡献者只读 README 能正确 `pnpm dev`、理解 Fastify + `server/public`、知道三大功能入口。
- **依赖**：无。

### P1-2 · Gitignore 构建产物 `server/public/`

- **问题**：`vite.config.ts` `outDir: './server/public'`，`.gitignore` 只忽略 `dist/`。`server/public/` 常以 untracked 出现在 `git status`。
- **位置**：`.gitignore`；可选清理已跟踪文件。
- **建议做法**：忽略 `server/public/`（或整目录）；文档写明生产构建输出位置。
- **验收**：`pnpm build` 后 `git status` 不出现 public 下 hash 资源。
- **依赖**：无。可与 P1-1 同会话。

### P1-3 · 补齐 `package.json` scripts

- **问题**：无 `test` 脚本；`typecheck` 存在但未进日常/CI。
- **位置**：`package.json`。
- **建议做法**：
  ```json
  "test": "node --import tsx --test server/**/*.test.ts client/**/*.test.ts",
  "smoke:visit-origin": "node --import tsx scripts/smoke-visit-origin.mjs"
  ```
  并在 README Scripts 段说明。
- **验收**：`pnpm test` / `pnpm typecheck` 可一键跑通。
- **依赖**：无。

### P1-4 · Smoke 脚本隔离数据库

- **问题**：`scripts/smoke-visit-origin.mjs` 向真实 `data/spacetime-travel.sqlite` 写入，污染用户/开发数据。
- **位置**：`scripts/smoke-visit-origin.mjs`；`server/db.ts` 模块级开库路径。
- **建议做法**：支持 `SPACETIME_DB_PATH`（或 `:memory:`）环境变量；smoke 使用临时文件并在结束时删除；`db.ts` 据此开库。
- **验收**：跑 smoke 前后，默认 `data/spacetime-travel.sqlite` 的 visit 数量不变。
- **依赖**：小改 `db.ts` 开库路径；建议在 P0 测试基建前完成。

### P1-5 · 测试基建（db 事务 + 电影核心纯函数）

- **问题**：仅有 `server/visitRoutes.test.ts`、`client/lib/stats/compute.test.ts`；`db.ts` CRUD/重建、movie `pathSampler`/`timeline`/`cameraRig`、poster bounds **无单测**。Spec 曾要求 movie 单测未兑现。
- **位置**：新建 `server/db.test.ts` 等；`package.json` test 脚本（P1-3）。
- **建议做法**：
  1. db 测试用临时 sqlite 文件 + 导出可注入的 db 工厂（可能需弱化模块副作用）。
  2. 优先覆盖：create → sequence/legs、中间插入日期重排、delete 级联、locations 复用（若 P0-2 已做）。
  3. movie：`crossesDateline` / `buildRouteGeometry`、timeline 阶段边界。
- **验收**：`pnpm test` 覆盖上述关键路径；CI 或文档要求提交前运行。
- **依赖**：P1-3、P1-4；locations 相关用例依赖 P0-2。

### P1-6 · 消除 YEAR_PALETTE 双份维护

- **问题**：`server/db.ts` L15–44 与 `client/lib/years.ts` 重复 palette / `visitYear` / `yearColor`。
- **建议做法**：抽到共享模块（如 `shared/years.ts`），或服务端只返回 year 列表、颜色仅前端算（API 契约需一致）。
- **验收**：改一处 palette，两端着色一致；无复制粘贴块。
- **依赖**：无。小会话。

### P1-7 · 服务端不再 import 客户端类型

- **问题**：`server/visitRoutes.ts` `import type` 自 `../client/lib/types.js`，边界耦合。
- **建议做法**：`shared/types.ts` 或 `server/types.ts` 自洽定义 `VisitRoute` 所需最小形状。
- **验收**：server 构建/测试不依赖 `client/` 路径。
- **依赖**：无。

---

## P2 · 产品闭环（日常使用安全）

### P2-1 · JSON 导出 / 导入

- **问题**：数据只在单个 sqlite；无导出口。本地优先应用的安全底线未兑现（原 P0 功能闭环）。
- **位置**：`server/index.ts`（现仅 health/atlas/visits）；前端设置或侧栏入口。
- **建议做法**：
  - `GET /api/export` → 全量 JSON（visits + locations 或扁平 atlas 形状，带 `schemaVersion`）。
  - `POST /api/import` → 校验版本后替换或合并（需明确策略：替换更简单）。
  - UI：下载文件 / 选择文件上传；危险操作走 `ConfirmDialog`。
- **验收**：导出 → 删库 → 导入 → 地图与统计与导出前一致；坏文件返回 400。
- **依赖**：最好有 P0-1 的 `schemaVersion` 字段写进导出文件。

### P2-2 · 删除撤销（软删除或 Undo Toast）

- **问题**：删除不可恢复；虽已有 `ConfirmDialog`，误确认仍永久丢失。与情感定位冲突。
- **位置**：`App.svelte` `handleDelete`；可选 `server/db.ts`。
- **建议做法（由易到难）**：
  - **短线**：删除成功后 Toast「撤销」→ 短时内用导出的 visit payload 再 `createVisit`（注意 location 复用）。
  - **长线**：`deleted_at` 软删除 + 清理任务。
- **验收**：删除后可在时限内恢复节点与相邻 legs 语义正确。
- **依赖**：P0-2 会让恢复时 location 行为更清晰。

---

## P3 · 正确性与交互打磨

### P3-1 · 地图 pan 边界 clamp

- **问题**：`movePan` 无边界，地图可被拖出可视区（`TravelCanvas.svelte` ~127–134）。
- **建议做法**：按 `displayScale` 与视口尺寸 clamp `pan.x/y`；zoom 后同样约束。
- **验收**：任意拖拽后地图仍有可见陆地/内容；重置仍正确。
- **依赖**：无。

### P3-2 · 电影模式 `setViewport` 接入

- **问题**：`MovieEngine.setViewport()` 已实现（`engine.ts` ~76–79）但 `App.svelte` 从未调用；窗口 resize 时镜头可能不准。
- **建议做法**：movie 激活时监听 resize / 读 canvas 尺寸并调用 `setViewport`。
- **验收**：播放中改变窗口，光点与镜头仍对齐路径。
- **依赖**：无。

### P3-3 · `resolveLegs` O(n²)

- **问题**：`engine.ts` ~27–28 内层 `legs.find`。
- **建议做法**：预处理 `Map` 按 from/to 索引。
- **验收**：节点较多时电影模式启动无可见卡顿；行为不变。
- **依赖**：无。

### P3-4 · TravelCanvas 国家 path 预计算

- **问题**：模板中每次调用 `pathGenerator(country)`（~280–282）；`LocationPicker` 已预计算 `countryPaths`。
- **建议做法**：与 LocationPicker 一样预计算 path `d` 字符串。
- **验收**：拖拽/缩放更顺；视觉不变。
- **依赖**：无。

### P3-5 · 表单校验补齐（前端）

- **问题**：无 `departedAt > arrivedAt`；勾选返回起点时 `returnTransport` 可空；create/edit 评分默认 4.5 vs 4 不一致（`VisitForm.svelte`）。
- **建议做法**：与 P0-5 对齐的前端校验与默认值统一。
- **验收**：非法组合无法提交；默认值一致。
- **依赖**：可与 P0-5 同做。

### P3-6 · 模态 a11y（focus trap）

- **问题**：`VisitForm` 缺 `aria-modal` / focus trap；`ConfirmDialog` 有 `aria-modal` 但 Tab 可逃到背景。
- **位置**：`VisitForm.svelte`、`ConfirmDialog.svelte`。
- **验收**：打开模态后 Tab 循环在模态内；Esc 关闭（若已有则保持）。
- **依赖**：无。

### P3-7 · UX 小一致性

- `handleSaved` 强制 `selectedYear = 'all'`（`App.svelte` ~202）破坏筛选上下文 → 应保留当前年（若新节点属于该年则选中）。
- `flash()` notice 与 error 共用 UI 槽 → 分离或排队。
- `TimelineStrip` 选中项补 `aria-current`。
- 加载失败时地图区也应有错误/重试态。
- **依赖**：无。可拆成多个微会话。

### P3-8 · gazetteer 搜索小优化

- **问题**：6244 条线性扫描可接受；中英文 normalize 不一致（`gazetteer.ts` ~80–84）；文件 559KB 略超 spec 500KB。
- **建议做法**：统一 normalize；可选简单前缀索引；人口阈值微调压体积（可选）。
- **验收**：中英文搜索体验一致；首搜仍懒加载。
- **依赖**：无。

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

- **问题**：`App.svelte` ~765 行（编排+电影+海报+UI）；`TravelCanvas` ~625；`VisitForm` ~596。
- **建议做法**：
  - App：抽出 `useMovieSession` / poster 生成逻辑到 `client/lib/` 或小模块。
  - TravelCanvas：控制条 / 节点层 / 路线层拆子组件。
  - VisitForm：outbound / return / inbound / memory 分段子组件。
- **验收**：单文件行数明显下降；行为不变。
- **依赖**：与 P4-1 可先后，避免同会话又迁 runes 又拆文件。

### P4-3 · 去重 pan/zoom 与 plotVisits

- **问题**：pan/zoom 在 `TravelCanvas` 与 `LocationPicker` 重复；`plotVisits` 在 App 与 TravelCanvas 重复计算。
- **建议做法**：共享 `client/lib/map/panZoom.ts`；plot 结果单一来源向下传。
- **验收**：两处地图交互一致；无双重投影漂移。
- **依赖**：无。

### P4-4 · Tailwind 策略决策（二选一并文档化）

- **问题**：README 宣称 Tailwind，实际 utility 几乎未用；`app.css` + scoped CSS 才是设计系统。
- **建议做法**：
  - **A**：更新 README：「Tailwind 仅作 base/reset，样式以语义 CSS 为准」。
  - **B**：逐步把重复样式改为 utility（工作量大，不推荐除非要统一团队习惯）。
- **验收**：文档与代码一致；不出现半套两套规范。
- **依赖**：无。推荐选 A，与 P1-1 合并。

### P4-5 · API 客户端增强（按需）

- **问题**：`client/lib/api.ts` 无 abort/retry；电影导出已有 AbortController，CRUD 没有。
- **建议做法**：为 loadAtlas / 保存提供 AbortSignal；避免快速切换导致竞态。
- **验收**：慢网下快速切换年份/关闭表单不出现错乱覆盖。
- **依赖**：无。

### P4-6 · `TransportSelect` 弃用 API

- **问题**：仍用 `<svelte:component>`（Svelte 5 弃用路径）。
- **位置**：`TransportSelect.svelte` ~94, 117。
- **验收**：无弃用警告；图标切换正常。
- **依赖**：可与 P4-1 一起。

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
| P5-6 | 双击地图空白新建 | 带入点击坐标 | LocationPicker/投影已具备 |
| P5-7 | 移动端 pinch zoom | 现有 `touch-action: none` 无 pinch | TravelCanvas |
| P5-8 | 标签碰撞 / zoom 分级显隐 | 低倍率减文字重叠 | TravelCanvas |
| P5-9 | 选中态强化相邻路段 | 按年弱化其余轨迹 | TravelCanvas |
| P5-10 | 详情面板切换过渡 | 「飞到下一站」感 | TripPanel |
| P5-11 | Stats 交通/里程深化 | 心情天气分布等 | 依赖 P0-3 |
| P5-12 | Playwright 主链路 E2E | 创建→地图→编辑→删除 | 依赖 P1-3 |
| P5-13 | CI：typecheck + test | GitHub Actions 等 | 依赖 P1-3、P1-5 |
| P5-14 | 鉴权 / 多用户 | 当前明确单机无鉴权；公网 `0.0.0.0` 有风险 | 仅在部署模型变化时做 |

---

## 已修复 / 已完成（勿再开 issue）

| 项 | 说明 |
| --- | --- |
| 地图点选 / 地名搜索 | `LocationPicker` + gazetteer 懒加载 |
| 移除旅行线 → 年份筛选 | 见 spec `2026-07-08-remove-travel-lines-year-filter-design.md` |
| 出发起点与回程 | visits origin 模型 + `visitRoutes` |
| 电影模式 | `client/lib/movie/` + overlay + WebM 导出 |
| 统计页 | `StatsView` + `compute.ts`（里程等仍待 P0-3） |
| 旅行海报 | `client/lib/poster/` |
| 删除确认 UI | `ConfirmDialog` + `confirm()` Promise API（**不是**原生 `confirm`） |
| 跨日界线路由 | `pathSampler.buildRouteGeometry`；Canvas/海报/电影共用 |
| 端口 5167/5168 | `package.json` 与 README 已对齐（以仓库当前文件为准） |
| Schema 迁移机制 | `server/migrations.ts` + `PRAGMA user_version`；空库/旧库可升到当前版本 |
| FK 列索引 | 迁移 1：`idx_visits_location_id` 等四条 |
| locations 实体化 | `ensureLocation` 复用、`purgeOrphanLocations`、迁移 2 去重 + `idx_locations_name_country` |
| legs 大圆距离 | Haversine 写入 `distance_km`；Stats 总里程 + 交通里程 |
| legs/sequence 重建优化 | `rebuildLegs.ts`：窗口函数写 sequence + 单次 JOIN 批量建 leg |

---

## 建议实施顺序（新会话路线图）

| 顺序 | 会话主题 | 包含 ID |
| --- | --- | --- |
| 1 | ~~Schema 迁移骨架 + FK 索引~~ | ~~P0-1, P0-6~~ |
| 2 | ~~locations 实体化 + 测试~~ | ~~P0-2~~ |
| 3 | ~~legs 距离 + Stats 里程~~ | ~~P0-3~~ |
| 4 | ~~rebuildSequencesAndLegs 优化~~ | ~~P0-4~~ |
| 5 | 写入校验 | P0-5, P3-5 |
| 6 | 文档 + gitignore + scripts | P1-1, P1-2, P1-3, P4-4 |
| 7 | Smoke 隔离 + db/movie 单测 | P1-4, P1-5 |
| 8 | JSON 导出导入 | P2-1 |
| 9 | 删除撤销 | P2-2 |
| 10 | pan clamp + 电影 viewport + path 预计算 | P3-1, P3-2, P3-4 |
| 11 | 共享 years / server 类型边界 | P1-6, P1-7 |
| 12 | 前端拆分或 runes（选其一） | P4-1 或 P4-2 |
| 13 | 产品增强按需 | P5-* |

---

## 实现备忘（给 Agent）

- 主画布：`client/components/TravelCanvas.svelte`
- API / DB：`server/index.ts`（Fastify）、`server/db.ts`、`server/migrations.ts`、`server/visitRoutes.ts`
- Schema 版本：`PRAGMA user_version`；新增迁移时 bump `SCHEMA_VERSION` 并在 `migrations` 字典注册
- 运行时 DB：`data/spacetime-travel.sqlite`（gitignore）
- 构建输出：`server/public/`（应 gitignore，见 P1-2）
- 类型检查：`pnpm typecheck`
- 现有测试：
  ```bash
  node --import tsx --test server/migrations.test.ts
  node --import tsx --test server/locations.test.ts
  node --import tsx --test server/haversine.test.ts
  node --import tsx --test server/legDistance.test.ts
  node --import tsx --test server/rebuildLegs.test.ts
  node --import tsx --test server/visitRoutes.test.ts
  node --import tsx --test client/lib/stats/compute.test.ts
  node --import tsx scripts/smoke-visit-origin.mjs   # 会写真实 DB，见 P1-4
  ```
- Specs：`docs/superpowers/specs/`、`docs/superpowers/plans/`
- 原生模块：若 pnpm 拦截构建，`pnpm approve-builds`（`better-sqlite3` / `esbuild`）
- 提交信息：英文 + gitmoji，见 `AGENTS.md`

---

## 安全部署提示（非立即项）

- API 监听 `0.0.0.0` 且无鉴权（`server/index.ts`）；仅适合本机或受信网络。
- `deploy2server.sh` 被 gitignore；其中 DB scp 曾注释——部署不会自动同步 sqlite，需运维自觉备份（与 P2-1 互补）。
