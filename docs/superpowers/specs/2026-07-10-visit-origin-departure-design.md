# Visit 出发起点与回程 — 设计文档

> 决策：每条 visit 代表一次完整出发（起点 → 目的地 → 可选回程）；同时保留相邻 visit 目的地之间的时序连线。不向前兼容，删库重建。

## 背景

当前模型将 visit 视为全局时间链上的一个**目的地节点**，`legs` 仅连接相邻 visit，最早节点没有 inbound leg。用户在录入第一站时无法表达「从哪出发」，表单仍显示「前往方式」但语义悬空；种子数据用 `mood: '启程'` 等自由文本凑合。

用户反馈：旅行记忆天然有方向——每次出发都有起点和目标地点，默认还会回到起点；少数情况一去不回。现有扁平链模型缺少这一叙事维度。

## 目标

1. **每次出发有起点**：visit 必填 `origin`（完整地点，地图可见、可复用）。
2. **完整出发记录**：visit = 起点 → 目的地 →（默认）回到起点；可勾选「未返回起点」。
3. **保留时序连线**：相邻 visit 的目的地之间仍自动建 leg，地图主路线与电影模式行为不变。
4. **双轨路线可视化**：去程/回程用细线叠加；时序连线保持现有主样式。
5. **降低录入摩擦**：常用起点一键建议；返程交通默认同去程。

## 非目标（YAGNI）

- 旧 SQLite 数据迁移 / 向前兼容。
- 独立 `saved_origins` 收藏表（复用 `locations` + 历史查询即可）。
- 多目的地单次出发（一次出发多个目的地需拆成多条 visit）。
- 回程到达时间单独字段（`departed_at` 仍表示离开目的地；回程仅地图语义）。
- 修改电影模式主路径（仍沿时序连线，不绕去程/回程）。

## 关键设计决策

| 决策 | 选择 |
| --- | --- |
| visit 语义 | 一次完整出发，情感字段归属目的地停留 |
| 起点 | 必填 `origin_location_id`，完整坐标，地图展示 |
| 回程 | `returns_to_origin` 默认 `true`；`false` 时只画去程 |
| visit 间连线 | 保留 `legs` 表，连接相邻 visit 的**目的地** |
| 去程/回程 | 服务端合成 `visitRoutes`，不存入 `legs` |
| 返程交通 | `return_transport` 可空，空则 fallback 去程 |
| 起点复用 | 表单建议栏：历史 `origin_location_id` 去重列表 |
| 兼容策略 | 不迁移；删 `data/*.sqlite*` 后重启 seed |

## 架构

### 1. Schema

**`visits`（调整）**

新增：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `origin_location_id` | `INTEGER NOT NULL` | FK → `locations`，起点 |
| `returns_to_origin` | `INTEGER NOT NULL DEFAULT 1` | 是否回到起点 |
| `outbound_transport` | `TEXT NOT NULL DEFAULT 'flight'` | 去程交通 |
| `outbound_note` | `TEXT DEFAULT ''` | 去程备注 |
| `return_transport` | `TEXT` | 返程交通；`NULL` = 同去程 |
| `return_note` | `TEXT DEFAULT ''` | 返程备注 |
| `inbound_transport` | `TEXT` | 时序连线交通（上一站目的地 → 本站目的地）；全局首站为 `NULL` |
| `inbound_note` | `TEXT DEFAULT ''` | 时序连线备注 |

保留：`location_id`（目的地）、`arrived_at`、`departed_at`、情感字段、`sequence`。

字段语义（三种交通，各司其职）：

| 字段 | 路线 | 渲染层 |
| --- | --- | --- |
| `outbound_*` | 起点 → 目的地 | `visitRoutes` 去程 |
| `return_*` | 目的地 → 起点 | `visitRoutes` 回程 |
| `inbound_*` | 上一站目的地 → 本站目的地 | `legs` 时序连线 |

`rebuildSequencesAndLegs()` 建 leg 时，从目标 visit 的 `inbound_transport` / `inbound_note` 取值（与现逻辑相同，只是源字段改名区分 outbound）。

