# Server Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile `server/` + `shared/` to `dist/` via `pnpm build:server`, and run production via `node dist/server/index.js`.

**Architecture:** Dedicated emit `tsconfig.server.json` (`NodeNext`); root `tsconfig` stays `noEmit`. Fix `config.ts` repo-root path resolution so `server/public` and `server/data` work from both `server/` (tsx) and `dist/server/` (node). Point `start`, PM2, and Docker at the compiled entry.

**Tech Stack:** TypeScript `tsc`, Node ESM, Fastify, PM2, Docker multi-stage

## Global Constraints

- Dev path stays `tsx` (`pnpm api` / `pnpm dev`)
- `pnpm build` remains Vite → `server/public/` only
- Do not add `pm2` as a dependency
- Do not add `build:all` in this plan
- Commit messages: English + gitmoji per `AGENTS.md`

---

### Task 1: `tsconfig.server.json` + `build:server` + path fix

**Files:**
- Create: `tsconfig.server.json`
- Modify: `package.json` (scripts `build:server`, `start`)
- Modify: `server/config.ts`
- Modify: `README.md` (scripts / start / PM2 notes)

**Interfaces:**
- Produces: `pnpm build:server` → `dist/server/index.js`, `dist/shared/**`
- Produces: `config.publicPath` / `config.defaultDbPath` resolve to repo `server/public` and `server/data` from either run mode
- Produces: `pnpm start` → `node dist/server/index.js`

- [ ] **Step 1: Add `tsconfig.server.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": ".",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "declaration": false,
    "sourceMap": true
  },
  "include": ["server/**/*.ts", "shared/**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 2: Update `package.json` scripts**

Set:

```json
"build:server": "tsc -p tsconfig.server.json",
"start": "node dist/server/index.js"
```

Leave `build`, `api`, `dev`, `typecheck` unchanged.

- [ ] **Step 3: Fix `server/config.ts` paths**

Replace `__dirname`-relative `public` / `data` with repo-root resolution:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** `server/` under tsx, or `dist/server/` under node — both map to repo root. */
const repoRoot =
  path.basename(path.dirname(here)) === 'dist'
    ? path.resolve(here, '../..')
    : path.resolve(here, '..');

export const config = {
  port: Number(process.env.PORT || 5168),
  host: '0.0.0.0' as const,
  bodyLimit: 5 * 1024 * 1024,
  publicPath: path.join(repoRoot, 'server', 'public'),
  defaultDbPath: path.join(repoRoot, 'server', 'data', 'spacetime-travel.sqlite'),
  get dbPath() {
    return process.env.SPACETIME_DB_PATH?.trim() || this.defaultDbPath;
  }
} as const;
```

- [ ] **Step 4: Document in README**

Under Scripts:

- Add `pnpm build:server` — compiles API to `dist/`
- Update `pnpm start` — requires prior `build:server`; runs `node dist/server/index.js`
- PM2 section: note `pnpm build` + `pnpm build:server` before `pnpm deploy` when code changed

- [ ] **Step 5: Verify compile + health**

Run:

```bash
pnpm build:server
test -f dist/server/index.js
pnpm build
node dist/server/index.js &
sleep 1
curl -s http://127.0.0.1:5168/api/health
kill %1
```

Expected: `build:server` exit 0; health `{"ok":true}`

- [ ] **Step 6: Commit**

```bash
git add tsconfig.server.json package.json server/config.ts README.md docs/superpowers/specs/2026-08-03-server-build-design.md docs/superpowers/plans/2026-08-03-server-build.md
git commit -m "$(cat <<'EOF'
✨ Add server TypeScript build to dist/

EOF
)"
```

---

### Task 2: PM2 + Docker production entry

**Files:**
- Modify: `ecosystem.config.cjs`
- Modify: `Dockerfile`
- Modify: `docs/superpowers/specs/2026-08-03-pm2-deploy-design.md` (script/entry lines only, keep deploy=reload)

**Interfaces:**
- Consumes: `dist/server/index.js` from Task 1
- Produces: PM2 and Docker start compiled Node entry

- [ ] **Step 1: Update `ecosystem.config.cjs`**

```js
module.exports = {
  apps: [
    {
      name: 'spacetime-travel',
      script: 'dist/server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      env: {
        NODE_ENV: 'production',
        PORT: '5168',
      },
    },
  ],
};
```

Update header comment: production needs `pnpm build:server` (and `pnpm build` for UI).

- [ ] **Step 2: Update `Dockerfile`**

Build stage:

```dockerfile
RUN pnpm build \
  && pnpm build:server \
  && pnpm prune --prod
```

Production copies — replace TS-only copy with:

```dockerfile
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server/public ./server/public
COPY --from=build --chown=node:node /app/server/data ./server/data
```

Remove PATH comment about `tsx` if obsolete. Set:

```dockerfile
CMD ["node", "dist/server/index.js"]
```

Do not copy full `server/` TS sources or `shared/` sources into the production image (compiled output + static assets + data dir are enough).

- [ ] **Step 3: Sync PM2 deploy design doc entry fields**

In `docs/superpowers/specs/2026-08-03-pm2-deploy-design.md`, change ecosystem table:

- `script` → `dist/server/index.js`
- Remove `args` / `tsx` rows

Operator flow: mention `pnpm build:server` alongside `pnpm build` when code changed.

- [ ] **Step 4: Verify (local, no full Docker required if slow)**

```bash
pnpm build:server
node -e "const c=require('./ecosystem.config.cjs'); if(c.apps[0].script!=='dist/server/index.js') process.exit(1)"
grep -q 'build:server' Dockerfile
grep -q 'dist/server/index.js' Dockerfile
pnpm typecheck
pnpm test
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add ecosystem.config.cjs Dockerfile docs/superpowers/specs/2026-08-03-pm2-deploy-design.md
git commit -m "$(cat <<'EOF'
🚀 Point PM2 and Docker at compiled server entry

EOF
)"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `tsconfig.server.json` | 1 |
| `build:server` / `start` scripts | 1 |
| `config.ts` path fix | 1 |
| README | 1 |
| `ecosystem.config.cjs` | 2 |
| Dockerfile | 2 |
| PM2 design doc sync | 2 |
| Health verification | 1 |
| Dev `tsx` unchanged | 1 (no change to `api`) |
