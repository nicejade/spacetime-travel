# spacetime-travel

`spacetime-travel` is a local-first travel memory atlas built with Svelte, Vite, Fastify, and SQLite.

The app is designed around a spatial timeline: past journeys are plotted on an offline world map, connected by time-ordered routes, and enriched with transport mode, personal reflections, food memories, tags, dates, and ratings.

## Features

- Full-screen world-map canvas with pan and zoom controls.
- Offline SVG world map — no map API key or tile server required.
- Time-ordered travel nodes with date and location labels.
- Directional route lines between visits, with transport-aware styles (flight, train, ferry, drive, bus, walk).
- Year filters, timeline strip, and detail panel linked to the selected stop.
- Visit CRUD with origin / outbound / return / inbound fields, place-name search, and map pick.
- JSON export / import (full replace) for local backups.
- Delete undo toast (recreate within a short window).
- Rating-based node glow so memorable stops stand out.
- **Movie mode**: animated path playback with camera follow and WebM export.
- **Stats**: trip counts, transport mix, and great-circle distance totals.
- **Yearly travel poster**: SVG → PNG export.
- SQLite-backed local persistence with schema migrations (`PRAGMA user_version`).
- Seed data for demo visits across Asia, Europe, Africa, and the Americas.

## Tech Stack

- Svelte 5 (components still largely use Svelte 4-style `let` / `$:` syntax)
- Vite 6
- Tailwind CSS 4 — installed for base/reset only; UI styling lives in `client/app.css` and component scoped CSS (semantic classes, not utility-first)
- Fastify 5 + `@fastify/static`
- SQLite via `better-sqlite3` (WAL)
- `d3-geo`, `topojson-client`, and `world-atlas` for the offline map
- `@lucide/svelte` for icons

## Requirements

- Node.js 22 or newer is recommended.
- pnpm 10 or newer is recommended.

## Getting Started

Install dependencies:

```bash
pnpm install
```

If pnpm blocks native build scripts, approve builds for `better-sqlite3` and `esbuild`:

```bash
pnpm approve-builds
```

Run the app:

```bash
pnpm dev
```

Open:

```text
http://localhost:5167
```

The API runs on:

```text
http://localhost:5168
```

The frontend uses Vite proxying so browser requests to `/api/*` are forwarded to the local API.

## PM2

