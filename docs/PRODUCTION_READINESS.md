# OpenHunterAI - Production Readiness Checklist (v1)

> Scope: engineering and operations gaps that must be resolved before production rollout. Missing real secret values are deployment configuration, not engineering work.

---

# 1. Canonical docs and product contract

- [ ] **Docs package model sync.** All canonical docs must use:
  Free Hunter,
  AI Black-hat Mindset Check,
  Monitor Workspace,
  Enterprise / PAYG.
  Authenticated Scope must be described as a mode, not a public package.
  Readiness Report View/Export must be described as report/export mode, not a scan package.
- [ ] **No stale package tiers.** Public docs must not keep old package tier names as v1 package names.
- [ ] **Positioning sync.** Public positioning must be `Authorized Attacker-Mindset Security Workspace`, not an uncontrolled black-hat tool.
- [ ] **Evidence policy sync.** Docs and implementation must agree: no raw evidence persistence; only sanitized reports/findings/summaries.
- [ ] **Adversarial action model.** Product, security, worker, and acceptance docs must all reference gated validation and forbidden actions.

---

# 2. Application / API

- [ ] **JWT secret validation.** API must refuse to boot in production if `APP_JWT_SECRET` is unset or dev-only.
- [ ] **Session cookie hardening.** Use secure cookies in production, `__Host-` prefix where topology allows, and strict SameSite policy for dashboard sessions.
- [ ] **CSRF protection.** Add CSRF protection or require explicit same-origin/write headers for cookie-authenticated POST/PATCH/DELETE.
- [ ] **Route-specific rate limits.** Tighten `/v1/auth/signin`, `/v1/auth/signup`, domain verification, scan creation, and approval endpoints.
- [ ] **Input validation errors.** Translate Zod/input validation failures to 400, not generic 500.
- [ ] **Request correlation.** Return `request_id` on server errors and include it in logs.
- [ ] **Health checks.** `/v1/health` must check Postgres and Redis. Tool health must expose ZAP/Nuclei/browser readiness separately.
- [ ] **CORS restriction.** Production CORS must allow only configured web origin(s).

---

# 3. Database and storage

- [ ] **Migration discipline.** Production uses `prisma migrate deploy`, never `db push`.
- [ ] **Connection pooling.** Multiple API/worker containers require PgBouncer or managed pooling.
- [ ] **Backups.** Define daily logical backups and retention; prefer PITR if hosting supports it.
- [ ] **Seed data guard.** `pnpm db:seed` must refuse to run in production.
- [ ] **No raw evidence persistence.** DB/object storage must not store raw request/response, raw HAR, raw cookie jar, raw token, raw credential, or unsanitized private data.
- [ ] **Object storage policy.** Store only sanitized screenshots, sanitized report exports, and sanitized evidence summaries.

---

# 4. Workers / queues / scan orchestration

- [ ] **Per-family worker topology.** Production must run separate containers/processes for orchestrator, browser, ZAP, Nuclei, OpenHack, Strix, report, and retest workers.
- [ ] **Phase fan-out/fan-in.** Orchestrator should coordinate phases and step queues, not run the whole pipeline as one long sequential process.
- [ ] **Idempotent scan steps.** Retried jobs must not duplicate already-succeeded steps/findings.
- [ ] **Stuck job recovery.** Add timeout/reconciler behavior for steps left running after worker crash.
- [ ] **Tool availability surface.** UI/API should expose ZAP/Nuclei/browser availability before users start scans.
- [ ] **Coverage gaps.** Tool unavailable/failure must become an explicit coverage gap, not fake success.
- [ ] **Queue observability.** Track queue depth, active jobs, failed jobs, retry counts, and scan step duration.

---

# 5. Tool packaging

- [ ] **Per-family Docker images.** Build tagged images for `web`, `api`, `orchestrator`, `browser-worker`, `zap-worker`, `nuclei-worker`, `openhack-worker`, `strix-worker`, `report-worker`, and `retest-worker`.
- [ ] **Playwright isolation.** Browser worker must run with non-root user where possible, sandbox/seccomp guidance, low concurrency, hard timeout, and egress/scope guardrails.
- [ ] **Nuclei packaging.** Nuclei worker image must include pinned nuclei binary and internal curated templates only, not unreviewed full template execution by default.
- [ ] **ZAP daemon packaging.** ZAP must run as pinned image/service with API key, restricted network access, health check, and passive/baseline-only configuration by default.
- [ ] **Image rollback.** Docker VPS deploy must use immutable tags or digests and documented rollback to prior tag.

