# Visit 出发起点与回程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每条 visit 记录完整出发（起点 → 目的地 → 可选回程），保留 visit 间时序连线，地图双轨渲染。

**Architecture:** `visits` 表新增 `origin_location_id`、`returns_to_origin`、`outbound_*`、`return_*`、`inbound_*`；`legs` 表不变（时序连线）；服务端合成 `visitRoutes`（去程/回程）并入 `getAtlas`；前端表单三段式录入，地图叠加起点 pin 与细线。

**Tech Stack:** Svelte 5 + Vite + Fastify + better-sqlite3 + TypeScript；验证用 `pnpm typecheck` + `node --import tsx --test`。

**Spec:** `docs/superpowers/specs/2026-07-10-visit-origin-departure-design.md`

---

## File structure

| 文件 | 职责 |
| --- | --- |
| `client/lib/types.ts` | `Visit` 扩展 origin/transport 字段；`VisitRoute`；`Atlas.visitRoutes`；`VisitPayload` 扩展 |
| `server/types.ts` | `VisitPayloadInput` / `ParsedVisitPayload` 新字段 |
| `server/visitRoutes.ts` | `buildVisitRoutes()` 纯函数（可测） |
| `server/visitRoutes.test.ts` | node:test 覆盖去程/回程合成 |
| `server/db.ts` | Schema 重建、seed、CRUD、`getAtlas`、`rebuildSequencesAndLegs` |
| `client/lib/map/plotOrigins.ts` | 从 visits 去重合成起点 pin 坐标 |
| `client/components/VisitForm.svelte` | 三段式表单（出发/目的/返回） |
| `client/components/TripPanel.svelte` | 展示 origin、去程/返程/站间 |
| `client/components/TravelCanvas.svelte` | 起点 pin + visitRoutes 细线层 |
| `client/App.svelte` | `visibleVisitRoutes` 年份筛选 |
| `client/lib/stats/compute.test.ts` | 更新 `makeVisit` 工厂 |
| `scripts/smoke-visit-origin.mjs` | Atlas API smoke |
| `README.md` / `HANDOFF.md` | 数据模型文档 |

---

### Task 1: 更新共享类型

**Files:**
- Modify: `client/lib/types.ts`
- Modify: `server/types.ts`

- [ ] **Step 1: 重写 `client/lib/types.ts` 中 Visit / Atlas / VisitPayload**

```typescript
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
  location: Location;
  origin: Location;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  inboundTransport: string | null;
  inboundNote: string | null;
}

export interface VisitRoute {
  visitId: number;
  kind: 'outbound' | 'return';
  from: Location;
  to: Location;
  transport: string;
  note: string;
}

export interface Atlas {
  visits: Visit[];
  legs: Leg[];
  visitRoutes: VisitRoute[];
  originSuggestions: Location[];
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
  originName: string;
  originCountry: string;
  originLat: number | string;
  originLng: number | string;
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  inboundTransport?: string;
  inboundNote?: string;
  feeling?: string;
  food?: string;
  rating?: number | string;
  mood?: string;
  weather?: string;
  memory?: string;
  tags?: string;
}
```

删除 `Visit` 上旧的 `transport` / `legNote` 字段。

- [ ] **Step 2: 更新 `server/types.ts`**

```typescript
export interface VisitPayloadInput {
  locationName?: string;
  country?: string;
  lat?: number | string;
  lng?: number | string;
  arrivedAt?: string;
  departedAt?: string;
  originName?: string;
  originCountry?: string;
  originLat?: number | string;
  originLng?: number | string;
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  inboundTransport?: string;
  inboundNote?: string;
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
  originName: string;
  originCountry: string;
  originLat: number;
  originLng: number;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  inboundTransport: string | null;
  inboundNote: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}
```

- [ ] **Step 3: 运行 typecheck（预期大量失败，记录基线）**

Run: `pnpm typecheck`
Expected: FAIL（Visit 旧字段引用处报错，后续 task 逐步修复）

- [ ] **Step 4: Commit**

```bash
git add client/lib/types.ts server/types.ts
git commit -m "♻️ Extend Visit types for origin and return trip fields"
```

---

### Task 2: buildVisitRoutes 纯函数 + 测试

