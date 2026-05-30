# WORKER_SPEC.md - OpenHunterAI

> Worker contracts for v1. Workers are internal integrations, not public packages. Public packages are defined in PRD.

---

# 1. Worker principles

Every worker must have:

```text
- scan_id
- project_id
- worker_type
- input schema
- output schema
- timeout
- retry limit
- structured logs
- error handling
- sanitized output contract
```

No worker may:

```text
- run forever
- scan outside scope
- log raw secrets
- persist raw evidence
- silently fail
- fake success
```

Tool unavailable must be explicit:

```text
state = skipped
error_code = TOOL_UNAVAILABLE
coverage_gap = true
```

---

# 2. Worker families v1

```text
scan-orchestrator
browser-worker
zap-worker
nuclei-worker
openhack-worker
strix-worker
report-worker
retest-worker
llm-gateway service/library
```

Not v1 workers:

```text
github
jira
ci-cd
vps-agent
cloud
sast
sca
secrets
mobile-apk
```

Playwright, ZAP, and Nuclei are internal worker integrations. They are not public-facing packages or product tiers.

---

# 3. Phase pipeline responsibilities

## 3.1. scan-orchestrator

Purpose:

```text
Coordinate scan phases, create scan_steps, enqueue ready worker jobs, fan-in results, and mark coverage gaps.
```

Responsibilities:

```text
- validate domain verification and authorization
- freeze scope snapshot
- create phase-based steps
- fan-out browser/ZAP/Nuclei/OpenHack where safe
- fan-in normalized signals
- trigger DeepSeek Flash triage / DeepSeek Pro reasoning according to mode
- trigger report worker
- avoid duplicate step execution on retry
```

It must not directly run all tools in a single long sequential pipeline in production.

---

# 4. browser-worker

## 4.1. Purpose

Open the verified web/app with Playwright/CDP and observe real browser behavior.

## 4.2. Input

```json
{
  "scan_id": "scan_123",
  "project_id": "proj_123",
  "mode": "free_hunter|ai_blackhat_mindset_check",
  "target_urls": ["https://example.com"],
  "allowed_hosts": ["example.com"],
  "allowed_paths": ["/"],
  "excluded_paths": [],
  "test_account_ref": "optional"
}
```

## 4.3. Output

```json
{
  "routes": [],
  "api_endpoints": [],
  "network_summary": {},
  "cookie_attribute_summary": {},
  "storage_key_summary": {},
  "console_errors": [],
  "screenshots": [],
  "coverage_gaps": []
}
```

## 4.4. Guardrails

```text
- block navigation outside allowed scope
- separate browser context per scan/account
- no raw credential persistence
- no raw cookie/storage persistence
- no full HAR persistence
- hard timeout
- low concurrency in production
```

---

# 5. zap-worker

## 5.1. Purpose

Generate passive/baseline DAST signals through a ZAP daemon or equivalent safe mode.

## 5.2. Modes

```text
free_hunter: passive mini
ai_blackhat_mindset_check: passive/baseline standard-safe
authenticated_scope: passive/baseline on sanitized authenticated traffic metadata if available
```

## 5.3. Output

```json
{
  "scanner": "zap",
  "profile": "passive-mini|baseline-standard",
  "candidates": [],
  "summary": {},
  "coverage_gaps": []
}
```

## 5.4. Guardrails

```text
- no broad active scan by default
- no out-of-scope URLs
- timeout required
- fail or skip loudly
- no fake alerts
```

---

# 6. nuclei-worker

## 6.1. Purpose

Run the Nuclei engine with internal curated templates for exposure/misconfig/known patterns.

## 6.2. Profiles

```text
mini-safe
standard-safe
```

## 6.3. Blocked template types

```text
destructive
intrusive
bruteforce
dos
malware
credential-attack
```

## 6.4. Output

```json
{
  "scanner": "nuclei",
  "template_profile": "mini-safe|standard-safe",
  "candidates": [],
  "summary": {},
  "coverage_gaps": []
}
```

---

# 7. openhack-worker

## 7.1. Purpose

Create hunter structure, mini hunter outputs, and finding/warning/hardening/coverage-gap schema.

## 7.2. Mini hunters

```text
Vibe-code Exposure Hunter
Frontend Secret & Storage Hunter
API Surface Hunter
Auth/Session Smoke Hunter
AI App Smoke Hunter
```

## 7.3. Input

```json
{
  "browser_observations": {},
  "zap_candidates": [],
  "nuclei_candidates": [],
  "mode": "free_hunter|ai_blackhat_mindset_check"
}
```

## 7.4. Output

```json
{
  "candidates": [],
  "warnings": [],
  "hardening": [],
  "coverage_gaps": [],
  "compact_security_context": {}
}
```

---

# 8. strix-worker

## 8.1. Purpose

Run attacker-mindset reasoning on compact sanitized context.

## 8.2. Modes

```text
free_hunter: DeepSeek V4 Flash triage + DeepSeek V4 Pro first valuable finding reasoning
ai_blackhat_mindset_check: DeepSeek V4 Pro hypothesis pass + validation reasoning pass
authenticated_scope: access-control reasoning with sanitized authenticated context
```

## 8.3. Input

```json
{
  "compact_security_context": {},
  "sanitized_evidence": [],
  "hunter_output": {},
  "finding_candidates": [],
  "package": "free_hunter|ai_blackhat_mindset_check",
  "pass": "mini_summary|hypothesis|validation_reasoning|access_control_reasoning"
}
```

## 8.4. Output

```json
{
  "observations": [],
  "hypotheses": [],
  "validation_plan": [],
  "prioritized_findings": [],
  "severity_confidence_updates": [],
  "remediation": [],
  "fix_prompts": [],
  "retest_proposals": [],
  "approval_requests": []
}
```

## 8.5. Guardrails

```text
- no raw secrets
- no out-of-scope action
- no sensitive action without Product Policy Gate/User Approval Gate
- no destructive action
- no abuse instructions outside verified scope
```

---

# 9. report-worker

## 9.1. Purpose

Generate reports and exports from sanitized findings/summaries.

## 9.2. Outputs

```text
- Hunter Snapshot Report
- Human-readable Report
- AI/dev-readable Report
- Auth Security Report
- Readiness Report View/Export
```

## 9.3. Guardrails

```text
- no raw secrets
- no raw request/response
- no raw evidence persistence
- no absolute security guarantee
- include scope/coverage/limitations
```

---

# 10. retest-worker

## 10.1. Purpose

Manual retest for one finding/scenario.

## 10.2. Input

```json
{
  "finding_id": "FIND-001",
  "retest_scenario": {},
  "scope_snapshot": {},
  "approval_state": "not_required|required|approved|denied",
  "max_runtime_ms": 60000
}
```

## 10.3. Output

```json
{
  "result": "Fixed|Still Vulnerable|Partially Fixed|Cannot Verify",
  "sanitized_evidence_refs": [],
  "coverage_gaps": [],
  "notes": ""
}
```

## 10.4. Guardrails

```text
- retest must be tied to one finding
- no full-app rescan
- no deployment-triggered retest
- sensitive action requires User Approval Gate
- no raw evidence persistence
```

---

# 11. Docker packaging expectation

Production should use per-family images:

```text
web
api
orchestrator
browser-worker
zap-worker
nuclei-worker
openhack-worker
strix-worker
report-worker
retest-worker
```

Browser, ZAP, and Nuclei workers need separate packaging because their runtime dependencies and isolation requirements differ.
