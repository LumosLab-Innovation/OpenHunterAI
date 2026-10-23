# PRODUCTION_READINESS.md - OpenHunterAI

> Engineering and operations blockers before production rollout.

---

# 1. Canonical Contract

- [ ] CLI/dashboard/API use one `scan_request_v2` contract with Quick, Standard and Deep profiles.
- [ ] Billing/entitlement schema and all finding/retest/cooldown quotas are absent from runtime.
- [ ] Target Type + Surface Flags + Test Intensity Mode drive deterministic Scan Plan.
- [ ] `report_v2` structured JSON is the canonical report contract; legacy claims are `legacy_unverified`.
- [ ] No profiler worker.
- [ ] No external artifact storage in core v1 docs/env/code path.

---

# 2. Security Blockers

- [ ] Scan authorization requires explicit authority confirmation and a public-host scope; DNS proof is optional in self-host.
- [ ] Private/local/metadata target blocking is tested.
- [ ] Redirect out of scope is blocked and audited.
- [ ] Aggressive Staging requires staging/dev/test risk acceptance.
- [ ] Raw password/token/cookie/API key/HAR/request/response never appears in DB, logs, prompts, reports, or storage.
- [ ] Sensitive actions require User Approval Gate.
- [ ] Production path cannot return mock scan results.
- [ ] Review/remediate frontend lockfile advisories before release. On 2026-09-20,
  `npm audit --omit=dev` reported 4 high and 4 moderate entries (including
  build-tool packages listed as dependencies); impact on shipped static assets
  has not been established.

---

# 3. Workers And Integrations

- [ ] Per-family images exist for web, API, orchestrator, browser, ZAP, Nuclei, built-in passive surface, Strix, report, retest.
- [ ] Integration adapter images expose health checks and stable ports.
- [x] ZAP is pinned/restricted and passive/baseline by default.
- [x] Nuclei image uses pinned binary + internal curated templates only.
- [ ] Playwright/browser worker has isolation, low concurrency, hard timeout, egress/scope guardrails.
- [x] Tool unavailable becomes skipped/coverage gap, not fake success.
- [x] Worker callbacks are idempotent by run id for steps, candidates, and activity events.
- [x] Worker claims require a separate independent triage decision before promotion.
- [ ] Independent replay verifies that referenced baseline/exploit exchanges exist and still demonstrate impact. Until this exists, metadata-only triage records `needs_more_evidence` and does not promote worker candidates.
- [ ] The compose Local E2E canary passes report and retest gates on a Docker-capable host.

---

# 4. LLM Gateway

- [ ] Business logic uses only `low_reasoning_model` / `high_reasoning_model`.
- [ ] Provider/model mapping is config behind LLM Gateway.
- [ ] Prompt sanitizer runs before provider adapters.
- [ ] Budget/timeout/retry/fallback are tested.

---

# 5. Reporting And Export

- [ ] Report draft SSE is org-scoped, authenticated, and does not leak cross-tenant updates.
- [ ] Report content is sanitized before DB insert and before HTML/PDF export.
- [ ] HTML/PDF export is generated on demand and does not persist files.
- [ ] LLM ranking is recommendation-only and cannot create findings or override policy.

---

# 6. Deliberately Not V1

```text
CI/CD-based automated retesting
deployment-triggered retest
GitHub code scanning
Jira/Linear integration
VPS/cloud/private network scan
server agent
mobile/APK audit
SAST/SCA/secrets scanning
Kubernetes/secureCodeBox orchestration
full DefectDojo integration
```
