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

Every declared use case may use the gateway in an authorized scan. Profile resource ceilings limit total calls, never the number of findings or availability of a particular reasoning use case.

For reports, LLM output is recommendation-only. It may summarize sanitized facts, propose ranking reasons, and draft wording. It must not create new findings, reference unknown finding IDs, override severity policy, or add evidence that is not present in sanitized inputs.

The [method catalog and AI responsibility map](research/PENTEST_METHODS_2026.md)
place these existing use cases at discovery, hypothesis, validation planning,
reporting and manual retest. Scope authorization, execution, budgets and finding
promotion remain deterministic policy/validator responsibilities. Catalog methods
without an accepted executor remain research-only. `fix_prompt` supplies advisory
remediation context for [OpenShield](OPENSHIELD_COLLABORATION.md); it cannot run
containment, remediation or recovery actions.

---

# 4. Prompt And Data Policy

Never send raw password, raw token, raw cookie, raw API key, Authorization header, raw request/response, raw HAR, raw browser storage, raw credential, raw private data, or unsanitized secret to any provider.

If a secret/key is detected, only masked fingerprint/hash/metadata may be used and the report recommends rotate/revoke.

---

# 5. Budgets

Internal call ceilings are configurable by scan profile:

```text
quick
standard
deep
```

Budget exceeded must stop extra calls and produce budget-limited coverage/limitations. It must never fake output.

---

# 6. System-wide coding CLI routes

The twelve use cases above are the configurable reasoning modules. Configuration is system-wide: there is no per-project or per-scan override. Each module has a primary and a distinct fallback. A coding CLI route stores `cli`, `model`, and `reasoningLevel`. An API-key route is explicit; a coding CLI hop never falls through to an API key that was not saved on that hop.

Defaults:

```text
signal_summary, candidate_dedupe, suspicious_surface_ranking
  primary codex / cli-default / low
  fallback codex / cli-default / medium

all other use cases
  primary codex / cli-default / high
  fallback codex / cli-default / medium
```

`cli-default` means the CLI's own model. Any other model is unaccepted until a host probe lists it. Reasoning levels outside the per-CLI set are rejected when settings are saved. A version check does not prove login. Codex uses `codex login status`, Claude uses `claude auth status`, and Grok uses `grok models`. Gemini has no login probe until that CLI is installed.

Scan creation copies the routes and which hops preflight accepted. Later Settings edits do not change that copy. If the primary fails at runtime, only the accepted fallback is used. If neither hop was accepted, the module is a coverage gap. Deep blocks when `attacker_hypothesis`, `validation_plan`, or `report_generation` has no accepted hop. Other profiles record the gap and still require the operator to acknowledge it.

The host bridge may probe a CLI with fixed argv. It must not put host credential files into a container. On this local installation, Codex CLI 0.154.0 completion is enabled with user config, shell, code mode, apps, plugins, browser, and web search disabled; it runs read-only in an empty temporary directory. A newer Codex version fails closed until its tool boundary is verified again. Any attempted tool call is a failed completion. Claude, Gemini, Grok, and explicit API-key routes remain configurable but are not used by the local defaults; unavailable routes must report a gap. OpenHunter's tool broker remains the only component that may send a scoped probe. Call records store CLI or provider, model, reasoning level, hop, fallback, latency, and error code. They do not store the prompt or credentials.

A green probe is not a pentest gate. Installed CLIs do not prove XSS, SQLi, or IDOR.

In the local acceptance stack, the S worker may ask the locked Codex bridge to
rank already planned hunter families and safe review steps. This uses the
immutable `attacker_hypothesis` and `validation_plan` routes through the
findings service. Its output is hypothesis-only, and its provenance names
OpenHunter's Codex-guided reasoning path. It does not count as execution of the
third-party Strix CLI or as vulnerability validation. `strix:REASONING_ONLY`
remains a coverage gap, and Deep still requires a real, governed Strix runtime.

# 7. Required Tests

```text
- low_reasoning_model and high_reasoning_model resolve from env/config
- use cases map to the correct alias
- profile-based resource ceiling is enforced without commercial use-case entitlements
- prompt sanitizer masks secrets/raw evidence
- fallback/timeout/retry do not fake output
- business logic does not instantiate provider SDK directly
```
