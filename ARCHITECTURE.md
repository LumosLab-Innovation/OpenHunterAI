# ARCHITECTURE.md — AI White-hat Security Workspace

> Kiến trúc v1 cho sản phẩm kiểm thử bảo mật web/app đã xác minh domain.  
> V1 không làm GitHub/Jira/CI-CD/VPS/cloud/private network/mobile/SAST.

---

# 1. Scope kiến trúc v1

Hệ thống v1 phục vụ flow:

```text
Domain verified
→ Scope authorization
→ Optional test account
→ Browser/ZAP/Nuclei/OpenHack/Strix scan
→ Reports
→ Finding board
→ Manual retest
```

Không thiết kế cho:

```text
- CI/CD auto retest
- GitHub code scanning
- Jira/Linear workflow
- cloud/VPS scanning
- private network scan
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
Workers
  - browser-inspector
  - zap-signal
  - nuclei-signal
  - openhack-hunter
  - strix-core
  - report
  - retest
  ↓
LLM Gateway
  ↓
OpenAI / Claude / DeepSeek
```

---

# 3. Main components

## 3.1. apps/web

Customer-facing dashboard.

Chức năng:

```text
- project dashboard
- domain verification UI
- scan authorization UI
- test account UI
- scan progress
- reports
- finding board
- manual retest
- user approval gate
```

## 3.2. apps/api

Backend API.

Chức năng:

```text
- auth/session
- projects
- domains
- verification
- scan authorization
- scan jobs
- findings
- reports
- retest
- billing/credits cơ bản
```

## 3.3. Scan Orchestrator

Điều phối scan jobs.

Nhiệm vụ:

```text
- validate domain verification
- validate scan authorization
- create scan steps
- enqueue workers
- track progress
- enforce package gates
- enforce timeout/budget
```

## 3.4. Worker layer

Workers chạy tách khỏi web/API process.

```text
browser-inspector
zap-signal
nuclei-signal
openhack-hunter
strix-core
report
retest
```

Mọi worker phải có:

```text
- timeout
- retry limit
- structured logs
- audit events nếu cần
- scan_id
- project_id
```

---

# 4. Worker architecture

## 4.1. Browser Inspector Worker

Dùng Playwright/CDP.

Input:

```text
- scan_id
- target URLs
- allowed scope
- optional test account reference
```

Output:

```text
- route summary
- network metadata
- API endpoint summary
- cookie attributes
- storage key summary
- console errors
- screenshots/snapshots nếu cần
```

Không output raw secrets.

## 4.2. ZAP Signal Worker

Dùng ZAP passive/baseline.

Input:

```text
- verified target
- scan profile
- browser traffic nếu có
```

Output:

```text
- ZAP alert candidates
- normalized finding candidates
```

Không dùng full active scan mặc định.

## 4.3. Nuclei Signal Worker

Dùng curated safe templates.

Input:

```text
- verified target
- template profile
```

Output:

```text
- nuclei results
- normalized finding candidates
```

Không chạy destructive/intrusive/bruteforce/dos templates.

## 4.4. OpenHack Hunter Worker

Dùng OpenHack-style workflow/schema.

Input:

```text
- browser observations
- ZAP/Nuclei candidates
- compact security context
```

Output:

```text
- hunter findings
- warnings
- hardening items
- coverage gaps
- hunter snapshot sections
```

Dùng nhiều cho Free/Light.

## 4.5. Strix Core Worker

Dùng Strix attacker-mindset reasoning.

Input:

```text
- compact security context
- sanitized evidence
- OpenHack hunter output
- finding candidates
```

Output:

```text
- adversarial observations
- prioritized findings
- severity/confidence
- remediation
- fix prompt
- retest scenario proposal
```

Action nhạy cảm phải qua Product Policy Gate / User Approval Gate.

## 4.6. Report Worker

Tạo:

```text
- Free Hunter Snapshot Report
- Human-readable report
- AI/dev-readable report
```

Mọi report phải qua sanitizer.

## 4.7. Retest Worker

Manual retest theo từng finding.

Input:

```text
- finding_id
- retest_scenario
- scope snapshot
- user approval nếu cần
```

Output:

```text
Fixed
Still Vulnerable
Partially Fixed
Cannot Verify
```

---

# 5. LLM Gateway architecture

## 5.1. Vị trí

```text
OpenHack Hunter / Strix Core / Report / Retest
  ↓
LLM Gateway
  ↓
Provider Adapter
  ↓
OpenAI / Claude / DeepSeek
```

## 5.2. Quy tắc

Không module nào gọi trực tiếp provider SDK.

Mọi request đi qua:

```text
- prompt sanitizer
- budget check
- provider router
- timeout/retry/fallback
- response normalizer
- metrics logger
```

## 5.3. Provider adapters

```text
OpenAIProvider
ClaudeProvider
DeepSeekProvider
```

Chi tiết nằm trong:

```text
LLM_PROVIDER_SPEC.md
```

---

# 6. Data stores

## 6.1. Postgres

Lưu dữ liệu có cấu trúc:

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
credit_ledger
audit_logs
```

## 6.2. Redis

Dùng cho:

```text
- job queue
- scan progress
- worker coordination
- rate limit
```

## 6.3. Object Storage

Dùng cho:

```text
- sanitized evidence
- screenshots
- report files
- raw evidence nếu cần, phải protected/encrypted
```

---

# 7. Security boundaries

## 7.1. Product Policy Gate

Chặn:

```text
- unverified domain
- out-of-scope host/path
- private/local/metadata IP
- expired authorization
- unsupported package action
- sensitive action without approval
```

## 7.2. Evidence Sanitizer

Chạy trước:

```text
- LLM prompt
- report generation
- finding display
- AI/dev report
```

Mask:

```text
password
token
cookie
API key
Authorization header
session id
private data
```

## 7.3. User Approval Gate

Bắt buộc trước action nhạy cảm:

```text
- dùng test account
- access-control retest
- POST/PUT/PATCH/DELETE
- billing/payment/file/email/webhook
- High/Critical retest
```

---

# 8. Scan flow

## 8.1. Free Hunter Snapshot

```text
verify domain
→ scope authorization
→ browser lightweight observation
→ ZAP passive mini
→ Nuclei mini safe
→ OpenHack mini hunters
→ Strix Mini Summary via LLM Gateway
→ Free Hunter Snapshot Report
```

## 8.2. Standard/Auth

```text
verify domain
→ scope authorization
→ optional test account
→ browser inspector
→ ZAP baseline/passive
→ Nuclei standard-safe
→ OpenHack workflow
→ Strix attacker-mindset reasoning via LLM Gateway
→ findings
→ reports
→ manual retest
```

---

# 9. Deployment shape v1

MVP/staging có thể chạy bằng:

```text
- apps/web
- apps/api
- worker processes
- Postgres
- Redis
- object storage
```

Không cần Kubernetes/secureCodeBox trong v1.

---

# 10. Architecture acceptance

Kiến trúc được xem là đúng khi:

```text
- business logic không gọi trực tiếp LLM provider SDK
- mọi scan đi qua domain verification + authorization
- mọi worker có timeout/retry/logs
- mọi evidence/report đi qua sanitizer
- retest là manual theo finding
- không có GitHub/Jira/CI-CD/VPS/cloud modules trong v1
```
