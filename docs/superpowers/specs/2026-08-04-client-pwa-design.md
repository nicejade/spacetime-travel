# Client PWA Design

**Date:** 2026-08-04  
**Status:** Approved  
**Scope:** Make the Vite client installable as a PWA with shell-offline / API-online behavior.

## Context

Favicon and Web App Manifest assets already live under `client/public/` (RealFaviconGenerator output):

- `favicon.ico`, `favicon.svg`, `favicon-96x96.png`
- `apple-touch-icon.png`
- `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`
- `site.webmanifest`

Gaps today:

1. Root `index.html` does not link icons or the manifest.
2. Vite default `publicDir` is `public/` (repo root); assets are in `client/public/`, so they are not served in dev or copied on build.
3. There is no Service Worker; the app is not a full installable PWA.

Map geometry is bundled via `world-atlas` imports (not a separate network fetch). Atlas and CRUD data come from `/api/*` and stay network-dependent.

## Goals

- Browser tab / home-screen icons and titles use the provided brand assets (“时空旅行”).
- Production builds ship a Service Worker that precaches the app shell (HTML, JS, CSS, public static icons/manifest).
- `/api/*` is never served from cache (NetworkOnly).
- Users can “Add to Home Screen” / install when the browser’s installability criteria are met.

## Non-goals

- Offline API / last-known atlas cache
- Offline write queue or sync
- Custom install prompt UI
- Changes to Fastify routes or visit business logic

## Approach

Use **`vite-plugin-pwa`** (Workbox) with `registerType: 'autoUpdate'`.

### Vite

- Set `publicDir: 'client/public'` so icons and `site.webmanifest` are copied into `server/public/` on `pnpm build`.
- Add `VitePWA` with:
  - Precache of build assets + public static files
  - `workbox.navigateFallback: '/index.html'` for SPA-style navigation (Fastify already falls back to `index.html` for non-API routes)
  - Runtime caching: `/api/**` → NetworkOnly (explicit; do not precache API responses)

### HTML (`index.html`)

Wire RealFaviconGenerator tags:

```html
<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-title" content="时空旅行" />
<link rel="manifest" href="/site.webmanifest" />
```

Also:

- `<title>` → `时空旅行`
- Keep / align `theme-color` with the shell background (`#edf7f6`, matching the existing meta)

### Manifest (`client/public/site.webmanifest`)

Complete install metadata:

| Field | Value |
|-------|--------|
| `name` / `short_name` | 时空旅行 |
| `start_url` | `/` |
| `lang` | `zh-CN` |
| `display` | `standalone` |
| `theme_color` | `#edf7f6` |
| `background_color` | `#edf7f6` |
| icons | For each of 192 and 512: two entries pointing at the same PNG — one `"purpose": "any"`, one `"purpose": "maskable"` |

### Offline model

| Resource | Strategy |
|----------|----------|
| App shell (HTML/JS/CSS/icons/manifest) | Precache + serve from cache when offline |
| `/api/*` | NetworkOnly — fail when offline |
| Map TopoJSON | Already in JS bundle → covered by shell precache |

## Architecture

```text
Browser
  ├─ index.html (icons + manifest + theme)
  ├─ Vite app (Svelte)
  └─ Service Worker (vite-plugin-pwa / Workbox)
        ├─ precache: hashed assets + public/*
        └─ /api/** → network only

Fastify (unchanged)
  ├─ /api/* → JSON handlers
  └─ static → server/public/ (Vite outDir), SPA fallback index.html
```

SW registration is injected by the plugin at build time; no manual `navigator.serviceWorker` glue in app code unless the plugin requires a one-line import (follow plugin defaults for Vite 6).

## Error handling

- Offline shell: app boots; atlas `fetch` fails as today — existing UI error paths remain.
- SW update: `autoUpdate` activates new SW when available; no custom toast required for v1.

## Testing / verification

1. `pnpm build` — confirm `server/public/` contains icons, `site.webmanifest`, SW files (`sw.js` / workbox), and hashed assets.
2. `pnpm preview` or production `pnpm start` — Application panel: Manifest valid; SW registered; icons resolve.
3. DevTools → Network offline: shell loads; `/api/atlas` fails (not cached).
4. Lighthouse / Chrome installability: install prompt available on a secure origin (localhost OK).

## Dependencies

- Add `vite-plugin-pwa` (devDependency). Workbox comes transitively.

## Out of scope follow-ups

- Stale-while-revalidate for `GET /api/atlas`
- Install banner / `beforeinstallprompt` UI
- Push notifications
