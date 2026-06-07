# PRD.md - OpenHunterAI

> Public positioning: **OpenHunterAI - Authorized Attacker-Mindset Security Workspace**.
> PRD defines product behavior. Technical worker details live in ARCHITECTURE and WORKER_SPEC.

---

# 1. Product

OpenHunterAI tests verified public web/app targets with attacker-mindset reasoning and governed execution. It is not an uncontrolled offensive tool, checklist scanner, or compliance audit.

Execution is controlled by:

```text
verified domain
scan authorization
Target Type
Surface Flags
Test Intensity Mode
package quota
policy gates
approval gates
rate limits
data-handling policy
```

V1 does not include CI/CD retest, GitHub/Jira integration, VPS/cloud/private network scan, server agent, SAST/SCA/secrets scanning, mobile APK audit, or destructive unrestricted testing.

---

# 2. Canonical Public Packages

Public packages:

```text
Free Hunter
AI Black-hat Mindset Check
Monitor Workspace
Enterprise / PAYG
```

Rules:

```text
- Authenticated Scope is not a public package. It is an auth_scope inside AI Black-hat Mindset Check or Enterprise / PAYG.
- Readiness Report View/Export is a report/export mode, not a scan package.
- Monitor sub-tiers may exist as internal quota tiers, not public package names.
```

---

# 3. Free Hunter

Free Hunter is not the weak version. It uses the same Target Type and Test Intensity Mode model as paid, subject to authorization and risk acceptance.

Free Hunter limits:

```text
max_returned_findings = 1
max_monitored_findings = 1
max_retests = 1
cooldown_days = 7
```

Behavior:

```text
- Stop after the first valuable finding.
- Create a limited finding view for the one monitored finding.
- Allow one retest quota for that finding.
- Do not open the full paid finding board/retest workspace.
- If no valuable finding is found inside budget, return coverage report + hardening + limitations.
```

Free can use every Target Type and every Test Intensity Mode when the user is authorized and accepts the relevant risk. Aggressive Staging still requires staging/dev/test risk acceptance.

---

# 4. Onboard Inputs

User selects exactly one Target Type:

```text
static_content_website
  Landing page, blog, docs, portfolio, marketing/content site with little deep interaction.

interactive_web_app
  UI with forms, login, dashboard, user data, admin/upload/payment if present.

api_service
  REST, GraphQL, webhook, OpenAPI/Swagger, or backend endpoints as the main surface.

ai_llm_application
  Chatbot, RAG, agent, prompt input, model output, tool calling, or knowledge base.
```

Surface Flags:

```text
has_login
has_test_account
has_api_docs
has_file_upload
has_payment
has_admin_dashboard
has_webhook
has_chatbot_or_rag_or_tool_calling
```

Auth Scope:

```text
none
one_account
two_accounts
```

Auth Scope enables authenticated observation/access-control checks inside AI Black-hat Mindset Check or Enterprise / PAYG. It is not a package.

---

# 5. Test Intensity Mode

```text
safe_discovery
  Passive/baseline signals, observation, hypothesis, little or no validation.

controlled_attack_simulation
  Controlled validation in verified scope, benign PoC where allowed. Default paid mode.

aggressive_staging
  Staging/dev/test only. More hypotheses and validation attempts. Requires explicit risk acceptance.
```

Risk Acceptance requires user to confirm:

```text
- domain/env is under their control;
- active validation can cause errors, load, test data, or alerts;
- aggressive_staging target is staging/dev/test;
- emergency contact / testing window for risky modes;
- raw secrets are not stored, only masked fingerprint/hash/metadata.
```

Even Aggressive Staging forbids malware, persistence, stealth/evasion, credential stuffing/bruteforce, destructive wipe, raw secret exfiltration, and out-of-scope scan.

---

# 6. Deterministic Scan Plan

Scan Orchestrator builds a deterministic Scan Plan from:

```text
package_tier
target_type
surface_flags
auth_scope
test_intensity_mode
verified scope
policy gates
budget/quota
```

There is no profiler worker. LLM does not decide Target Type or which worker runs. LLM reasons over sanitized context after the deterministic plan is built.

Scan Plan output includes:

```text
enabledWorkers
enabledHunters
skippedHunters with reason
allowedValidationLevel
budgets
requiresApprovalForSensitiveActions
coverage expectations
```

---

# 7. Worker Roles

```text
ZAP Proxy
  Passive/baseline DAST signal layer. Captures headers, cookie flags, CSP/CORS, mixed content, passive/baseline alerts. Not a hacker agent.

Nuclei
  Curated known-pattern / exposure / misconfig signal layer. Uses internal selected templates only. No full community templates by default.

OpenHack
  Scenario-first hunter workflow + schema layer. Converts signals to candidate / warning / hardening / coverage_gap / finding by Target Type.

Strix
  Attacker-mindset reasoning + controlled validation planning. Produces hypothesis, abuse path, validation plan, severity/confidence, fix prompt, retest scenario. Not an uncontrolled runner.
```

Worker selection by Target Type:

| Target Type | Browser | ZAP | Nuclei | OpenHack | Strix |
|---|---|---|---|---|---|
| static_content_website | light | passive mini | exposure/config mini | content exposure + hardening | only if candidate |
| interactive_web_app | medium/deep | passive/baseline | standard-safe | API/session/auth/admin-like | hypothesis + validation reasoning |
| api_service | docs/UI only | API passive/spec if available | API exposure/templates | API surface/auth/data | API abuse/data exposure reasoning |
| ai_llm_application | chat-focused | hygiene only | exposure only | AI prompt/RAG/tool-call | prompt/RAG/tool-call reasoning |

---

# 8. Reports And Monitor

Reports never include raw credentials, raw cookies, raw tokens, raw HAR, sensitive raw request/response, raw secrets, or unsanitized PII.

If a secret/key is detected, store only masked fingerprint/hash/metadata and recommend rotate/revoke.

The canonical report output is `report_v1` structured JSON, not free-form Markdown. User-facing views are rendered from this sanitized snapshot:

```text
Owner Summary
Developer Fix Pack
Retest / Monitor Actions
Coverage / Limitations
```

Report generation streams draft sections over SSE while the scan runs. Final reports are immutable versions; current finding/retest state is returned as a latest overlay.

HTML/PDF export is generated on demand from sanitized report JSON. Export files are not persisted, and external artifact storage is not a v1 core dependency.

Free Hunter report behavior:

```text
- valuable finding found: return one ranked finding + limited monitored finding + one retest path
- no valuable finding: return coverage_only report with coverage, hardening, limitations, and next steps
- never create fake low-severity findings to fill the report
```

Readiness Report View/Export is an export mode from sanitized reports/findings. It is not a scan package and does not run a new scan.

Monitor Workspace stores history, reminders, quota, limited/full finding workspace depending on package, and manual retest queue. Monitor does not auto scan all findings, run after deploy, or implement CI/CD retest.

---

# 9. Acceptance Summary

PRD is aligned when:

```text
- public packages are Free Hunter / AI Black-hat Mindset Check / Monitor Workspace / Enterprise / PAYG;
- Authenticated Scope is an auth_scope, not a package;
- Free Hunter is first valuable finding + one monitored finding + one retest + 7-day cooldown;
- Target Type, Surface Flags, and Test Intensity Mode drive Scan Plan;
- no profiler worker exists;
- LLM uses low_reasoning_model and high_reasoning_model aliases through LLM Gateway;
- no external artifact storage is part of v1 core;
- no v1 scope creep into CI/CD, GitHub/Jira, cloud/private network, mobile, server agent, SAST/SCA/secrets scanning.
```
