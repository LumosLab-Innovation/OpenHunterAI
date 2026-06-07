# ACCEPTANCE_CRITERIA.md - OpenHunterAI

> Conditions for v1 to be considered correct.

---

# 1. Product Contract

V1 is accepted when:

```text
public packages are Free Hunter / AI Black-hat Mindset Check / Monitor Workspace / Enterprise / PAYG
Authenticated Scope is auth_scope, not a package
Readiness Report View/Export is export mode, not scan package
Monitor sub-tiers are not public package names
Free Hunter is not report-only and not a weak scanner
```

---

# 2. Authorization And Onboard

Scan authorization must require:

```text
verified domain
allowed_hosts / allowed_paths / excluded_paths
scanMode
authScope
targetType
testIntensityMode
surfaceFlags
risk acceptance for aggressive_staging
```

Validation:

```text
authScope none requires no test account
authScope one_account requires >= 1 test account
authScope two_accounts requires >= 2 test accounts
aggressive_staging requires explicit staging/dev/test acceptance
```

---

# 3. Scan Plan

Scan Plan builder is accepted when:

```text
each Target Type enables the documented worker/hunter set
Free quotas are enforced
Free can use every Target Type and Test Intensity Mode if authorized
skippedHunters include reason
LLM does not choose Target Type or worker set
profiler worker does not exist
```

---

# 4. Free Hunter

Free Hunter is accepted when:

```text
max_returned_findings = 1
max_monitored_findings = 1
max_retests = 1
cooldown_days = 7
first valuable finding stops expensive steps
one limited monitored finding view exists
one retest quota exists
no full paid board/retest workspace is opened
no valuable finding returns coverage/hardening/limitations
```

---

# 5. Worker/Tool Behavior

```text
ZAP = passive/baseline DAST signal layer
Nuclei = curated known-pattern/exposure/misconfig templates only
OpenHack = scenario-first hunter workflow/schema layer
Strix = attacker-mindset reasoning + controlled validation planning
```

Workers must fail loudly, never fake success, and never persist raw evidence.

---

# 6. LLM Gateway

Accepted when:

```text
business logic calls only LLM Gateway
low_reasoning_model and high_reasoning_model resolve from env/config
provider/model names are not hardcoded in business logic
prompt sanitizer blocks raw secrets/evidence
budget/timeout/retry/fallback do not fake output
```

---

# 7. Storage

Accepted when:

```text
external artifact storage is absent from v1 core docs/env/code path
sanitized reports/findings are stored in Postgres
raw credentials/cookies/tokens/HAR/request/response are not stored/logged/reported
detected secrets store only masked fingerprint/hash/metadata
report_v1 structured JSON is the canonical report snapshot
draft sections stream over SSE
HTML/PDF exports are generated on demand and not persisted as artifacts
LLM ranking recommendations cannot invent findings or override deterministic policy
```

---

# 8. Not V1

Fail if implementation adds:

```text
CI/CD retest
deployment-triggered retest
GitHub/Jira integration
cloud/VPS/private network scan
server agent
mobile APK audit
SAST/SCA/secrets scanning
unrestricted aggressive/offensive mode
white-hat audit/compliance repositioning
```
