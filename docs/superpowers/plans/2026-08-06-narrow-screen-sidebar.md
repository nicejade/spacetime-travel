# Narrow-Screen Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Below 1000px viewport width, show only the atlas sidebar plus VisitForm / ConfirmDialog / import-export; hide map-centric chrome; explain the limitation with clear Chinese copy.

**Architecture:** Enable Tailwind v4 utilities globally. Drive visual show/hide with `max-[1000px]:` / `min-[1000px]:` classes on wrappers in `App.svelte`. Drive behavior guards (stats route, poster) with a small `matchMedia('(width < 1000px)')` helper so deep links and menu actions cannot open hidden surfaces.

**Tech Stack:** Svelte 5 (existing `$:` style), Tailwind CSS v4 via `@tailwindcss/vite`, existing Node test runner (`node --import tsx --test`)

## Global Constraints

- Breakpoint is exactly **1000px** (`width < 1000px` for narrow); do not use default `lg` (1024px)
- Prefer Tailwind utilities for show/hide and narrow layout tweaks; new bespoke CSS only when utilities cannot express the need
- Keep VisitForm, ConfirmDialog, export/import usable when narrow
- Hide TravelCanvas, TimelineStrip, TripPanel, StatsView, PosterPreview, MovieOverlay, map-error layer when narrow
- Copy language: Chinese
- Commit messages: English + gitmoji per `AGENTS.md`
- Spec: `docs/superpowers/specs/2026-08-06-narrow-screen-sidebar-design.md`

## File Structure

| File | Role |
|------|------|
| `client/app.css` | Enable full Tailwind import; remove 1200px min-width / desktop-only overflow |
| `client/lib/viewport.ts` | Shared media-query constant + pure helpers for narrow / stats visibility |
| `client/lib/viewport.test.ts` | Unit tests for those helpers |
| `client/App.svelte` | `matchMedia` state, Tailwind hide classes, notice, tools-menu + route guards, sidebar bottom override |

---

### Task 1: Enable Tailwind utilities and relax global min-width

**Files:**
- Modify: `client/app.css`

**Interfaces:**
- Produces: Full Tailwind (base/theme/utilities) available to markup; shell no longer forces `min-width: 1200px`
- Consumes: Existing custom rules (`.glass-panel`, buttons, fields) stay after the import

- [ ] **Step 1: Replace the Tailwind import and width policy in `client/app.css`**

Replace the top of the file so it starts like this (keep everything from `:root` onward except the `html/body/#app` and `body` overflow rules shown below):

```css
@import 'tailwindcss';

:root {
  color: #182633;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  overflow-x: hidden;
  overflow-y: hidden;
  background:
    radial-gradient(circle at 20% 15%, rgba(226, 112, 91, 0.18), transparent 26rem),
    radial-gradient(circle at 78% 18%, rgba(65, 132, 145, 0.2), transparent 30rem),
    linear-gradient(135deg, #f3fbfb 0%, #faf7f2 48%, #eef6ef 100%);
}
```

Remove the old comment about “Preflight only” and the `min-width: 1200px` / `overflow-x: auto` desktop-pan policy.

Leave `.glass-panel`, button, field, and route-stroke rules unchanged below.

- [ ] **Step 2: Smoke-check that Vite still serves CSS**

Run: `pnpm client` (or reuse a running dev server) and open the app once. Confirm the page still paints (background gradient + sidebar glass). If utilities somehow break layout globally, stop and investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add client/app.css
git commit -m "$(cat <<'EOF'
🔧 Enable Tailwind utilities and drop 1200px min-width

EOF
)"
```

---

### Task 2: Viewport helper + unit tests

**Files:**
- Create: `client/lib/viewport.ts`
- Create: `client/lib/viewport.test.ts`

**Interfaces:**
- Produces:
  - `NARROW_VIEWPORT_MQ: '(width < 1000px)'`
  - `isNarrowViewport(matchesNarrow: boolean): boolean` — identity helper kept for a single import surface (or simply export the constant and `shouldShowStatsView`)
  - `shouldShowStatsView(isNarrow: boolean, isStatsRoute: boolean): boolean` — `true` only when stats route and not narrow
  - `canOpenMapSurfaces(isNarrow: boolean): boolean` — `false` when narrow (stats / poster / movie chrome)
- Consumes: nothing

- [ ] **Step 1: Write the failing tests**

Create `client/lib/viewport.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NARROW_VIEWPORT_MQ,
  canOpenMapSurfaces,
  shouldShowStatsView
} from './viewport';

