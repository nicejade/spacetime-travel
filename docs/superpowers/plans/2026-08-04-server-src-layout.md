# Server `src/` + `test/` Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `server/` into `server/src/` + `server/test/`, lightly classify root modules, keep compatibility barrels, and update build/runtime entry paths.

**Architecture:** Keep `tsc` `rootDir: "."` / `outDir: ./server/dist` so `shared/` still emits. Application code lives under `server/src/`; tests under flat `server/test/`; runtime artifacts stay at `server/{data,public,dist}/`. Production entry becomes `server/dist/server/src/index.js`.

**Tech Stack:** TypeScript (NodeNext ESM), Node `node:test` + `tsx`, Fastify, PM2, Docker

**Spec:** `docs/superpowers/specs/2026-08-04-server-src-layout-design.md`

## Global Constraints

- Do not change API behavior, SQLite schema, or migration semantics
- Keep compatibility barrels `db.ts` and `locations.ts` (moved under `src/`)
- Do not add `server/package.json` or project references
- Do not move `shared/`, `server/data/`, or `server/public/`
- Prefer `git mv` for renames
- Commit messages: English + gitmoji per `AGENTS.md`

## File structure (target)

| Path | Responsibility |
|------|----------------|
| `server/src/index.ts` | Process entry (`listen`) |
| `server/src/app.ts` | Fastify `buildApp` |
| `server/src/config.ts` | Port, `publicPath`, `dbPath` (repo-root aware) |
| `server/src/types.ts` | Shared server types |
| `server/src/db.ts` | Compat barrel for tests/scripts |
| `server/src/locations.ts` | Compat barrel → `models/location` |
| `server/src/lib/haversine.ts` | Distance helpers |
| `server/src/lib/httpError.ts` | HTTP error helper |
| `server/src/db/migrations.ts` | Schema bootstrap + migrate |
| `server/src/db/connection.ts` | SQLite connection |
| `server/src/db/seed.ts` | Seed empty DB |
| `server/src/services/exportImport.ts` | Export document parse/build |
| `server/src/services/rebuildLegs.ts` | Sequence + legs rebuild |
| `server/src/services/visitValidation.ts` | Visit field parsers |
| `server/src/services/visitRoutes.ts` | `buildVisitRoutes` |
| `server/test/*.test.ts` | All server unit tests |
| `package.json` / `tsconfig*.json` / PM2 / Docker | Entry + include paths |

---

### Task 1: Move application sources under `server/src/`

**Files:**
- Move: all current `server/**/*.ts` except `*.test.ts` → under `server/src/` (preserve relative layout)
- Modify: `server/src/models/atlas.ts` (`shared` import depth)
- Modify: `package.json` (`api` script)
- Modify: `tsconfig.json` include globs (partial; tests still old until Task 2)
- Modify: `tsconfig.server.json` include

**Interfaces:**
- Consumes: existing module graph
- Produces: sources at `server/src/**/*.ts`; `pnpm api` → `tsx watch server/src/index.ts`

- [ ] **Step 1: Create `server/src` and `git mv` non-test sources**

```bash
mkdir -p server/src
# Move directories
git mv server/controllers server/src/controllers
git mv server/db server/src/db
git mv server/lib server/src/lib
git mv server/middleware server/src/middleware
git mv server/models server/src/models
git mv server/routes server/src/routes
git mv server/services server/src/services
# Move root .ts files (exclude tests)
git mv server/app.ts server/src/app.ts
git mv server/config.ts server/src/config.ts
git mv server/db.ts server/src/db.ts
git mv server/exportImport.ts server/src/exportImport.ts
git mv server/haversine.ts server/src/haversine.ts
git mv server/index.ts server/src/index.ts
git mv server/locations.ts server/src/locations.ts
git mv server/migrations.ts server/src/migrations.ts
git mv server/rebuildLegs.ts server/src/rebuildLegs.ts
git mv server/types.ts server/src/types.ts
git mv server/visitRoutes.ts server/src/visitRoutes.ts
git mv server/visitValidation.ts server/src/visitValidation.ts
```

