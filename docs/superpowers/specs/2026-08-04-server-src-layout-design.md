# Server `src/` + `test/` Layout Design

**Date:** 2026-08-04  
**Status:** Approved  
**Scope:** Reorganize `server/` into TypeScript-conventional `src/` + `test/`; lightly classify root modules; keep compatibility barrels; update build/runtime entry paths.

## Goal

Clean up the cluttered `server/` package root by:

1. Moving all application source under `server/src/`
2. Moving all server tests under `server/test/`
3. Placing formerly root-level domain/util modules into existing layers (`lib/`, `db/`, `services/`)
4. Keeping thin compatibility re-exports (`db.ts`, `locations.ts`) inside `src/`
5. Updating TypeScript configs, scripts, PM2, Docker, and README so production still runs from compiled output under `server/dist/`

## Non-goals

- Changing API behavior, SQLite schema, or migrations semantics
- Removing compatibility barrels (`db.ts`, `locations.ts`)
- Introducing a nested `server/package.json` or TypeScript project references
- Moving `shared/`, `server/data/`, or `server/public/`
- Client directory restructuring or a new test runner
- Full rewrite of historical HANDOFF / old plan path references

## Decisions

| Topic | Choice |
|-------|--------|
| Layout depth | Full `server/src/` + `server/test/` (option C) |
| Compatibility barrels | Keep, move into `src/` (option B) |
| Classification | Mild: flatten root modules into `lib/` / `db/` / `services/` |
| Test layout | Flat `server/test/*.test.ts` (no mirrored subfolders) |
| Compile strategy | Keep `rootDir: "."` + `outDir: ./server/dist` so `shared/` still emits |

## Target tree

```
server/
  src/
    index.ts
    app.ts
    config.ts
    types.ts
    db.ts                 # compatibility barrel
    locations.ts          # compatibility barrel
    lib/
      httpError.ts
      haversine.ts
    db/
      connection.ts
      seed.ts
      migrations.ts
    services/
      exportImportService.ts
      visitPayload.ts
      visitService.ts
      exportImport.ts
      rebuildLegs.ts
      visitValidation.ts
      visitRoutes.ts
    controllers/
    models/
    middleware/
    routes/
  test/
    db.test.ts
    exportImport.test.ts
    haversine.test.ts
    legDistance.test.ts
    locations.test.ts
    migrations.test.ts
    rebuildLegs.test.ts
    visitRoutes.test.ts
    visitValidation.test.ts
  data/                   # runtime SQLite (unchanged location)
  public/                 # Vite build output (unchanged location)
  dist/                   # tsc output (unchanged package-root location)
```

### Module placement rules

| File (today at `server/` root) | Destination |
|--------------------------------|-------------|
| `index.ts`, `app.ts`, `config.ts`, `types.ts` | `server/src/` |
| `db.ts`, `locations.ts` | `server/src/` (thin re-exports) |
| `haversine.ts` | `server/src/lib/haversine.ts` |
| `migrations.ts` | `server/src/db/migrations.ts` |
| `exportImport.ts` | `server/src/services/exportImport.ts` |
| `rebuildLegs.ts` | `server/src/services/rebuildLegs.ts` |
| `visitValidation.ts` | `server/src/services/visitValidation.ts` |
| `visitRoutes.ts` | `server/src/services/visitRoutes.ts` |
| `*.test.ts` | `server/test/` (same filenames) |
| Existing `controllers/`, `models/`, `services/`, `middleware/`, `routes/`, `lib/`, `db/` | Under `server/src/` with the same relative structure |

Package root after migration must not contain application `.ts` or `.test.ts` files.

## Build and runtime

### TypeScript

**Root `tsconfig.json`**

- `include` server sources as `server/src/**/*.ts` and `server/test/**/*.ts` (plus existing client/shared/vite entries)

**`tsconfig.server.json`**

| Option | Value | Why |
|--------|--------|-----|
| `include` | `server/src/**/*.ts`, `shared/**/*.ts` | Source-only compile |
| `exclude` | `**/*.test.ts`, `server/test/**` | Do not emit tests |
| `rootDir` | `.` | Preserve emit of both `server/...` and `shared/...` |
| `outDir` | `./server/dist` | Artifacts stay under the server package |

Compiled entry becomes:

```text
server/dist/server/src/index.js
```

`shared` remains at `server/dist/shared/`.

### `config.ts` repo-root resolution

`publicPath` and `defaultDbPath` stay anchored at repo-root `server/public` and `server/data`.

Detect production vs dev by whether the resolved directory of `config.ts` contains a `dist` path segment (more robust than `basename` heuristics):

| Mode | Module directory | Repo root from `config.ts` |
|------|------------------|----------------------------|
| `tsx` (dev) | `server/src/` | `path.resolve(here, '../..')` |
| `node` (prod) | `server/dist/server/src/` | `path.resolve(here, '../../../..')` |

If the path includes `dist` as a segment → prod; otherwise → dev.

### Scripts and deploy entrypoints

| Surface | New value |
|---------|-----------|
| `pnpm api` | `tsx watch server/src/index.ts` |
| `pnpm start` | `node server/dist/server/src/index.js` |
| `pnpm test` | include `server/test/**/*.test.ts` (client/shared globs unchanged) |
| PM2 `script` | `server/dist/server/src/index.js` |
| Docker `CMD` | `node server/dist/server/src/index.js` |
| `scripts/smoke-visit-origin.mjs` | import `../server/src/db.ts` |

After the change, grep must not find the old production entry `server/dist/server/index.js` in live scripts/configs (README/historical specs may still mention it as past state).

### Tests

- All server unit tests live under `server/test/`
- Imports reach source via `../src/...` (e.g. `../src/db.js`, `../src/lib/haversine.js`)
- Compatibility barrels remain valid test entrypoints (`../src/db.js`, `../src/locations.js`)

## Migration sequence

1. Create `server/src/` and `server/test/`; `git mv` existing sources and tests
2. Classify formerly root modules per the placement table; fix internal relative imports (including one extra `../` for `shared/`)
3. Point tests at `../src/...`
4. Update `config.ts` repo-root detection
5. Update `package.json`, `tsconfig.json`, `tsconfig.server.json`, `ecosystem.config.cjs`, `Dockerfile`, smoke script, README directory/entry docs
6. Remove stale `server/dist/` and run `pnpm build:server`
7. Run acceptance checks

Prefer `git mv` so history remains traceable.

## Risks

| Risk | Mitigation |
|------|------------|
| Wrong repo root → broken DB or static paths | `/dist/`-aware resolution; verify default paths still under `server/` |
| `tsc` fails because `shared` is outside a narrowed `rootDir` | Keep `rootDir: "."` |
| Missed relative imports after moves | `pnpm typecheck` + `pnpm test` |
| Production still points at old entry | Update start / PM2 / Docker together; grep for old path |
| Stale docs | README required; HANDOFF only where it still describes current layout |

## Acceptance criteria

- `server/` package root has no application `.ts` / `.test.ts` (only `src/`, `test/`, `data/`, `public/`, `dist/`, etc.)
- `pnpm typecheck` passes
- `pnpm test` passes
- `pnpm build:server` emits `server/dist/server/src/index.js`
- Dev (`pnpm api`) and prod (`pnpm start` after build) both serve `GET /api/health` → `{"ok":true}`
- Smoke script imports successfully from `server/src/db.ts`

## Out of scope follow-ups

- Delete compatibility barrels once all callers use models/services directly
- Mirror `test/` subfolders to `src/` layers
- `build:all` combining UI + server builds
- Nested server package / project references for `shared`