For a host with Node, pnpm, and a global [PM2](https://pm2.keymetrics.io/) install (no Docker):

```bash
npm i -g pm2   # once
pnpm install
pnpm build          # UI → server/public/
pnpm build:server   # API → dist/
pnpm deploy         # pm2 startOrReload
```

When code changed, run `pnpm build` and `pnpm build:server` before `pnpm deploy`.

Open `http://localhost:5168`. Useful commands:

```bash
pnpm pm2:status
pnpm pm2:logs
pnpm pm2:stop
pnpm pm2:restart
```

Config lives in `ecosystem.config.cjs` (single fork process; SQLite is not multi-writer safe). Logs go to `logs/` (gitignored). Override `PORT` or `SPACETIME_DB_PATH` in the shell before `pnpm deploy` / `pnpm pm2:reload` if needed.

## Docker

Production deployment uses a multi-stage image: install deps (with a compiler for `better-sqlite3`), build the Vite frontend into `server/public/`, prune to production dependencies, then run the Fastify process as a non-root user. The same process serves `/api/*` and the static UI.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) Engine 24+ (BuildKit enabled)
- [Docker Compose](https://docs.docker.com/compose/) v2 (`docker compose`)

### Quick start

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:5168
```

Health check:

```bash
curl -s http://localhost:5168/api/health
# {"ok":true}
```

Stop:

```bash
docker compose down
```

Data is kept in the named volume `spacetime-travel-data`. To remove containers **and** wipe the database:

```bash
docker compose down -v
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5168` | Host port published by Compose (maps to container port `5168`). Also used as the process listen port inside the image. |
| `SPACETIME_DB_PATH` | `/app/data/spacetime-travel.sqlite` | SQLite file path inside the container. |
| `NODE_ENV` | `production` | Set by Compose / the image. |

Optional host overrides: copy `.env.example` to `.env` (Compose loads it automatically).

```bash
cp .env.example .env
# edit PORT=… if 5168 is already in use
```

### Image-only (no Compose)

```bash
docker build -t spacetime-travel:latest .
docker run --rm -d \
  --name spacetime-travel \
  -p 5168:5168 \
  -v spacetime-travel-data:/app/data \
  -e SPACETIME_DB_PATH=/app/data/spacetime-travel.sqlite \
  spacetime-travel:latest
```

### Persist data with a bind mount

To use a host directory instead of a named volume (for example to back up or seed `server/data/`):

```yaml
# docker-compose.override.yml (local only; gitignored if you prefer)
services:
  app:
    volumes:
      - ./server/data:/app/data
```

The container runs as UID/GID `1000` (`node`). If the host `server/data/` directory is not writable, fix ownership once:

```bash
mkdir -p server/data
sudo chown -R 1000:1000 server/data
```

### Seed / migrate an existing database

Copy a local SQLite file into the volume, then start the stack:

```bash
docker compose up -d --build
docker compose cp ./server/data/spacetime-travel.sqlite app:/app/data/spacetime-travel.sqlite
docker compose restart app
```

On startup the app applies pending migrations (`PRAGMA user_version`) and seeds only when there are no visits.

### Useful commands

```bash
# Follow logs
docker compose logs -f app

# Rebuild after code changes
docker compose up -d --build

# Shell into the running container
docker compose exec app sh
```

### Notes

- There is **no authentication**. Expose the port only on localhost or a trusted network (or put a reverse proxy / auth layer in front).
- The image is not intended for multi-tenant production SaaS; it is a local-first atlas packaged for self-hosting.
- `tsx` is a runtime dependency so the server TypeScript entrypoint can run without a separate compile step.

## Scripts

```bash
pnpm dev
```

Starts both the Fastify API and the Vite dev server.

```bash
pnpm client
```

Starts only the Vite frontend on port `5167`.

```bash
pnpm api
```

Starts only the Fastify API on port `5168`.

```bash
pnpm build
```

Builds the production frontend into `server/public/` (gitignored).

```bash
pnpm build:server
```

Compiles the Fastify API and shared modules to `dist/`.

```bash
pnpm start
```

Runs `node dist/server/index.js` (requires a prior `pnpm build:server`). If `server/public/` exists, the same process also serves the production frontend.

```bash
pnpm deploy
```

Runs `pm2 startOrReload` via `ecosystem.config.cjs` (requires global `pm2`). Build the UI separately with `pnpm build` when needed.

```bash
pnpm pm2:start
pnpm pm2:stop
pnpm pm2:restart
pnpm pm2:reload
pnpm pm2:logs
pnpm pm2:status
```

PM2 process helpers for the `spacetime-travel` app.

```bash
pnpm typecheck
```

Runs TypeScript checking (`tsc --noEmit`).

```bash
pnpm test
```

Runs unit tests under `server/` and `client/`.

CI (GitHub Actions) runs `pnpm typecheck` and `pnpm test` on pushes to `main` / `feat/**` and on pull requests.

```bash
pnpm smoke:visit-origin
```

Runs the visit-origin smoke script against a temporary sqlite file (`SPACETIME_DB_PATH`); the default `server/data/spacetime-travel.sqlite` is left unchanged.

```bash
pnpm build:gazetteer
```

Rebuilds the client gazetteer data from GeoNames dumps.

## Project Structure

```text
.
├── client/                # Svelte UI (Vite)
│   ├── App.svelte
│   ├── components/
│   └── lib/
├── server/                # Fastify API + production static host
│   ├── index.ts
│   ├── config.ts          # port, publicPath, default DB path
│   ├── db/                # connection + seed
│   ├── data/              # Runtime SQLite (gitignored; .gitkeep only)
│   ├── models/            # atlas, visit, location
│   ├── services/
│   ├── routes/
│   └── public/            # Vite build output (gitignored)
├── shared/                # Isomorphic pure logic used by API + UI
│   └── years.ts           # Stable year → color palette
├── scripts/               # Gazetteer build, smoke tests
├── docs/                  # Design specs and plans
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.cjs   # PM2 production process
├── index.html             # Vite HTML entry
├── package.json
└── vite.config.ts
```

**Why `shared/`?** The year palette must match between the atlas API (`yearColors`) and the client (filters, map nodes, posters). Keeping one pure module avoids drift; do not duplicate it under `client/` or `server/`.

**Why `server/data/`?** SQLite is owned by the API process. Docker still mounts a volume at `/app/data` via `SPACETIME_DB_PATH` — container paths are independent of the local source layout.

## Data Model

The SQLite database is created automatically at:

```text
server/data/spacetime-travel.sqlite
```

Core tables:

- `locations`: geographic points (destinations and trip origins), **shared entities** keyed by `name + country` (reused across visits; orphans purged on delete/update).
- `visits`: travel memories with a **destination** (`location_id`) and **origin** (`origin_location_id`), ordered globally by arrival date. Each visit stores:
  - `outbound_*`: how you left the origin for this stop.
  - `return_*` + `returns_to_origin`: optional return leg back to the origin (defaults to returning).
  - `inbound_*`: how you arrived at this stop from the **previous** visit in the timeline (drives `legs` for non-first stops).
- `legs`: time-ordered connections between adjacent visits (built from each visit’s `inbound_*` fields), including great-circle `distance_km`.

The atlas API also returns **`visitRoutes`**: synthetic outbound/return segments per visit (origin → destination and, when `returnsToOrigin` is true, destination → origin). These are for map rendering and detail UI; **`legs`** remain the chronological spine used by movie mode.

`originSuggestions` lists locations previously used as origins for quick form fill.

Years and year colors are derived from `arrived_at` at query time (not stored as entities).

The database is seeded only when there are no visits.

**Schema migrations** use SQLite `PRAGMA user_version` (`server/migrations.ts`). On startup the app bootstraps tables if needed, then applies any pending migrations in order. Existing visit data is preserved across additive upgrades (new indexes, columns via `ALTER TABLE`, backfills).

Only delete `server/data/spacetime-travel.sqlite*` when a release notes a **non-migratable** breaking change, or when you intentionally want a clean reseed.

## API Overview

```http
GET /api/health
```

Health check.

```http
GET /api/atlas
```

Returns visits, legs, visitRoutes, originSuggestions, years, yearColors, and aggregate stats.

```http
GET /api/export
```

Downloads a JSON backup of all visits (`format`, `schemaVersion`, flattened visit payloads).

```http
POST /api/import
```

Replaces all atlas data with a previously exported JSON document. Invalid files return `400` without wiping existing data.

```http
POST /api/visits
```

Creates a new visit and rebuilds the global sequence / adjacent legs.

```http
PUT /api/visits/:id
```

Updates a visit and its location/inbound leg metadata.

```http
DELETE /api/visits/:id
```

Deletes a visit and rebuilds the global sequence / adjacent legs.

## Notes

- Port `5167` is used for the Vite frontend to avoid common conflicts with other Vite apps on `5173`.
- Production (including Docker) serves the built UI and API together on port `5168`.
- Runtime database files and `server/public/` build output are ignored by Git.
- The app is currently a local MVP and has no authentication or multi-user support.
- The API listens on `0.0.0.0` with no auth — suitable for localhost or a trusted network only.