**Files:**
- Create: `server/visitRoutes.ts`
- Create: `server/visitRoutes.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// server/visitRoutes.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVisitRoutes } from './visitRoutes.js';

const origin = { id: 1, name: '杭州', country: '中国', lat: 30.27, lng: 120.15, kind: 'city' };
const dest = { id: 2, name: '上海', country: '中国', lat: 31.23, lng: 121.47, kind: 'city' };

const baseVisit = {
  id: 10,
  outboundTransport: 'train',
  outboundNote: '高铁',
  returnTransport: null,
  returnNote: '',
  origin,
  location: dest
};

describe('buildVisitRoutes', () => {
  it('emits outbound and return when returnsToOrigin is true', () => {
    const routes = buildVisitRoutes([{ ...baseVisit, returnsToOrigin: true }]);
    assert.equal(routes.length, 2);
    assert.equal(routes[0].kind, 'outbound');
    assert.equal(routes[0].from.name, '杭州');
    assert.equal(routes[0].to.name, '上海');
    assert.equal(routes[1].kind, 'return');
    assert.equal(routes[1].transport, 'train');
  });

  it('emits only outbound when returnsToOrigin is false', () => {
    const routes = buildVisitRoutes([{ ...baseVisit, returnsToOrigin: false }]);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].kind, 'outbound');
  });

  it('falls back return transport to outbound', () => {
    const routes = buildVisitRoutes([
      { ...baseVisit, returnsToOrigin: true, returnTransport: 'flight' }
    ]);
    assert.equal(routes[1].transport, 'flight');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --import tsx --test server/visitRoutes.test.ts`
Expected: FAIL `Cannot find module './visitRoutes.js'`

- [ ] **Step 3: 实现 `server/visitRoutes.ts`**

```typescript
import type { Location, VisitRoute } from '../client/lib/types.js';

export interface VisitRouteSource {
  id: number;
  returnsToOrigin: boolean;
  outboundTransport: string;
  outboundNote: string;
  returnTransport: string | null;
  returnNote: string;
  origin: Location;
  location: Location;
}

export function buildVisitRoutes(visits: VisitRouteSource[]): VisitRoute[] {
  const routes: VisitRoute[] = [];

  for (const visit of visits) {
    routes.push({
      visitId: visit.id,
      kind: 'outbound',
      from: visit.origin,
      to: visit.location,
      transport: visit.outboundTransport,
      note: visit.outboundNote
    });

    if (visit.returnsToOrigin) {
      routes.push({
        visitId: visit.id,
        kind: 'return',
        from: visit.location,
        to: visit.origin,
        transport: visit.returnTransport ?? visit.outboundTransport,
        note: visit.returnNote
      });
    }
  }

  return routes;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --import tsx --test server/visitRoutes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/visitRoutes.ts server/visitRoutes.test.ts
git commit -m "✅ Add buildVisitRoutes with node:test coverage"
```

---

### Task 3: Schema 重建与种子数据

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 删除旧数据库**

```bash
rm -f data/spacetime-travel.sqlite data/spacetime-travel.sqlite-wal data/spacetime-travel.sqlite-shm
```

- [ ] **Step 2: 更新 `visits` CREATE TABLE（`server/db.ts` 内 `db.exec` 块）**

将 `visits` 表替换为：

```sql
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL,
  origin_location_id INTEGER NOT NULL,
  returns_to_origin INTEGER NOT NULL DEFAULT 1,
  outbound_transport TEXT NOT NULL DEFAULT 'flight',
  outbound_note TEXT DEFAULT '',
  return_transport TEXT,
  return_note TEXT DEFAULT '',
  inbound_transport TEXT,
  inbound_note TEXT DEFAULT '',
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
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  FOREIGN KEY (origin_location_id) REFERENCES locations(id) ON DELETE RESTRICT
);
```

`legs` 表保持不变。

- [ ] **Step 3: 扩展 `SeedVisit` 接口与种子数据**

```typescript
interface SeedVisit {
  location: [string, string, number, number];
  origin: [string, string, number, number];
  returnsToOrigin?: boolean;
  outboundTransport?: string;
  outboundNote?: string;
  returnTransport?: string;
  returnNote?: string;
  transport?: string;       // inbound，时序连线
  legNote?: string;
  arrivedAt: string;
  departedAt: string;
  feeling: string;
  food: string;
  rating: number;
  mood: string;
  weather: string;
  memory: string;
  tags: string;
}
```

