# WORKER_SPEC.md — AI White-hat Security Workspace

> Tài liệu đặc tả các worker v1.  
> Mọi worker phải tuân thủ SECURITY_GUARDRAILS.md và chỉ chạy trong verified scope.

---

# 1. Worker principles

Mọi worker phải có:

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
```

Không worker nào được:

```text
- chạy vô hạn
- scan ngoài scope
- log raw secret
- silently fail
- trả fake success
```

---

# 2. Worker list v1

```text
browser-inspector
zap-signal
nuclei-signal
openhack-hunter
strix-core
llm-gateway
report
retest
```

Không có worker v1 cho:

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

---

# 3. browser-inspector worker

## 3.1. Purpose

Mở app thật bằng Playwright/CDP và quan sát bề mặt web/app.

## 3.2. Input

```json
{
  "scan_id": "scan_123",
  "project_id": "proj_123",
  "target_url": "https://example.com",
  "allowed_hosts": ["example.com"],
  "excluded_paths": [],
  "mode": "free|light|standard|auth",
  "test_account_ref": "optional"
}
```

## 3.3. Output

```json
{
  "routes": [],
  "api_endpoints": [],
  "network_summary": {},
  "cookie_summary": {},
  "storage_summary": {},
  "console_errors": [],
  "screenshots": [],
  "evidence_refs": []
}
```

## 3.4. Guardrails

```text
- không navigate ngoài allowed_hosts
- không lưu raw credential
- không log token/cookie
- có timeout
- browser context riêng cho mỗi scan/account
```

---

# 4. zap-signal worker

## 4.1. Purpose

Tạo DAST signal nhanh/rẻ bằng ZAP passive/baseline.

## 4.2. Modes

```text
free: passive mini
light: passive/baseline limited
standard: baseline/passive standard
auth: passive/baseline trên authenticated traffic nếu có
```

## 4.3. Output

```json
{
  "scanner": "zap",
  "alerts": [],
  "finding_candidates": [],
  "raw_output_ref": "optional"
}
```

## 4.4. Guardrails

```text
- không full active scan mặc định
- không scan ngoài scope
- timeout bắt buộc
- fail thì report lỗi, không fake success
```

---

# 5. nuclei-signal worker

## 5.1. Purpose

Chạy curated safe templates để tìm exposure/misconfig/known patterns.

## 5.2. Profiles

```text
mini-safe
standard-safe
```

## 5.3. Blocked template types

```text
destructive
intrusive
bruteforce
dos
malware
credential-attack
```

## 5.4. Output

```json
{
  "scanner": "nuclei",
  "template_profile": "mini-safe",
  "results": [],
  "finding_candidates": []
}
```

---

# 6. openhack-hunter worker

## 6.1. Purpose

Tạo Free Hunter Layer và workflow/schema cho finding.

## 6.2. Mini hunters

```text
Vibe-code Exposure Hunter
Frontend Secret & Storage Hunter
API Surface Hunter
Auth/Session Smoke Hunter
AI App Smoke Hunter
```

## 6.3. Input

```json
{
  "browser_observations": {},
  "zap_candidates": [],
  "nuclei_candidates": [],
  "mode": "free|light|standard|auth"
}
```

## 6.4. Output

```json
{
  "findings": [],
  "warnings": [],
  "hardening": [],
  "coverage_gaps": [],
  "hunter_summary_context": {}
}
```

---

# 7. strix-core worker

## 7.1. Purpose

Dùng Strix attacker-mindset reasoning để phân tích rủi ro và finding.

## 7.2. Modes

```text
free: Strix Mini Summary only
light: limited reasoning
standard: attacker-mindset reasoning
auth: attacker-mindset reasoning with authenticated context
```

## 7.3. Input

```json
{
  "compact_security_context": {},
  "sanitized_evidence": [],
  "hunter_output": {},
  "finding_candidates": [],
  "package": "free|light|standard|auth"
}
```

## 7.4. Output

```json
{
  "observations": [],
  "prioritized_findings": [],
  "severity_confidence_updates": [],
  "remediation": [],
  "fix_prompts": [],
  "retest_proposals": []
}
```

## 7.5. Guardrails

```text
- không nhận raw secret
- không scan ngoài scope
- action nhạy cảm phải qua Product Policy Gate
- không tự chạy destructive action
```

---

# 8. llm-gateway worker/service

## 8.1. Purpose

Gateway chung cho OpenAI / Claude / DeepSeek.

## 8.2. Responsibilities

```text
- prompt sanitizer
- budget check
- provider routing
- fallback
- retry
- timeout
- response normalization
- token/cost/latency logging
```

## 8.3. Providers

```text
OpenAIProvider
ClaudeProvider
DeepSeekProvider
```

## 8.4. Rule

Không module nào được gọi trực tiếp provider SDK.  
Chi tiết trong `LLM_PROVIDER_SPEC.md`.

---

# 9. report worker

## 9.1. Purpose

Sinh report.

## 9.2. Outputs

```text
- Free Hunter Snapshot Report
- Human-readable report
- AI/dev-readable technical report
```

## 9.3. Guardrails

```text
- mọi evidence phải qua sanitizer
- không raw secret
- không ghi “100% secure”
- phải nêu scope/coverage/limitations
```

---

# 10. retest worker

## 10.1. Purpose

Manual retest từng finding.

## 10.2. Input

```json
{
  "finding_id": "FIND-001",
  "retest_scenario": {},
  "scope_snapshot": {},
  "user_approval": "required_if_sensitive"
}
```

## 10.3. Output

```json
{
  "result": "Fixed|Still Vulnerable|Partially Fixed|Cannot Verify",
  "evidence_refs": [],
  "notes": ""
}
```

## 10.4. Guardrails

```text
- retest phải gắn với finding
- không scan lại toàn bộ app
- không chạy tự động sau deploy
- action nhạy cảm cần User Approval Gate
```
