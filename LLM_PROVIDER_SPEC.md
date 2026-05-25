# LLM_PROVIDER_SPEC.md — Multi-provider LLM Gateway

> Tài liệu này định nghĩa lớp LLM Provider cho AI White-hat Security Workspace.  
> Mục tiêu: toàn bộ OpenAI / Claude / DeepSeek phải đi qua một gateway thống nhất, có sanitizer, budget, fallback, logging và provider routing. Không gọi trực tiếp SDK provider rải rác trong business logic.

---

# 1. Mục tiêu

## 1.1. Vì sao cần LLM Gateway?

Hệ thống dùng LLM ở nhiều điểm:

```text
- Strix Mini Summary cho Free Hunter Snapshot
- Strix attacker-mindset reasoning cho Standard/Auth
- OpenHack-style hunter workflow summary
- Finding classification
- Severity/confidence explanation
- Human-readable report
- AI/dev-readable report
- AI fix prompt
- Retest reasoning cho một số finding cần ngữ cảnh
```

Nếu gọi trực tiếp từng provider ở nhiều nơi, hệ thống sẽ khó kiểm soát:

```text
- chi phí
- timeout
- retry
- fallback
- prompt sanitizer
- token budget
- logging
- bảo mật credential
- thay provider/model
```

Do đó, mọi LLM call phải đi qua:

```text
LLM Gateway / Provider Adapter
```

---

# 2. Kiến trúc tổng quan

```text
Strix Core / OpenHack Hunter / Report Service / Retest Service
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

Không module nào được gọi trực tiếp:

```text
openai.*
anthropic.*
deepseek.*
```

trừ trong provider adapter tương ứng.

---

# 3. Provider abstraction

## 3.1. Interface chung

```ts
export type LLMUseCase =
  | "free_hunter_summary"
  | "openhack_hunter_summary"
  | "strix_reasoning"
  | "finding_classification"
  | "severity_confidence"
  | "human_report"
  | "ai_dev_report"
  | "fix_prompt"
  | "retest_reasoning";

export interface LLMRequest {
  useCase: LLMUseCase;
  projectId: string;
  scanId?: string;
  findingId?: string;
  packageTier: "free" | "light" | "standard" | "auth" | "launch";
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

export interface LLMProvider {
  generate(request: SanitizedLLMRequest): Promise<LLMResponse>;
}
```

## 3.2. Provider adapters bắt buộc

```text
OpenAIProvider
ClaudeProvider
DeepSeekProvider
```

Mỗi adapter chịu trách nhiệm:

```text
- map request chung sang format provider cụ thể
- gọi API provider
- normalize response về LLMResponse
- normalize lỗi
- expose usage/token nếu provider trả về
```

---

# 4. Model aliases

Không hardcode model cụ thể trong business logic.  
Business logic chỉ dùng alias.

```text
llm.free.summary
llm.light.summary
llm.standard.reasoning
llm.auth.reasoning
llm.report.writer
llm.fix_prompt.writer
llm.retest.reasoning
```

Mapping provider/model nằm trong config:

```yaml
llm:
  aliases:
    llm.free.summary:
      primary:
        provider: deepseek
        model: ${DEEPSEEK_FREE_SUMMARY_MODEL}
      fallback:
        provider: openai
        model: ${OPENAI_FREE_SUMMARY_MODEL}

    llm.standard.reasoning:
      primary:
        provider: claude
        model: ${CLAUDE_STANDARD_REASONING_MODEL}
      fallback:
        provider: openai
        model: ${OPENAI_STANDARD_REASONING_MODEL}

    llm.auth.reasoning:
      primary:
        provider: claude
        model: ${CLAUDE_AUTH_REASONING_MODEL}
      fallback:
        provider: openai
        model: ${OPENAI_AUTH_REASONING_MODEL}