首条种子示例：

```typescript
{
  origin: ['杭州', '中国', 30.2741, 120.1551],
  location: ['上海', '中国', 31.2304, 121.4737],
  arrivedAt: '2019-03-28',
  departedAt: '2019-03-30',
  outboundTransport: 'train',
  outboundNote: '从杭州东站出发，第一次把家留在身后。',
  returnsToOrigin: true,
  feeling: '从熟悉的江边出发...',
  // ...其余字段保留
}
```

第二条起示例：

```typescript
{
  origin: ['上海', '中国', 31.2304, 121.4737],
  location: ['京都', '日本', 35.0116, 135.7681],
  transport: 'flight',          // inbound 时序连线
  legNote: '清晨航班落地大阪...',
  outboundTransport: 'flight',
  outboundNote: '从上海浦东出发。',
  returnsToOrigin: true,
  // ...
}
```

为全部 9 条种子补 `origin`；其中 1 条设 `returnsToOrigin: false` 用于视觉验证（如里斯本一站未返）。

- [ ] **Step 4: 更新 `seedDatabase()` 插入逻辑**

对每个 seed visit：
1. `insertLocation` 目的地
2. `insertLocation` 起点
3. `insertVisit` 写入新字段（`origin_location_id`, `returns_to_origin`, `outbound_*`, `return_*`, `inbound_transport`, `inbound_note`）

- [ ] **Step 5: 验证 seed 启动**

Run: `tsx -e "import { getAtlas } from './server/db.ts'; const a = getAtlas(); console.log(a.visits.length, a.visits[0].origin.name)"`
Expected: `9 杭州`（或实际种子条数）

- [ ] **Step 6: Commit**

```bash
git add server/db.ts
git commit -m "✨ Rebuild visits schema with origin and return fields"
```

---

### Task 4: Payload 解析、校验与 CRUD

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 更新 `readVisitPayload`**

在现有纬度/经度校验后，增加起点坐标解析：

```typescript
function readCoords(
  payload: VisitPayloadInput,
  prefix: '' | 'origin'
): { lat: number; lng: number; name: string; country: string } {
  const latKey = prefix ? 'originLat' : 'lat';
  const lngKey = prefix ? 'originLng' : 'lng';
  const nameKey = prefix ? 'originName' : 'locationName';
  const countryKey = prefix ? 'originCountry' : 'country';
  const lat = cleanNumber(payload[latKey]);
  const lng = cleanNumber(payload[lngKey]);
  if (lat === null || lat < -90 || lat > 90) throw httpError(400, '纬度需要在 -90 到 90 之间');
  if (lng === null || lng < -180 || lng > 180) throw httpError(400, '经度需要在 -180 到 180 之间');
  return {
    lat,
    lng,
    name: requireText(payload, nameKey, prefix ? '起点' : '地点'),
    country: requireText(payload, countryKey, prefix ? '起点国家/地区' : '国家/地区')
  };
}
```

在 `readVisitPayload` 返回对象中加入：

```typescript
const destination = readCoords(payload, '');
const origin = readCoords(payload, 'origin');

if (destination.lat === origin.lat && destination.lng === origin.lng) {
  throw httpError(400, '起点与目的地不能相同');
}

const returnsToOrigin = payload.returnsToOrigin !== false;
// returnTransport: empty string → null
const returnTransport = returnsToOrigin
  ? cleanString(payload.returnTransport) || null
  : null;

return {
  ...destination,
  locationName: destination.name,
  originName: origin.name,
  originCountry: origin.country,
  originLat: origin.lat,
  originLng: origin.lng,
  returnsToOrigin,
  outboundTransport: cleanString(payload.outboundTransport, 'flight'),
  outboundNote: cleanString(payload.outboundNote),
  returnNote: cleanString(payload.returnNote),
  returnTransport,
  inboundTransport: cleanString(payload.inboundTransport) || null,
  inboundNote: cleanString(payload.inboundNote),
  // ...情感字段
};
```

- [ ] **Step 2: 更新 `insertVisit` prepared statement**

