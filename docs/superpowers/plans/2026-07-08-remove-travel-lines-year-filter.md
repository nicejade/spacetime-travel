# 移除旅行线 · 年份筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `trips` 旅行线概念，改为扁平 visits + 全局 legs，用「所有年份 / 各年」筛选，并按到达年份着色。

**Architecture:** SQLite 去掉 `trips`；`visits`/`legs` 全局 `sequence`；`getAtlas` 返回 `{ visits, legs, years, yearColors, stats }`；前端筛选 `selectedYear`，地图/时间轴用年份色。不迁移旧库——删 `data/*.sqlite*` 后 seed。

**Tech Stack:** Svelte 5 + Vite + Express + better-sqlite3 + TypeScript（已有 `pnpm typecheck`；无 Vitest，用临时 DB smoke 脚本 + typecheck 验证）。

**Spec:** `docs/superpowers/specs/2026-07-08-remove-travel-lines-year-filter-design.md`

---

## File structure

| 文件 | 职责 |
| --- | --- |
| `client/lib/types.ts` | 去掉 `Trip`；扁平 `Atlas`；载荷无 trip 字段 |
| `server/types.ts` | `VisitPayloadInput` / `ParsedVisitPayload` 去掉 trip 字段 |
| `client/lib/years.ts` | `visitYear`、`YEAR_PALETTE`、`yearColor`（前后端可共用逻辑；服务端内联同色表常量以免跨包 import） |
| `server/db.ts` | Schema / seed / getAtlas / create / update / delete + rebuildSequencesAndLegs |
| `server/index.ts` | 突变响应去掉 `tripId`（若有） |
| `client/App.svelte` | 年份筛选状态与数据投影 |
| `client/components/TravelCanvas.svelte` | `visits`+`legs`+`yearColors` |
| `client/components/TimelineStrip.svelte` | 扁平 visits + 年份色 |
| `client/components/TripPanel.svelte` | 年份 chip；stats 无 tripCount |
| `client/components/VisitForm.svelte` | 删除旅行线表单块 |
| `README.md` / `HANDOFF.md` | 数据模型与 P0 更新 |
| `scripts/smoke-year-atlas.mjs` | 可选临时 smoke（验证后可删，或保留） |

---

### Task 1: 更新共享类型

**Files:**
- Modify: `client/lib/types.ts`
- Modify: `server/types.ts`
- Create: `client/lib/years.ts`

- [ ] **Step 1: 重写 `client/lib/types.ts`**

将类型改为扁平模型（完整替换相关接口）：

```ts
export type Transport = 'flight' | 'train' | 'ferry' | 'drive' | 'bus' | 'walk';

export interface Location {
  id: number;
  name: string;
  country: string;
  lat: number;
  lng: number;
  kind: string;
}

export interface Visit {
  id: number;
  arrivedAt: string;
  departedAt: string | null;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
  sequence: number;
  transport: string | null;
  legNote: string | null;
  location: Location;
}

export interface Leg {
  id: number;
  fromVisitId: number;
  toVisitId: number;
  transport: string;
  durationHours: number | null;
  distanceKm: number | null;
  note: string;
  sequence: number;
}

export interface AtlasStats {
  visitCount: number;
  countryCount: number;
  averageRating: number;
  startYear: number | null;
  endYear: number | null;
}

export interface Atlas {
  visits: Visit[];
  legs: Leg[];
  years: number[];
  yearColors: Record<string, string>;
  stats: AtlasStats;
}

export interface VisitPayload {
  locationName: string;
  country: string;
  lat: number | string;
  lng: number | string;
  arrivedAt: string;
  departedAt?: string;
  transport?: string;
  legNote?: string;
  feeling?: string;
  food?: string;
  rating?: number | string;
  mood?: string;
  weather?: string;
  memory?: string;
  tags?: string;
}

export interface VisitMutationResult {
  ok: boolean;
  visitId: number;
  atlas: Atlas;
}

export interface ApiErrorBody {
  error?: string;
}
```

注意：删除整个 `Trip` 接口与所有 `tripId` / `tripCount`。

