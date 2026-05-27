# OpenHunterAI

Microservice-oriented white-hat security workspace. The runtime is split into
frontend, gateways, backend services, Go workers, and Go integration adapters.

`third_party_research/` is reference material only. It is not imported or used as
runtime code.

## Structure

```txt
frontend/                  Vite + React dashboard
gateway/public-api/        Express public API, auth, public /v1/* routes
gateway/internal-api/      Private API for worker/service callbacks
backend/control-plane/     Projects, domains, authorizations, scan lifecycle
backend/findings/          Findings and retest domain service
backend/reporting/         Report domain service
workers/*                  Go worker services
integrations/*             Go adapters + Docker runtime per tool
shared/*                   Shared TS packages: db, events, security, llm, queue
contracts/                 OpenAPI, AsyncAPI, JSON Schema, generated types
infra/docker-compose/      Compose files split by runtime layer
infra/env/                 Core infra env examples
ops/scripts/               Local dev scripts
third_party_research/      Reference repos only
```

Root files are only repo-level controls: `README.md`, `Makefile`, and `go.work`.
Each TypeScript service owns its own `package.json`, `tsconfig.json`, dependencies,
and env example under `*/env/*.env.example` or `integrations/*/runtime/.env.example`.

## Install

```bash
make install
```

Generate Prisma client and prepare DB:

```bash
make up-core
make db-generate
make db-migrate
make db-seed
```

## Run For Dev

Run the full Docker stack:

```bash
make up-full
```

Run frontend and public API locally:

```bash
make dev-frontend      # http://localhost:3001
make dev-public-api    # http://localhost:4000
```

Run one backend/gateway service:

```bash
make up-service BACKEND=public-api
make up-service BACKEND=internal-api
make up-service BACKEND=control-plane
make up-service BACKEND=findings
make up-service BACKEND=reporting

make dev-service BACKEND=public-api
```

Run one worker:

```bash
make up-worker WORKER=orchestrator
make up-worker WORKER=nuclei-signal

make dev-worker WORKER=zap-signal
```

Run one integration:

```bash
make up-integration INTEGRATION=zaproxy
make up-integration INTEGRATION=nuclei
make up-integration INTEGRATION=openhack
make up-integration INTEGRATION=strix
make up-integration INTEGRATION=playwright

make dev-integration INTEGRATION=nuclei
make check-integrations
```

## Env Files

Examples are split by owner:

```txt
infra/env/core.env.example
frontend/env/frontend.env.example
gateway/public-api/env/public-api.env.example
gateway/internal-api/env/internal-api.env.example
backend/*/env/*.env.example
workers/*/env/*.env.example
integrations/*/runtime/.env.example
shared/db/env/db.env.example
shared/llm-gateway-core/env/llm.env.example
```

## Current Runtime Flow

Frontend calls `gateway/public-api`. The public API writes business state and
publishes NATS events. Go workers consume events, call integration adapters, and
report status through `gateway/internal-api`. Integrations own Docker-first
runtimes for ZAP, Nuclei, OpenHack, Strix, and Playwright MCP/fallback.
