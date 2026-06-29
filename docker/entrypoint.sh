#!/bin/sh
set -e

echo "▸ Evenly entrypoint starting…"

# ---------------------------------------------------------------------------
# Apply database migrations. Prisma retries the DB connection internally, and
# the compose healthcheck already gates the app on a ready database.
# ---------------------------------------------------------------------------
echo "▸ Applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy

# ---------------------------------------------------------------------------
# Seed demo data (idempotent — safe to run on every boot). Disable: RUN_SEED=false
# ---------------------------------------------------------------------------
if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "▸ Seeding demo data…"
  node prisma/seed.mjs || echo "⚠ Seed skipped/failed (continuing)."
else
  echo "▸ RUN_SEED=false — skipping seed."
fi

echo "▸ Starting Evenly on :${PORT:-3000} …"
exec "$@"