    llm.report.writer:
      primary:
        provider: openai
        model: ${OPENAI_REPORT_MODEL}
      fallback:
        provider: deepseek
        model: ${DEEPSEEK_REPORT_MODEL}
```

Các biến model cụ thể đặt ở environment/config, không ghi cứng trong code.

---

# 5. Routing theo package

## 5.1. Free

Dùng LLM ít nhất có thể.

```text
- OpenHack-style mini hunter workflow chạy bằng rule/schema trước.
- Strix Mini Summary chỉ đọc compact context.
- Không chạy full Strix adversarial reasoning.
```

Use cases được phép:

```text
free_hunter_summary
openhack_hunter_summary
```

Không được phép:

```text
strix_reasoning full
deep validation
multi-step agent loop
```

## 5.2. Light

Dùng LLM giới hạn.

```text
- Strix limited reasoning trên suspicious surfaces.
- Report/fix prompt ngắn.
```

Use cases được phép:

```text
openhack_hunter_summary
finding_classification
severity_confidence
human_report
fix_prompt
```

## 5.3. Standard

Dùng Strix attacker-mindset reasoning trong verified scope.

Use cases được phép:

```text
strix_reasoning
finding_classification
severity_confidence
human_report
ai_dev_report
fix_prompt
retest_reasoning
```

## 5.4. Auth

Dùng Strix reasoning với authenticated context đã sanitize.

Yêu cầu:

```text
- không raw password/token/cookie
- không raw private data
- context phải qua sanitizer
- action nhạy cảm phải qua User Approval Gate
```

## 5.5. Launch Audit

Có thể dùng LLM sâu hơn, nhưng Expert Human Review chỉ được ghi nếu có reviewer thật.

---

# 6. Prompt Sanitizer

## 6.1. Sanitizer bắt buộc

Mọi prompt đi qua LLM Gateway phải được sanitize.

Phải loại/mask:

```text
- password
- token
- cookie
- API key
- Authorization header
- session id
- private user data
- raw credential
- full raw request/response nhạy cảm
```

## 6.2. Input cho LLM phải là compact context

Không đưa:

```text
raw HAR
full DOM lớn
full JS bundle
full logs
raw browser storage
raw cookie jar
```

Đưa:

```text
- route summary
- endpoint summary
- cookie attribute summary
- storage key summary
- scanner finding candidates
- sanitized evidence
- risk observations
- coverage gaps
```

---

# 7. Budget control

## 7.1. Budget theo package

```yaml
budgets:
  free:
    max_llm_calls_per_scan: 1
    max_input_tokens_per_call: 6000
    max_output_tokens_per_call: 1200

  light:
    max_llm_calls_per_scan: 5
    max_input_tokens_per_call: 10000
    max_output_tokens_per_call: 2000

  standard:
    max_llm_calls_per_scan: 20
    max_input_tokens_per_call: 20000
    max_output_tokens_per_call: 4000

  auth:
    max_llm_calls_per_scan: 35
    max_input_tokens_per_call: 24000
    max_output_tokens_per_call: 5000
```

Các số trên là default nội bộ, không hiển thị cho user như benefit.

## 7.2. Không bán hypothesis budget

Không ghi ở pricing:

```text
Gói này có 10 hypotheses.
```

Pricing chỉ bán:

```text
- coverage
- authenticated context
- report
- retest quota
- evidence
- expert review nếu có
```

## 7.3. Khi vượt budget

Nếu vượt budget:

```text
- dừng LLM calls không cần thiết
- ghi scan_step = budget_limited
- report ghi coverage/limitations nếu ảnh hưởng kết quả
- không silently fail
```

---

# 8. Fallback, retry, timeout

## 8.1. Timeout

Mỗi LLM call phải có timeout.

```text
free/light: timeout ngắn hơn
standard/auth: timeout dài hơn nhưng vẫn có hard limit
```

## 8.2. Retry

Chỉ retry lỗi retryable:

```text
- network timeout
- provider overloaded
- rate limit có backoff
```

Không retry vô hạn.

## 8.3. Fallback

Nếu provider chính lỗi:

```text
primary provider → fallback provider → graceful failure
```

Nếu fallback cũng lỗi:

```text
- mark LLM step failed
- dùng deterministic fallback summary nếu có
- không fake output
```

---

# 9. Observability

Mỗi LLM call phải log metadata an toàn:

```text
- request_id
- project_id
- scan_id
- finding_id nếu có
- use_case
- provider
- model_alias
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- status
- error_code nếu có
```

Không log raw prompt nếu prompt có thể chứa dữ liệu nhạy cảm.

Có thể log prompt hash hoặc sanitized prompt preview.

---

# 10. Secrets management

API keys không được hardcode.

Dùng environment/secret manager:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
```

Không commit `.env`.

Không log API key.

Không trả API key ra frontend.

---

# 11. Required tests

Phải có tests cho:

```text
- provider routing by use case
- fallback provider works
- timeout handling
- retry limit
- budget exceeded behavior
- prompt sanitizer masks token/cookie/password
- raw credential never reaches provider adapter
- business logic cannot call provider SDK directly
```

---

# 12. Done criteria

LLM Provider Layer được xem là xong khi:

```text
- OpenAIProvider, ClaudeProvider, DeepSeekProvider implement chung interface.
- Business logic chỉ gọi LLM Gateway.
- Prompt Sanitizer chạy trước mọi provider call.
- Budget theo package hoạt động.
- Fallback hoạt động.
- Timeout/retry hoạt động.
- Logs có token/cost/latency metadata.
- Raw secrets không xuất hiện trong prompt/log/report.
