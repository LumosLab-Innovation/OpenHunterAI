# LLM_PROVIDER_SPEC.md - DeepSeek-first LLM Gateway

> V1 dung DeepSeek-first model stack: DeepSeek V4 Flash cho triage/ranking va DeepSeek V4 Pro cho reasoning supervisor. Optional providers chi dung cho Enterprise/PAYG escalation neu duoc bat ro.

---

# 1. Muc tieu

OpenHunterAI dung LLM cho:

```text
- Free Hunter triage/ranking.
- First valuable finding reasoning cho Free Hunter.
- Hypothesis reasoning cho AI Black-hat Mindset Check.
- Validation reasoning cho AI Black-hat Mindset Check va Authenticated Scope.
- OpenHack-style hunter summary.
- Finding classification.
- Severity/confidence explanation.
- Human Report.
- AI/dev Report.
- Fix prompt.
- Retest reasoning cho Monitor/manual retest.
```

Khong module nao duoc goi truc tiep provider SDK ngoai provider adapters.

---

# 2. Architecture

```text
OpenHack / Strix / Report / Retest
  ↓
LLM Gateway
  ↓
Prompt Sanitizer
  ↓
Budget & Policy Check
  ↓
Model Router
  ↓
DeepSeekProvider
  - llm.triage.flash = DeepSeek V4 Flash
  - llm.reasoning.pro = DeepSeek V4 Pro
  ↓
Optional Enterprise/PAYG escalation provider, disabled by default
  ↓
Response Normalizer
  ↓
Audit + Metrics + Cost Log
```

---

# 3. Provider abstraction

## 3.1. Use cases

```ts
export type LLMUseCase =
  | "free_triage_flash"
  | "first_valuable_finding_reasoning_pro"
  | "hunter_report_for_first_finding"
  | "openhack_hunter_summary"
  | "blackhat_hypothesis"
  | "blackhat_validation"
  | "auth_scope_access_control"
  | "finding_classification"
  | "severity_confidence"
  | "human_report"
  | "ai_dev_report"
  | "auth_report"
  | "readiness_export"
  | "fix_prompt"
  | "monitor_retest_reasoning"
  | "enterprise_escalation_optional";
```

## 3.2. Request / response contract

```ts
export type PackageTier =
  | "free_hunter"
  | "ai_blackhat_mindset_check"
  | "monitor_workspace"
  | "enterprise_payg";

export interface LLMRequest {
  useCase: LLMUseCase;
  projectId: string;
  scanId?: string;
  findingId?: string;
  packageTier: PackageTier;
  authScope?: {
    enabled: boolean;
    accountMode?: "one_account" | "two_accounts";
  };
  systemPrompt: string;
  userPrompt: string;
  compactContext?: Record<string, unknown>;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  requireJson?: boolean;
  metadata?: Record<string, string>;
}

export interface LLMResponse {
  provider: "deepseek" | "openai" | "claude";
  modelAlias: string;
  outputText: string;
  outputJson?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  latencyMs: number;
  finishReason?: string;
  safetyBlocked?: boolean;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

Provider adapters:

```text
Required in v1:
- DeepSeekProvider

Optional, disabled by default:
- ClaudeProvider
- OpenAIProvider
```

---

# 4. Model aliases

Business logic chi dung alias, khong hardcode model.

```text
llm.free.triage.flash
llm.free.first_finding.pro
llm.blackhat.hypothesis.pro
llm.blackhat.validation.pro
llm.auth_scope.access_control.pro
llm.report.human.pro
llm.report.ai_dev.pro
llm.fix_prompt.pro
llm.monitor.retest.pro
llm.enterprise.escalation.optional
```

Mapping provider/model nam trong config/env.

---

# 5. Routing theo package

## 5.1. Free Hunter

Free Hunter allowed:

```text
- free_triage_flash
- first_valuable_finding_reasoning_pro
- hunter_report_for_first_finding
```

Free Hunter limits:

```text
- max returned findings = 1
- max monitored findings = 1
- max retests = 1
- cooldown_days = 7
- no full paid finding board
- no multi-account auth
- no full adversarial depth
```

## 5.2. AI Black-hat Mindset Check

Dung DeepSeek V4 Pro reasoning:

```text
1. blackhat_hypothesis
   - attacker hypotheses
   - risk areas
   - safe validation plan

