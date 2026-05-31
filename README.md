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
- Trip filters, timeline strip, and detail panel.
- Create, edit, and delete visit records.
- SQLite-backed local persistence.
- Seed data for three demo journeys across Asia, Europe, Africa, and the Americas.

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
http://localhost:5174
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

Starts only the Express API on port `5174`.

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
├── src/
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

- `trips`: named travel lines with colors and date ranges.
- `locations`: reusable geographic points.
- `visits`: travel memories attached to a trip and location.
- `legs`: movement between visits, including transport mode and notes.

The database is seeded only when there are no trips.

## API Overview

```http
GET /api/health
```

Health check.

```http
GET /api/atlas
```

Returns trips, visits, legs, and aggregate stats.

```http
POST /api/visits
```

Creates a new visit and optionally a new trip.

```http
PUT /api/visits/:id
```

Updates a visit and its location/inbound leg metadata.

```http
DELETE /api/visits/:id
```

Deletes a visit and resequences the trip.

## Notes

- Port `5188` is used for the Vite frontend to avoid common conflicts with other Vite apps on `5173`.
- Runtime database files are ignored by Git.
- The app is currently a local MVP and has no authentication or multi-user support.
