# syntax=docker/dockerfile:1

###############################################################################
# Evenly — multi-stage, production-capable image                              #
#                                                                             #
#  base   → pinned Node + pnpm + system deps (openssl for Prisma, tini PID-1) #
#  deps   → install node_modules (cached on the lockfile)                     #
#  build  → prisma generate + next build                                      #
#  runner → built app + node_modules (incl. Prisma CLI/engines for migrate)   #
###############################################################################

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies (cached unless the lockfile or manifest changes)
# ---------------------------------------------------------------------------
FROM base AS deps
# pnpm-workspace.yaml carries the build-script approvals (allowBuilds) needed to
# compile Prisma engines, @node-rs/argon2 and esbuild during install.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
# A dummy DATABASE_URL lets `next build` run without a live database.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN pnpm build

# ---------------------------------------------------------------------------
# Runner (production runtime)
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Built app + full node_modules (includes the generated Prisma client, the
# Prisma CLI + engines used to migrate/seed on startup, and @node-rs/argon2).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json /app/next.config.mjs /app/prisma.config.ts ./
COPY --chmod=755 docker/entrypoint.sh /app/docker/entrypoint.sh

# Writable uploads volume + prisma dir (for the migration shadow/engine).
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads /app/prisma /app/.next

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
