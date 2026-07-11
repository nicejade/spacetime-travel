# Visit 写入校验加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加固 visit 写入校验：服务端拒绝非法日期 / 颠倒离站日 / 非法 transport / 非数字 id（400）；前端对称拦截；评分默认统一为 4.5。

**Architecture:** 抽出纯函数模块 `server/visitValidation.ts`（日期、transport、visitId）；`readVisitPayload` 与路由 `:id` 调用之；`VisitForm` 提交前做对称校验。无新依赖、无 schema 迁移。

**Tech Stack:** TypeScript、Fastify、`node:test` + `tsx`、Svelte 4 组件语法。

**Spec:** `docs/superpowers/specs/2026-07-11-visit-write-validation-design.md`

---

## File structure

| 文件 | 职责 |
| --- | --- |
| `server/visitValidation.ts` | 纯函数：`parseIsoDate`、`assertDateOrder`、`parseTransport`、`parseVisitId`、`TRANSPORTS` |
| `server/visitValidation.test.ts` | 上述纯函数单测 |
| `server/db.ts` | `readVisitPayload` 接入校验；`cleanRating` fallback → 4.5 |
| `server/index.ts` | PUT/DELETE 用 `parseVisitId` |
| `client/components/VisitForm.svelte` | 提交前校验 + 评分默认 4.5 |
| `HANDOFF.md` | P0-5 / P3-5 标完成 |

---

### Task 1: `parseIsoDate` + `assertDateOrder`（TDD）

**Files:**
- Create: `server/visitValidation.test.ts`
- Create: `server/visitValidation.ts`

- [ ] **Step 1: 写失败测试（日期与先后）**

创建 `server/visitValidation.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDateOrder,
  parseIsoDate,
  parseTransport,
  parseVisitId,
  TRANSPORTS
} from './visitValidation.js';
import type { HttpError } from './types.js';

function assertHttpError(fn: () => unknown, status: number, messageIncludes: string) {
  try {
    fn();
    assert.fail('expected throw');
  } catch (error) {
    const err = error as HttpError;
    assert.equal(err.status ?? err.statusCode, status);
    assert.ok(String(err.message).includes(messageIncludes), err.message);
  }
}

describe('parseIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    assert.equal(parseIsoDate('2024-01-15', '到达时间'), '2024-01-15');
  });

  it('rejects empty', () => {
    assertHttpError(() => parseIsoDate('', '到达时间'), 400, '到达时间');
  });

  it('rejects slash format', () => {
    assertHttpError(() => parseIsoDate('2024/01/15', '到达时间'), 400, 'YYYY-MM-DD');
  });

  it('rejects impossible calendar date', () => {
    assertHttpError(() => parseIsoDate('2024-13-01', '到达时间'), 400, 'YYYY-MM-DD');
    assertHttpError(() => parseIsoDate('2024-02-30', '离开时间'), 400, 'YYYY-MM-DD');
  });
});

describe('assertDateOrder', () => {
  it('allows null departedAt', () => {
    assertDateOrder('2024-01-10', null);
  });

  it('allows same-day departure', () => {
    assertDateOrder('2024-01-10', '2024-01-10');
  });

  it('allows later departure', () => {
    assertDateOrder('2024-01-10', '2024-01-12');
  });

  it('rejects earlier departure', () => {
    assertHttpError(() => assertDateOrder('2024-01-10', '2024-01-09'), 400, '离开时间不能早于到达时间');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --import tsx --test server/visitValidation.test.ts`

Expected: FAIL — `Cannot find module './visitValidation.js'` 或类似。

- [ ] **Step 3: 实现日期校验**

Create `server/visitValidation.ts`:

```typescript
import type { HttpError } from './types.js';

export const TRANSPORTS = ['flight', 'train', 'ferry', 'drive', 'bus', 'walk'] as const;
export type Transport = (typeof TRANSPORTS)[number];

function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.statusCode = status;
  return error;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `${label}不能为空`);
  }
  const trimmed = value.trim();
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    throw httpError(400, `${label}格式无效，请使用 YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw httpError(400, `${label}格式无效，请使用 YYYY-MM-DD`);
  }
  return trimmed;
}

export function assertDateOrder(arrivedAt: string, departedAt: string | null): void {
  if (departedAt !== null && departedAt < arrivedAt) {
    throw httpError(400, '离开时间不能早于到达时间');
  }
}