Leave `server/data/`, `server/public/`, `server/dist/`, and all `*.test.ts` in place for now.

- [ ] **Step 2: Fix `shared` import depth in atlas**

In `server/src/models/atlas.ts`, change:

```ts
import { buildYearColors, visitYear } from '../../shared/years.js';
```

to:

```ts
import { buildYearColors, visitYear } from '../../../shared/years.js';
```

(All other relative imports among moved files stay valid at this stage.)

- [ ] **Step 3: Point `api` + server compile includes at `src`**

In `package.json`:

```json
"api": "tsx watch server/src/index.ts"
```

In `tsconfig.json` `include`, replace `"server/**/*.ts"` with:

```json
"server/src/**/*.ts"
```

(Do not include tests yet — they still live at `server/*.test.ts` with broken relative imports until Task 2.)

In `tsconfig.server.json`:

```json
"include": ["server/src/**/*.ts", "shared/**/*.ts"],
"exclude": ["**/*.test.ts", "server/test/**"]
```

Note: `pnpm typecheck` will temporarily skip server tests until Task 2 adds `server/test/**/*.ts` to `include`.
- [ ] **Step 4: Verify server compile only**

Do **not** run full `pnpm typecheck` / `pnpm test` yet — co-located `server/*.test.ts` still import `./db.js` etc. and will fail until Task 2.

```bash
rm -rf server/dist
pnpm build:server
test -f server/dist/server/src/index.js
```

Expected: `build:server` exit 0; `server/dist/server/src/index.js` exists.

- [ ] **Step 5: Commit**

```bash
git add -A server package.json tsconfig.json tsconfig.server.json
git commit -m "$(cat <<'EOF'
♻️ Move server application sources under src/

EOF
)"
```

---

### Task 2: Move tests to `server/test/` and update test tooling

**Files:**
- Move: all `server/*.test.ts` → `server/test/`
- Modify: each test file’s imports to `../src/...`
- Modify: `package.json` `test` script
- Modify: `tsconfig.json` include (drop temporary `server/**/*.test.ts`)

**Interfaces:**
- Consumes: `server/src/**` modules (incl. barrels `db.ts`, `locations.ts`)
- Produces: `pnpm test` runs `server/test/**/*.test.ts`

- [ ] **Step 1: `git mv` tests**

```bash
mkdir -p server/test
git mv server/db.test.ts server/test/db.test.ts
git mv server/exportImport.test.ts server/test/exportImport.test.ts
git mv server/haversine.test.ts server/test/haversine.test.ts
git mv server/legDistance.test.ts server/test/legDistance.test.ts
git mv server/locations.test.ts server/test/locations.test.ts
git mv server/migrations.test.ts server/test/migrations.test.ts
git mv server/rebuildLegs.test.ts server/test/rebuildLegs.test.ts
git mv server/visitRoutes.test.ts server/test/visitRoutes.test.ts
git mv server/visitValidation.test.ts server/test/visitValidation.test.ts
```

- [ ] **Step 2: Rewrite test imports to `../src/...`**

Apply these replacements per file (`.js` suffix kept for ESM):

| File | Old import | New import |
|------|------------|------------|
| `db.test.ts` | `./types.js` | `../src/types.js` |
| `db.test.ts` | `./db.js` (dynamic) | `../src/db.js` |
| `exportImport.test.ts` | `./migrations.js` | `../src/migrations.js` |
| `exportImport.test.ts` | `./exportImport.js` | `../src/exportImport.js` |
| `haversine.test.ts` | `./haversine.js` | `../src/haversine.js` |
| `legDistance.test.ts` | `./haversine.js` | `../src/haversine.js` |
| `legDistance.test.ts` | `./locations.js` | `../src/locations.js` |
| `legDistance.test.ts` | `./migrations.js` | `../src/migrations.js` |
| `locations.test.ts` | `./locations.js` | `../src/locations.js` |
| `locations.test.ts` | `./migrations.js` | `../src/migrations.js` |
| `migrations.test.ts` | `./migrations.js` | `../src/migrations.js` |
| `rebuildLegs.test.ts` | `./locations.js` | `../src/locations.js` |
| `rebuildLegs.test.ts` | `./migrations.js` | `../src/migrations.js` |
| `rebuildLegs.test.ts` | `./rebuildLegs.js` | `../src/rebuildLegs.js` |
| `visitRoutes.test.ts` | `./visitRoutes.js` | `../src/visitRoutes.js` |
| `visitValidation.test.ts` | `./visitValidation.js` | `../src/visitValidation.js` |
| `visitValidation.test.ts` | `./types.js` | `../src/types.js` |

