# DESIGN — X-hunter AI v1 Implementation

This document is the _as-built_ implementation design for v1. The aspirational
spec lives in `PLAN_V3_AI_WHITEHAT_SECURITY_WORKSPACE.md` and `ARCHITECTURE.md`;
this file documents what is actually shipped in this monorepo.

## 1. Runtime topology

```
┌──────────────┐         ┌──────────────┐
│   web (Next) │ ──HTTP──▶   api (Fastify) │
└──────────────┘         └──────┬───────┘
                                │ Prisma
                                ▼
                          ┌────────────┐
                          │ Postgres   │
                          └────────────┘
                                ▲
                                │ Prisma (workers)
                                │
                 ┌──────────────┴───────────────┐
                 │  BullMQ over Redis           │
                 │  - queue: scan               │
                 │  - queue: retest             │
                 └──────────────┬───────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ scan-orchestrator│
                       │  ├─ browser-inspector
                       │  ├─ zap-signal     (optional)
                       │  ├─ nuclei-signal  (optional)
                       │  ├─ openhack-hunter
                       │  ├─ strix-core      (LLM gateway)
                       │  └─ report
                       └─────────────────┘

                       ┌──────────────┐
                       │ retest-worker│
                       └──────────────┘
```

Web does not talk to Redis or Postgres directly — only the API does.
Workers and API share Prisma + the BullMQ connection.

## 2. Packages

| Package                    | What it owns                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@x-hunter/shared`         | `ScopeAuthorization`/`ScopeSnapshot` types, `normalizeUrl`, `assertInScope`, `assertNotReservedTarget`, evidence sanitizer (`sanitize`, `sanitizeText`, `sanitizeValue`), `encryptString`/`decryptString` (AES-256-GCM), `createLogger`, `GuardrailError`. |
| `@x-hunter/db`             | Prisma schema (Organization, User, Project, Domain, DomainVerification, ScanAuthorization, ScanJob, ScanStep, Finding, FindingCandidate, Report, ApprovalRequest, TestAccount, RetestRun, AuditLog), seed.                                                 |
| `@x-hunter/llm-gateway`    | Provider interface + OpenAI/Claude/DeepSeek adapters, alias → route map, per-package budgets, sanitizer, retry/fallback, structured logging. **No business code may import provider SDKs directly.**                                                       |
| `@x-hunter/worker-runtime` | `BaseWorker<I,O>` with timeout + retry + AbortSignal, BullMQ queue helpers (`getQueue`, `QUEUE_SCAN`, `QUEUE_RETEST`), Product Policy Gate (`decide`, `packageAllows`), audit-log helper.                                                                  |

## 3. Workers

All workers consume a `ScopeSnapshot` (frozen at scan creation), are wrapped by
`BaseWorker` for timeout/retry, and pass observations through `sanitizeValue`
before persisting.

### 3.1 scan-orchestrator

BullMQ `Worker` on `QUEUE_SCAN`. For each scan it creates a `ScanStep` row per
phase. Pipeline:

1. `browser-inspector` — required. Failure marks scan failed.
2. `zap-signal` — optional (skipped if `ZAP_BASE_URL` unset).
3. `nuclei-signal` — optional (skipped if `NUCLEI_BIN` not on PATH).
4. `openhack-hunter` — always when browser observation succeeded.
5. `strix-core` — only for `standard | auth | launch` packages.
6. `report` — always; produces `free_snapshot` (always) + `human` + `ai_dev`
   (light+).

After the pipeline, every `FindingCandidate` is persisted as both a
`Finding` row (the canonical one shown in the board) and a
`FindingCandidate` row (the pre-promotion record, for audit).

### 3.2 browser-inspector

Playwright Chromium. Records:

- routes visited (URL, method, status, content-type)
- API endpoints called (origin + path, with id-segment pattern collapsing)
- cookies (attributes only — values masked by sanitizer)
- localStorage / sessionStorage keys (`looksTokenLike` heuristic)
- console errors (sanitized, capped)
- policy blocks: any request to a host not in `allowedHosts` is `route.abort()`
  and recorded; same-host static assets (image/font/stylesheet/script/media)
  are allowed through but not followed as routes.

Redirects out of scope are caught via `assertInScope(res.url(), scope, { asRedirect: true })`.

### 3.3 zap-signal

Calls a ZAP daemon via REST:

- `core/action/accessUrl` for each seed
- `spider/action/scan` (passive crawl only)
- polls `spider/view/status` until 100%
- pulls `core/view/alerts`, re-checks scope per alert URL, maps risk → severity.

Active scan is **explicitly never invoked** in v1.

### 3.4 nuclei-signal

Spawns `nuclei -jsonl -silent -rl 20 -c 10 -timeout 10 -tags exposure,misconfig,tls,network-misconfig,http,edb-id -exclude-tags fuzz,intrusive,dos,brute-force`.

Returns TOOL_UNAVAILABLE if the binary cannot be invoked. Each JSONL line is
parsed, scope-checked, severity mapped.

### 3.5 openhack-hunter

Five rule-based hunters. Each returns `{ candidates, warnings, hardening, coverageGaps }`:

1. **vibe-code-exposure** — non-prod-looking hosts, sensitive paths (`/.env`, `/.git`, `/admin`, `/__debug__`, `/swagger`, `/openapi.json`), policy-related console errors.
2. **frontend-secret** — `localStorage`/`sessionStorage` keys matching risky names or containing token-shaped values.
3. **api-surface** — observed mutating endpoints (POST/PUT/PATCH/DELETE), with an id-pattern flag suggesting BOLA/IDOR review.
4. **auth-session** — session-like cookies missing `HttpOnly`/`Secure`/`SameSite=Lax|Strict`.
5. **ai-app-smoke** — direct LLM-provider calls from the browser, LLM-key-named cache entries.

Every candidate's `evidence.description` is re-sanitized before return.

### 3.6 strix-core

Strix builds a compact security context (already sanitized) and calls the LLM
Gateway with use case `strix_reasoning`. The system prompt forbids: scanning
out of scope, brute force/destructive fuzzing, requesting raw secrets. The
gateway-side budget guard prevents free/light packages from invoking Strix at
all (use-case not allowed).

Strix returns observations, additional findings, remediation, fix prompts, and
retest proposals. All strings are sanitized + length-bounded.

### 3.7 report

Three report kinds:

- **free_snapshot** — always. Lists every checked area, every coverage gap,
  every finding. If no critical/high is found, says explicitly: _"không phát hiện Critical/High đáng kể trong phạm vi đã quét"_.
- **human** — deterministic backbone; only the _Kết luận chung_ paragraph is
  optionally polished via LLM Gateway (`human_report`).
- **ai_dev** — machine-readable, includes per-finding details and Strix fix
  prompts.

### 3.8 retest-worker

BullMQ `Worker` on `QUEUE_RETEST`. Each `RetestRun` references a single
`Finding` and a frozen `ScopeSnapshot`. The worker:

1. Re-scope-checks the scenario URL.
2. Performs a smoke HTTP probe with redirect=manual.
3. Classifies result as `fixed | still_vulnerable | partially_fixed | cannot_verify`.
4. Records an `AuditLog` entry and (if applicable) updates the
   `Finding.status`.

A retest **never** re-runs the full scan.

## 4. API surface

All under `/v1`:

| Method/Path                                                          | Purpose                                       |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`       | JWT/session.                                  |
| `POST /projects`, `GET /projects`                                    | Project CRUD.                                 |
| `GET/POST /projects/:id/domains`                                     | List/add domains.                             |
| `POST /projects/:id/domains/:did/verifications`                      | Start a verification (dns_txt or well_known). |
| `POST /projects/:id/domains/:did/verifications/check`                | Check verification.                           |
| `GET/POST /projects/:id/authorizations`                              | List/create scan authorizations.              |
| `POST /projects/:id/test-accounts`                                   | Provision encrypted test account credentials. |
| `POST /projects/:id/scans` & `GET /v1/scans/:id`                     | Create + read scans.                          |
| `GET /v1/findings`, `GET /v1/findings/:id`, `PATCH /v1/findings/:id` | Finding board.                                |
| `POST /v1/findings/:id/retest`                                       | Trigger manual retest.                        |
| `GET /v1/scans/:id/reports`                                          | Pull persisted reports.                       |
| `POST /v1/approvals/:id/approve`, `/deny`                            | Sensitive-action approval flow.               |
| `GET /healthz`, `GET /readyz`                                        | Liveness/readiness.                           |

