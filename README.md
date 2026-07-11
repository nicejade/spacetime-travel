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
pnpm start
```

Starts the Fastify API. If `server/public/` exists, the same process also serves the production frontend.

```bash
pnpm typecheck
```

Runs TypeScript checking (`tsc --noEmit`).

```bash
pnpm test
```

Runs unit tests under `server/` and `client/`.

```bash
pnpm smoke:visit-origin
```

Runs the visit-origin smoke script against a temporary sqlite file (`SPACETIME_DB_PATH`); the default `data/spacetime-travel.sqlite` is left unchanged.

```bash
pnpm build:gazetteer
```

Rebuilds the client gazetteer data from GeoNames dumps.

## Project Structure

```text
.
├── server/
│   ├── index.ts           # Fastify API + production static server
│   ├── db.ts              # SQLite queries, mutations, seed
│   ├── migrations.ts      # Schema version + migrations
│   ├── locations.ts       # Location reuse / orphan purge
│   ├── rebuildLegs.ts     # Sequence + legs rebuild
│   ├── visitRoutes.ts     # Read-time outbound/return routes
│   ├── visitValidation.ts # Write payload validation
│   └── public/            # Production build output (gitignored)
├── client/
│   ├── App.svelte         # Main shell and state orchestration
│   ├── app.css            # Global visual system
│   ├── components/        # Map, form, movie, stats, poster, dialogs
│   └── lib/
│       ├── api.ts
│       ├── movie/         # Playback engine, path, camera, export
│       ├── poster/        # Yearly poster SVG/PNG
│       ├── stats/         # Stats computations
│       └── gazetteer.ts   # Lazy place-name search
├── data/                  # Runtime SQLite database files
├── scripts/
├── index.html
├── package.json
└── vite.config.ts
```

## Data Model

The SQLite database is created automatically at:

```text
data/spacetime-travel.sqlite
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

Only delete `data/spacetime-travel.sqlite*` when a release notes a **non-migratable** breaking change, or when you intentionally want a clean reseed.

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
- Runtime database files and `server/public/` build output are ignored by Git.
- The app is currently a local MVP and has no authentication or multi-user support.
- The API listens on `0.0.0.0` with no auth — suitable for localhost or a trusted network only.
