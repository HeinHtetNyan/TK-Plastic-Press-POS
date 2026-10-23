#!/usr/bin/env bash
set -euo pipefail

cd /home/appbox/TK-Plastic-Press-POS

echo "==> Syncing to latest main"
git fetch origin main
git reset --hard origin/main

echo "==> Building the new backend image"
docker compose -f docker-compose.prod.yml build backend

# Migrate BEFORE the new code starts. Migrations only add things, so the old backend that is
# still running keeps working while the new column appears. Running them after the restart left
# a gap where the new code hit a missing column and returned errors. If this step fails the
# script stops here and the old backend keeps running untouched.
echo "==> Running database migrations (before restart)"
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backend alembic upgrade head

echo "==> Rebuilding and restarting changed containers"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Waiting for backend to be healthy"
for i in $(seq 1 30); do
  status=$(docker inspect plastic_press_backend --format '{{.State.Health.Status}}' 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 2
done

echo "==> Confirming database migrations (already applied above; does nothing if so)"
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo "==> Deploy complete"
docker compose -f docker-compose.prod.yml ps
