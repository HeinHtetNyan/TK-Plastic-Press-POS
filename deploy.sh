#!/usr/bin/env bash
set -euo pipefail

cd /home/appbox/TK-Plastic-Press-POS

echo "==> Syncing to latest main"
git fetch origin main
git reset --hard origin/main

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

echo "==> Running database migrations"
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

echo "==> Deploy complete"
docker compose -f docker-compose.prod.yml ps
