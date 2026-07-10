# HANDOFF

> 本文档记录 `spacetime-travel` 的当前状态、整体评价、待办优先级、已知问题与产品升级方向，用于交接与后续迭代。
> 审阅基线：仓库 @ `3a9185e`。覆盖 `server/`、`client/` 全部源码及 `README.md`。

## 当前状态

`spacetime-travel` 是一个可运行的 MVP，技术栈为 Svelte 5 + Vite + Tailwind CSS 4 + Express + SQLite（`better-sqlite3`）。

产品骨架：一块全屏离线世界地图画布承载一切，左侧图谱总览、右侧节点详情、底部时间轴，四个面板围绕「选中节点」这一个状态联动。

已实现能力：

- **地图画布**：离线 SVG 世界地图（`d3-geo` + `world-atlas`）、平移 / 缩放 / 重置、交通方式差异化虚线、方向箭头、评分驱动的节点光晕、轨迹播放。
- **数据录入**：节点创建 / 编辑 / 删除；字段涵盖感受、饮食、心境、天气、记忆片段、标签、评分；支持离线地名搜索与地图点选坐标。
- **浏览导航**：年份筛选（默认「所有年份」）、时间轴条、详情面板、统计卡（节点数 / 地区数 / 均分 / 年份跨度）；地图按到达年份着色。
- **数据层**：SQLite + WAL、事务化写入、全局 `sequence` / 相邻 `legs` 重建、扁平 visits 种子数据（无 `trips` 表）。
- **出发起点与回程**：每条 visit 记录完整出发信息（起点 → 目的地 → 可选回程）。`visits` 含 `origin_location_id`、`returns_to_origin`、`outbound_*`、`return_*`、`inbound_*`；`legs` 仍表示站间时序连线（由 `inbound_*` 驱动）；`getAtlas` 合成 `visitRoutes`（去程/回程）供地图细线与详情展示；常用起点通过 `originSuggestions` 回填表单。
- Vite 前端与 Express API 分端口运行，前端通过 proxy 转发 `/api/*`。

## 整体评价

产品定位清晰、品味在线：离线地图（无需 API key）、情感化的数据字段、交通方式差异化的路线视觉语言，共同构成「旅行记忆图谱」区别于打卡地图的根本差异，值得继续往深里做。

当前主要瓶颈在于 **录入门槛** 与 **数据管理闭环的断点**，正在削弱这一定位的价值。

设计亮点：

- **情感化数据模型**：`visits` 不只记录「去过哪」，而是感受 / 食物 / 心境 / 天气 / 记忆片段。
- **零依赖离线地图**：`d3-geo` 投影 + `topojson` 全部本地渲染，与「本地优先」定位一致。
- **交通方式视觉语言**：飞行 / 火车 / 渡轮 / 自驾 / 巴士 / 步行各有专属虚线样式；节点与路线主色按到达年份着色，路线曲线交替弯曲。
- **API 返回全量 atlas**：每次写操作直接回传最新 atlas，前端无需二次拉取，在单用户本地场景下是恰当的简化。

## P0：优先补齐的功能闭环

> 完成这一批后，产品才算「可以放心日常使用」。

1. ~~**地图点选 / 地名搜索取坐标**~~ — 已完成。
2. ~~**旅行线管理**~~ — **已取消**：产品已移除旅行线概念，改为年份筛选（见 `docs/superpowers/specs/2026-07-08-remove-travel-lines-year-filter-design.md`）。
3. **JSON 导出 / 导入**
   - 新增 `GET /api/export`（全量 JSON）与 `POST /api/import`（恢复）。
   - 数据仅存在单个 `.sqlite` 文件中，目前没有任何导出口，这是本地优先应用的安全底线。

## Visit origin 功能备忘

- **删库重建**：`visits` schema 含 origin/return 字段，无迁移脚本。升级后删除 `data/spacetime-travel.sqlite*` 并重启以重 seed。
- **站间移动字段**：`VisitForm` 的 `inbound_*` 仅在非首站时显示（新建时若已有 visits，或编辑 `sequence > 1` 的 visit）。
- **Smoke**：`node --import tsx scripts/smoke-visit-origin.mjs` 应输出 `smoke ok`。
- **电影模式**：仍由 `legs` 驱动路径；`visitRoutes` 不参与播放。

## 已知问题

按严重度排序。位置为实际发生问题的代码点。

