# PM2 Local Deploy Design

**Date:** 2026-08-03  
**Status:** Approved  
**Scope:** Option B — local process management + one-command PM2 reload (`deploy`)

## Goal

Add a PM2-based production run path alongside the existing Docker stack, so a host with Node/pnpm/pm2 can build the frontend and run (or hot-reload) the Fastify process that serves both `/api/*` and static UI.

## Non-goals

- Remote deploy / SCP / SSH automation (existing private `deploy2server.sh` stays separate)
- Multi-instance / cluster mode (SQLite is single-writer)
- Adding `pm2` as a project dependency
- Changing Docker, Compose, or the existing `pnpm start` entrypoint

## Approach

Root `ecosystem.config.cjs` plus `package.json` scripts. Deploy = `pm2 startOrReload` (build is separate: `pnpm build` for UI, `pnpm build:server` for server).

## Files

### `ecosystem.config.cjs`

CommonJS (repo has `"type": "module"`).

| Field | Value | Why |
|-------|--------|-----|
| `name` | `spacetime-travel` | Stable PM2 app id for scripts |
| `script` | `dist/server/index.js` | Compiled server entry (same as Docker `CMD`) |
| `instances` | `1` | SQLite-safe |
| `exec_mode` | `fork` | Default for single process |
| `env.NODE_ENV` | `production` | Match Docker |
| `env.PORT` | `5168` | Match `server/config.ts` default |
| `out_file` / `error_file` | `logs/pm2-out.log` / `logs/pm2-error.log` | Local log files |
| `max_memory_restart` | `512M` | Guard against leaks |
| `autorestart` | `true` | Survive crashes |

`SPACETIME_DB_PATH` is not set in the ecosystem file; the app keeps using `server/data/spacetime-travel.sqlite` unless the operator exports the env var.

### `package.json` scripts

| Script | Command |
|--------|---------|
| `pm2:start` | `pm2 start ecosystem.config.cjs` |
| `pm2:stop` | `pm2 stop spacetime-travel` |
| `pm2:restart` | `pm2 restart spacetime-travel` |
| `pm2:reload` | `pm2 startOrReload ecosystem.config.cjs --update-env` |
| `pm2:logs` | `pm2 logs spacetime-travel` |
| `pm2:status` | `pm2 status spacetime-travel` |
| `deploy` | `pnpm pm2:reload` |

Prerequisite: `pm2` installed globally on the host (`npm i -g pm2` or equivalent).

### `.gitignore`

Add `logs/` so PM2 log files are not committed.

### README

Short “PM2” section next to Docker: prerequisite, `pnpm deploy`, and common `pm2:*` commands. No change to Docker docs.

## Operator flow

1. `pnpm install` (and approve native builds if needed)
2. Ensure `pm2` is on `PATH`
3. First deploy or update: `pnpm build` (if UI changed), `pnpm build:server` (if server changed), then `pnpm deploy`
4. App listens on `http://localhost:5168` (or `PORT`)
5. Optional: `pnpm pm2:logs` / `pnpm pm2:stop`

## Error handling

- If `pm2` is missing, scripts fail with the shell’s “command not found”
- SQLite path and migrations behave as today on process start

## Testing

- Manual: `pnpm build`, `pnpm build:server`, then `pnpm deploy`; `GET /api/health` returns `{"ok":true}`
- `pnpm pm2:status` shows `spacetime-travel` online
- No automated CI for PM2 (host-dependent)

## Out of scope follow-ups

- `pm2 startup` / boot persistence (operator-specific)
- Wire remote deploy script to call `pm2:reload` on the server
