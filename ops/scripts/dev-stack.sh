#!/usr/bin/env sh
set -eu

docker compose -f infra/docker-compose/core.yml up -d
docker compose -f infra/docker-compose/integrations.yml up -d

echo "Core and integrations are starting."
echo "Run frontend/API in separate terminals:"
echo "  make dev-frontend"
echo "  make dev-public-api"
