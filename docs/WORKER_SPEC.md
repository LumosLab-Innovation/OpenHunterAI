# WORKER_SPEC.md - OpenHunterAI

> Workers are internal integrations, not public packages.

---

# 1. Required Worker Input

Every worker input must include:

```json
{
  "scanId": "scan_123",
  "projectId": "proj_123",
  "scanMode": "free_hunter|ai_blackhat_mindset_check",
  "targetType": "static_content_website|interactive_web_app|api_service|ai_llm_application",
  "authScope": "none|one_account|two_accounts",
  "testIntensityMode": "safe_discovery|controlled_attack_simulation|aggressive_staging",
  "surfaceFlags": {},
  "scanPlan": {},
  "allowedHosts": [],
  "allowedPaths": [],
  "excludedPaths": []
}
```

No worker receives a legacy authenticated package/mode. Authenticated behavior is controlled by `authScope`.

---

# 2. Report Worker

`report-worker` is the canonical report generator. It writes sanitized `report_v1` draft sections, validates LLM ranking recommendations against existing findings/candidates, finalizes immutable report versions, and never stores raw evidence or export files.

---

# 2. Worker Principles

Workers must have timeout, retry limit, structured logs, `scan_id`, `project_id`, `worker_type`, error handling, and sanitized output.

Workers must not run forever, scan outside scope, log raw secrets, persist raw evidence, silently fail, fake success, or return mock production results.

Tool unavailable:

```text
state = skipped
error_code = TOOL_UNAVAILABLE
coverage_gap = true
```

---

# 3. Roles

```text
ZAP Proxy
  Passive/baseline DAST signal layer. Not a hacker agent.

Nuclei
  Curated known-pattern / exposure / misconfig signal layer. Internal templates only.

OpenHack
  Scenario-first hunter workflow + schema layer. Produces candidate/warning/hardening/coverage_gap/finding.

Strix
  Attacker-mindset reasoning + controlled validation planning. Not an uncontrolled runner.
```

---

# 4. Target Type Matrix

| Target Type | Browser | ZAP | Nuclei | OpenHack | Strix |
|---|---|---|---|---|---|
| static_content_website | light | passive mini | exposure/config mini | content exposure + hardening | only if candidate |
| interactive_web_app | medium/deep | passive/baseline | standard-safe | API/session/auth/admin-like | hypothesis + validation reasoning |
| api_service | only if docs/UI | API passive/spec if available | API exposure/templates | API surface/auth/data | API abuse/data exposure reasoning |
| ai_llm_application | chat-focused | hygiene only | exposure only | AI prompt/RAG/tool-call hunter | prompt/RAG/tool-call reasoning |

Skipped hunters must include a reason.

---

# 5. Free Hunter Gate

Free Hunter uses the same plan model but has quota:

```text
max_returned_findings = 1
max_monitored_findings = 1
max_retests = 1
cooldown_days = 7
```

If a valuable finding is promoted, remaining expensive hypothesis/validation steps stop. If none is found in budget, report coverage, hardening, and limitations.

Free Hunter must not create fake low-severity findings just to populate a report.

---

# 6. Forbidden Worker Behavior

Even in `aggressive_staging`, workers must not run malware, persistence, stealth/evasion, credential stuffing/bruteforce, destructive wipe, raw secret exfiltration, or out-of-scope scans.
