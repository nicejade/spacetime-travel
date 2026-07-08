# 移除旅行线，改用年份筛选 — 设计文档

> 决策：删除 `trips`（旅行线）这一用户概念与数据实体；浏览改以「所有年份 / 各年」筛选，地图按年份着色，轨迹按到达日期全局串联。
> 不向前兼容：无迁移脚本，本地删库重建即可。

## 背景

`spacetime-travel` 当前把每一次访问挂在一条命名「旅行线」（`trips`）上。旅行线同时负责：

- 节点归属与 `sequence` / `legs` 分段
- 地图与时间轴着色
- 侧栏筛选芯片
- 录入时「选线 / 新建线 / 线名 / 副标题 / 颜色」

产品与用户侧反馈：多数使用场景不需要「起一条线」——人们只是在不同日期留下记忆节点。旅行线反而增加录入决策，且 HANDOFF 中「旅行线 CRUD」至今双缺失，说明该概念从未被日常管理需要验证。

## 目标

1. **彻底移除旅行线**：schema、API 载荷、UI 文案与筛选中不再出现 trip / 旅行线。
2. **以年份组织浏览**：筛选默认为「所有年份」，并列出有数据的各年。
3. **全局时间序轨迹**：所有节点按 `arrived_at` 串联成一条人生轨迹；筛某年时只显示该年节点与同年内边。
4. **按年份着色**：节点 / 路线色由到达年份映射，替代原 trip 色。
5. **降低录入门槛**：创建节点不再选择或命名旅行线。

## 非目标（YAGNI）

- 旧 SQLite 数据迁移 / 向前兼容。
- 年份实体表（颜色、年终寄语等可后置，本阶段从日期推导）。
- 新增 `/api/trips` 或旅行线 CRUD（该 P0 项取消）。
- 按时间空隙自动拆「段落」、标签主题筛选（可另开设计）。
- 跨年节点双年可见或「主导年份」归属（已明确不做）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| 组织方式 | 扁平 visits + 全局 legs；年份从 `arrived_at` 推导 |
| 筛选默认 | 「所有年份」 |
| 连线 | 全局按日期串；单年筛选只保留两端都在该年的 legs |
| 着色 | 按到达年份，固定调色板稳定映射 |
| 跨年节点归属 | 严格按到达年（12 月算出发年，1 月算次年） |
| 兼容策略 | 不迁移；文档要求删除 `data/*.sqlite*` 后重启 seed |

## 架构

### 1. Schema

删除 `trips` 表。调整：

**`visits`**

- 删除 `trip_id` 及对应外键。
- `sequence` 改为**全局**顺序（按 `arrived_at` 升序，同日按 `id` 稳定排序后重写）。

**`legs`**

- 删除 `trip_id` 及对应外键。
- `sequence` 改为全局；每条 leg 连接全局时间序上相邻的两个 visits。
- `transport` / `note` 语义不变：表示「到达后一站」的 inbound 信息，创建/编辑时仍挂在目标 visit 上。

**不变**

- `locations` 表结构与用途不变（本设计不修复孤儿 location，那是独立问题）。

索引：`idx_visits_trip_sequence` / `idx_legs_trip_sequence` 删除，改为例如 `idx_visits_arrived_at`、`idx_legs_sequence`。

开发机 / 文档说明：因无迁移，启动前删除 `data/spacetime-travel.sqlite*`；`CREATE TABLE IF NOT EXISTS` 不会改掉已存在的旧表结构，删库是必须步骤。

### 2. 年份与颜色（查询层）

不在 DB 存 year。

```
year(visit) = calendar year of visit.arrived_at  // 解析为本地/存储用的日期字符串年份即可，与现有 TEXT 日期一致
years = unique years across all visits, descending
yearColors[year] = YEAR_PALETTE[(year - YEAR_PALETTE_EPOCH) mod palette.length]
```

使用固定有序列表（约 6–8 色）按年份序取模映射，不用随机 hash，保证同输入同输出、多年并排可区分。色值实现期写入常量即可。

跨年 leg（两端年份不同）：仅在「所有年份」视图渲染；颜色取 **后一站（to visit）的到达年份色**（一条明确规则，避免实现分歧）。

### 3. Atlas 响应

`GET /api/atlas`（及所有突变响应中的 `atlas`）形状：

```ts
{
  visits: Visit[];       // 全局 sequence / arrived_at 升序
  legs: Leg[];           // 相邻 visits
  years: number[];       // 降序，如 [2024, 2023, 2022]
  yearColors: Record<string, string>; // "2024" → "#…"
  stats: {
    visitCount: number;
    countryCount: number;
    averageRating: number;
    startYear: number | null;
    endYear: number | null;
    // 删除 tripCount
  };
}
```