Example for `server/test/haversine.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { haversineKm } from '../src/haversine.js';
```

Example dynamic import in `server/test/db.test.ts`:

```ts
const { createVisit, db, deleteVisit, getAtlas, getExportDocument, importReplace, updateVisit } =
  await import('../src/db.js');
```

- [ ] **Step 3: Update `package.json` test script and `tsconfig.json`**

```json
"test": "node --import tsx --test \"server/test/**/*.test.ts\" \"client/**/*.test.ts\" \"shared/**/*.test.ts\""
```

In `tsconfig.json` `include`, use:

```json
"server/src/**/*.ts",
"server/test/**/*.ts"
```

(Remove any temporary `server/**/*.test.ts` entry.)

- [ ] **Step 4: Run tests**

Run: `pnpm test`

Expected: all server + client + shared tests PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add -A server/test server package.json tsconfig.json
git commit -m "$(cat <<'EOF'
♻️ Move server tests into test/ directory

EOF
)"
```

---

### Task 3: Classify root modules into `lib/` / `db/` / `services/`

**Files:**
- Move within `server/src/`:
  - `haversine.ts` → `lib/haversine.ts`
  - `migrations.ts` → `db/migrations.ts`
  - `exportImport.ts` → `services/exportImport.ts`
  - `rebuildLegs.ts` → `services/rebuildLegs.ts`
  - `visitValidation.ts` → `services/visitValidation.ts`
  - `visitRoutes.ts` → `services/visitRoutes.ts`
- Modify: all importers (src + test) for new paths
- Leave: `db.ts`, `locations.ts` at `server/src/` root as barrels

**Interfaces:**
- Produces: classified module paths per spec placement table
- Produces: barrels still at `server/src/db.ts` and `server/src/locations.ts`

- [ ] **Step 1: `git mv` classified modules**

```bash
git mv server/src/haversine.ts server/src/lib/haversine.ts
git mv server/src/migrations.ts server/src/db/migrations.ts
git mv server/src/exportImport.ts server/src/services/exportImport.ts
git mv server/src/rebuildLegs.ts server/src/services/rebuildLegs.ts
git mv server/src/visitValidation.ts server/src/services/visitValidation.ts
git mv server/src/visitRoutes.ts server/src/services/visitRoutes.ts
```

- [ ] **Step 2: Fix imports inside moved modules**

`server/src/lib/haversine.ts` — no internal server imports to fix (only `better-sqlite3` types).

`server/src/db/migrations.ts` — change:

```ts
} from './locations.js';
```

to:

```ts
} from '../locations.js';
```

`server/src/services/exportImport.ts` — change:

```ts
import { httpError } from './lib/httpError.js';
import { SCHEMA_VERSION } from './migrations.js';
import type { VisitPayloadInput } from './types.js';
```

to:

```ts
import { httpError } from '../lib/httpError.js';
import { SCHEMA_VERSION } from '../db/migrations.js';
import type { VisitPayloadInput } from '../types.js';
```

`server/src/services/rebuildLegs.ts` — change:

```ts
import { distanceBetweenKm } from './haversine.js';
```

to:

```ts
import { distanceBetweenKm } from '../lib/haversine.js';
```

`server/src/services/visitValidation.ts` — change:

```ts
import { httpError } from './lib/httpError.js';
```

to:

```ts
import { httpError } from '../lib/httpError.js';
```

`server/src/services/visitRoutes.ts` — change:

```ts
import type { Location, VisitRoute } from './types.js';
```

to:

```ts
import type { Location, VisitRoute } from '../types.js';
```

- [ ] **Step 3: Fix remaining `src/` importers**

| File | Old | New |
|------|-----|-----|
| `db/connection.ts` | `../migrations.js` | `./migrations.js` |
| `db/connection.ts` | `../rebuildLegs.js` | `../services/rebuildLegs.js` |
| `db/seed.ts` | `../rebuildLegs.js` | `../services/rebuildLegs.js` |
| `models/atlas.ts` | `../visitRoutes.js` | `../services/visitRoutes.js` |
| `services/visitPayload.ts` | `../visitValidation.js` | `./visitValidation.js` |
| `services/visitService.ts` | `../rebuildLegs.js` | `./rebuildLegs.js` |
| `services/exportImportService.ts` | `../exportImport.js` | `./exportImport.js` |
| `services/exportImportService.ts` | `../migrations.js` | `../db/migrations.js` |
| `services/exportImportService.ts` | `../rebuildLegs.js` | `./rebuildLegs.js` |
| `controllers/visitController.ts` | `../visitValidation.js` | `../services/visitValidation.js` |

`server/src/db.ts` and `server/src/locations.ts` relative targets (`./db/connection.js`, `./models/...`, `./services/...`) stay valid — no change.

- [ ] **Step 4: Fix test imports for classified paths**

| File | Old | New |
|------|-----|-----|
| `haversine.test.ts` | `../src/haversine.js` | `../src/lib/haversine.js` |
| `legDistance.test.ts` | `../src/haversine.js` | `../src/lib/haversine.js` |
| `legDistance.test.ts` | `../src/migrations.js` | `../src/db/migrations.js` |
| `exportImport.test.ts` | `../src/migrations.js` | `../src/db/migrations.js` |
| `exportImport.test.ts` | `../src/exportImport.js` | `../src/services/exportImport.js` |
| `locations.test.ts` | `../src/migrations.js` | `../src/db/migrations.js` |
| `migrations.test.ts` | `../src/migrations.js` | `../src/db/migrations.js` |
| `rebuildLegs.test.ts` | `../src/migrations.js` | `../src/db/migrations.js` |
| `rebuildLegs.test.ts` | `../src/rebuildLegs.js` | `../src/services/rebuildLegs.js` |
| `visitRoutes.test.ts` | `../src/visitRoutes.js` | `../src/services/visitRoutes.js` |
| `visitValidation.test.ts` | `../src/visitValidation.js` | `../src/services/visitValidation.js` |

Barrels used by tests stay: `../src/db.js`, `../src/locations.js`, `../src/types.js`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: both exit 0.

Confirm package root has no app `.ts`:

```bash
ls server/*.ts 2>/dev/null || true
```

Expected: no matches (or empty).

- [ ] **Step 6: Commit**

```bash
git add -A server
git commit -m "$(cat <<'EOF'
♻️ Classify server root modules into lib/db/services

EOF
)"
```

---

### Task 4: Config repo-root detection + production entrypoints

**Files:**
- Modify: `server/src/config.ts`
- Modify: `package.json` (`start`)
- Modify: `ecosystem.config.cjs`
- Modify: `Dockerfile` (`CMD`)
- Modify: `scripts/smoke-visit-origin.mjs`

**Interfaces:**
- Produces: `config.publicPath` / `config.defaultDbPath` correct under tsx (`server/src`) and node (`server/dist/server/src`)
- Produces: production entry `server/dist/server/src/index.js` everywhere live

- [ ] **Step 1: Replace `server/src/config.ts` repo-root logic**

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const segments = here.split(path.sep);
const isCompiled = segments.includes('dist');
/** `server/src` under tsx, or `server/dist/server/src` under node. */
const repoRoot = isCompiled
  ? path.resolve(here, '../../../..')
  : path.resolve(here, '../..');

