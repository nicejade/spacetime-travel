# HANDOFF

## Current Status

`spacetime-travel` is a working MVP built with Svelte, Vite, Tailwind CSS, Express, and SQLite.

The app has:

- An offline world-map canvas.
- Pan, zoom, reset, play/pause, and create controls.
- Travel nodes, directional route lines, timeline navigation, trip filters, and a detail panel.
- Create, edit, and delete flows for visits.
- SQLite schema creation and seed data.
- A Vite frontend on `http://localhost:5188`.
- An Express API on `http://localhost:5174`.

## Latest User Request

The user reported that the top toolbar buttons did not react. This pass improved the toolbar by:

- Stopping pointer events from bubbling from the toolbar into the canvas drag handler.
- Preventing canvas pointer capture from stealing toolbar interactions.
- Adding immediate playback movement to the next travel node when Play is pressed.
- Adding `aria-pressed` to the play/pause button.
- Adding a small zoom percentage readout and screen-reader status updates.
- Keeping the create button from accidentally interacting with canvas drag state.

The user also requested:

- An English `README.md`.
- A `HANDOFF.md` with incomplete work and recommended follow-up tasks.

## Verification To Run

Run:

```bash
pnpm build
```

Then run the dev app:

```bash
pnpm dev
```

Open:

```text
http://localhost:5188
```

Manual toolbar checks:

- Click Zoom In and confirm the percentage readout increases and the map grows.
- Click Zoom Out and confirm the percentage readout decreases and the map shrinks.
- Click Reset and confirm the map returns to the full-world view.
- Click Play and confirm the selected visit starts moving immediately through the route.
- Click Pause and confirm playback stops.
- Click Plus and confirm the visit form opens.

Latest automated toolbar check result:

- Zoom In changed the readout from `52%` to `60%`.
- Zoom Out changed the readout from `60%` to `51%`.
- Reset returned the readout to `52%`.
- Play changed the selected detail from `墨西哥城` to `上海` and set `aria-pressed="true"`.
- Pause set `aria-pressed="false"`.
- Plus opened the visit form.
- No page errors or failed HTTP responses were observed.

## Known Limitations

- There are no unit or integration test files yet.
- There is no undo flow after deleting a visit.
- The app does not calculate real route distance or duration.
- Visit order is append-only inside a trip; there is no drag-and-drop reordering.
- Trips cannot be edited directly from their own dedicated trip settings screen.
- Locations require manual latitude and longitude input.
- The offline equirectangular map has no pan bounds, so users can drag the map completely off screen.
- Seed data is only inserted when the database has zero trips.
- No export, import, backup, or restore workflow exists yet.
- No photo attachments or rich media memories are implemented.
- No authentication, profiles, or multi-user support exists.

## Suggested Next Features

- Add geocoding search for locations so users do not need to enter coordinates manually.
- Add trip editing for title, subtitle, notes, color, and ordering.
- Add drag-and-drop visit reordering and automatic leg resequencing.
- Add import/export for JSON and CSV.
- Add database backup and restore actions.
- Add optional photo attachments per visit.
- Add a route metrics layer for distance, duration, and transport totals.
- Add a yearly heatmap or stats view.
- Add keyboard shortcuts for zoom, reset, play/pause, and create.
- Add Playwright tests for the core user flows.
- Add an undo toast after delete.

## Implementation Notes

- Main canvas code lives in `src/components/TravelCanvas.svelte`.
- API and database logic live in `server/db.js` and `server/index.js`.
- The runtime database is `data/spacetime-travel.sqlite` and is ignored by Git.
- `pnpm-workspace.yaml` allows native build scripts for `better-sqlite3` and `esbuild`.
- If dependency installation fails because pnpm blocks native scripts, run `pnpm approve-builds`.