export function isTransport(value: string): value is Transport {
  return (TRANSPORTS as readonly string[]).includes(value);
}

export function parseTransport(
  value: unknown,
  options: { label: string; fallback?: Transport; allowEmpty?: boolean }
): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (options.fallback !== undefined) return options.fallback;
    if (options.allowEmpty) return null;
    throw httpError(400, `${options.label}不能为空`);
  }
  if (!isTransport(raw)) {
    throw httpError(400, `${options.label}无效`);
  }
  return raw;
}

export function parseVisitId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw httpError(400, '访问 ID 无效');
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError(400, '访问 ID 无效');
  }
  return id;
}
```

Note: Step 3 可一次实现全部导出（后续 Task 的测试会立刻绿）；若严格按红绿循环，可先只实现 `parseIsoDate` / `assertDateOrder`，其余函数抛 `not implemented`。推荐一次实现完整模块，因 API 已在 spec 锁定。

- [ ] **Step 4: 跑测试确认日期部分通过**

Run: `node --import tsx --test server/visitValidation.test.ts`

Expected: `parseIsoDate` / `assertDateOrder` PASS（若尚无 transport/id 测试则全部 PASS）。

- [ ] **Step 5: Commit**

```bash
git add server/visitValidation.ts server/visitValidation.test.ts
git commit -m "$(cat <<'EOF'
✅ Add visit date validation helpers

EOF
)"
```

---

### Task 2: `parseTransport` + `parseVisitId` 测试补齐

**Files:**
- Modify: `server/visitValidation.test.ts`

- [ ] **Step 1: 追加 transport / id 测试**

Append to `server/visitValidation.test.ts`:

```typescript
describe('parseTransport', () => {
  it('accepts all whitelist values', () => {
    for (const t of TRANSPORTS) {
      assert.equal(parseTransport(t, { label: '去程交通方式', fallback: 'flight' }), t);
    }
  });

  it('uses fallback when empty', () => {
    assert.equal(parseTransport('', { label: '去程交通方式', fallback: 'flight' }), 'flight');
    assert.equal(parseTransport(undefined, { label: '去程交通方式', fallback: 'flight' }), 'flight');
  });

  it('allows empty when allowEmpty', () => {
    assert.equal(parseTransport('', { label: '返程交通方式', allowEmpty: true }), null);
    assert.equal(parseTransport('  ', { label: '站间交通方式', allowEmpty: true }), null);
  });

  it('rejects unknown transport', () => {
    assertHttpError(
      () => parseTransport('teleport', { label: '去程交通方式', fallback: 'flight' }),
      400,
      '去程交通方式无效'
    );
  });
});

