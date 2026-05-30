/**
 * Provider-agnostic LLM types.
 * Implementations of LLMProvider live under ./providers/<name>.ts.
 *
 * No business-logic code may instantiate or call these provider classes
 * directly — everything must go through the LLMGateway. See
 * LLM_PROVIDER_SPEC.md §2 + §3 and SECURITY_GUARDRAILS.md §12.
 */

import type { PackageTier } from '@x-hunter/shared';

export type LLMUseCase =
  | 'free_triage_flash'
  | 'first_valuable_finding_reasoning_pro'
  | 'hunter_report_for_first_finding'
  | 'openhack_hunter_summary'
  | 'blackhat_hypothesis'
  | 'blackhat_validation'
  | 'auth_scope_access_control'
  | 'finding_classification'
  | 'severity_confidence'
  | 'human_report'
  | 'ai_dev_report'
  | 'fix_prompt'
  | 'monitor_retest_reasoning'
  | 'enterprise_escalation_optional';

export type ProviderName = 'openai' | 'claude' | 'deepseek';

export interface LLMRequest {
  useCase: LLMUseCase;
  projectId: string;
  scanId?: string;
  findingId?: string;
  packageTier: PackageTier;
  authScope?: {
    enabled: boolean;
    accountMode?: 'one_account' | 'two_accounts';
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

export interface SanitizedLLMRequest extends LLMRequest {
  /** Set to true by the Prompt Sanitizer; provider adapters must assert this. */
  readonly sanitized: true;
  /** Resolved alias to use (e.g. `llm.blackhat.hypothesis.pro`). */
  readonly modelAlias: string;
  /** Resolved provider + model after routing. */
  readonly resolvedProvider: ProviderName;
  readonly resolvedModel: string;
  /** Concrete max output tokens after budget clamp. */
  readonly effectiveMaxOutputTokens: number;
  readonly effectiveTimeoutMs: number;
}

export interface LLMError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface LLMResponse {
  provider: ProviderName;
  modelAlias: string;
  model: string;
  outputText: string;
  outputJson?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  latencyMs: number;
  finishReason?: string;
  safetyBlocked?: boolean;
  error?: LLMError;
}

export interface LLMProvider {
  readonly name: ProviderName;
  generate(req: SanitizedLLMRequest, signal?: AbortSignal): Promise<LLMResponse>;
  /** Fast non-network self-check so the gateway can fall through unconfigured providers. */
  isConfigured(): boolean;
}

/** Per-package, per-call budget. See LLM_PROVIDER_SPEC.md §7. */
export interface LLMBudget {
  maxLLMCallsPerScan: number;
  maxInputTokensPerCall: number;
  maxOutputTokensPerCall: number;
  defaultTimeoutMs: number;
  /** Use cases the package may invoke. Empty array = none allowed. */
  allowedUseCases: LLMUseCase[];
}

/** Routed provider chain for one alias. */
export interface AliasRoute {
  primary: { provider: ProviderName; model: string };
  fallback?: { provider: ProviderName; model: string };
}