- [ ] **Step 2: 重写 `server/types.ts` 载荷**

```ts
export interface HttpError extends Error {
  status?: number;
}

export interface VisitPayloadInput {
  locationName?: string;
  country?: string;
  lat?: number | string;
  lng?: number | string;
  arrivedAt?: string;
  departedAt?: string;
  transport?: string;
  legNote?: string;
  feeling?: string;
  food?: string;
  rating?: number | string;
  mood?: string;
  weather?: string;
  memory?: string;
  tags?: string;
}

export interface ParsedVisitPayload {
  locationName: string;
  country: string;
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string | null;
  transport: string;
  legNote: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}
```

- [ ] **Step 3: 新增 `client/lib/years.ts`**

```ts
/** Stable year → color mapping shared by UI. Server uses the same palette constants. */
export const YEAR_PALETTE = [
  '#dd6f5c',
  '#2d7c89',
  '#6d8f58',
  '#5b6bb5',
  '#c45c26',
  '#8b5a7c',
  '#3d8b8b',
  '#a46c21'
] as const;

export const YEAR_PALETTE_EPOCH = 2018;

export function visitYear(arrivedAt: string): number {
  return Number(String(arrivedAt).slice(0, 4));
}

export function yearColor(year: number): string {
  const index = Math.abs(year - YEAR_PALETTE_EPOCH) % YEAR_PALETTE.length;
  return YEAR_PALETTE[index];
}

export function buildYearColors(years: number[]): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const year of years) {
    colors[String(year)] = yearColor(year);
  }
  return colors;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/lib/types.ts server/types.ts client/lib/years.ts
git commit -m "refactor: 扁平化 Atlas/Visit 类型并新增年份色工具"
```

---

### Task 2: 重写 `server/db.ts`（schema · seed · atlas · mutations）

**Files:**
- Modify: `server/db.ts`（整文件核心逻辑）
- Modify: `server/index.ts`（响应去掉 `tripId`）

**重要：** 现有进程可能已打开旧 sqlite。实现后必须删除 `data/spacetime-travel.sqlite*` 再启动 API。

- [ ] **Step 1: 替换 schema 块**

删除 `trips` 表定义。`visits` / `legs` 去掉 `trip_id`：

```sql
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  kind TEXT DEFAULT 'city',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL,
  arrived_at TEXT NOT NULL,
  departed_at TEXT,
  feeling TEXT DEFAULT '',
  food TEXT DEFAULT '',
  rating REAL NOT NULL DEFAULT 4,
  mood TEXT DEFAULT '',
  weather TEXT DEFAULT '',
  memory TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_visit_id INTEGER NOT NULL,
  to_visit_id INTEGER NOT NULL,
  transport TEXT NOT NULL DEFAULT 'flight',
  duration_hours REAL,
  distance_km REAL,
  note TEXT DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_visit_id) REFERENCES visits(id) ON DELETE CASCADE,
  FOREIGN KEY (to_visit_id) REFERENCES visits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visits_arrived_at ON visits(arrived_at);
CREATE INDEX IF NOT EXISTS idx_legs_sequence ON legs(sequence);
```

同步更新 TypeScript 行接口：去掉所有 `trip_id` / `TripRow`。

- [ ] **Step 2: 扁平 seed**

将 `seedTrips` 改为 `seedVisits` 数组（保留现有站点与情感字段，去掉 title/subtitle/color/notes 容器）。按 `arrivedAt` 排序后一次插入；相邻建 leg。Seed 条件：

```ts
if ((db.prepare('SELECT COUNT(*) AS count FROM visits').get() as { count: number }).count === 0) {
  seedDatabase();
}
```

`insertVisit` / `insertLeg` 去掉 `trip_id` 列。

- [ ] **Step 3: 实现年份色与 `rebuildSequencesAndLegs`**

在 `db.ts` 内联与 `client/lib/years.ts` **相同** 的 `YEAR_PALETTE` / `YEAR_PALETTE_EPOCH` / `yearColor` / `buildYearColors` / `visitYear`。

