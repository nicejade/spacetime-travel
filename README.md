# spacetime-travel

`spacetime-travel` is a local-first travel memory atlas built with Svelte, Vite, Tailwind CSS, Express, and SQLite.

The app is designed around a spatial timeline: past journeys are plotted on an offline world map, connected by time-ordered routes, and enriched with transport mode, personal reflections, food memories, tags, dates, and ratings.

## Features

- Full-screen world-map canvas with pan and zoom controls.
- Offline SVG world map, so no map API key or tile server is required.
- Time-ordered travel nodes with date and location labels.
- Directional route lines between visits.
- Transport-aware route styles for flights, trains, ferries, drives, buses, and walking.
- Rating-based node glow to make memorable stops stand out.
- Year filters (all years by default), timeline strip, and detail panel.
- Create, edit, and delete visit records without naming a trip.
- SQLite-backed local persistence.
- Seed data for demo visits across Asia, Europe, Africa, and the Americas spanning multiple years.

## Tech Stack

- Svelte 5
- Vite
- Tailwind CSS 4
- Express
- SQLite via `better-sqlite3`
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
http://localhost:5188
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

Starts both the Express API and the Vite dev server.

```bash
pnpm client
```

Starts only the Vite frontend on port `5188`.

```bash
pnpm api
```

Starts only the Express API on port `5168`.

```bash
pnpm build
```

Builds the production frontend into `dist/`.

```bash
pnpm start
```

Starts the Express API. If `dist/` exists, the server also serves the production frontend.

## Project Structure

```text
.
├── server/
│   ├── db.js          # SQLite schema, seed data, queries, and mutations
│   └── index.js       # Express API and production static server
├── client/
│   ├── App.svelte     # Main app shell and state orchestration
│   ├── app.css        # Global visual system and shared controls
│   ├── components/
│   │   ├── TimelineStrip.svelte
│   │   ├── TravelCanvas.svelte
│   │   ├── TripPanel.svelte
│   │   └── VisitForm.svelte
│   └── lib/
│       ├── api.js
│       └── format.js
├── data/              # Runtime SQLite database files
├── index.html
├── package.json
└── vite.config.js
```

## Data Model

The SQLite database is created automatically at:

```text
data/spacetime-travel.sqlite
```

Core tables:

- `locations`: geographic points.
- `visits`: travel memories attached to a location, ordered globally by arrival date.
- `legs`: movement between adjacent visits, including transport mode and notes.

Years and year colors are derived from `arrived_at` at query time (not stored as entities).

The database is seeded only when there are no visits.

**Schema upgrades are not migrated.** After pulling a breaking change, delete `data/spacetime-travel.sqlite*` and restart so the app recreates and reseeds the database.

## API Overview

```http
GET /api/health
```

Health check.

```http
GET /api/atlas
```

Returns visits, legs, years, yearColors, and aggregate stats.

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

- Port `5188` is used for the Vite frontend to avoid common conflicts with other Vite apps on `5173`.
- Runtime database files are ignored by Git.
- The app is currently a local MVP and has no authentication or multi-user support.