describe('parseVisitId', () => {
  it('parses positive integer string', () => {
    assert.equal(parseVisitId('42'), 42);
  });

  it('rejects non-numeric', () => {
    assertHttpError(() => parseVisitId('abc'), 400, '访问 ID 无效');
  });

  it('rejects zero and negative', () => {
    assertHttpError(() => parseVisitId('0'), 400, '访问 ID 无效');
    assertHttpError(() => parseVisitId('-1'), 400, '访问 ID 无效');
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `node --import tsx --test server/visitValidation.test.ts`

Expected: 全部 PASS（实现已在 Task 1）。若有失败，按失败信息修 `visitValidation.ts`。

- [ ] **Step 3: Commit**

```bash
git add server/visitValidation.test.ts server/visitValidation.ts
git commit -m "$(cat <<'EOF'
✅ Cover transport and visitId validation

EOF
)"
```

---

### Task 3: 接入 `readVisitPayload`（`db.ts`）

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 增加 import**

在 `server/db.ts` 顶部加入：

```typescript
import {
  assertDateOrder,
  parseIsoDate,
  parseTransport
} from './visitValidation.js';
```

- [ ] **Step 2: 改 `cleanRating` fallback 为 4.5**

Find:

```typescript
function cleanRating(value: unknown): number {
  const rating = cleanNumber(value, 4) ?? 4;
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}
```

Replace with:

```typescript
function cleanRating(value: unknown): number {
  const rating = cleanNumber(value, 4.5) ?? 4.5;
  return Math.max(1, Math.min(5, Number(rating.toFixed(1))));
}
```

- [ ] **Step 3: 改 `readVisitPayload` 日期与 transport**

Replace the return-building section of `readVisitPayload` so that after `returnsToOrigin` is computed:

```typescript
  const returnsToOrigin = payload.returnsToOrigin !== false;
  const arrivedAt = parseIsoDate(payload.arrivedAt, '到达时间');
  const departedRaw = typeof payload.departedAt === 'string' ? payload.departedAt.trim() : '';
  const departedAt = departedRaw ? parseIsoDate(departedRaw, '离开时间') : null;
  assertDateOrder(arrivedAt, departedAt);

  const outboundTransport = parseTransport(payload.outboundTransport, {
    label: '去程交通方式',
    fallback: 'flight'
  }) as string;

  const returnTransport = returnsToOrigin
    ? parseTransport(payload.returnTransport, { label: '返程交通方式', allowEmpty: true })
    : null;

  const inboundTransport = parseTransport(payload.inboundTransport, {
    label: '站间交通方式',
    allowEmpty: true
  });

  return {
    locationName: destination.name,
    country: destination.country,
    lat: destination.lat,
    lng: destination.lng,
    arrivedAt,
    departedAt,
    originName: origin.name,
    originCountry: origin.country,
    originLat: origin.lat,
    originLng: origin.lng,
    returnsToOrigin,
    outboundTransport,
    outboundNote: cleanString(payload.outboundNote),
    returnNote: cleanString(payload.returnNote),
    returnTransport,
    inboundTransport,
    inboundNote: cleanString(payload.inboundNote),
    feeling: cleanString(payload.feeling),
    food: cleanString(payload.food),
    rating: cleanRating(payload.rating),
    mood: cleanString(payload.mood),
    weather: cleanString(payload.weather),
    memory: cleanString(payload.memory),
    tags: cleanString(payload.tags)
  };
```

Remove the old lines that used `requireText` for `arrivedAt`、`cleanString` for transports in this function（`requireText` 仍可被 `readCoords` 使用，勿删函数本身）。

- [ ] **Step 4: 跑现有服务端测试 + 校验测试**

Run:

```bash
node --import tsx --test server/visitValidation.test.ts server/visitRoutes.test.ts server/rebuildLegs.test.ts server/locations.test.ts server/haversine.test.ts server/legDistance.test.ts server/migrations.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add server/db.ts
git commit -m "$(cat <<'EOF'
✨ Validate visit dates and transports on write

EOF
)"
```

---

### Task 4: 路由 `:id` 解析（`index.ts`）

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: 接入 `parseVisitId`**

Update imports and handlers:

```typescript
import { createVisit, deleteVisit, getAtlas, updateVisit } from './db.js';
import type { HttpError } from './types.js';
import type { VisitPayloadInput } from './types.js';
import { parseVisitId } from './visitValidation.js';
```

```typescript
app.put<{ Params: { id: string } }>('/api/visits/:id', async (request) => {
  const visitId = parseVisitId(request.params.id);
  const result = updateVisit(visitId, request.body as VisitPayloadInput);
  return { ok: true, ...result, atlas: getAtlas() };
});

app.delete<{ Params: { id: string } }>('/api/visits/:id', async (request) => {
  const visitId = parseVisitId(request.params.id);
  const result = deleteVisit(visitId);
  return { ok: true, ...result, atlas: getAtlas() };
});
```

- [ ] **Step 2: 快速确认 typecheck**

Run: `pnpm typecheck`

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "$(cat <<'EOF'
🐛 Return 400 for non-numeric visit ids

EOF
)"
```

---

### Task 5: 前端 `VisitForm` 对称校验 + 默认评分

**Files:**
- Modify: `client/components/VisitForm.svelte`

- [ ] **Step 1: 统一 edit 缺省评分为 4.5**

In `buildValues()` edit branch, change:

```typescript
        rating: visit.rating || 4,
```

to:

```typescript
        rating: visit.rating || 4.5,
```

Create branch already uses `4.5` — leave as is.

- [ ] **Step 2: 在 `submit()` 增加客户端校验**

Add helpers near `submit`（组件内即可，勿新建 shared 包）:

```typescript
  const TRANSPORT_SET = new Set(['flight', 'train', 'ferry', 'drive', 'bus', 'walk']);
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function isValidIsoDate(value: string): boolean {
    if (!ISO_DATE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function validateBeforeSubmit(): string | null {
    if (!isValidIsoDate(String(values.arrivedAt || ''))) {
      return '到达时间格式无效，请使用 YYYY-MM-DD';
    }
    const departed = String(values.departedAt || '').trim();
    if (departed) {
      if (!isValidIsoDate(departed)) {
        return '离开时间格式无效，请使用 YYYY-MM-DD';
      }
      if (departed < String(values.arrivedAt)) {
        return '离开时间不能早于到达时间';
      }
    }
    const outbound = String(values.outboundTransport || '').trim();
    if (outbound && !TRANSPORT_SET.has(outbound)) {
      return '去程交通方式无效';
    }
    const inbound = String(values.inboundTransport || '').trim();
    if (inbound && !TRANSPORT_SET.has(inbound)) {
      return '站间交通方式无效';
    }
    const ret = String(values.returnTransport || '').trim();
    if (ret && !TRANSPORT_SET.has(ret)) {
      return '返程交通方式无效';
    }
    return null;
  }
```

Update `submit()`:

```typescript
  async function submit() {
    if (Number(values.lat) === Number(values.originLat) && Number(values.lng) === Number(values.originLng)) {
      error = '起点与目的地不能相同';
      return;
    }

    const validationError = validateBeforeSubmit();
    if (validationError) {
      error = validationError;
      return;
    }

    busy = true;
    error = '';

    try {
      const payload = { ...values };
      const result = mode === 'edit' && visit ? await updateVisit(visit.id, payload) : await createVisit(payload);
      onSaved(result);
    } catch (submitError) {
      error = submitError instanceof Error ? submitError.message : '保存失败';
    } finally {
      busy = false;
    }
  }
```

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`

Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add client/components/VisitForm.svelte
git commit -m "$(cat <<'EOF'
✨ Align VisitForm validation and rating default

EOF
)"
```

---

### Task 6: 更新 HANDOFF + 最终验证

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: 标记 P0-5 / P3-5 完成**

In `HANDOFF.md` P0-5 section, replace the problem/suggestion bullets with a completed status block similar to P0-4:

```markdown
### P0-5 · 写入校验加固

- **状态**：~~已完成（2026-07-11）~~
- **实现**：
  - `server/visitValidation.ts`：`parseIsoDate`、`assertDateOrder`、`parseTransport`、`parseVisitId`
  - `readVisitPayload` 校验日期格式 / 先后 / transport 白名单；`cleanRating` fallback `4.5`
  - `index.ts`：非数字 `:id` → 400
  - 测试：`server/visitValidation.test.ts`
```

In P3-5 section:

```markdown
### P3-5 · 表单校验补齐（前端）

- **状态**：~~已完成（2026-07-11，随 P0-5）~~
- **实现**：`VisitForm` 提交前日期/先后/transport 校验；create/edit 评分默认统一 `4.5`；`returnTransport` 仍可空（fallback 去程）。
```

In「建议实施顺序」table, strike item 5:

```markdown
| 5 | ~~写入校验~~ | ~~P0-5, P3-5~~ |
```

In「已修复 / 已完成」table, add a row:

```markdown
| 写入校验加固 | `visitValidation.ts`：日期 / transport / visitId；VisitForm 对称校验 |
```

In「实现备忘」测试列表, add:

```bash
  node --import tsx --test server/visitValidation.test.ts
```

- [ ] **Step 2: 最终验证**

Run:

```bash
node --import tsx --test server/visitValidation.test.ts
pnpm typecheck
```

Expected: 测试 PASS；typecheck 干净。

- [ ] **Step 3: Commit**

```bash
git add HANDOFF.md
git commit -m "$(cat <<'EOF'
📝 Mark P0-5 and P3-5 complete in HANDOFF

EOF
)"
```

---

## Spec coverage checklist

| Spec 要求 | Task |
| --- | --- |
| `YYYY-MM-DD` + 日历合法性 | Task 1 |
| `departedAt >= arrivedAt` / 可空 | Task 1, 3 |
| transport 白名单 | Task 2, 3 |
| `returnTransport` 可空 | Task 2, 3, 5 |
| `:id` → 400 | Task 2, 4 |
| `readVisitPayload` 接入 | Task 3 |
| 评分默认 4.5 | Task 3, 5 |
| VisitForm 对称校验 | Task 5 |
| HANDOFF 更新 | Task 6 |
| 无 zod / schema / CHECK | 全任务遵守 |
