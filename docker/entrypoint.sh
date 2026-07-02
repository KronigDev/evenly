#!/bin/sh
set -e

echo "▸ Evenly entrypoint starting…"

# ---------------------------------------------------------------------------
# Apply database migrations. Prisma retries the DB connection internally, and
# the compose healthcheck already gates the app on a ready database.
# ---------------------------------------------------------------------------
echo "▸ Applying database migrations…"
node node_modules/prisma/build/index.js migrate deploy

echo "▸ Starting Evenly on :${PORT:-3000} …"
exec "$@"