export const config = {
  port: Number(process.env.PORT || 5168),
  host: '0.0.0.0' as const,
  bodyLimit: 5 * 1024 * 1024,
  publicPath: path.join(repoRoot, 'server', 'public'),
  defaultDbPath: path.join(repoRoot, 'server', 'data', 'spacetime-travel.sqlite'),
  get dbPath() {
    return process.env.SPACETIME_DB_PATH?.trim() || this.defaultDbPath;
  }
} as const;
```

- [ ] **Step 2: Update live entrypoints**

`package.json`:

```json
"start": "node server/dist/server/src/index.js"
```

`ecosystem.config.cjs`:

```js
script: 'server/dist/server/src/index.js',
```

`Dockerfile` final `CMD`:

```dockerfile
CMD ["node", "server/dist/server/src/index.js"]
```

`scripts/smoke-visit-origin.mjs`:

```js
const { createVisit, db, getAtlas } = await import('../server/src/db.ts');
```

- [ ] **Step 3: Grep for stale production entry**

Run:

```bash
rg -n 'server/dist/server/index\.js' package.json ecosystem.config.cjs Dockerfile scripts README.md || true
```

Expected: no hits in `package.json`, `ecosystem.config.cjs`, `Dockerfile`, `scripts/` (README updated in Task 5).

- [ ] **Step 4: Rebuild + health check (dev + prod)**

```bash
rm -rf server/dist
pnpm build:server
test -f server/dist/server/src/index.js