```sql
INSERT INTO visits (
  location_id, origin_location_id, returns_to_origin,
  outbound_transport, outbound_note, return_transport, return_note,
  inbound_transport, inbound_note,
  arrived_at, departed_at, feeling, food, rating, mood, weather, memory, tags, sequence
) VALUES (
  @locationId, @originLocationId, @returnsToOrigin,
  @outboundTransport, @outboundNote, @returnTransport, @returnNote,
  @inboundTransport, @inboundNote,
  @arrivedAt, @departedAt, @feeling, @food, @rating, @mood, @weather, @memory, @tags, @sequence
)
```

- [ ] **Step 3: 更新 `createVisit`**

```typescript
export const createVisit = db.transaction((rawPayload: VisitPayloadInput) => {
  const payload = readVisitPayload(rawPayload);

  const locationId = Number(insertLocation.run({ name: payload.locationName, country: payload.country, lat: payload.lat, lng: payload.lng, kind: 'city' }).lastInsertRowid);
  const originLocationId = Number(insertLocation.run({ name: payload.originName, country: payload.originCountry, lat: payload.originLat, lng: payload.originLng, kind: 'city' }).lastInsertRowid);

  const visitId = Number(insertVisit.run({
    locationId,
    originLocationId,
    returnsToOrigin: payload.returnsToOrigin ? 1 : 0,
    outboundTransport: payload.outboundTransport,
    outboundNote: payload.outboundNote,
    returnTransport: payload.returnTransport,
    returnNote: payload.returnNote,
    inboundTransport: payload.inboundTransport,
    inboundNote: payload.inboundNote,
    arrivedAt: payload.arrivedAt,
    departedAt: payload.departedAt,
    feeling: payload.feeling,
    food: payload.food,
    rating: payload.rating,
    mood: payload.mood,
    weather: payload.weather,
    memory: payload.memory,
    tags: payload.tags,
    sequence: 0
  }).lastInsertRowid);

  rebuildSequencesAndLegs({
    focusVisitId: visitId,
    focusInboundTransport: payload.inboundTransport || 'flight',
    focusInboundNote: payload.inboundNote || ''
  });

  return { visitId };
});
```

- [ ] **Step 4: 更新 `updateVisit`**

类似 createVisit：upsert 目的地 location（UPDATE）、upsert 起点 location（UPDATE 或新 insert——简单做法：始终 UPDATE `current.origin_location_id` 指向的 location 行）、UPDATE visits 全部新字段、`rebuildSequencesAndLegs` 传 `inbound_*`。

- [ ] **Step 5: 重写 `rebuildSequencesAndLegs`**

删除 `snapshotLegMetaByToVisitId`；改为从 `visits` 表读 `inbound_transport` / `inbound_note`：

```typescript
function rebuildSequencesAndLegs(options?: {
  focusVisitId?: number;
  focusInboundTransport?: string;
  focusInboundNote?: string;
}) {
  const ordered = db.prepare('SELECT id FROM visits ORDER BY arrived_at ASC, id ASC').all() as { id: number }[];
  ordered.forEach((row, index) => {
    db.prepare('UPDATE visits SET sequence = ? WHERE id = ?').run(index + 1, row.id);
  });

  db.prepare('DELETE FROM legs').run();

  for (let i = 1; i < ordered.length; i += 1) {
    const fromId = ordered[i - 1].id;
    const toId = ordered[i].id;
    const row = db.prepare('SELECT inbound_transport, inbound_note FROM visits WHERE id = ?').get(toId) as {
      inbound_transport: string | null;
      inbound_note: string | null;
    };

    let transport = row.inbound_transport || 'flight';
    let note = row.inbound_note || '';

    if (options?.focusVisitId === toId) {
      transport = options.focusInboundTransport || 'flight';
      note = options.focusInboundNote || '';
      db.prepare('UPDATE visits SET inbound_transport = ?, inbound_note = ? WHERE id = ?').run(transport, note, toId);
    }

    insertLeg.run({ fromVisitId: fromId, toVisitId: toId, transport, durationHours: null, distanceKm: null, note, sequence: i });
  }
}
```

- [ ] **Step 6: 手动 smoke createVisit**