## 5. HTTP status mapping

| Status | Used for                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400    | INVALID_INPUT (schema/validation).                                                                                                                                 |
| 401    | NOT_AUTHENTICATED.                                                                                                                                                 |
| 403    | FORBIDDEN (not allowed for this org/project).                                                                                                                      |
| 404    | NOT_FOUND.                                                                                                                                                         |
| 409    | CONFLICT (e.g. domain already exists).                                                                                                                             |
| 422    | Guardrail violation: UNVERIFIED_DOMAIN, OUT_OF_SCOPE_HOST, REDIRECT_OUT_OF_SCOPE, RESERVED_TARGET, SENSITIVE_ACTION_NOT_APPROVED, PACKAGE_TIER_FORBIDS_CAPABILITY. |
| 429    | BUDGET_EXCEEDED.                                                                                                                                                   |
| 503    | TOOL_UNAVAILABLE.                                                                                                                                                  |
| 504    | TIMEOUT.                                                                                                                                                           |

## 6. Security testing checklist (v1)

- [x] Cannot scan unverified domain
- [x] Cannot scan private/local/metadata IP (`assertNotReservedTarget`)
- [x] Cannot follow out-of-scope redirect
- [x] Cookie / token / API-key patterns masked in evidence + prompts
- [x] AES-256-GCM encryption for test-account credentials
- [x] All workers have hard timeouts
- [x] All LLM calls go through Gateway
- [x] Per-scan LLM call/token budgets enforced per package tier
- [x] Free report is valuable even when no Critical/High is found
- [x] Retest stays inside its finding's scope
- [x] No raw response bodies persisted — only the sanitized summary
