#!/usr/bin/env sh
set -eu

docker compose -f infra/docker-compose/docker-compose.core.yml up -d
docker compose -f infra/docker-compose/docker-compose.core.yml up -d zap zaproxy-adapter nuclei-adapter openhack-adapter strix-adapter playwright-adapter

echo "Core and integrations are starting."
echo "Run frontend/API in separate terminals:"
echo "  make dev-frontend"
echo "  make dev-public-api"