Run:
```bash
tsx -e "
import { createVisit, getAtlas } from './server/db.ts';
createVisit({
  originName:'家', originCountry:'中国', originLat:30.27, originLng:120.15,
  locationName:'东京', country:'日本', lat:35.68, lng:139.69,
  arrivedAt:'2025-01-01', outboundTransport:'flight', returnsToOrigin:false
});
const v = getAtlas().visits.at(-1);
console.log(v?.origin.name, v?.returnsToOrigin);
"
```
Expected: `家 false`

- [ ] **Step 7: Commit**

```bash
git add server/db.ts
git commit -m "✨ Wire visit CRUD for origin, return, and inbound fields"
```

---

### Task 5: getAtlas 合成 visitRoutes 与 originSuggestions

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 更新 SQL 查询 JOIN origin location**

替换 `allVisitRows`：

```sql
SELECT
  visits.*,
  dest.name AS location_name,
  dest.country,
  dest.lat,
  dest.lng,
  dest.kind,
  orig.id AS origin_id,
  orig.name AS origin_name,
  orig.country AS origin_country,
  orig.lat AS origin_lat,
  orig.lng AS origin_lng,
  orig.kind AS origin_kind
FROM visits
JOIN locations dest ON dest.id = visits.location_id
JOIN locations orig ON orig.id = visits.origin_location_id
ORDER BY visits.sequence ASC, visits.arrived_at ASC, visits.id ASC
```

- [ ] **Step 2: 重写 `normalizeVisit`**

```typescript
function normalizeVisit(row: VisitRow) {
  return {
    id: row.id,
    arrivedAt: row.arrived_at,
    departedAt: row.departed_at,
    feeling: row.feeling,
    food: row.food,
    rating: row.rating,
    mood: row.mood,
    weather: row.weather,
    memory: row.memory,
    tags: row.tags,
    sequence: row.sequence,
    returnsToOrigin: Boolean(row.returns_to_origin),
    outboundTransport: row.outbound_transport,
    outboundNote: row.outbound_note,
    returnTransport: row.return_transport,
    returnNote: row.return_note,
    inboundTransport: row.inbound_transport,
    inboundNote: row.inbound_note,
    location: {
      id: row.location_id,
      name: row.location_name,
      country: row.country,
      lat: row.lat,
      lng: row.lng,
      kind: row.kind
    },
    origin: {
      id: row.origin_id,
      name: row.origin_name,
      country: row.origin_country,
      lat: row.origin_lat,
      lng: row.origin_lng,
      kind: row.origin_kind
    }
  };
}
```

- [ ] **Step 3: 更新 `getAtlas`**

```typescript
import { buildVisitRoutes } from './visitRoutes.js';

const originSuggestions = db.prepare(`
  SELECT DISTINCT l.id, l.name, l.country, l.lat, l.lng, l.kind
  FROM locations l
  JOIN visits v ON v.origin_location_id = l.id
  ORDER BY l.name ASC
`).all();

export function getAtlas() {
  const visits = (allVisitRows.all() as VisitRow[]).map(normalizeVisit);
  const legs = (allLegRows.all() as LegRow[]).map(normalizeLeg);
  const visitRoutes = buildVisitRoutes(visits);
  // ...years/stats 不变
  return { visits, legs, visitRoutes, originSuggestions, years: yearSet, yearColors: buildYearColors(yearSet), stats: { ... } };
}
```

- [ ] **Step 4: 验证 atlas 输出**

Run: `tsx -e "import { getAtlas } from './server/db.ts'; const a=getAtlas(); console.log(a.visitRoutes.length, a.originSuggestions.length)"`
Expected: visitRoutes 数 ≥ visits 数（每条至少 1 条去程）

- [ ] **Step 5: Commit**

```bash
git add server/db.ts
git commit -m "✨ Add visitRoutes and originSuggestions to atlas response"
```

---

### Task 6: VisitForm 三段式表单

**Files:**
- Modify: `client/components/VisitForm.svelte`

- [ ] **Step 1: 扩展 `buildValues()` 默认值**