```ts
function snapshotLegMetaByToVisitId(): Map<number, { transport: string; note: string }> {
  const rows = db.prepare('SELECT to_visit_id, transport, note FROM legs').all() as {
    to_visit_id: number;
    transport: string;
    note: string;
  }[];
  return new Map(rows.map((row) => [row.to_visit_id, { transport: row.transport, note: row.note }]));
}

function rebuildSequencesAndLegs(options?: {
  focusVisitId?: number;
  focusTransport?: string;
  focusNote?: string;
}) {
  const ordered = db
    .prepare('SELECT id FROM visits ORDER BY arrived_at ASC, id ASC')
    .all() as { id: number }[];

  ordered.forEach((row, index) => {
    db.prepare('UPDATE visits SET sequence = ? WHERE id = ?').run(index + 1, row.id);
  });

  const meta = snapshotLegMetaByToVisitId();
  db.prepare('DELETE FROM legs').run();

  for (let i = 1; i < ordered.length; i += 1) {
    const fromId = ordered[i - 1].id;
    const toId = ordered[i].id;
    let transport = 'flight';
    let note = '';

    if (options?.focusVisitId === toId) {
      transport = options.focusTransport || 'flight';
      note = options.focusNote || '';
    } else if (meta.has(toId)) {
      const kept = meta.get(toId)!;
      transport = kept.transport;
      note = kept.note;
    }

    insertLeg.run({
      fromVisitId: fromId,
      toVisitId: toId,
      transport,
      durationHours: null,
      distanceKm: null,
      note,
      sequence: i
    });
  }
}
```

- [ ] **Step 4: 重写 `getAtlas`**

一次查询全部 visits（JOIN locations + LEFT JOIN inbound leg），一次查全部 legs；按 sequence 排序。

```ts
export function getAtlas() {
  const visits = (/* all visit rows */).map(normalizeVisit);
  const legs = (/* all leg rows */).map(normalizeLeg);
  const yearSet = [...new Set(visits.map((v) => visitYear(v.arrivedAt)).filter(Number.isFinite))].sort(
    (a, b) => b - a
  );
  const countries = new Set(visits.map((v) => v.location.country));
  const ratings = visits.map((v) => Number(v.rating)).filter(Number.isFinite);
  const yearNums = visits.map((v) => visitYear(v.arrivedAt)).filter(Number.isFinite);

  return {
    visits,
    legs,
    years: yearSet,
    yearColors: buildYearColors(yearSet),
    stats: {
      visitCount: visits.length,
      countryCount: countries.size,
      averageRating: ratings.length
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
        : 0,
      startYear: yearNums.length ? Math.min(...yearNums) : null,
      endYear: yearNums.length ? Math.max(...yearNums) : null
    }
  };
}
```

`normalizeVisit` 去掉 `tripId`。

- [ ] **Step 5: 重写 create / update / delete**

`readVisitPayload` 去掉 trip 字段。

`createVisit`：
1. parse payload → insert location → insert visit（临时 sequence=0）
2. `rebuildSequencesAndLegs({ focusVisitId: visitId, focusTransport: payload.transport, focusNote: payload.legNote })`
3. return `{ visitId }`（无 tripId）

`updateVisit`：
1. update location + visit 字段
2. 同上 rebuild，focus 当前 visitId + 表单 transport/note
3. return `{ visitId }`

`deleteVisit`：
1. snapshot 已在 rebuild 内；delete visit（legs CASCADE 或先删 legs）
2. `rebuildSequencesAndLegs()` 无 focus
3. return `{ visitId }`

删除 `updateTripDates`、`createTripForPayload`、`resequenceTrip`、`insertTrip`、`TripRow`、按 trip 查询的语句。

- [ ] **Step 6: 更新 `server/index.ts` 响应**

`createVisit` / `updateVisit` / `deleteVisit` 已回 `{ visitId }`；确认 JSON 为 `{ ok: true, visitId, atlas }`，无 `tripId`。

- [ ] **Step 7: 删旧库并 smoke**

