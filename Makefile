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
	check-integrations dev-frontend dev-public-api dev-stack go-build \
	app app-down app-worker app-integration dev dev-down logs

help:
	@echo "OpenHunterAI - quick commands"
	@echo "  make app                              Start core + frontend + public-api (default dev stack)"
	@echo "  make app-worker WORKER=orchestrator   Start app + one worker"
	@echo "  make app-integration INTEGRATION=zaproxy  Start app + one integration"
	@echo "  make app-down                         Stop app stack (core+frontend+backend)"
	@echo "  make dev                              Run frontend + public-api locally in one command"
	@echo "  make dev-down                         Stop local dev processes from 'make dev'"
	@echo "  make logs                             Tail logs for frontend + backend + core"
	@echo ""
	@echo "OpenHunterAI - detailed commands"
	@echo "  make up-core | down-core"
	@echo "  make up-frontend | up-backend | up-workers | up-integrations | up-full | down-full"
	@echo "  make up-service BACKEND=public-api | dev-service BACKEND=public-api"
	@echo "  make up-worker WORKER=orchestrator | dev-worker WORKER=orchestrator"
	@echo "  make up-integration INTEGRATION=zaproxy | dev-integration INTEGRATION=nuclei"
	@echo "  make install | typecheck | test | build | db-generate | db-migrate | db-seed | go-build"

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

# --- high-level convenience targets ---
app:
	docker compose $(COMPOSE_CORE) $(COMPOSE_FRONTEND) $(COMPOSE_BACKEND) up -d

app-down:
	docker compose $(COMPOSE_CORE) $(COMPOSE_FRONTEND) $(COMPOSE_BACKEND) down

app-worker: app
	$(MAKE) up-worker WORKER=$(WORKER)

app-integration: app
	$(MAKE) up-integration INTEGRATION=$(INTEGRATION)

logs:
	docker compose $(COMPOSE_CORE) $(COMPOSE_FRONTEND) $(COMPOSE_BACKEND) logs -f --tail=150

DEV_PID_DIR := /tmp/openhunter-dev
DEV_PUBLIC_API_PID := $(DEV_PID_DIR)/public-api.pid
DEV_FRONTEND_PID := $(DEV_PID_DIR)/frontend.pid

dev:
	@mkdir -p $(DEV_PID_DIR)
	@echo "Starting local dev: public-api + frontend"
	@cd gateway/public-api && nohup pnpm run dev > /tmp/openhunter-public-api.log 2>&1 & echo $$! > $(DEV_PUBLIC_API_PID)
	@cd frontend && nohup pnpm run dev > /tmp/openhunter-frontend.log 2>&1 & echo $$! > $(DEV_FRONTEND_PID)
	@echo "public-api log: /tmp/openhunter-public-api.log"
	@echo "frontend log:   /tmp/openhunter-frontend.log"
	@echo "Use 'make dev-down' to stop."

dev-down:
	@set -e; \
	if [ -f $(DEV_PUBLIC_API_PID) ]; then kill "$$(cat $(DEV_PUBLIC_API_PID))" 2>/dev/null || true; rm -f $(DEV_PUBLIC_API_PID); fi; \
	if [ -f $(DEV_FRONTEND_PID) ]; then kill "$$(cat $(DEV_FRONTEND_PID))" 2>/dev/null || true; rm -f $(DEV_FRONTEND_PID); fi; \
	echo "Local dev processes stopped."
