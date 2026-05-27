SHELL := /bin/bash

COMPOSE_CORE := -f infra/docker-compose/core.yml
COMPOSE_FRONTEND := -f infra/docker-compose/frontend.yml
COMPOSE_BACKEND := -f infra/docker-compose/backend.yml
COMPOSE_WORKERS := -f infra/docker-compose/workers.yml
COMPOSE_INTEGRATIONS := -f infra/docker-compose/integrations.yml

TS_SERVICES := frontend gateway/public-api gateway/internal-api backend/control-plane backend/findings backend/reporting shared/db shared/event-core shared/security-core shared/llm-gateway-core shared/queue-core contracts/generated/ts
BACKEND ?= public-api
WORKER ?= orchestrator
INTEGRATION ?= zaproxy

.PHONY: help install typecheck test build db-generate db-migrate db-seed \
	up-core down-core up-frontend up-backend up-workers up-integrations up-full down-full \
	up-service dev-service up-worker dev-worker up-integration dev-integration \
	check-integrations dev-frontend dev-public-api dev-stack go-build

help:
	@echo "OpenHunterAI"
	@echo "  make install                         Install dependencies inside each TS service"
	@echo "  make up-full                         Start core + frontend + backend + workers + integrations"
	@echo "  make down-full                       Stop all docker compose services"
	@echo "  make dev-frontend                    Run frontend locally"
	@echo "  make dev-public-api                  Run public API locally"
	@echo "  make up-service BACKEND=public-api   Start one backend/gateway service"
	@echo "  make dev-service BACKEND=public-api  Run one TS service locally"
	@echo "  make up-worker WORKER=orchestrator   Start one Go worker container"
	@echo "  make dev-worker WORKER=orchestrator  Run one Go worker locally"
	@echo "  make up-integration INTEGRATION=zaproxy"
	@echo "  make dev-integration INTEGRATION=nuclei"
	@echo "  make check-integrations              Health check all integration adapters"

install:
	for d in $(TS_SERVICES); do (cd $$d && pnpm install); done

typecheck:
	for d in $(TS_SERVICES); do (cd $$d && pnpm run typecheck); done

test:
	for d in $(TS_SERVICES); do (cd $$d && pnpm run test); done

build:
	for d in $(TS_SERVICES); do (cd $$d && pnpm run build); done

db-generate:
	cd shared/db && pnpm run generate

db-migrate:
	cd shared/db && pnpm run migrate

db-seed:
	cd shared/db && pnpm run seed

up-core:
	docker compose $(COMPOSE_CORE) up -d

down-core:
	docker compose $(COMPOSE_CORE) down

up-frontend:
	docker compose $(COMPOSE_FRONTEND) up -d frontend

up-backend:
	docker compose $(COMPOSE_CORE) $(COMPOSE_BACKEND) up -d

up-workers:
	docker compose $(COMPOSE_CORE) $(COMPOSE_WORKERS) up -d

up-integrations:
	docker compose $(COMPOSE_INTEGRATIONS) up -d

up-full:
	docker compose $(COMPOSE_CORE) $(COMPOSE_FRONTEND) $(COMPOSE_BACKEND) $(COMPOSE_WORKERS) $(COMPOSE_INTEGRATIONS) up -d

down-full:
	docker compose $(COMPOSE_CORE) $(COMPOSE_FRONTEND) $(COMPOSE_BACKEND) $(COMPOSE_WORKERS) $(COMPOSE_INTEGRATIONS) down

up-service:
	docker compose $(COMPOSE_CORE) $(COMPOSE_BACKEND) up -d $(BACKEND)

dev-service:
	@if [ "$(BACKEND)" = "public-api" ] || [ "$(BACKEND)" = "internal-api" ]; then \
		cd gateway/$(BACKEND) && pnpm run dev; \
	else \
		cd backend/$(BACKEND) && pnpm run dev; \
	fi

up-worker:
	docker compose $(COMPOSE_CORE) $(COMPOSE_WORKERS) up -d $(WORKER)

dev-worker:
	cd workers/$(WORKER) && go run ./cmd/$(WORKER)

up-integration:
	@if [ "$(INTEGRATION)" = "zaproxy" ]; then \
		docker compose $(COMPOSE_INTEGRATIONS) up -d zap zaproxy-adapter; \
	else \
		docker compose $(COMPOSE_INTEGRATIONS) up -d $(INTEGRATION)-adapter; \
	fi

dev-integration:
	cd integrations/$(INTEGRATION) && go run ./cmd/$(INTEGRATION)

check-integrations:
	ops/scripts/check-integrations.sh

dev-frontend:
	cd frontend && pnpm run dev

dev-public-api:
	cd gateway/public-api && pnpm run dev

dev-stack:
	ops/scripts/dev-stack.sh

go-build:
	go work sync
	for d in workers/* integrations/*; do (cd $$d && go build ./...); done