```bash
rm -f data/spacetime-travel.sqlite data/spacetime-travel.sqlite-shm data/spacetime-travel.sqlite-wal
pnpm exec tsx -e "
import { getAtlas, createVisit, updateVisit, deleteVisit, db } from './server/db.ts';
const atlas = getAtlas();
console.log('visits', atlas.visits.length, 'legs', atlas.legs.length, 'years', atlas.years);
if (!atlas.years.includes(2019) || !atlas.years.includes(2024)) throw new Error('years missing');
if (atlas.stats.tripCount !== undefined) throw new Error('tripCount should be gone');
const created = createVisit({
  locationName: '测试城', country: '测试国', lat: 10, lng: 20,
  arrivedAt: '2023-06-01', transport: 'train', legNote: 'smoke', feeling: 'x', rating: 4
});
let a2 = getAtlas();
const v = a2.visits.find(x => x.id === created.visitId);
if (!v || v.sequence < 1) throw new Error('create failed');
updateVisit(created.visitId, {
  locationName: '测试城', country: '测试国', lat: 10, lng: 20,
  arrivedAt: '2018-01-01', transport: 'bus', rating: 4
});
a2 = getAtlas();
const early = a2.visits.find(x => x.id === created.visitId);
if (early?.sequence !== 1) throw new Error('reorder failed: ' + early?.sequence);
deleteVisit(created.visitId);
console.log('smoke ok', getAtlas().visits.length);
db.close();
"
```

Expected: 打印 seed 数量（约 12 visits）、years 含 2019/2022/2024，`smoke ok`。

- [ ] **Step 8: Commit**

```bash
git add server/db.ts server/index.ts
git commit -m "refactor: 移除 trips，改为全局 visits/legs 与年份 atlas"
```

---

### Task 3: 前端壳与筛选（App + Timeline + Panel）

**Files:**
- Modify: `client/App.svelte`
- Modify: `client/components/TimelineStrip.svelte`
- Modify: `client/components/TripPanel.svelte`

- [ ] **Step 1: 改 `App.svelte` 状态与派生数据**

- `selectedTripId` → `selectedYear: 'all' | number`，默认 `'all'`
- `trips = atlas?.trips` → `visits = atlas?.visits ?? []`，`legs = atlas?.legs ?? []`，`years = atlas?.years ?? []`，`yearColors = atlas?.yearColors ?? {}`
- `visibleVisits` / `visibleLegs`：`'all'` 时全量；否则按 `visitYear(arrivedAt)` 过滤 visits，legs 两端 id 均在可见 visit 集合内
- 筛选 UI：按钮「所有年份」+ `{#each years as year}`，`--trip-color` / class 改用 `yearColors[year]`（CSS 变量可改名 `--year-color`，或暂时复用 `--trip-color` 减少样式 diff）
- `handleSaved` / `loadAtlas` / `handleDelete` 使用 `atlas.visits`，去掉 trip 逻辑
- 传给 canvas：`visits={visibleVisits} legs={visibleLegs} yearColors={yearColors}`
- `TripPanel`：`visit`、`yearColor={selectedVisit ? yearColors[String(visitYear(selectedVisit.arrivedAt))] : null}`、`year={...}`、`visits`（用于国家云）、`stats`
- `VisitForm`：去掉 `trips`/`trip` props

辅助 import：`import { visitYear } from '$lib/years';`

- [ ] **Step 2: 改 `TimelineStrip.svelte`**

```svelte
export let visits: Visit[] = [];
export let yearColors: Record<string, string> = {};
```

按 `arrivedAt` 排序（父组件也可已排）。`style={`--trip-color: ${yearColors[String(visitYear(visit.arrivedAt))] || '#2d7c89'}`}`。

- [ ] **Step 3: 改 `TripPanel.svelte`**

- 去掉 `trip` / `trips` / `tripCount`
- props：`visit`、`year: number | null`、`yearColor: string`、`visits: Visit[]`、`stats`
- chip 显示 `{year}`，`--trip-color: yearColor`
- 空态：`stats.visitCount` 节点文案，去掉旅行线数；`countries` 从 `visits` 推导

- [ ] **Step 4: Commit**

