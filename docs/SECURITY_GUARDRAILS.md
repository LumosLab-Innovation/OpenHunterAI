# SECURITY_GUARDRAILS.md - OpenHunterAI

> Highest-priority implementation rules.

---

# 1. No Verified Authorization, No Scan

Do not create scan/retest jobs if:

```text
domain is not verified
verification expired
scan authorization is missing/expired
target is outside allowed_hosts/allowed_paths
target is excluded
target is private/local/metadata IP
redirect leaves scope
```

---

# 2. Governed Attacker-Mindset

OpenHunterAI keeps black-hat mindset reasoning but governed execution. Every action is constrained by verified scope, Target Type, Surface Flags, Test Intensity Mode, auth_scope, package quota, policy gates, approval gates, rate limits, and data-handling policy.

Forbidden always:

```text
out-of-scope scan
private/internal/local/metadata scan
malware
persistence
stealth/evasion
credential stuffing/bruteforce
destructive wipe
DoS
raw secret exfiltration
raw credential/cookie/token/HAR/request/response persistence
abuse instructions outside verified scope
```

Aggressive Staging is staging/dev/test only and still follows all forbidden-action rules.

---

# 3. Onboard And Risk Acceptance

Authorization must store:

```text
scanMode
authScope
targetType
testIntensityMode
surfaceFlags
allowedHosts
allowedPaths
excludedPaths
risk acceptance if aggressive_staging
```

`aggressive_staging` requires explicit confirmation that the target is staging/dev/test and user controls the environment.

Risk copy must state active validation can cause errors, load, test data, or alerts. For risky modes user should provide emergency contact/testing window.

---

# 4. Credential And Evidence Policy

Do not log/store/report/send to LLM:

```text
raw password
raw token
raw cookie
raw API key
raw credential
raw HAR
sensitive raw request/response
unsanitized PII/private data
```

If a secret/key is found, persist only masked fingerprint/hash/metadata and recommend rotate/revoke.

V1 core stores sanitized reports/findings in Postgres. External artifact storage is not a core dependency.

---

# 5. User Approval Gate

Approval is required before sensitive actions:

```text
access-control validation
using test accounts for sensitive validation
POST/PUT/PATCH/DELETE
billing/payment
file upload/delete/export
email/webhook
High/Critical retest
actions that may mutate data
```

Approval must show action, host/path, account label/email if relevant, what will not be done, residual risk, approve/cancel.

---

# 6. Retest

Retest is manual and tied to one finding.

Do not implement:

```text
CI/CD-based automated retesting
deployment-triggered retest
background full-app retest
auto retest for all findings
```

---

# 7. Worker Rules

Workers must have timeout, retry limit, structured logs, scan_id, project_id, worker_type, error handling, and sanitized output.

Tool unavailable must become skipped/coverage gap. No fake success.

ZAP is passive/baseline only by default. Nuclei uses internal curated safe templates only.

---

# 8. Production Blockers

Do not release if:

```text
unverified domains can scan
private/local/metadata targets can scan
redirect outside scope is followed
raw secrets/evidence appear in logs/prompts/reports/storage
sensitive actions bypass approval
workers can run without timeout
production path returns mock scan results
LLM provider SDK is called outside gateway
```
