# PRODUCTION_READINESS.md - OpenHunterAI

> Engineering and operations blockers before production rollout.

---

# 1. Canonical Contract

- [ ] Docs and code use public packages: `Free Hunter`, `AI Black-hat Mindset Check`, `Monitor Workspace`, `Enterprise / PAYG`.
- [ ] Legacy authenticated package/mode is removed; authenticated behavior is `authScope`.
- [ ] Free Hunter quotas are enforced: one returned finding, one monitored finding, one retest, 7-day cooldown.
- [ ] Target Type + Surface Flags + Test Intensity Mode drive deterministic Scan Plan.
- [ ] No profiler worker.
- [ ] No external artifact storage in core v1 docs/env/code path.

---

# 2. Security Blockers

- [ ] Domain verification required before scan authorization.
- [ ] Private/local/metadata target blocking is tested.
- [ ] Redirect out of scope is blocked and audited.
- [ ] Aggressive Staging requires staging/dev/test risk acceptance.
- [ ] Raw password/token/cookie/API key/HAR/request/response never appears in DB, logs, prompts, reports, or storage.
- [ ] Sensitive actions require User Approval Gate.
- [ ] Production path cannot return mock scan results.

---

# 3. Workers And Integrations

- [ ] Per-family images exist for web, API, orchestrator, browser, ZAP, Nuclei, OpenHack, Strix, report, retest.
- [ ] Integration adapter images expose health checks and stable ports.
- [ ] ZAP is pinned/restricted and passive/baseline by default.
- [ ] Nuclei image uses pinned binary + internal curated templates only.
- [ ] Playwright/browser worker has isolation, low concurrency, hard timeout, egress/scope guardrails.
- [ ] Tool unavailable becomes skipped/coverage gap, not fake success.

---

# 4. LLM Gateway

- [ ] Business logic uses only `low_reasoning_model` / `high_reasoning_model`.
- [ ] Provider/model mapping is config behind LLM Gateway.
- [ ] Prompt sanitizer runs before provider adapters.
- [ ] Budget/timeout/retry/fallback are tested.

---

# 5. Deliberately Not V1

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
