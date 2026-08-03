# Server Build Design

**Date:** 2026-08-03  
**Status:** Approved  
**Scope:** Compile Fastify server (+ shared) to JS under `server/dist/`; production entry uses `node server/dist/server/index.js`

## Goal

Add a `build:server` script that TypeScript-compiles `server/` and its `shared/` imports into `server/dist/`, and switch production run paths (`start`, PM2, Docker) from `tsx server/index.ts` to `node server/dist/server/index.js`.

## Non-goals

- Changing the Vite frontend build (`pnpm build` → `server/public/`)
- Adding `pm2` as a project dependency
- Changing the dev path (`pnpm api` / `pnpm dev` still use `tsx`)
- Adding a combined `build:all` script (optional follow-up)
- Emitting to repo-root `dist/` (output stays under `server/`)

## Approach

Dedicated `tsconfig.server.json` with emit enabled; root `tsconfig.json` stays `noEmit` for editor/`typecheck`. Production entrypoints consume compiled output only. `outDir` is `./server/dist` so compile artifacts live next to the server package (alongside `public/` / `data/`).

## Files

### `tsconfig.server.json`

| Option | Value | Why |
|--------|--------|-----|
| `extends` | `./tsconfig.json` | Reuse strictness / target |
| `noEmit` | `false` | Override root noEmit |
| `outDir` | `./server/dist` | Emit `server/dist/server/` + `server/dist/shared/` |
| `rootDir` | `.` | Preserve import layout for `../../shared/...` |
| `module` / `moduleResolution` | `NodeNext` | Match existing `.js` import suffixes under Node ESM |
| `include` | `server/**/*.ts`, `shared/**/*.ts` | Server + shared dependency |
| `exclude` | `**/*.test.ts` | Do not emit tests |

Also clear client-only options that would conflict if inherited awkwardly (`lib` DOM is fine to keep; paths aliases unused by server).

### `package.json` scripts

| Script | Command |
|--------|---------|
| `build:server` | `tsc -p tsconfig.server.json` |
| `build` | `vite build` (unchanged) |
| `start` | `node server/dist/server/index.js` |

`api` / `dev` remain on `tsx`.

### `server/config.ts`

Resolve `publicPath` and `defaultDbPath` relative to the **repo root**, whether the file runs from `server/` (tsx) or `server/dist/server/` (node), so Vite output stays at `server/public/` and SQLite default at `server/data/`.

### `ecosystem.config.cjs`

- `script`: `server/dist/server/index.js`
- Drop `tsx` / `args` for the TS entry

### `Dockerfile`

- Build stage: `pnpm build && pnpm build:server` (then prune)
- Production: copy `server/dist/`, keep `server/public` (and data dir layout); `CMD ["node", "server/dist/server/index.js"]`
- `tsx` no longer required on the production PATH for the app entry (may still exist in node_modules until prune removes unused deps — acceptable)

### README

Document `pnpm build:server`, note that `pnpm start` / PM2 / Docker expect a prior server build, and that UI still needs `pnpm build`.

## Operator flow

1. `pnpm install`
2. `pnpm build` (UI → `server/public/`) when UI changed
3. `pnpm build:server` (API → `server/dist/`)
4. `pnpm start` or `pnpm deploy` (PM2)

## Error handling

- If `server/dist/` is missing, `node` / PM2 fail with module-not-found — operator must run `build:server`
- `tsc` failures abort `build:server` with non-zero exit

## Testing

- `pnpm build:server` exits 0; `server/dist/server/index.js` exists
- `pnpm build && pnpm build:server && pnpm start` → `GET /api/health` returns `{"ok":true}`
- `pnpm api` still starts via tsx without requiring `server/dist/`

## Out of scope follow-ups

- `build:all` = `pnpm build && pnpm build:server`
- Wire `deploy` to optionally run builds before reload
- Drop `tsx` from production Docker deps via a tighter install