| 严重度 | 问题 | 位置 | 影响 |
| --- | --- | --- | --- |
| 高 | `locations` 表只增不减、从不复用 | `server/db.ts` `createVisit` / `deleteVisit` | 每次创建都 INSERT 新 location，删除 visit 后留下孤儿行；README 声称的「可复用地点」实际未实现 |
| 中 | 删除不可撤销 + 使用原生 `confirm` | `client/App.svelte` `handleDelete` | 误删即永久丢失一段记忆，与产品情感定位冲突 |
| 中 | 跨日界线路线被横穿整图 | `client/components/TravelCanvas.svelte` `routePath` | 上海→旧金山等跨太平洋航线会画一条贯穿地图的长线，需按经度差 > 180° 拆分或走球面插值 |
| 中 | 端口文档与脚本不一致 | `package.json`（5167）vs `README.md`（5188） | 新用户按 README 打开 5188 会发现服务不在该端口 |
| 低 | 地图无平移边界 | `client/components/TravelCanvas.svelte` `movePan` | 可将地图整个拖出可视区，需要 clamp pan 范围 |

**值得注意的信号**：`legs` 表已设计 `distance_km` 与 `duration_hours` 字段，但所有写入路径都填 `null`——schema 的野心超前于功能。优先兑现这些「已付定金」的设计（用 Haversine 公式在落库时自动算大圆距离），性价比最高。

## 让功能「上一层楼」的方向

### 记忆升维

- **照片 / 媒体附件**：每个节点支持若干张照片（本地文件存 `data/media/`，DB 只存路径）。详情面板加缩略图墙，地图节点 hover 浮出首图。
- **路线播放升级为「电影模式」**：将现在的 `setInterval` 跳节点，改为沿路径移动的光点 + 镜头平滑插值（飞行弧线、火车贴地），每站停留时淡入感受文字，做成可回放、可分享的体验。「时空旅行」的概念由此真正成立。
- **节点拖拽排序 + 删除撤销**：`visits.sequence` 现已按 `arrived_at` 全局重建；时间轴仍可支持显式拖拽重排；删除改为「软删除 + Undo Toast」。

### 数据洞察

- **旅行统计页（Stats View）**：兑现 `legs` 的距离 / 时长字段，汇总总里程、各交通方式占比、年度出行热力、评分分布。
- **时间维度浏览（年份刻度 / 回忆胶卷）**：把均匀排列的时间轴改为真实比例的年份刻度尺，拖动游标让地图只显示该时间窗内的轨迹。

### 表达输出

- **标签主题地图**：把逗号字符串的 `tags` 提取为可点击标签，点击后地图仅高亮含该标签的节点，形成「美食地图 / 徒步地图」等主题视图。
- **一键生成旅行海报 / 分享图**：把当前地图视角 + 轨迹 + 统计渲染成一张 SVG→PNG 海报（年度总结风格），无需任何账号体系。

## 工程层改进

### 正确性

- 路线渲染处理日界线（经度差 > 180° 时拆段或反向绕行）。
- 复用或清理 location：按 `name + country` 去重复用，删除 visit 时回收孤儿行。
- pan / zoom 增加边界约束，地图不可完全拖出视口。
- 统一端口：脚本、Vite proxy、README 三处对齐。

### 质量保障

- 用 Vitest 覆盖 `db.ts` 的事务逻辑（创建 / 重排 / 级联删除是回归高发区）。
- 用 Playwright 覆盖「创建节点 → 地图出现 → 编辑 → 删除」主链路。
- CI 中调用 `pnpm typecheck`（脚本已存在，尚无人调用）。

### 交互细节

- 键盘快捷键：`+` / `-` 缩放、`0` 重置、空格播放、`N` 新建、`←` / `→` 切换节点。
- 双击地图空白处快速新建节点（自动带入点击处坐标）。
- 移动端捏合缩放（目前 `touch-action: none` 但无 pinch 逻辑）。

### 视觉打磨

- 缩放时节点标签做碰撞检测或按 zoom 分级显隐，避免低倍率下文字重叠。
- 选中节点时提高相邻路段亮度，并按年份弱化其余轨迹。
- 详情面板切换节点时加轻量过渡，强化「飞到下一站」的感受。

## 建议路线图

| 阶段 | 周期 | 内容 |
| --- | --- | --- |
| 第一阶段 · 补齐闭环 | 1–2 周 | JSON 导出导入、删除撤销、修复日界线与端口文档 |
| 第二阶段 · 记忆升维 | 2–4 周 | 照片附件、电影模式播放、节点拖拽排序、距离自动计算与统计页 |
| 第三阶段 · 表达输出 | 长期 | 年份刻度时间轴、标签主题地图、旅行海报生成 |

## 实现备忘

- 主画布代码在 `client/components/TravelCanvas.svelte`。
- API 与数据库逻辑在 `server/db.ts` 与 `server/index.ts`。
- 运行时数据库为 `data/spacetime-travel.sqlite`，已被 Git 忽略。
- `pnpm-workspace.yaml` 允许 `better-sqlite3` 与 `esbuild` 的原生构建脚本；若安装因 pnpm 拦截原生脚本而失败，运行 `pnpm approve-builds`。
