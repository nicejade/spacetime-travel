# Narrow-Screen Sidebar Mode Design

**Date:** 2026-08-06  
**Status:** Approved  
**Scope:** When viewport width &lt; 1000px, show only the atlas sidebar and data-management overlays; hide map-centric UI; explain why.

## Context

The client shell is desktop-oriented: `client/app.css` sets `html, body, #app { min-width: 1200px }` and allows horizontal pan on narrower windows. The main chrome is:

- `TravelCanvas` (map)
- `atlas-sidebar` (brand, stats grid, year filter, add/refresh, tools menu)
- `TripPanel`, `TimelineStrip`
- overlays: `VisitForm`, `ConfirmDialog`, `PosterPreview`, `MovieOverlay`, `StatsView` (route)

Tailwind is wired via `@tailwindcss/vite`, but `client/app.css` currently imports **preflight only** (utilities intentionally skipped). No component yet uses utility classes.

## Goals

- Viewport **&lt; 1000px**: only sidebar + related data ops remain usable.
- Clear copy explaining that the full atlas needs a wider screen.
- Prefer **Tailwind utility classes** for show/hide and narrow layout tweaks; avoid new bespoke CSS unless necessary.
- Viewport **≥ 1000px**: unchanged desktop experience.

## Non-goals

- Full mobile redesign of map / timeline / trip panel
- Removing or rewriting existing scoped styles for the desktop layout
- Conditional unmount of the map for performance (CSS hide is enough)

## Product rules (option B)

| Visible / usable &lt; 1000px | Hidden &lt; 1000px |
|---|---|
| `atlas-sidebar` | `TravelCanvas` |
| `VisitForm` | `TimelineStrip` |
| `ConfirmDialog` | `TripPanel` |
| Export / import (tools menu) | `StatsView` |
| | `PosterPreview` |
| | `MovieOverlay` / map error layer |

Tools menu under narrow width:

- Keep **导出数据** / **导入数据**
- **旅行统计** / **生成海报**: hide or disable; do not open those surfaces

If the user is already on the stats route when the viewport is narrow, do not show `StatsView`; fall back to the sidebar shell (same as atlas home) so the screen is not blank.

## Approach

### 1. Enable Tailwind utilities

Change `client/app.css` from preflight-only to a full Tailwind import (v4), e.g. `@import "tailwindcss";`, while preserving existing custom rules (`:root`, `body` background, `.glass-panel`, shared button/field styles).

Rationale: utilities are required for the requested `max-[1000px]:` / `min-[1000px]:` markup. Preflight stays; existing scoped `<style>` blocks continue to win where they set the same properties more specifically.

Watch-out (historical comment about “responsive container breakpoints”): verify after enabling utilities that nothing reintroduces an unwanted global `min-width` or container query side effect. Keep app-level width policy explicit in `app.css` (remove the old 1200px floor).

### 2. Breakpoint

Use **1000px** via Tailwind arbitrary variants:

- Hide chrome: `max-[1000px]:hidden` on map / timeline / trip panel / poster / movie / map-error wrappers
- Show narrow-only notice: `hidden max-[1000px]:…` (or equivalent)
- Prefer utilities on markup over new `@media` blocks in `<style>`

Do not rely on default `lg` (1024px).

### 3. Global width policy

In `app.css`:

- Remove `min-width: 1200px` from `html, body, #app`
- Narrow viewports should not force horizontal page scroll for the shell; body overflow can return to normal vertical behavior as needed for the sidebar-only mode

### 4. Sidebar layout under narrow width

Apply Tailwind on the sidebar element (keep `atlas-sidebar` / `glass-panel` for existing look):

- Fill available height (no reserved gap for the bottom timeline)
- Full-height fixed panel with existing left inset, or slightly tighter padding via utilities if needed

Only add a scoped rule if a property cannot be expressed cleanly with utilities (e.g. existing glass / brand styles stay as-is).

### 5. Narrow-mode notice

Inside `atlas-sidebar`, add a short status line (Chinese), visible only below 1000px, e.g.:

> 当前屏幕较窄，仅提供数据管理。完整地图、时间轴与详情需宽度 ≥ 1000px。

Style with Tailwind (muted text, compact leading). Place near the top of the sidebar (after brand row or before stats) so it is obvious without crowding actions.

### 6. Tools menu / route guards

- Markup: hide or disable 「旅行统计」/「生成海报」with utilities and/or `disabled` + `title` explaining width requirement.
- Logic: if `openStatsView` / `openPosterPreview` are invoked while narrow (URL, leftover state), no-op or close those surfaces so they cannot appear.

`matchMedia('(width < 1000px)')` (or equivalent reactive width check) is acceptable for **behavior** guards; visual hide/show stays on Tailwind classes.

### 7. Overlays that stay

`VisitForm` and `ConfirmDialog` remain available so create/edit/delete/import confirmation still work. No change to their internal layouts beyond what already fits narrow viewports.

## Files likely touched

- `client/app.css` — enable utilities; drop 1200px min-width
- `client/App.svelte` — utility classes on chrome wrappers; notice copy; tools menu / stats-route behavior
- Possibly thin wrappers around child components if they root at the top level without a hideable parent

## Testing

- Resize below 1000px: map / timeline / trip panel gone; sidebar + notice visible; add node opens form; confirm dialog still works; export/import still in menu
- Stats / poster entries not usable; deep-linking stats while narrow does not show StatsView
- Resize to ≥ 1000px: full atlas restored, notice gone
- Visual smoke: glass sidebar still matches desktop look

## Out of scope follow-ups

- True mobile map UX
- Unmounting `TravelCanvas` when hidden for perf
