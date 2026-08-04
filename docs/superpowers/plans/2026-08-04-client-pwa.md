# Client PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Vite client installable as a PWA with branded icons/manifest and shell-offline / API-online Service Worker caching.

**Architecture:** Point Vite `publicDir` at `client/public/` (existing RealFaviconGenerator assets). Wire favicon + `site.webmanifest` links in root `index.html`. Add `vite-plugin-pwa` with Workbox precache for the app shell and NetworkOnly for `/api/**`. Keep Fastify routes unchanged.

**Tech Stack:** Vite 6, Svelte 5, `vite-plugin-pwa` (Workbox), existing Fastify static host (`server/public/`)

## Global Constraints

- Shell offline only; `/api/*` must never be cached (NetworkOnly)
- No custom install prompt UI
- No Fastify / visit business-logic changes
- Prefer existing `client/public/site.webmanifest` over plugin-generated manifest (`manifest: false` on VitePWA)
- Commit messages: English + gitmoji per `AGENTS.md`
- Spec: `docs/superpowers/specs/2026-08-04-client-pwa-design.md`

## File Structure

| File | Role |
|------|------|
| `client/public/*` | Icons + hand-written web manifest (git-track) |
| `client/public/site.webmanifest` | Install metadata (name, colors, icons any+maskable) |
| `index.html` | Favicon / apple-touch / manifest / title / theme-color |
| `vite.config.ts` | `publicDir` + `VitePWA` Workbox config |
| `package.json` | Add `vite-plugin-pwa` devDependency |
| `README.md` | Brief note that production build includes PWA SW |

---

### Task 1: Track assets + complete `site.webmanifest`

**Files:**
- Modify: `client/public/site.webmanifest`
- Track: `client/public/favicon.ico`, `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`

**Interfaces:**
- Produces: Manifest at `/site.webmanifest` with `start_url: '/'`, `lang: 'zh-CN'`, `theme_color` / `background_color` `#edf7f6`, and 192/512 icons each with `any` + `maskable` entries
- Consumes: Existing PNG/SVG/ICO files already on disk under `client/public/`

- [ ] **Step 1: Replace `client/public/site.webmanifest` contents**

Write exactly:

```json
{
  "name": "时空旅行",
  "short_name": "时空旅行",
  "lang": "zh-CN",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#edf7f6",
  "background_color": "#edf7f6",
  "icons": [
    {
      "src": "/web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Verify assets exist**

Run:

```bash
ls -la client/public/
```

Expected: all seven files present (`favicon.ico`, `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `site.webmanifest`).

- [ ] **Step 3: Commit**

```bash
git add client/public/
git commit -m "$(cat <<'EOF'
✨ Add PWA icons and complete web manifest

EOF
)"
```

---

### Task 2: Wire favicons and manifest in `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: Public URLs `/favicon-96x96.png`, `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, `/site.webmanifest`
- Produces: Document title `时空旅行`; `theme-color` `#edf7f6`; apple web app title `时空旅行`

- [ ] **Step 1: Update `index.html` head**

Replace the entire file with:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#edf7f6" />
    <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-title" content="时空旅行" />
    <link rel="manifest" href="/site.webmanifest" />
    <title>时空旅行</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/client/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Smoke-check in Vite (optional if Task 3 not done yet)**

After Task 3 sets `publicDir`, `pnpm client` should serve icons at those paths. If running alone before Task 3, skip — Vite still looks at root `public/` until `publicDir` is set.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
✨ Wire favicon and web manifest links in index.html

