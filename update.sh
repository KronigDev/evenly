#!/usr/bin/env bash
# ============================================================================
#  Evenly - manual update
#  Pulls the latest code and rebuilds the production stack. Database migrations
#  run automatically on container start (prisma migrate deploy).
#  (The same thing the self-hosted Auto-Deploy runner does on every push to main.)
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Updating Evenly"
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
echo "==> Done. Evenly is up to date."
