# syntax=docker/dockerfile:1

# spacetime-travel — multi-stage production image
# Stage layout: base → deps → build → production

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Base: Node + pnpm (corepack)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    # Avoid interactive prompts / telemetry noise in CI and builds
    CI=true

RUN corepack enable \
  && corepack prepare pnpm@10.11.1 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Deps: install all dependencies (native modules need a compiler toolchain)
# ---------------------------------------------------------------------------
FROM base AS deps

# better-sqlite3 compiles against the current glibc/arch
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build: Vite production assets → server/public
# ---------------------------------------------------------------------------
FROM deps AS build

COPY . .

RUN pnpm build \
  && pnpm prune --prod

# ---------------------------------------------------------------------------
# Production: minimal runtime image
# ---------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production \
    PORT=5168 \
    SPACETIME_DB_PATH=/app/data/spacetime-travel.sqlite \
    # so `tsx` from node_modules/.bin is on PATH
    PATH="/app/node_modules/.bin:/pnpm:$PATH"

# tini reaps zombies and forwards signals (SIGTERM → graceful shutdown)
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data \
  && chown -R node:node /app

# Runtime application files only
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared

USER node

EXPOSE 5168

# Named volumes inherit ownership of this directory on first create
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5168)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["tini", "--"]
CMD ["tsx", "server/index.ts"]