```typescript
function buildValues(): VisitPayload {
  if (mode === 'edit' && visit) {
    return {
      locationName: visit.location.name,
      country: visit.location.country,
      lat: visit.location.lat,
      lng: visit.location.lng,
      originName: visit.origin.name,
      originCountry: visit.origin.country,
      originLat: visit.origin.lat,
      originLng: visit.origin.lng,
      returnsToOrigin: visit.returnsToOrigin,
      outboundTransport: visit.outboundTransport,
      outboundNote: visit.outboundNote,
      returnTransport: visit.returnTransport || '',
      returnNote: visit.returnNote,
      inboundTransport: visit.inboundTransport || 'flight',
      inboundNote: visit.inboundNote || '',
      arrivedAt: visit.arrivedAt,
      departedAt: visit.departedAt || '',
      // ...情感字段
    };
  }
  return {
    locationName: '', country: '', lat: '', lng: '',
    originName: '', originCountry: '', originLat: '', originLng: '',
    returnsToOrigin: true,
    outboundTransport: 'flight', outboundNote: '',
    returnTransport: '', returnNote: '',
    inboundTransport: 'flight', inboundNote: '',
    arrivedAt: new Date().toISOString().slice(0, 10),
    departedAt: '',
    // ...情感字段默认值
  };
}
```

- [ ] **Step 2: 添加 props `originSuggestions: Location[]` 与 `showInboundFields: boolean`**

`App.svelte` 传入：
- `originSuggestions={atlas.originSuggestions}`
- `showInboundFields={mode === 'edit' && visit ? visit.sequence > 1 : visits.length > 0}`（非全局首站时显示站间移动）

- [ ] **Step 3: 表单 markup — 出发段**

在「选择地点」之前插入：

```svelte
{#if originSuggestions.length}
  <div class="origin-chips">
    <span class="picker-label">常用起点</span>
    <div class="chip-row">
      {#each originSuggestions as suggestion (suggestion.id)}
        <button type="button" class="chip" on:click={() => fillOrigin(suggestion)}>
          {suggestion.name}
        </button>
      {/each}
    </div>
  </div>
{/if}

<div class="section-label">出发</div>
<div class="picker-block">
  <span class="picker-label">起点</span>
  <LocationPicker name={values.originName} country={values.originCountry} lat={values.originLat} lng={values.originLng} onPick={handleOriginPick} />
</div>
<!-- origin 名称/国家/坐标 fields -->
<div class="field-row">
  <label><span>去程方式</span><TransportSelect bind:value={values.outboundTransport} /></label>
  <label><span>去程备注</span><input class="field" bind:value={values.outboundNote} /></label>
</div>
```

目的地区块 label 改为 `<div class="section-label">目的地</div>`。

- [ ] **Step 4: 站间移动（条件渲染）**

```svelte
{#if showInboundFields}
  <div class="field-row">
    <label><span>站间移动</span><TransportSelect bind:value={values.inboundTransport} /></label>
    <label><span>站间备注</span><input class="field" bind:value={values.inboundNote} placeholder="上一站目的地到这里的路上" /></label>
  </div>
{/if}
```

- [ ] **Step 5: 返回段**

```svelte
<div class="section-label">返回</div>
<label class="checkbox-row">
  <input type="checkbox" bind:checked={values.returnsToOrigin} />
  <span>返回起点</span>
</label>
{#if values.returnsToOrigin}
  <details class="return-details">
    <summary>返程方式（默认同去程）</summary>
    <div class="field-row">
      <label><span>返程方式</span><TransportSelect bind:value={values.returnTransport} /></label>
      <label><span>返程备注</span><input class="field" bind:value={values.returnNote} /></label>
    </div>
  </details>
{/if}
```

- [ ] **Step 6: 客户端校验**

`submit()` 前：

```typescript
if (Number(values.lat) === Number(values.originLat) && Number(values.lng) === Number(values.originLng)) {
  error = '起点与目的地不能相同';
  return;
}
```

- [ ] **Step 7: Commit**

```bash
git add client/components/VisitForm.svelte client/App.svelte
git commit -m "✨ Redesign VisitForm with origin, return, and inbound sections"
```

---

### Task 7: TripPanel 详情展示

**Files:**
- Modify: `client/components/TripPanel.svelte`

- [ ] **Step 1: 更新 quick-facts**

替换原 `visit.transport` 行：