EOF
)"
```

---

### Task 3: `publicDir` + `vite-plugin-pwa`

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (devDependency)
- Modify: `README.md` (short PWA / build note)
- Possibly modify: `client/main.ts` only if SW registration does not inject automatically (prefer plugin `injectRegister: 'auto'` — no app change)

**Interfaces:**
- Produces: `pnpm build` copies `client/public/*` → `server/public/`
- Produces: Service Worker + Workbox files under `server/public/`
- Produces: Precached shell; `/api/**` NetworkOnly
- Consumes: Task 1 manifest/icons; Task 2 HTML links

- [ ] **Step 1: Install dependency**

Run:

```bash
pnpm add -D vite-plugin-pwa
```

Expected: `vite-plugin-pwa` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Update `vite.config.ts`**

Replace contents with:

```ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  publicDir: 'client/public',
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Hand-written site.webmanifest in client/public — do not emit a second manifest
      manifest: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'web-app-manifest-192x192.png',
        'web-app-manifest-512x512.png',
        'site.webmanifest'
      ],
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./client/lib', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5168'
    }
  },
  build: {
    outDir: './server/public'
  }
});
```

If TypeScript complains that `urlPattern` callback typing is wrong for the installed Workbox version, use the RegExp form instead:

```ts
urlPattern: /^\/api\//
```

(same `handler: 'NetworkOnly'`). Prefer the callback form when types allow — it matches pathname prefix without treating the whole origin as a string match quirk.

- [ ] **Step 3: Build and assert artifacts**

Run:

```bash
pnpm build
```

Then:

```bash
ls server/public/favicon.ico server/public/favicon.svg server/public/site.webmanifest \
  server/public/apple-touch-icon.png \
  server/public/web-app-manifest-192x192.png \
  server/public/web-app-manifest-512x512.png
ls server/public/sw.js server/public/workbox-*.js 2>/dev/null || ls server/public/*sw* server/public/workbox*
rg -n "serviceWorker|registerSW|workbox" server/public/index.html
```

Expected:

- All listed icons + `site.webmanifest` exist under `server/public/`
- A service worker file exists (commonly `sw.js` plus a `workbox-*.js` chunk; names may vary slightly by plugin version)
- Built `index.html` contains SW registration injection (script tag or inline) and still has the favicon/manifest link tags

- [ ] **Step 4: Assert API is not in precache manifest**

Run:

```bash
rg -n "/api/" server/public/sw.js server/public/workbox-*.js 2>/dev/null | head
# Also check generated precache list if present:
rg -n "precache|url:" server/public/sw.js | head -40
```

Expected: No precache entry for `/api/atlas` or other API routes. Mentions of `NetworkOnly` / `/api/` in runtime routing config are OK.

- [ ] **Step 5: Manual browser verification**

1. Run `pnpm preview` (or `pnpm build:server && pnpm start` if exercising Fastify static host).
2. Open the app on `http://localhost:<port>/`.
3. DevTools → Application:
   - Manifest loads from `/site.webmanifest` (name 时空旅行, theme `#edf7f6`)
   - Service worker status: activated
   - Icons resolve (no 404)
4. DevTools → Network → Offline:
   - Reload: shell (HTML/JS/CSS) still loads from cache
   - `/api/atlas` fails (network error) — not served from cache

- [ ] **Step 6: Document in README**

In `README.md` Tech Stack or Build section, add one short bullet / sentence, for example under the Vite client mention:

```markdown
- Production Vite build includes a PWA Service Worker (`vite-plugin-pwa`): app shell is precached; `/api/*` stays network-only.
```

Do not expand into a full offline-guide; keep it one line.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts README.md
git commit -m "$(cat <<'EOF'
✨ Add vite-plugin-pwa with shell-offline caching

EOF
)"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `publicDir: 'client/public'` | Task 3 |
| Favicon / apple / manifest HTML tags | Task 2 |
| Title + theme-color 时空旅行 / `#edf7f6` | Task 2 |
| Manifest fields + any/maskable icons | Task 1 |
| `vite-plugin-pwa`, `autoUpdate` | Task 3 |
| Precache shell; `/api/**` NetworkOnly | Task 3 |
| No install UI / no Fastify changes | All (by omission) |
| Build + offline verification | Task 3 Steps 3–5 |

## Self-Review Notes

- No placeholder steps; SW file names may vary — Step 3 uses a fallback `ls` glob.
- `manifest: false` avoids conflicting with hand-written `site.webmanifest` linked from HTML.
- Unit tests are not added: behavior is build/config + browser Application panel; artifact assertions replace TDD for this config-only feature.
