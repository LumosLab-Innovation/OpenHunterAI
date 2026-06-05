# LLM_PROVIDER_SPEC.md - LLM Gateway

> Business logic uses model role aliases only. Provider/model selection lives behind the LLM Gateway.

---

# 1. Model Aliases

```text
low_reasoning_model
  signal_summary
  candidate_dedupe
  suspicious_surface_ranking
  cheap triage

high_reasoning_model
  first_valuable_finding
  attacker_hypothesis
  validation_plan
  access_control_reasoning
  api_reasoning
  llm_app_reasoning
  report_generation
  fix_prompt
  retest_reasoning
```

Provider config example:

```text
LLM_LOW_REASONING_PROVIDER=deepseek
LLM_LOW_REASONING_MODEL=deepseek-v4-flash
LLM_HIGH_REASONING_PROVIDER=deepseek
LLM_HIGH_REASONING_MODEL=deepseek-v4-pro
```

Business logic must not hardcode OpenAI, Claude, Anthropic, DeepSeek, or model ids.

---

# 2. Gateway Pipeline

```text
OpenHack / Strix / Report / Retest
→ LLM Gateway
→ Prompt Sanitizer
→ Budget & Policy Check
→ Alias Router
→ Provider Adapter
→ Response Normalizer
→ safe audit/cost metadata
```

No worker or backend service calls provider SDKs directly.

---

# 3. Use Cases

```ts
type LLMUseCase =
  | "signal_summary"
  | "candidate_dedupe"
  | "suspicious_surface_ranking"
  | "first_valuable_finding"
  | "attacker_hypothesis"
  | "validation_plan"
  | "access_control_reasoning"
  | "api_reasoning"
  | "llm_app_reasoning"
  | "report_generation"
  | "fix_prompt"
  | "retest_reasoning";
```

Free Hunter may use high reasoning for `first_valuable_finding`, but is still limited by first finding/one monitored finding/one retest/7-day cooldown.

---

# 4. Prompt And Data Policy

Never send raw password, raw token, raw cookie, raw API key, Authorization header, raw request/response, raw HAR, raw browser storage, raw credential, raw private data, or unsanitized secret to any provider.

If a secret/key is detected, only masked fingerprint/hash/metadata may be used and the report recommends rotate/revoke.

---

# 5. Budgets

Internal budgets are enforced by package/use case:

```text
free_hunter
ai_blackhat_mindset_check
monitor_workspace
enterprise_payg
```

Budget exceeded must stop extra calls and produce budget-limited coverage/limitations. It must never fake output.

---

# 6. Required Tests

```text
- low_reasoning_model and high_reasoning_model resolve from env/config
- use cases map to the correct alias
- package/use-case allowance is enforced
- prompt sanitizer masks secrets/raw evidence
- fallback/timeout/retry do not fake output
- business logic does not instantiate provider SDK directly
```