```svelte
<div>
  <MapPin size={16} />
  <span>从 {visit.origin.name} 出发</span>
</div>
<div>
  <Plane size={16} />
  <span>去程：{transportLabel(visit.outboundTransport)}</span>
</div>
{#if visit.returnsToOrigin}
  <div>
    <Plane size={16} />
    <span>返程：{transportLabel(visit.returnTransport ?? visit.outboundTransport)}</span>
  </div>
{:else}
  <span class="one-way-badge">未返回起点</span>
{/if}
{#if visit.inboundTransport}
  <div>
    <Plane size={16} />
    <span>站间：{transportLabel(visit.inboundTransport)}</span>
  </div>
{/if}
```

- [ ] **Step 2: 添加 `.one-way-badge` 样式**

```css
.one-way-badge {
  display: inline-flex;
  border-radius: 999px;
  background: rgba(196, 92, 38, 0.12);
  color: #9b4a1f;
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/components/TripPanel.svelte
git commit -m "🎨 Show origin and return info in TripPanel"
```

---

### Task 8: 地图双轨渲染

**Files:**
- Create: `client/lib/map/plotOrigins.ts`
- Modify: `client/components/TravelCanvas.svelte`
- Modify: `client/App.svelte`

- [ ] **Step 1: 实现 `plotOrigins.ts`**

```typescript
import { projection } from '$lib/geo';
import type { Location, Visit } from '$lib/types';

export interface PlottedOrigin {
  key: string;
  name: string;
  country: string;
  x: number;
  y: number;
}

export function plotOrigins(visits: Visit[]): PlottedOrigin[] {
  const map = new Map<string, PlottedOrigin>();
  for (const visit of visits) {
    const { origin } = visit;
    const key = `${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}`;
    if (map.has(key)) continue;
    const [x, y] = projection([origin.lng, origin.lat]) ?? [0, 0];
    map.set(key, { key, name: origin.name, country: origin.country, x, y });
  }
  return [...map.values()];
}
```

- [ ] **Step 2: `App.svelte` 添加筛选**

```typescript
$: visibleVisitRoutes =
  selectedYear === 'all'
    ? visitRoutes
    : visitRoutes.filter((route) => visibleVisitIds.has(route.visitId));
```

传参给 `TravelCanvas`：

```svelte
<TravelCanvas
  visitRoutes={visibleVisitRoutes}
  ...
/>
```

- [ ] **Step 3: `TravelCanvas.svelte` 新增 props 与渲染层**

```typescript
export let visitRoutes: VisitRoute[] = [];
$: plottedOrigins = plotOrigins(visits);
```

在 `trip-routes` **之前**插入去程/回程层（使其在主路线下方）：

```svelte
<g class="visit-routes">
  {#each visitRoutes as route (route.visitId + route.kind)}
    <path
      class={`visit-route visit-route-${route.kind} ${transportClass(route.transport)}`}
      d={buildLocationRoute(route, index)}
      stroke-dasharray={route.kind === 'return' ? '4 6' : transportDash(route.transport)}
      opacity={route.kind === 'return' ? 0.2 : 0.3}
    />
  {/each}
</g>
```

实现 `buildLocationRoute`：用 `projection` 将 `route.from` / `route.to` 转屏幕坐标，复用 `buildRouteGeometry` 或简化直线/贝塞尔。

在 visit 节点之后渲染起点 pin：

```svelte
{#each plottedOrigins as origin (origin.key)}
  <g class="origin-node" transform={`translate(${origin.x} ${origin.y})`}>
    <circle class="origin-ring" r="6" />
    <text class="origin-label" x="10" y="4">{origin.name}</text>
  </g>
{/each}
```

CSS：

```css
.visit-route { stroke-width: 1.4; fill: none; }
.visit-route-outbound { stroke: #2d7c89; }
.visit-route-return { stroke: #667a80; }
.origin-ring { fill: #f8fbf7; stroke: #2d7c89; stroke-width: 1.6; }
.origin-label { font-size: 11px; fill: #304751; font-weight: 700; }
```

- [ ] **Step 4: Commit**

```bash
git add client/lib/map/plotOrigins.ts client/components/TravelCanvas.svelte client/App.svelte
git commit -m "🎨 Render origin pins and outbound/return routes on map"
```

---

### Task 9: 修复测试与 typecheck

**Files:**
- Modify: `client/lib/stats/compute.test.ts`
- Modify: 所有仍引用 `visit.transport` / `visit.legNote` 的文件（`grep -r` 排查）