describe('viewport', () => {
  it('uses a range media query for the 1000px breakpoint', () => {
    assert.equal(NARROW_VIEWPORT_MQ, '(width < 1000px)');
  });

  it('hides stats view when the viewport is narrow', () => {
    assert.equal(shouldShowStatsView(true, true), false);
    assert.equal(shouldShowStatsView(false, true), true);
    assert.equal(shouldShowStatsView(false, false), false);
  });

  it('blocks map surfaces when narrow', () => {
    assert.equal(canOpenMapSurfaces(true), false);
    assert.equal(canOpenMapSurfaces(false), true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test client/lib/viewport.test.ts`  
Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Implement `client/lib/viewport.ts`**

```ts
/** Narrow mode: viewport width < 1000px */
export const NARROW_VIEWPORT_MQ = '(width < 1000px)';

export function shouldShowStatsView(isNarrow: boolean, isStatsRoute: boolean): boolean {
  return isStatsRoute && !isNarrow;
}

export function canOpenMapSurfaces(isNarrow: boolean): boolean {
  return !isNarrow;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test client/lib/viewport.test.ts`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add client/lib/viewport.ts client/lib/viewport.test.ts
git commit -m "$(cat <<'EOF'
✅ Add narrow viewport helpers for sidebar mode

EOF
)"
```

---

### Task 3: Wire narrow mode in `App.svelte`

**Files:**
- Modify: `client/App.svelte`

**Interfaces:**
- Consumes: `NARROW_VIEWPORT_MQ`, `shouldShowStatsView`, `canOpenMapSurfaces` from `$lib/viewport`
- Produces: Reactive `isNarrow` from `matchMedia`; UI + guards per spec option B

- [ ] **Step 1: Import helpers and subscribe to `matchMedia`**

In `<script lang="ts">`, add:

```ts
import {
  NARROW_VIEWPORT_MQ,
  canOpenMapSurfaces,
  shouldShowStatsView
} from '$lib/viewport';
```

Add state:

```ts
let isNarrow = false;
```

Inside `onMount`, after existing listeners, subscribe:

```ts
const narrowMq = window.matchMedia(NARROW_VIEWPORT_MQ);
const syncNarrow = () => {
  isNarrow = narrowMq.matches;
};
syncNarrow();
narrowMq.addEventListener('change', syncNarrow);
```

In the `onMount` cleanup, also:

```ts
narrowMq.removeEventListener('change', syncNarrow);
```

Add reactive derived (near other `$:` lines):

```ts
$: showStatsView = shouldShowStatsView(isNarrow, isStatsRoute);
$: mapSurfacesOpen = canOpenMapSurfaces(isNarrow);
```

- [ ] **Step 2: Guard stats / poster openers**

Update:

```ts
async function openPosterPreview() {
  if (!mapSurfacesOpen || !canGeneratePoster || typeof selectedYear !== 'number') return;
  await poster.open({
    year: selectedYear,
    yearColor: yearColors[String(selectedYear)] || '#2d7c89',
    visits: visibleVisits,
    legs: visibleLegs,
    yearColors
  });
}

function openStatsView() {
  if (loading || !mapSurfacesOpen) return;
  navigate(statsPath());
}
```

When already on stats while narrow, `showStatsView` will be false so the sidebar shell renders instead of a blank stats page (no forced navigate required).

- [ ] **Step 3: Replace `{#if isStatsRoute}` with `{#if showStatsView}`**

Change the top of `<main>`:

```svelte
{#if showStatsView}
  <StatsView
    ...
  />
{:else}
```

- [ ] **Step 4: Hide map-centric chrome with Tailwind wrappers**

Wrap each of these in an element that includes `max-[1000px]:hidden` (use a plain `<div class="max-[1000px]:hidden contents">` only if it does not break fixed positioning — if `contents` + `hidden` is unreliable in target browsers, use a plain wrapper `div` with class `max-[1000px]:hidden` and no other layout styles; `position: fixed` descendants remain hidden when an ancestor is `display: none`):

1. `TravelCanvas` (+ keep existing binds/props)
2. Map error block (`{#if error && !atlas && !loading}` …)
3. `MovieOverlay` block
4. `TripPanel`
5. `TimelineStrip`
6. `PosterPreview`

Do **not** wrap `VisitForm`, `ConfirmDialog`, or `atlas-sidebar`.

Example for TripPanel:

```svelte
<div class="max-[1000px]:hidden">
  <TripPanel
    visit={selectedVisit}
    year={selectedVisitYear}
    yearColor={selectedYearColor}
    visits={visits}
    stats={stats}
    onEdit={openEdit}
    onDelete={handleDelete}
  />
</div>
```

Apply the same pattern to the other five surfaces listed above.

- [ ] **Step 5: Narrow notice + tools menu + sidebar bottom**

On the sidebar `<aside>`, add Tailwind override for full height under narrow (timeline gap goes away). Keep existing `atlas-sidebar glass-panel` classes:

```svelte
<aside
  class="atlas-sidebar glass-panel max-[1000px]:!bottom-5"
  aria-label="旅行图谱"
>
```

(`!` so the utility beats scoped `.atlas-sidebar { bottom: 126px }`.)

After the brand row (before `import` / stats grid), insert notice:

```svelte
<p
  class="m-0 hidden text-[13px] font-semibold leading-normal text-[#4c646c] max-[1000px]:block"
  role="status"
>
  当前屏幕较窄，仅提供数据管理。完整地图、时间轴与详情需宽度 ≥ 1000px。
</p>
```

In the tools menu, disable stats/poster when narrow and update titles:

```svelte
<button
  type="button"
  role="menuitem"
  disabled={loading || !mapSurfacesOpen}
  title={mapSurfacesOpen ? '查看旅行统计' : '需屏幕宽度 ≥ 1000px'}
  on:click={() => runToolsAction(openStatsView)}
>
  <BarChart3 size={17} />旅行统计
</button>
<button
  type="button"
  role="menuitem"
  disabled={!mapSurfacesOpen || !canGeneratePoster}
  title={
    !mapSurfacesOpen
      ? '需屏幕宽度 ≥ 1000px'
      : posterDisabledReason || '生成该年旅行海报'
  }
  on:click={() => runToolsAction(openPosterPreview)}
>
  <Image size={17} />生成海报
</button>
```

Leave export/import buttons unchanged.

- [ ] **Step 6: Manual verification checklist**

With `pnpm dev` (or client + api):

1. Width ≥ 1000: full atlas (map, timeline, trip panel) unchanged; notice hidden
2. Width &lt; 1000: only sidebar + notice; map/timeline/trip panel gone
3. Narrow: 新增节点 opens VisitForm; delete confirm still works; 导出/导入 still in menu
4. Narrow: 旅行统计 / 生成海报 disabled
5. Open `/stats` (or navigate stats) then shrink below 1000: StatsView disappears, sidebar shell shows
6. Grow back above 1000: map chrome returns; if still on stats route, StatsView returns

- [ ] **Step 7: Run unit tests**

Run: `pnpm test`  
Expected: existing suite + new viewport tests pass

- [ ] **Step 8: Commit**

```bash
git add client/App.svelte
git commit -m "$(cat <<'EOF'
✨ Show sidebar-only mode under 1000px viewport

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Enable Tailwind utilities | Task 1 |
| Remove 1200px min-width | Task 1 |
| Breakpoint 1000px via utilities | Task 3 |
| Hide map / timeline / trip / poster / movie / map-error | Task 3 |
| Keep form / confirm / import-export | Task 3 (left unwrapped) |
| Chinese notice copy | Task 3 |
| Disable stats + poster when narrow | Task 2 helpers + Task 3 |
| Stats route while narrow → no blank StatsView | Task 2 + Task 3 (`showStatsView`) |
| Sidebar full height (no timeline gap) | Task 3 (`max-[1000px]:!bottom-5`) |

## Placeholder / consistency scan

- Media query string is only `NARROW_VIEWPORT_MQ` / `(width < 1000px)` — matches Tailwind `max-[1000px]:`
- Helper names `shouldShowStatsView` / `canOpenMapSurfaces` used consistently in tests and App
- No TBD / “similar to Task N” steps