客户端类型：删除 `Trip`；`Visit` / `Leg` 去掉 `tripId`；新增 `yearColors` / `years`。

### 4. 写入路径

**载荷**：从 `VisitPayload` / `ParsedVisitPayload` 删除 `tripId`、`newTripTitle`、`newTripSubtitle`、`tripColor`。

**`createVisit` / `updateVisit` / `deleteVisit`**（均在事务内）：

1. 写入或删除 visit（及 location，遵循现有位置逻辑）。
2. 读取全部 visits，按 `arrived_at ASC, id ASC` 重写全局 `sequence`。
3. **重建全部 legs**（统一算法，避免半截 trip 逻辑）：
   - 事务开始前或删除前：把现有 legs 按 `to_visit_id` 快照为 `Map<toVisitId, { transport, note }>`。
   - 写入 / 删除 visit 后，按当前全局 visit 顺序清空并重建：对每一对相邻 `(prev, curr)` 插入一条 leg。
   - 每条新 leg 的 `transport` / `note` 取值优先级：
     1. 若本次请求正是在写 `curr`（create 或 update 该 visit），用表单的 inbound `transport` / `legNote`；
     2. 否则若快照中有 `to_visit_id === curr.id`，沿用快照；
     3. 否则 `transport = 'flight'`，`note = ''`。
   - 全局最早的 visit 没有 inbound leg。
4. 删除 `updateTripDates` 与「删光 trip 时删 trip」逻辑。

端点集合不变：`POST/PUT/DELETE /api/visits`；不增加 trips API。

### 5. 种子数据

删除「东亚春日线」等命名旅程包装。改为扁平的 visits（带 dates、locations、feelings 等）序列；seed 条件从「无 trips」改为「无 visits」。内容仍可大致保留现有站点顺序与情感文案，只去掉 trip 元数据。

### 6. UI

| 区域 | 变更 |
| --- | --- |
| `App.svelte` 筛选 | `selectedTripId` → `selectedYear: 'all' \| number`，默认 `'all'`；芯片文案「所有年份」+ 各年（圆点用 `yearColors`） |
| 可见数据 | `selectedYear === 'all'`：全 visits + 全 legs；否则 visits 中 `year(arrivedAt) === selectedYear`，legs 两端均在该子集内 |
| `TravelCanvas` | `trips` prop 改为 `visits` + `legs` + `yearColors`；节点色 / 路线色用到达年；跨年边仅在 all 视图出现 |
| `TimelineStrip` | 同上数据源；色点用年份色 |
| `TripPanel` | 本轮保留文件名以减小无关 diff；芯片改为到达年份；stats 去掉旅行线数 |
| `VisitForm` | 删除旅行线下拉、新线名/副标题/颜色整块 |

文案：「旅行线筛选」→「年份筛选」等。

### 7. 文档与 HANDOFF

实现完成后（另计）：更新 `README.md` 数据模型与特性列表；`HANDOFF.md` 取消「旅行线 CRUD」P0，已知问题中「旅行线无编辑入口」标记为废弃（因概念移除）。

## 错误处理

- 必填校验（地点、坐标、到达日）保持现有 4xx。
- 写入路径失败：事务回滚，API 返回错误；客户端展示错误信息，不本地假装成功。
- 空库：`years = []`，筛选仅「所有年份」，地图 / 时间轴空态沿用现有模式。
- 旧库：不自动升级；README / HANDOFF 写明需删除 sqlite 文件。

## 测试 / 验证

实现期最小集：

1. **DB**：create → 全局 sequence 与相邻 legs；update `arrivedAt` 跨过邻居 → 重排正确；delete 中间节点 → 缺口补边。
2. **Atlas**：`years` / `yearColors`；跨年 leg 存在于全量 legs，按年过滤后不可见。
3. **UI 手测**：默认「所有年份」；切到单年只见同年节点/边；表单无 trip 字段；详情显示年份 chip。

类型检查：`pnpm typecheck`（或项目等价脚本）通过。

## 成功标准

- 产品中用户无法创建、选择或看到「旅行线」。
- 新用户默认看到全部节点的一条按时间连接的轨迹，可用年份收窄。
- 创建一站只需地点与日期等记忆字段，无需命名任何容器。
- 删除旧库后 `pnpm dev` 即可得到新 seed，无 trip 残留。
