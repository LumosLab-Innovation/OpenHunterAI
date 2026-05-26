# OpenHunterAI — White-hat Security Workspace

End-to-end **authorized** security testing workspace for web/app targets.

> **Rule zero.** OpenHunterAI only scans domains the operator has proven ownership of.
> No scanning without verified domain authorization. No scanning private/local IP. No raw secrets in logs, prompts, or reports.

See the long-form specs in [`docs/`](./docs):

- [`docs/PLAN_V3_AI_WHITEHAT_SECURITY_WORKSPACE.md`](./docs/PLAN_V3_AI_WHITEHAT_SECURITY_WORKSPACE.md) — the master plan.
- [`docs/PRD.md`](./docs/PRD.md) — product requirements.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system architecture.
- [`docs/SECURITY_GUARDRAILS.md`](./docs/SECURITY_GUARDRAILS.md) — non-negotiable rules.
- [`docs/WORKER_SPEC.md`](./docs/WORKER_SPEC.md) — worker contracts.
- [`docs/LLM_PROVIDER_SPEC.md`](./docs/LLM_PROVIDER_SPEC.md) — LLM gateway contract.
- [`docs/ACCEPTANCE_CRITERIA.md`](./docs/ACCEPTANCE_CRITERIA.md) — must-pass criteria.
- [`docs/DESIGN.md`](./docs/DESIGN.md) — v1 implementation design (this monorepo).
- [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md) — remaining work to be production-ready.
- [`AGENTS.md`](./AGENTS.md) — operator/agent rules (kept at root).

---

## Monorepo layout

```
X-hunterAI/
├── apps/
│   ├── api/                 Fastify REST API (auth, projects, domains, verify,
│   │                        authorizations, scans, findings, retest, reports,
│   │                        approvals, health).
│   └── web/                 Next.js dashboard (projects → verify → scan
│                            → findings → retest).
├── workers/
│   ├── scan-orchestrator/   BullMQ entry point. Runs the full pipeline:
│   │                        browser-inspector → zap → nuclei → openhack →
│   │                        strix (standard+) → report.
│   ├── browser-inspector/   Playwright crawl + scope-aware route blocking.
│   ├── zap-signal/          ZAP daemon REST client (passive/baseline only).
│   ├── nuclei-signal/       Nuclei CLI wrapper, safe tag profile.
│   ├── openhack-hunter/     5 rule-based mini hunters.
│   ├── strix-core/          LLM-driven attacker-mindset reasoning.
│   ├── report/              Free snapshot + human + AI/dev reports.
│   └── retest/              Manual single-finding retest.
├── packages/
│   ├── shared/              Types, URL normalization, scope check, evidence
│   │                        sanitizer, AES-256-GCM crypto, logger.
│   ├── db/                  Prisma schema + seed.
│   ├── llm-gateway/         OpenAI / Claude / DeepSeek providers + budget +
│   │                        sanitizer + fallback. Single entrypoint for LLM.
│   └── worker-runtime/      BaseWorker (timeout/retry/logs), Policy Gate,
│                            BullMQ queue helpers.
├── infra/
│   ├── docker/              Dockerfile.{api,web,worker}
│   └── docker-compose.yml   Local stack (postgres, redis, optional zap/minio).
├── .github/workflows/ci.yml CI: typecheck + test + format.
└── third_party_research/    Reference repos (ZAP, Nuclei, Playwright, Strix,
                             OpenHack). Not imported as source dependencies —
                             X-hunter integrates via CLI / REST / SDK only.
```

## Local development

Requirements:

- Node v22 (`.nvmrc`)
- pnpm 9 (`packageManager` is pinned)
- Docker (for postgres/redis)

```bash
# 1. Boot the local stack
docker compose -f infra/docker-compose.yml up -d postgres redis

# 2. Install deps + generate Prisma client
pnpm install
pnpm db:generate

# 3. Migrate + seed
cp .env.example .env
# edit DATABASE_URL, REDIS_URL, APP_JWT_SECRET, APP_ENCRYPTION_KEY, LLM keys, ...
pnpm db:migrate
pnpm db:seed

# 4. Run the API and web in two shells
pnpm dev:api          # http://localhost:4000 (API_PORT)
pnpm dev:web          # http://localhost:3001
#
# The web dev server proxies /api/* to API_BASE_URL (defaults to
# http://localhost:4000). If you change API_PORT, update API_BASE_URL too.

# 5. (Optional) Run the scan orchestrator worker in a third shell
pnpm --filter @x-hunter/scan-orchestrator run dev
```

### Required env vars

See [`.env.example`](./.env.example). The most important ones:

| Var                  | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | Postgres connection string.                                   |
| `REDIS_URL`          | Redis URL for BullMQ.                                         |
| `APP_JWT_SECRET`     | HMAC secret for API JWT (used for session cookies).           |
| `APP_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM (test account credentials).   |
| `OPENAI_API_KEY` …   | Optional LLM keys. Gateway routes by use-case + falls back.   |
| `ZAP_BASE_URL`       | Optional. If unset, ZAP step is `skipped` (TOOL_UNAVAILABLE). |
| `NUCLEI_BIN`         | Optional. If unset, Nuclei step is `skipped`.                 |

### Tests

```bash
pnpm typecheck   # tsc --noEmit on every package
pnpm test        # vitest for shared / llm-gateway / worker-runtime / openhack-hunter / api
pnpm format:check
```

## Operating principles

1. **Scope is a frozen snapshot.** Every scan job captures `ScopeSnapshot` at creation time and uses that snapshot for all subsequent worker calls and retests. Operators changing the underlying authorization does NOT change the scope of an in-flight scan.
2. **The Product Policy Gate gates every action.** Workers do not call URLs directly — they call `decide(input)` first. Out-of-scope, redirect-out-of-scope, sensitive-action-without-approval, package-tier-exceeded → all denied.
3. **The evidence sanitizer is conservative.** It over-masks before letting anything reach the report writer, the LLM, or the UI. Cookie values, headers in the sensitive set, JWT-shaped strings, common API-key prefixes (`sk-`, `ghp_`, `AKIA`, `AIza`), emails, and long hex/base64 blobs are masked.
4. **LLM calls go through the Gateway only.** No provider SDK call lives outside `packages/llm-gateway`. The Gateway enforces per-scan budgets, use-case allowances, sanitization, and primary/fallback routing.
5. **Workers can fail loudly.** Every worker has a hard timeout. A timeout is an error — never a silent hang.
6. **Tools that are unavailable mean the step is `skipped`.** The Free report must still be valuable even when ZAP/Nuclei aren't running; the report explicitly lists coverage gaps.

## What is **not** in v1

- CI/CD auto-retest, GitHub code scanning, Jira integration, VPS agent.
- Mobile/APK audit, Kubernetes orchestration, full DefectDojo integration.
- Multi-tenant enterprise admin features beyond a single organization seed.

See `AGENTS.md` §2 for the v1 scope contract.