**`legs`（不变）**

仍连接全局时间序上相邻两个 visit 的**目的地**：

- `from_visit_id` → `to_visit_id`
- `transport` / `note` 表示从上一站目的地到下一站目的地的移动（时序连线）
- `rebuildSequencesAndLegs()` 逻辑保留：按 `arrived_at` 排序后相邻 visit 建 leg

**`locations`（不变）**

起点与目的地共用同一张表。

### 2. API 类型

**`Visit`（扩展）**

```typescript
interface Visit {
  id: number;
  location: Location;           // 目的地
  origin: Location;             // 起点
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  inboundTransport: string | null;  // 时序连线；首站 null
  inboundNote: string | null;
  arrivedAt: string;
  departedAt: string | null;
  // ...existing emotional fields
  sequence: number;
}
```

**`VisitRoute`（新增，合成）**

```typescript
interface VisitRoute {
  visitId: number;
  kind: 'outbound' | 'return';
  from: Location;
  to: Location;
  transport: string;
  note: string;
}
```

**`Atlas`（扩展）**

```typescript
interface Atlas {
  visits: Visit[];
  legs: Leg[];              // 时序连线（保留）
  visitRoutes: VisitRoute[]; // 去程/回程（新增）
  years: number[];
  yearColors: Record<string, string>;
  stats: AtlasStats;
}
```

**`VisitPayload`（调整）**

```typescript
interface VisitPayload {
  // 目的地
  locationName: string;
  country: string;
  lat: number | string;
  lng: number | string;
  arrivedAt: string;
  departedAt?: string;
  // 起点
  originName: string;
  originCountry: string;
  originLat: number | string;
  originLng: number | string;
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  inboundTransport?: string;   // 时序连线；首站可省略
  inboundNote?: string;
  // 情感字段（不变）
  feeling?: string;
  food?: string;
  rating?: number | string;
  mood?: string;
  weather?: string;
  memory?: string;
  tags?: string;
}
```

### 3. 服务端逻辑

**`buildVisitRoutes(visits)`**

对每个 visit 合成：

1. **去程**：`origin` → `location`，`outboundTransport` / `outboundNote`
2. **回程**（仅 `returnsToOrigin === true`）：`location` → `origin`，`returnTransport ?? outboundTransport` / `returnNote`

**`getAtlas()`**

返回 `visits`、`legs`、`visitRoutes`、`years`、`yearColors`、`stats`。

**`createVisit` / `updateVisit`**

1. upsert 目的地 location
2. upsert 起点 location
3. 写入 visit 新字段
4. 调用 `rebuildSequencesAndLegs()` 维护时序连线
5. 返回完整 atlas

**`getOriginSuggestions()`**（可选独立端点，或 atlas 附带）

```sql
SELECT DISTINCT l.* FROM locations l
JOIN visits v ON v.origin_location_id = l.id
ORDER BY l.name
```

**校验**

- `origin` 与 `destination` 坐标不能完全相同（名称可不同但坐标相同视为同一地点，拒绝提交）。
- `origin_location_id`、`location_id` 必填。

### 4. 双轨路线模型

```
层 1 — 单次出发（每条 visit）:
  起点 ──去程──► 目的地 ──回程──► 起点   （默认）
  起点 ──去程──► 目的地                   （未返回起点）

层 2 — 时序连线（visit 之间）:
  Visit₁.目的地 ──leg──► Visit₂.目的地 ──leg──► Visit₃.目的地
```

两层路线**互不替代**，同时渲染，样式区分。

## UI 设计

### VisitForm（三段式）

**出发段**

- 常用起点建议 chips（历史 origin 去重）
- 起点 `LocationPicker` + 名称/国家/坐标（必填）
- 去程方式 + 去程备注

**目的段**

- 目的地 `LocationPicker` + 名称/国家/坐标（必填）
- 到达/离开时间、评分
- **站间移动**（仅非全局首站时显示）：时序连线交通 + 备注（`inbound_*`，对应上一站目的地 → 本站）
- 感受、饮食、心境、天气、记忆、标签（不变）

