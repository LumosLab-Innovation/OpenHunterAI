/**
 * LLM Gateway — the single entry point for any LLM call in the system.
 *
 * Responsibilities per LLM_PROVIDER_SPEC.md:
 *   1. Enforce package's allowed use cases.
 *   2. Run Prompt Sanitizer.
 *   3. Apply budget tracker.
 *   4. Resolve alias → provider + model.
 *   5. Time-out / retry / fallback to secondary provider.
 *   6. Emit structured log per call (no raw prompt).
 */

import { createLogger, GuardrailError, type Logger } from '@x-hunter/shared';
import { BudgetTracker, estimateTokens } from './budget.js';
import { aliasFor, budgetFor, PACKAGE_BUDGETS, routeFor } from './config.js';
import { sanitizePrompt } from './sanitizer.js';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ProviderName,
  SanitizedLLMRequest,
} from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
import { DeepSeekProvider } from './providers/deepseek.js';

export interface LLMGatewayOptions {
  providers?: Partial<Record<ProviderName, LLMProvider>>;
  logger?: Logger;
  /** Optional per-call attempt cap. Default 1 (no retry). */
  retryAttempts?: number;
}

export class LLMGateway {
  private readonly providers: Record<ProviderName, LLMProvider>;
  private readonly logger: Logger;
  private readonly retryAttempts: number;
  /** scanId → BudgetTracker */
  private readonly buckets = new Map<string, BudgetTracker>();

  constructor(opts: LLMGatewayOptions = {}) {
    this.providers = {
      openai: opts.providers?.openai ?? new OpenAIProvider(),
      claude: opts.providers?.claude ?? new ClaudeProvider(),
      deepseek: opts.providers?.deepseek ?? new DeepSeekProvider(),
    };
    this.logger = opts.logger ?? createLogger({ component: 'llm-gateway' });
    this.retryAttempts = opts.retryAttempts ?? 1;
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    // 1. Use-case must be allowed for this package.
    const budget = budgetFor(req.packageTier);
    if (!budget.allowedUseCases.includes(req.useCase)) {
      throw new GuardrailError(
        'PACKAGE_DOES_NOT_PERMIT_ACTION',
        `Use case ${req.useCase} not allowed for package ${req.packageTier}`,
        { useCase: req.useCase, package: req.packageTier },
      );
    }

    // 2. Sanitize.
    const sanitized = sanitizePrompt(req);

    // 3. Budget.
    const bucketKey = req.scanId || `__nokey__:${req.projectId}`;
    let tracker = this.buckets.get(bucketKey);
    if (!tracker) {
      tracker = new BudgetTracker(budget);
      this.buckets.set(bucketKey, tracker);
    }
    const estInput = estimateTokens(
      sanitized.systemPrompt + '\n' + sanitized.userPrompt +
        (sanitized.compactContext ? JSON.stringify(sanitized.compactContext) : ''),
    );
    tracker.reserve(estInput);

    // 4. Resolve route.
    const alias = aliasFor(req.useCase);
    const route = routeFor(alias);

    // 5. Build sanitized request.
    const requestedMax = req.maxOutputTokens ?? budget.maxOutputTokensPerCall;
    const effectiveMaxOutputTokens = Math.min(requestedMax, budget.maxOutputTokensPerCall);

    const sanitizedReq = (provider: ProviderName, model: string): SanitizedLLMRequest => ({
      ...req,
      systemPrompt: sanitized.systemPrompt,
      userPrompt: sanitized.userPrompt,
      compactContext: sanitized.compactContext,
      sanitized: true,
      modelAlias: alias,
      resolvedProvider: provider,
      resolvedModel: model,
      effectiveMaxOutputTokens,
      effectiveTimeoutMs: budget.defaultTimeoutMs,
    });

    // 6. Try primary → fallback.
    const chain = [route.primary, ...(route.fallback ? [route.fallback] : [])];
    let lastResponse: LLMResponse | undefined;
    for (const hop of chain) {
      const provider = this.providers[hop.provider];
      if (!provider.isConfigured()) {
        this.logger.warn('provider_not_configured', {
          provider: hop.provider,
          alias,
        });
        continue;
      }
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        const res = await provider.generate(sanitizedReq(hop.provider, hop.model));
        this.logger.info('llm_call', {
          request_id: req.metadata?.requestId,
          project_id: req.projectId,
          scan_id: req.scanId,
          finding_id: req.findingId,
          use_case: req.useCase,
          provider: res.provider,
          model_alias: alias,
          model: res.model,
          latency_ms: res.latencyMs,
          input_tokens: res.inputTokens,
          output_tokens: res.outputTokens,
          status: res.error ? 'error' : 'ok',
          error_code: res.error?.code,
          attempt,
        });
        lastResponse = res;
        if (!res.error) {
          tracker.commit(res.inputTokens, res.outputTokens);
          return res;
        }
        if (!res.error.retryable || attempt >= this.retryAttempts) break;
        // Backoff: 250ms * attempt
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }

    // 7. All providers failed → graceful failure (do not fake output).
    tracker.commit(0, 0);
    if (lastResponse) return lastResponse;
    return {
      provider: 'openai',
      modelAlias: alias,
      model: 'unknown',
      outputText: '',
      latencyMs: 0,
      error: {
        code: 'NO_PROVIDER_AVAILABLE',
        message: 'No LLM provider is configured.',
        retryable: false,
      },
    };
  }

  /** For tests. */
  resetBudgets(): void {
    this.buckets.clear();
  }
}

export { PACKAGE_BUDGETS };
