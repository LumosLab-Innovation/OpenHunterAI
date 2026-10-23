# SECURITY_GUARDRAILS.md - OpenHunterAI

> Highest-priority implementation rules.

---

# 1. No Explicit Authorization, No Scan

Do not create scan/retest jobs if:

```text
user has not explicitly confirmed authority for the declared public hosts
scan authorization is missing/expired
target is outside allowed_hosts/allowed_paths
target is excluded
target is private/local/metadata IP
redirect leaves scope
```

Each `allowedHosts` entry authorizes that hostname only. A parent domain does
not implicitly authorize its subdomains; declare each subdomain separately.
DNS ownership proof is not a self-host prerequisite, but this does not relax
request-time private-IP and redirect checks.

---

# 2. Governed Attacker-Mindset

OpenHunterAI keeps attacker-mindset reasoning but governed execution. Every action is constrained by declared authorized scope, Target Type, Surface Flags, Test Intensity Mode, auth_scope, profile resource ceiling, policy gates, approval gates, rate limits, and data-handling policy.

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
abuse instructions outside authorized scope
```

Aggressive Staging is staging/dev/test only and still follows all forbidden-action rules.

A lab campaign is a separate declaration from a public website scan. It may record subnet, web entry, time window, test accounts, budget, approval, snapshot, and rollback. Those fields do not authorize pivot, persistence, or destructive actions. Deep does not inherit them. No lab executor is enabled until isolation and restore have been demonstrated for a one-time lab.

OpenShield owns incident handling, containment and recovery. A Hunter report is
assessment input only: it transfers no credential or action authority. Report
text, fix suggestions and evidence URLs are untrusted data, never instructions
to execute or fetch. A research catalog entry does not enable a runtime action.

---

# 3. Onboard And Risk Acceptance

Authorization must store:

```text
profile: quick | standard | deep
targetUrl, including its path
authScope
targetType
testIntensityMode
surfaceFlags
allowedHosts
allowedPaths
excludedPaths
risk/authority confirmation stored with accepting user and consent text
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
targets outside explicitly authorized public-host scope can scan
private/local/metadata targets can scan
redirect outside scope is followed
raw secrets/evidence appear in logs/prompts/reports/storage
sensitive actions bypass approval
workers can run without timeout
production path returns mock scan results
LLM provider SDK is called outside gateway
```
