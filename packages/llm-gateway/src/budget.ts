/**
 * Per-scan budget tracker. Stays in-process; callers wire a tracker per
 * (scanId, packageTier). See LLM_PROVIDER_SPEC.md §7.
 *
 * The gateway calls `reserve` before each LLM call. If the budget is exhausted,
 * reserve throws GuardrailError('BUDGET_EXCEEDED'). The caller can check
 * `remaining()` to decide whether to degrade gracefully.
 */

import { GuardrailError } from '@x-hunter/shared';
import type { LLMBudget } from './types.js';

export class BudgetTracker {
  private callsUsed = 0;
  private inputTokensUsed = 0;
  private outputTokensUsed = 0;

  constructor(public readonly budget: LLMBudget) {}

  reserve(estInputTokens: number = 0): void {
    if (this.callsUsed >= this.budget.maxLLMCallsPerScan) {
      throw new GuardrailError('BUDGET_EXCEEDED', 'Max LLM calls per scan exceeded', {
        used: this.callsUsed,
        limit: this.budget.maxLLMCallsPerScan,
      });
    }
    if (estInputTokens > this.budget.maxInputTokensPerCall) {
      throw new GuardrailError('BUDGET_EXCEEDED', 'Input token estimate exceeds per-call limit', {
        est: estInputTokens,
        limit: this.budget.maxInputTokensPerCall,
      });
    }
  }

  commit(usedInputTokens?: number, usedOutputTokens?: number): void {
    this.callsUsed += 1;
    if (usedInputTokens) this.inputTokensUsed += usedInputTokens;
    if (usedOutputTokens) this.outputTokensUsed += usedOutputTokens;
  }

  remaining(): { calls: number; usedInput: number; usedOutput: number } {
    return {
      calls: Math.max(0, this.budget.maxLLMCallsPerScan - this.callsUsed),
      usedInput: this.inputTokensUsed,
      usedOutput: this.outputTokensUsed,
    };
  }
}

/**
 * Coarse token estimator. We don't ship a tokenizer per provider — for
 * gateway-side budget enforcement we use a heuristic of ~4 chars / token,
 * which is conservative (over-estimates) for English/code.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