- [ ] **Step 1: 更新 `makeVisit` 工厂**

```typescript
function makeVisit(overrides: Partial<Visit> & Pick<Visit, 'id' | 'arrivedAt' | 'location'>): Visit {
  const origin = overrides.origin ?? {
    id: 99, name: '家', country: '中国', lat: 30.27, lng: 120.15, kind: 'city'
  };
  return {
    departedAt: null,
    feeling: '', food: '', rating: 4, mood: '', weather: '', memory: '', tags: '',
    sequence: overrides.id,
    origin,
    returnsToOrigin: true,
    outboundTransport: 'flight',
    outboundNote: '',
    returnTransport: null,
    returnNote: '',
    inboundTransport: null,
    inboundNote: null,
    ...overrides
  };
}
```

- [ ] **Step 2: 全局搜索并修复旧字段引用**

Run: `rg "visit\.transport|visit\.legNote|transport:|legNote:" client server --glob '!*.md'`
逐文件替换为 `outboundTransport` / `inboundTransport` 等新字段。

- [ ] **Step 3: 运行全部验证**

```bash
pnpm typecheck
node --import tsx --test server/visitRoutes.test.ts
node --import tsx --test client/lib/stats/compute.test.ts
```

Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "✅ Fix type errors and update tests for origin visit model"
```

---

### Task 10: Smoke 脚本与文档

**Files:**
- Create: `scripts/smoke-visit-origin.mjs`
- Modify: `README.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: 创建 smoke 脚本**

```javascript
// scripts/smoke-visit-origin.mjs
import { getAtlas, createVisit } from '../server/db.ts';

const atlas = getAtlas();
console.assert(atlas.visits.length > 0, 'seed visits missing');
console.assert(atlas.visits[0].origin?.name, 'origin missing on visit');
console.assert(atlas.visitRoutes.length >= atlas.visits.length, 'visitRoutes missing');

createVisit({
  originName: '家', originCountry: '中国', originLat: 30.27, originLng: 120.15,
  locationName: '曼谷', country: '泰国', lat: 13.75, lng: 100.52,
  arrivedAt: '2025-06-01', outboundTransport: 'flight', returnsToOrigin: false,
  inboundTransport: 'flight', inboundNote: 'smoke'
});

const updated = getAtlas();
const last = updated.visits.at(-1);
console.assert(last?.returnsToOrigin === false, 'returnsToOrigin not saved');
console.assert(updated.visitRoutes.filter((r) => r.visitId === last.id).length === 1, 'one-way should have 1 route');
console.log('smoke ok');
```

- [ ] **Step 2: 运行 smoke**

Run: `node --import tsx scripts/smoke-visit-origin.mjs`
Expected: `smoke ok`

- [ ] **Step 3: 更新 README 数据模型段落**

说明 visit 含 origin、三种 transport 语义、`visitRoutes` 合成层。

- [ ] **Step 4: 更新 HANDOFF**

记录：起点功能已完成；删库重建说明；已知「站间移动仅非首站显示」。

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-visit-origin.mjs README.md HANDOFF.md
git commit -m "📝 Document visit origin model and add smoke script"
```

---

## Spec coverage checklist

| Spec 要求 | Task |
| --- | --- |
| 必填 origin | Task 3–4 |
| returnsToOrigin 默认 true | Task 3–4, 6 |
| 保留 legs 时序连线 | Task 4 |
| visitRoutes 合成 | Task 2, 5 |
| inbound_* 用于 legs | Task 4 |
| 起点/目的地坐标校验 | Task 4, 6 |
| 常用起点建议 | Task 5, 6 |
| 地图双轨样式 | Task 8 |
| 年份筛选 visitRoutes | Task 8 |
| TripPanel 展示 | Task 7 |
| 种子数据 | Task 3 |
| 电影模式不变 | 无改动（legs 仍驱动） |
| 删库重建 | Task 3 Step 1 |

## Self-review notes

- `buildVisitRoutes` 从 `server/visitRoutes.ts` 导出，避免 `db.ts` 难以单测。
- `rebuildSequencesAndLegs` 以 visit 行 `inbound_*` 为源，不再从 legs 快照回流。
- `showInboundFields` 在 create 模式且已有 visits 时也应显示（新 visit 将成为非首站）。
