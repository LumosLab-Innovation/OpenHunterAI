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
  | 'signal_summary'
  | 'candidate_dedupe'
  | 'suspicious_surface_ranking'
  | 'first_valuable_finding'
  | 'attacker_hypothesis'
  | 'validation_plan'
  | 'access_control_reasoning'
  | 'api_reasoning'
  | 'llm_app_reasoning'
  | 'report_generation'
  | 'fix_prompt'
  | 'retest_reasoning';

export type ProviderName = 'openai' | 'claude' | 'deepseek';

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

export interface SanitizedLLMRequest extends LLMRequest {
  /** Set to true by the Prompt Sanitizer; provider adapters must assert this. */
  readonly sanitized: true;
  /** Resolved alias to use (e.g. `llm.blackhat.reasoning`). */
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