**返回段**

- 复选框「返回起点」（默认勾选）
- 勾选时：折叠「返程方式」（默认标注「同去程」）+ 返程备注
- 取消勾选：隐藏返程字段

### TripPanel（详情）

新增：

- `从 {origin.name} 出发`
- 去程：{transportLabel(outboundTransport)}
- 返程：{transportLabel(returnTransport)} 或「未返回起点」徽章
- 站间：{transportLabel(inboundTransport)}（非首站时）

### TravelCanvas（地图）

**节点**

| 类型 | 样式 |
| --- | --- |
| 目的地 | 现有 visit 节点（评分光晕、日期/地名标签） |
| 起点 | 小空心圆 + 地名；同坐标合并为一个 pin |

**路线**

| 类型 | 样式 |
| --- | --- |
| 去程 | 细实线，~30% 透明度，按 visit 年份着色 |
| 回程 | 细虚线，~20% 透明度 |
| 时序连线 | 现有主路线（粗实线、箭头、年份色） |

**年份筛选**

- `visitRoutes`：仅包含可见 visit 的路线
- `legs`：两端 visit 都在该年（与现逻辑一致）

### 其他视图

| 视图 | 影响 |
| --- | --- |
| TimelineStrip | 无改动（仍按目的地排列） |
| MovieOverlay | 主路径仍沿时序 `legs`，不纳入去程/回程 |
| StatsView | 无改动 |
| PosterPreview | 无改动 |

## 种子数据

每条 seed visit 补 `origin`：

| Visit | 起点 | 目的地 | 返回 |
| --- | --- | --- | --- |
| 1 | 杭州 | 上海 | 是 |
| 2 | 上海 | 京都 | 是 |
| 3 | 京都 | 首尔 | 是 |
| … | 上一站或基地 | 下一站 | 按叙事 |

时序 `legs` 的 `transport` / `note` 保留为站间移动描述（与 visit 去程字段可不同，表示全局链上的衔接）。

## 边界情况

| 情况 | 处理 |
| --- | --- |
| 起点坐标 = 目的地坐标 | 表单 + 服务端校验拒绝 |
| `return_transport` 为空 | 展示/渲染时 fallback 到 `outbound_transport` |
| 删除被引用的 location | `ON DELETE RESTRICT`（与现逻辑一致） |
| 同一起点多次使用 | 地图上一个 pin，多条去程线出发 |
| 编辑 visit 改起点 | 重新 upsert location，旧 location 若无引用可被清理（非本阶段） |

## 测试要点

1. **db**：create/update visit 写入 origin；`buildVisitRoutes` 合成正确；`returns_to_origin = false` 无回程 route。
2. **API**：`GET /api/atlas` 返回 `visitRoutes`；payload 校验拒绝同坐标起终点。
3. **UI**：表单三段布局；取消「返回起点」隐藏返程；起点建议 chips 可点击。
4. **地图**：起点 pin 渲染；去程/回程/时序三线样式可区分。
5. **seed**：删库重启后数据完整，地图可见双轨路线。

## 实现范围（文件）

| 区域 | 文件 |
| --- | --- |
| Schema / CRUD | `server/db.ts` |
| API 类型 | `server/types.ts` |
| 前端类型 | `client/lib/types.ts` |
| 表单 | `client/components/VisitForm.svelte` |
| 详情 | `client/components/TripPanel.svelte` |
| 地图 | `client/components/TravelCanvas.svelte` |
| 主应用 | `client/App.svelte`（年份筛选 visitRoutes） |
| 格式化 | `client/lib/format.ts` |
| 文档 | `README.md`、`HANDOFF.md` |

## 参考

- 前序讨论：用户确认 visit = 完整出发记录，且保留 visit 间时序连线。
- 相关 spec：`2026-07-08-remove-travel-lines-year-filter-design.md`（扁平 visits + 全局 legs 基础）。