---

# 6. Web / dashboard

- [ ] **Production routing decision.** Choose same-host reverse proxy or cross-origin API with strict CORS/cookie domain. Document it.
- [ ] **Internal navigation.** Replace internal `<a href>` full reloads with framework routing where appropriate.
- [ ] **Accessibility sweep.** Add labels/aria for controls and CI linting where practical.
- [ ] **Report export UX.** Readiness Report View/Export must clearly state it is an export mode, not a new scan.
- [ ] **Free UX boundary.** Free shows first valuable finding report, 1 monitored finding slot, and 1 retest limit. It must not expose full paid finding board/workspace.

---

# 7. Security guardrails

- [ ] **Private/local blocking tests.** Cannot scan private/local/metadata targets.
- [ ] **Redirect guardrail tests.** Redirect outside allowed scope is blocked and audited.
- [ ] **Secret redaction tests.** Raw password/token/cookie/API key never appears in logs, prompts, reports, or storage.
- [ ] **Approval gate tests.** Sensitive validation actions cannot run without approval.
- [ ] **Retest scope tests.** Retest cannot run outside finding scope and cannot become full-app scan.
- [ ] **Mock production block.** Production path cannot return mock scan results.
- [ ] **Forbidden adversarial actions.** Out-of-scope, destructive, credential attack, persistence, evasion, malware, and exfiltration paths must be blocked.

---

# 8. LLM gateway

- [ ] **Provider SDK boundary.** Business logic/workers call only the LLM Gateway.
- [ ] **Package/use-case routing.** Free Hunter, AI Black-hat Mindset Check, Authenticated Scope, Monitor Workspace, and Enterprise/PAYG use-case allowances are enforced.
- [ ] **DeepSeek Flash/Pro routing.** Flash is used for triage/ranking; Pro is used for reasoning supervisor, report, fix prompt and retest reasoning.
- [ ] **Optional escalation providers are disabled by default and only enabled for Enterprise/PAYG.**
- [ ] **Strix 2-pass support.** AI Black-hat/Auth support hypothesis and validation reasoning use cases.
- [ ] **Budget enforcement.** Token/call budgets stop extra calls and report budget-limited coverage when needed.
- [ ] **Timeout/retry/fallback.** Provider failures degrade gracefully and never fake output.
- [ ] **Prompt sanitizer.** Raw credential/raw evidence never reaches provider adapters.

---

# 9. Observability and ops

- [ ] **Structured logs to aggregator.** Ship JSON logs to a central sink.
- [ ] **Metrics.** At minimum: `http_requests_total`, `scan_jobs_started_total`, `scan_step_duration_seconds`, `queue_depth`, `llm_tokens_used_total`, `tool_unavailable_total`.
- [ ] **Alerting.** Define SLOs for API p95, worker failure rate, queue backlog, and scan timeout rate.
- [ ] **Runbook.** Document deploy, rollback, worker drain, secret rotation, stuck job recovery, and ZAP/Nuclei/browser health triage.

---

# 10. Build and release

- [ ] **CI build.** CI must run `pnpm build` in addition to typecheck/test/format/lint.
- [ ] **Image scan.** Production images should pass baseline image scan and run as non-root where feasible.
- [ ] **Release versioning.** Pick release tags such as `1.0.0-beta.N` or git-sha image tags before rollout.
- [ ] **Docker VPS deployment.** Document `docker compose pull`, migrations, `up -d`, health checks, and rollback.

---

# 11. Deliberately not v1

```text
- CI/CD-based automated retesting
- GitHub code scanning
- Jira/Linear integration
- VPS/cloud/private network scan
- server agent
- mobile/APK audit
- Kubernetes/secureCodeBox orchestration
- full DefectDojo integration
- SSO/SAML/OIDC enterprise login
```
