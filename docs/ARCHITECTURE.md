# ARCHITECTURE.md - OpenHunterAI

> V1 architecture for an **Authorized Attacker-Mindset Security Workspace**. Only verified public web/app targets are in scope.

---

# 1. High-Level Flow

```text
web dashboard
→ public API
→ Postgres + NATS/queue
→ scan orchestrator
→ deterministic Scan Plan
→ worker families / integration adapters
→ LLM Gateway
→ sanitized findings/reports in Postgres
→ manual retest / Monitor Workspace
```

Core v1 stores sanitized reports/findings in Postgres. External artifact storage is not a core v1 dependency. DOCX/CSV/JSON/HTML/PDF exports are rendered on demand from sanitized report JSON and are not stored as files. Downloads require an org-scoped final or superseded snapshot. JSON includes the canonical snapshot and, when requested, a separate latest-status overlay. CSV is a flat findings/coverage summary, not a lossless replacement for JSON.

Reports use `report_v1` structured JSON snapshots in Postgres. Draft report sections stream to the UI through SSE while a scan runs.

---

# 2. Product Model In Architecture

Public packages:

```text
free_hunter
ai_blackhat_mindset_check
monitor_workspace
enterprise_payg
```

Scan modes:

```text
free_hunter
ai_blackhat_mindset_check
```

Auth Scope is stored as:

```text
none
one_account
two_accounts
```

Authenticated Scope is a scope/mode inside AI Black-hat Mindset Check or Enterprise / PAYG, not a public package.

---

# 3. Scan Plan Builder

The orchestrator builds a deterministic Scan Plan from:

```text
packageTier
scanMode
targetType
surfaceFlags
authScope
testIntensityMode
allowedHosts/paths
policy gates
budget/quota
```

Output:

```text
enabledWorkers
enabledHunters
skippedHunters with reason
allowedValidationLevel
budgets
requiresApprovalForSensitiveActions
notes / coverage expectations
```

There is no profiler worker. LLM does not select Target Type or worker set.

---

# 4. Worker / Integration Runtime Boundary

Workers and adapters are internal. Public package names are never worker names.

```text
browser-worker
zap-worker
nuclei-worker
openhack-worker
strix-worker
recon-worker
report-worker
retest-worker
```

Integration runtimes are packaged behind adapter ports:

```text
core/orchestrator
→ adapter health/execution API
→ packaged runtime image
→ sanitized signal output
```

Core does not import or know tool internals. Tool unavailable becomes skipped/coverage_gap, never fake success.

---

# 5. Target Type Matrix

| Target Type | Browser | ZAP | Nuclei | OpenHack | Strix | Recon |
|---|---|---|---|---|---|---|
| static_content_website | light | passive mini | exposure/config mini | content exposure + hardening | candidate only | light |
| interactive_web_app | medium/deep | passive/baseline | standard-safe | API/session/auth/admin-like | hypothesis + validation reasoning | standard-safe |
| api_service | docs/UI only | API passive/spec if available | API exposure/templates | API surface/auth/data | API abuse/data exposure reasoning | standard-safe |
| ai_llm_application | chat-focused | hygiene only | exposure only | prompt/RAG/tool-call hunters | prompt/RAG/tool-call reasoning | mini |

Recon (subfinder/dnsx/httpx/katana) is a passive-discovery -> scope-gated active-probe signal layer (WSTG-INFO/WSTG-CONF). Passive stages (subfinder/dnsx) run against every discovered candidate; active stages (httpx/katana) only ever touch hosts that already pass the scope guard. See `README.md` §7 and `integrations/recon`.

---

# 6. Test Intensity

```text
safe_discovery
  observe, passive/baseline, hypothesis, little/no validation

controlled_attack_simulation
  controlled validation in scope, benign PoC where allowed, default paid mode

aggressive_staging
  staging/dev/test only, more hypothesis/validation attempts, explicit risk acceptance
```

Aggressive Staging is still blocked from malware, persistence, stealth/evasion, credential stuffing/bruteforce, destructive wipe, raw secret exfiltration, and out-of-scope scan.

---

# 7. Data Stores

Postgres:

```text
users
organizations
projects
domains
domain_verifications
scan_authorizations
test_accounts
scan_jobs
scan_steps
finding_candidates
findings
reports
report_draft_sections
retest_runs
approval_requests
approval_decisions
credit_ledger
audit_logs
```

NATS/queue:

```text
job events
scan step coordination
worker progress
rate-limit / retry coordination
```

No raw evidence persistence in DB, logs, reports, prompts, or storage.

---

# 8. LLM Gateway

Business logic calls aliases only:

```text
low_reasoning_model
high_reasoning_model
```

Provider/model mapping is config behind the LLM Gateway. No business logic hardcodes OpenAI, Claude, Anthropic, DeepSeek, or model ids.

---

# 9. Deployment Target

First production target: Docker/Compose host with tagged images and rollback.

Core images:

```text
openhunter/web:<git-sha>
openhunter/public-api:<git-sha>
openhunter/orchestrator:<git-sha>
openhunter/browser-worker:<git-sha>
openhunter/zap-worker:<git-sha>
openhunter/nuclei-worker:<git-sha>
openhunter/openhack-worker:<git-sha>
openhunter/strix-worker:<git-sha>
openhunter/recon-worker:<git-sha>
openhunter/report-worker:<git-sha>
openhunter/retest-worker:<git-sha>
```

Integration adapter images:

```text
openhunter/zaproxy-adapter:<git-sha>
openhunter/nuclei-adapter:<git-sha>
openhunter/openhack-adapter:<git-sha>
openhunter/strix-adapter:<git-sha>
openhunter/recon-adapter:<git-sha>
```

`recon-worker`/`recon-adapter` are wired into local dev (`infra/docker-compose/integrations.yml`, `workers.yml`) and `ops/scripts/publish-images.sh`. Staging/production rollout (`infra/docker-compose/*.staging.yml`, `infra/cloudbuild/pipeline-runtime.yaml`) is a separate, not-yet-done step.

Infra services:

```text
postgres
nats/queue
reverse-proxy
observability/log shipper
zap daemon if used separately
```
