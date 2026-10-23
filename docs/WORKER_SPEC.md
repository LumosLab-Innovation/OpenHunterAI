# WORKER_SPEC.md - OpenHunterAI

> Workers are internal integrations, not scan profiles or products.

---

# 1. Required Worker Input

Every worker input must include:

```json
{
  "scanId": "scan_123",
  "projectId": "proj_123",
  "profile": "quick|standard|deep",
  "targetUrl": "https://authorized.example/app",
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

Workers receive the exact requested seed URL and an immutable scope snapshot. Authenticated behavior is controlled by `authScope`.

---

# 2. Report Worker

`report-worker` is the canonical report generator. It writes sanitized `report_v2` draft sections, validates LLM ranking recommendations against existing findings/candidates, finalizes immutable report versions, and never stores raw evidence or export files.

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

Canonical sanitized worker output:

```json
{
  "runId": "event_123",
  "status": "succeeded|partial|failed|skipped",
  "signals": [],
  "findingCandidates": [],
  "evidenceRefs": [],
  "coverage": {
    "surfacesAttempted": [],
    "surfacesCompleted": [],
    "surfacesSkipped": [],
    "gaps": []
  },
  "limitations": [],
  "retryable": false,
  "runtimeProvenance": {
    "upstreamId": "nuclei",
    "upstreamRef": "v3.4.10",
    "adapterVersion": "openhunter-nuclei-adapter/v1"
  }
}
```

`done|skipped|failed` remains a legacy `state` field during migration. New
consumers use `status`. Callback persistence is idempotent by `runId`.

Workers never author a validated finding. A worker may only return signals and
candidates. The findings service writes a separate triage decision:

```text
candidate | rejected | needs_more_evidence | validated
```

High/Critical promotion requires sanitized demonstrated impact,
counterevidence, and replayable baseline plus exploit evidence references.
The current deterministic decision checks the metadata contract and leaves even complete worker claims at `needs_more_evidence`; it does not
yet fetch and replay the referenced exchanges. Independent replay is an M0
release gate, not a capability to assume from the decision state alone.

---

# 3. Roles

```text
ZAP Proxy
  Passive/baseline DAST signal layer. Not a hacker agent.

Nuclei
  Curated known-pattern / exposure / misconfig signal layer. Internal templates only.

Built-in passive surface hunter (legacy DB enum: openhack_hunter)
  Native safe HTTP/header observation only. OpenHack is a workflow/schema
  reference and is not an executable runtime dependency.

Strix
  Attacker-mindset reasoning + controlled validation planning. Not an uncontrolled runner.
```

---

# 4. Target Type Matrix

| Target Type | Browser | ZAP | Nuclei | Built-in passive surface | Strix |
|---|---|---|---|---|---|
| static_content_website | light | passive mini | exposure/config mini | content exposure + hardening | only if candidate |
| interactive_web_app | medium/deep | passive/baseline | standard-safe | API/session/auth/admin-like | hypothesis + validation reasoning |
| api_service | only if docs/UI | API passive/spec if available | API exposure/templates | API surface/auth/data | API abuse/data exposure reasoning |
| ai_llm_application | chat-focused | hygiene only | exposure only | AI prompt/RAG/tool-call hunter | prompt/RAG/tool-call reasoning |

Skipped hunters must include a reason.

---

# 5. Resource and evidence gate

Quick, Standard and Deep have bounded resource/safety budgets, not a finding or retest quota. A budget stop is reported as a limitation. If no candidate is independently validated, the report explains coverage, hardening, and the next verification step; workers never create filler findings.

---

# 6. Forbidden Worker Behavior

Even in `aggressive_staging`, workers must not run malware, persistence, stealth/evasion, credential stuffing/bruteforce, destructive wipe, raw secret exfiltration, or out-of-scope scans.