# prod entry
node server/dist/server/src/index.js &
PID=$!
sleep 1
curl -s http://127.0.0.1:5168/api/health
kill $PID

# optional smoke
pnpm smoke:visit-origin
```

Expected: health `{"ok":true}`; smoke exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/config.ts package.json ecosystem.config.cjs Dockerfile scripts/smoke-visit-origin.mjs
git commit -m "$(cat <<'EOF'
🔧 Point production entry at server/dist/server/src

EOF
)"
```

---

### Task 5: README + full acceptance

**Files:**
- Modify: `README.md` (directory tree, scripts, production entry paths, migrations path note)

**Interfaces:**
- Produces: docs match new layout; all acceptance criteria from the spec pass

- [ ] **Step 1: Update README directory tree**

Replace the `server/` block under Project Structure with:

```text
├── server/                # Fastify API + production static host
│   ├── src/               # Application source
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── config.ts      # port, publicPath, default DB path
│   │   ├── db/            # connection, seed, migrations
│   │   ├── models/
│   │   ├── services/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── lib/
│   ├── test/              # Server unit tests
│   ├── data/              # Runtime SQLite (gitignored; .gitkeep only)
│   ├── public/            # Vite build output (gitignored)
│   └── dist/              # tsc output (gitignored)
```

- [ ] **Step 2: Update README entry / script wording**

Replace occurrences of `server/dist/server/index.js` with `server/dist/server/src/index.js`.

Update:

- Production note: compiled entry is `node server/dist/server/src/index.js`
- `pnpm start` description: same path
- Tests: “under `server/test/`, `client/`, and `shared/`”
- Schema migrations path mention: `server/src/db/migrations.ts` (if README cites `server/migrations.ts`)

- [ ] **Step 3: Full acceptance**

```bash
# no app ts at package root
test -z "$(ls server/*.ts 2>/dev/null)"

pnpm typecheck
pnpm test

rm -rf server/dist
pnpm build:server
test -f server/dist/server/src/index.js

# prod health
node server/dist/server/src/index.js &
PID=$!
sleep 1
curl -s http://127.0.0.1:5168/api/health
kill $PID

# smoke (uses src barrel)
pnpm smoke:visit-origin
```

Expected:

- no `server/*.ts`
- typecheck/test/build exit 0
- health `{"ok":true}`
- smoke exit 0

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
📝 Document server src/ and test/ layout

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Sources under `server/src/` | 1 |
| Tests under `server/test/` | 2 |
| Classify root modules | 3 |
| Keep `db.ts` / `locations.ts` barrels | 1, 3 |
| `tsconfig` / `build:server` include `server/src` | 1 |
| Production entry `server/dist/server/src/index.js` | 4 |
| `config` `/dist/`-aware repo root | 4 |
| `api` / `start` / PM2 / Docker / smoke | 1, 4 |
| README | 5 |
| Acceptance criteria | 5 |
