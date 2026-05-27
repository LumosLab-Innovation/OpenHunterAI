# ARCHITECTURE.md - OpenHunterAI

> Kien truc v1 cho **Authorized Attacker-Mindset Security Workspace**. He thong chi kiem thu web/app public da verify domain va co scan authorization.

---

# 1. Scope kien truc v1

He thong phuc vu flow:

```text
Domain verified
→ Scope authorization
→ Optional test account
→ Phase-based signal gathering
→ Strix hypothesis / validation reasoning
→ Sanitized reports + findings
→ Manual retest / Monitor queue
```

Khong thiet ke cho:

```text
- CI/CD-based automated retesting
- deployment-triggered retest
- GitHub code scanning
- Jira/Linear workflow
- VPS/cloud/private network scan
- mobile APK audit
```

---

# 2. High-level architecture

```text
apps/web
  ↓
apps/api
  ↓
Postgres / Redis / Object Storage
  ↓
Scan Orchestrator
  ↓
Step queues / worker families
  - browser-worker
  - zap-worker
  - nuclei-worker
  - openhack-worker
  - strix-worker
  - report-worker
  - retest-worker
  ↓
LLM Gateway
  ↓
OpenAI / Claude / DeepSeek
```

V1 co the dung BullMQ + Postgres state. Redis/BullMQ la transport; Postgres la durable source of truth cho `scan_jobs`, `scan_steps`, findings va reports.

---

# 3. Main components

## 3.1. apps/web

Customer-facing dashboard:

```text
- project dashboard
- domain verification UI
- scope authorization UI
- test account UI
- scan progress
- reports/export
- finding board cho paid checks va Monitor
- manual retest queue
- user approval gate
```

## 3.2. apps/api

Backend API:

```text
- auth/session
- projects/domains/verifications
- scan authorizations
- scan jobs/progress
- findings/reports
- approvals/retest
- Monitor subscription state/quotas
- health/tool availability
```

## 3.3. Scan Orchestrator

Orchestrator la scheduler/state coordinator, khong nen la mot long-running process tu chay tat ca tools.

```text
- validate domain verification va authorization
- tao scope snapshot
- tao scan_steps theo phase
- enqueue step jobs cho worker family phu hop
- fan-out/fan-in phases
- track progress, timeout, retry, coverage gaps
- enforce package/budget/policy gates
- mark completed / completed_with_gaps / failed
```

## 3.4. Worker families

Workers chay tach khoi web/API process. Moi worker co:

```text
- timeout
- retry limit
- rate limit neu can
- structured logs
- scan_id
- project_id
- worker_type
- error handling
- no fake success
```

---

# 4. Phase fan-out / fan-in scan pipeline

## 4.1. Free Hunter Snapshot

```text
Phase 0 - precheck
  verify domain, authorization, scope, private IP blocking

Phase 1 - safe signal fan-out
  browser lightweight observation
  ZAP passive mini
  Nuclei mini-safe

Phase 2 - hunter + summary
  OpenHack mini hunters
  Strix Mini Summary

Phase 3 - report
  Hunter Snapshot Report
```

Free output la report-only. Free khong tao finding board/retest workflow.

## 4.2. AI Black-hat Check

```text
Phase 0 - precheck
  verify domain, authorization, scope, package budget

Phase 1 - signal fan-out
  browser deeper observation
  ZAP passive/baseline
  Nuclei standard-safe
  OpenHack rule hunters where input is ready

Phase 2 - fan-in normalize
  merge/dedupe candidates
  produce compact sanitized context
  record coverage gaps for failed/skipped tools

Phase 3 - Strix hypothesis pass
  attacker hypotheses
  risk areas
  safe validation plan

Phase 4 - governed validation
  run safe validation in scope
  require User Approval Gate for sensitive actions

Phase 5 - Strix validation reasoning + report
  prioritize findings
  severity/confidence
  remediation/fix prompt
  retest scenario
  Human Report + AI/dev Report
```

## 4.3. Authenticated Check

Authenticated Check dung pipeline AI Black-hat Check va them:

```text
- encrypted test account retrieval
- authenticated browser context
- session/cookie/token attribute checks
- 1-account auth/session/private-data signals
- 2-account User A/User B access-control checks
- approval-gated validation for sensitive access-control actions
```

## 4.4. Monitor retest

Monitor khong scan lai toan bo app. Monitor chi queue manual retest theo finding:

```text
finding marked Ready for Retest
→ retest scope snapshot
→ approval if sensitive
→ narrow scenario execution
→ result: Fixed / Still Vulnerable / Partially Fixed / Cannot Verify
```

---

# 5. Worker architecture

## 5.1. Browser Worker

Dung Playwright/CDP de mo app that.

Input:

```text
- scan_id
- project_id
- mode: free | ai_blackhat | authenticated
- target URLs
- allowed scope
- excluded paths
- optional encrypted test account reference
```

Output:

```text
- route summary
- API endpoint summary
- network metadata
- cookie attribute summary
- storage key summary
- console errors
- sanitized screenshot/evidence refs if safe
```