2. blackhat_validation
   - findings
   - severity/confidence
   - remediation
   - fix prompt
   - retest scenario
```

Allowed:

```text
blackhat_hypothesis
blackhat_validation
finding_classification
severity_confidence
human_report
ai_dev_report
fix_prompt
```

## 5.3. Authenticated Scope

Authenticated Scope la mode ben trong AI Black-hat Mindset Check hoac Enterprise/PAYG.

Allowed:

```text
auth_scope_access_control
blackhat_hypothesis
blackhat_validation
finding_classification
severity_confidence
human_report
ai_dev_report
auth_report
fix_prompt
```

Requirements:

```text
- context da sanitize
- khong raw password/token/cookie
- khong raw private data
- User Approval Gate cho sensitive validation
```

## 5.4. Monitor Workspace

Monitor khong tu dong full scan. LLM chi dung cho retest reasoning neu user queue retest va goi/quota cho phep.

Allowed:

```text
monitor_retest_reasoning
fix_prompt
readiness_export neu goi/quota cho phep
```

---

# 6. Prompt Sanitizer

Truoc moi LLM call phai sanitize.

Khong dua vao provider:

```text
- raw password
- raw token
- raw cookie
- raw API key
- Authorization header
- session id
- private user data chua sanitize
- raw request/response
- raw HAR
- raw browser storage
- raw credential
```

LLM input phai la compact context:

```text
- route summary
- endpoint summary
- cookie attribute summary
- storage key summary
- scanner finding candidates
- sanitized evidence summary
- risk observations
- coverage gaps
```

---

# 7. Budget control

Default internal budgets, khong show nhu pricing benefit:

```yaml
budgets:
  free_hunter:
    max_triage_calls_flash: 1
    max_reasoning_calls_pro: 1
    max_returned_findings: 1
    max_monitored_findings: 1
    max_retests: 1
    cooldown_days: 7

  ai_blackhat_mindset_check:
    max_triage_calls_flash: 2
    max_reasoning_calls_pro: 10
    max_returned_findings: 10

  monitor_workspace:
    max_reasoning_calls_per_retest_pro: 2

  enterprise_payg:
    limits: usage_based
```

Khi vuot budget:

```text
- dung LLM calls khong can thiet
- mark step budget_limited hoac graceful failure
- report coverage/limitations neu anh huong ket qua
- khong silently fail
```

---

# 8. Fallback, retry, timeout

```text
- Moi LLM call co timeout.
- Chi retry loi retryable: network timeout, provider overloaded, rate limit co backoff.
- Khong retry vo han.
- DeepSeek-first production path; optional escalation providers chi bat cho Enterprise/PAYG.
- Neu provider loi, khong fake output.
```

---

# 9. Observability

Log metadata an toan:

```text
- request_id
- project_id
- scan_id
- finding_id neu co
- use_case
- provider
- model_alias
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- status
- error_code neu co
```

Khong log raw prompt neu prompt co the chua du lieu nhay cam. Co the log prompt hash hoac sanitized prompt preview.

---

# 10. Required tests

Phai co tests cho:

```text
- provider routing by use case
- package/use-case allowance
- optional escalation provider disabled by default
- timeout handling
- retry limit
- budget exceeded behavior
- prompt sanitizer masks token/cookie/password/private data
- raw credential/raw evidence never reaches provider adapter
- business logic cannot call provider SDK directly
```

---

# 11. Done criteria

LLM Provider Layer xong khi:

```text
- DeepSeekProvider implement production path.
- Flash/Pro model aliases hoat dong.
- Business logic chi goi LLM Gateway.
- Prompt Sanitizer chay truoc moi provider call.
- Budget theo package/use case hoat dong.
- Optional OpenAI/Claude providers khong bat buoc cho v1.
- Raw secrets/evidence khong xuat hien trong prompt/log/report.
```