```bash
git add client/App.svelte client/components/TimelineStrip.svelte client/components/TripPanel.svelte
git commit -m "feat: 侧栏改为年份筛选并更新详情/时间轴"
```

---

### Task 4: TravelCanvas + VisitForm

**Files:**
- Modify: `client/components/TravelCanvas.svelte`
- Modify: `client/components/VisitForm.svelte`

- [ ] **Step 1: `TravelCanvas` 改数据源**

Props：

```ts
export let visits: Visit[] = [];
export let legs: Leg[] = [];
export let yearColors: Record<string, string> = {};
```

- `plottedVisits`：对 `visits` 投影坐标，附加 `yearColor: yearColors[String(visitYear(visit.arrivedAt))]`
- 路线：用 `legs`；`getVisitPoint` 在 `plottedVisits` 找 id；每条 leg 的 `--trip-color` / stroke 用 **to visit** 的年份色（与 spec 一致）
- 删除 `plottedTrips` / trip 双重循环；节点循环直接 `{#each plottedVisits}`
- 播放逻辑已基于 flattened visits 排序则保持，改为用 `plottedVisits`

- [ ] **Step 2: `VisitForm` 去掉旅行线**

- 删除 `trips` / `trip` props 与 import `Trip`
- `buildValues` 不再含 `tripId` / `newTripTitle` / `newTripSubtitle` / `tripColor`
- 删除模板中「旅行线」整块（约原 119–149 行）
- `key` 改为 `` `${mode}:${visit?.id ?? 'new'}` ``

- [ ] **Step 3: Commit**

```bash
git add client/components/TravelCanvas.svelte client/components/VisitForm.svelte
git commit -m "feat: 地图按年份着色；表单去掉旅行线字段"
```

---

### Task 5: 文档 + typecheck + 手测清单

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: README**

- Features：Trip filters → Year filters
- Data model：删 `trips`；visits/legs 说明改为全局
- API：create visit 描述去掉「optionally a new trip」
- 增加 Notes：升级后需删除 `data/*.sqlite*` 重建

- [ ] **Step 2: HANDOFF**

- 已实现：旅行线筛选 → 年份筛选；去掉「顺带新建旅行线」
- P0 #2「旅行线管理」→ **取消**（概念移除）
- 已知问题表：「旅行线无编辑入口」→ 删除或注明「已废弃」
- 升级路线若仍提旅行线高亮，改为年份段落高亮或删掉

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

Expected: exit 0。若 Svelte 文件未被 tsc 覆盖，以 `pnpm build` 再验一轮。

- [ ] **Step 4: 本地手测**

```bash
rm -f data/spacetime-travel.sqlite*
pnpm dev
```

清单：

1. 打开 app → 默认「所有年份」，见多年彩色轨迹  
2. 点「2024」→ 仅 2024 节点与边  
3. 新增节点（无旅行线字段）→ 出现在对应年  
4. 编辑改日期跨年 → 筛选与颜色更新  
5. 删除节点 → 轨迹不断裂（相邻补边）

- [ ] **Step 5: Commit docs**

```bash
git add README.md HANDOFF.md docs/superpowers/plans/2026-07-08-remove-travel-lines-year-filter.md
git commit -m "docs: 同步 README/HANDOFF 到年份筛选模型"
```

---

## Spec coverage checklist

| Spec 项 | Task |
| --- | --- |
| 删除 trips / trip_id | Task 2 |
| 全局 sequence + rebuild legs | Task 2 |
| years / yearColors / 无 tripCount | Task 1–2 |
| 载荷无 trip 字段 | Task 1–2, 4 |
| 筛「所有年份」默认 + 单年 | Task 3 |
| 按年着色；跨年边 to-visit 色 | Task 2 palette + Task 4 |
| 严格按到达年 | Task 3 过滤 |
| 不迁移、删库 | Task 2 Step 7, Task 5 |
| VisitForm 去旅行线 | Task 4 |
| README / HANDOFF | Task 5 |
| 验证 create/update/delete/atlas | Task 2 smoke + Task 5 手测 |