Khong persist raw credential, cookie jar, full HAR hoac raw storage values.

## 5.2. ZAP Worker

Dung ZAP passive/baseline signals.

```text
- Free: passive mini
- AI Black-hat / Authenticated: passive/baseline within scope
- No broad active scan by default
- TOOL_UNAVAILABLE → skipped + coverage gap, not fake success
```

## 5.3. Nuclei Worker

Dung Nuclei engine + internal curated templates.

```text
- Free: mini-safe profile
- AI Black-hat / Authenticated: standard-safe profile
- No destructive/intrusive/bruteforce/dos/malware/credential-attack templates
- TOOL_UNAVAILABLE → skipped + coverage gap
```

## 5.4. OpenHack Worker

Rule/schema hunter layer:

```text
- mini exposure hunter
- frontend secret/storage hunter
- API surface hunter
- auth/session smoke hunter
- AI app smoke hunter if chatbot/LLM detected
- finding/warning/hardening/coverage gap classification
```

## 5.5. Strix Worker

Strix la attacker-mindset reasoning, khong phai uncontrolled action runner.

```text
- Free: Mini Summary only.
- AI Black-hat: hypothesis pass + validation reasoning pass.
- Authenticated: access-control reasoning with sanitized authenticated context.
```

Strix output:

```text
- attacker hypotheses
- safe validation plan
- prioritized findings
- severity/confidence
- remediation
- fix prompt
- retest scenario proposal
```

Sensitive action phai qua Product Policy Gate va User Approval Gate.

## 5.6. Report Worker

Tao:

```text
- Hunter Snapshot Report
- Human-readable report
- AI/dev-readable report
- Auth Security Report
- Readiness Report View/Export
```

Tat ca reports dung sanitized summaries. Khong report raw credential, raw token/cookie, raw request/response nhay cam.

## 5.7. Retest Worker

Manual single-finding retest:

```text
- finding_id
- retest_scenario
- scope_snapshot
- approval state if sensitive
- max runtime
```

---

# 6. LLM Gateway

Moi LLM call tu OpenHack, Strix, Report hoac Retest di qua LLM Gateway:

```text
Prompt Sanitizer
→ Budget & Policy Check
→ Provider Router
→ Provider Adapter
→ Response Normalizer
→ Audit + Metrics + Cost Log
```

Business logic khong goi truc tiep provider SDK.

---

# 7. Data stores

## 7.1. Postgres

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
retest_runs
approval_requests
approval_decisions
credit_ledger
audit_logs
```

## 7.2. Redis

```text
- job queues
- queue events/progress
- worker coordination
- rate limits
```

## 7.3. Object Storage

Dung cho sanitized artifacts only:

```text
- sanitized screenshots if safe
- sanitized report exports
- sanitized evidence summaries
```

Khong persist raw request/response, raw HAR, raw cookie, raw token, raw credential hoac private data chua sanitize.

---

# 8. Security boundaries

## 8.1. Product Policy Gate

Chặn:

```text
- unverified domain
- expired verification/authorization
- out-of-scope host/path
- private/local/metadata IP
- unsupported package action
- budget exceeded action
- sensitive action without approval
```

## 8.2. Evidence Sanitizer

Chay truoc:

```text
- LLM prompt
- report generation
- finding display
- readiness export
- object storage writes
```

## 8.3. User Approval Gate

Bat buoc truoc:

```text
- dung test account cho validation nhay cam
- access-control validation
- POST/PUT/PATCH/DELETE
- billing/payment/file/email/webhook
- High/Critical retest
- action co the thay doi du lieu
```

---

# 9. Deployment target v1

Production target dau tien: Docker VPS voi tagged images va rollback ro rang.

Per-family images:

```text
openhunter/web:<git-sha>
openhunter/api:<git-sha>
openhunter/orchestrator:<git-sha>
openhunter/browser-worker:<git-sha>
openhunter/zap-worker:<git-sha>
openhunter/nuclei-worker:<git-sha>
openhunter/openhack-worker:<git-sha>
openhunter/strix-worker:<git-sha>
openhunter/report-worker:<git-sha>
openhunter/retest-worker:<git-sha>
```

Infra services:

```text
postgres
redis
object-storage
reverse-proxy
zap-daemon if used separately
observability/log shipper
```

Browser worker can isolation manh nhat: non-root, sandbox/seccomp where possible, concurrency thap, timeout cung, egress guard.

---

# 10. Architecture acceptance

Kien truc dung khi:

```text
- Public docs dung package model Free / AI Black-hat / Authenticated / Monitor Basic / Monitor Pro.
- Moi scan di qua verification + authorization + scope snapshot.
- Scan pipeline co phase fan-out/fan-in va tool unavailable coverage gaps.
- Strix co 2-pass cho paid checks va khong tu chay sensitive action.
- Moi worker co timeout/retry/logs/error handling.
- Khong persist raw evidence.
- Moi LLM call di qua LLM Gateway.
- Retest la manual theo finding.
- Khong co GitHub/Jira/CI-CD/VPS/cloud/private network modules trong v1.
```
