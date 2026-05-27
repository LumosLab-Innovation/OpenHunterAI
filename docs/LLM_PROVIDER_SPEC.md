# LLM_PROVIDER_SPEC.md - Multi-provider LLM Gateway

> Moi OpenAI / Claude / DeepSeek call phai di qua mot gateway thong nhat co sanitizer, budget, fallback, timeout va logging an toan.

---

# 1. Muc tieu

OpenHunterAI dung LLM cho:

```text
- Strix Mini Summary cho Free Hunter Snapshot
- Strix hypothesis pass cho AI Black-hat Check
- Strix validation reasoning pass cho AI Black-hat/Auth
- OpenHack-style hunter summary
- finding classification
- severity/confidence explanation
- Human Report
- AI/dev Report
- fix prompt
- retest reasoning cho Monitor/manual retest
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
Provider Router
  ↓
OpenAIProvider / ClaudeProvider / DeepSeekProvider
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
  | "free_hunter_summary"
  | "openhack_hunter_summary"
  | "strix_hypothesis"
  | "strix_validation_reasoning"
  | "auth_access_control_reasoning"
  | "finding_classification"
  | "severity_confidence"
  | "human_report"
  | "ai_dev_report"
  | "auth_report"
  | "readiness_export"
  | "fix_prompt"
  | "monitor_retest_reasoning";
```

## 3.2. Request / response contract

```ts
export type PackageTier =
  | "free_hunter_snapshot"
  | "ai_blackhat_check"
  | "authenticated_check"
  | "monitor_basic"
  | "monitor_pro";

export interface LLMRequest {
  useCase: LLMUseCase;
  projectId: string;
  scanId?: string;
  findingId?: string;
  packageTier: PackageTier;
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
  provider: "openai" | "claude" | "deepseek";
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
OpenAIProvider
ClaudeProvider
DeepSeekProvider
```

---

# 4. Model aliases

Business logic chi dung alias, khong hardcode model.

```text
llm.free.summary
llm.openhack.summary
llm.blackhat.hypothesis
llm.blackhat.validation
llm.auth.access_control
llm.report.human
llm.report.ai_dev
llm.report.auth
llm.report.readiness
llm.fix_prompt.writer
llm.monitor.retest
```

Mapping provider/model nam trong config/env.

---

# 5. Routing theo package

## 5.1. Free Hunter Snapshot

Dung LLM it nhat co the.

Allowed:

```text
free_hunter_summary
openhack_hunter_summary
```

Blocked:

```text
strix_hypothesis full
strix_validation_reasoning
auth_access_control_reasoning
multi-step agent loop
```

## 5.2. AI Black-hat Check

Dung 2-pass Strix:

```text
1. strix_hypothesis
   - attacker hypotheses
   - risk areas
   - safe validation plan

2. strix_validation_reasoning
   - findings
   - severity/confidence
   - remediation
   - fix prompt
   - retest scenario
```

Allowed:

```text
strix_hypothesis
strix_validation_reasoning
finding_classification
severity_confidence
human_report
ai_dev_report
fix_prompt
```

## 5.3. Authenticated Check

Allowed:

```text
auth_access_control_reasoning
strix_hypothesis
strix_validation_reasoning
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

## 5.4. Monitor Basic / Pro

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
  free_hunter_snapshot:
    max_llm_calls_per_scan: 1
    max_input_tokens_per_call: 6000
    max_output_tokens_per_call: 1200

  ai_blackhat_check:
    max_llm_calls_per_scan: 20
    max_input_tokens_per_call: 20000
    max_output_tokens_per_call: 4000

  authenticated_check:
    max_llm_calls_per_scan: 35
    max_input_tokens_per_call: 24000
    max_output_tokens_per_call: 5000

  monitor_basic:
    max_llm_calls_per_retest: 2
    max_input_tokens_per_call: 10000
    max_output_tokens_per_call: 2000

  monitor_pro:
    max_llm_calls_per_retest: 4
    max_input_tokens_per_call: 16000
    max_output_tokens_per_call: 3000
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
- primary provider → fallback provider → graceful failure.
- Neu fallback cung loi, khong fake output.
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
- fallback provider works
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
- OpenAIProvider, ClaudeProvider, DeepSeekProvider implement chung interface.
- Business logic chi goi LLM Gateway.
- Prompt Sanitizer chay truoc moi provider call.
- Budget theo package/use case hoat dong.
- Fallback hoat dong.
- Timeout/retry hoat dong.
- Logs co token/cost/latency metadata an toan.
- Raw secrets/evidence khong xuat hien trong prompt/log/report.
```
