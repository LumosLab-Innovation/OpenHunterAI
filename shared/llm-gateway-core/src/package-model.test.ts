import { describe, expect, it } from 'vitest';
import { PACKAGE_BUDGETS } from './config.js';

describe('LLM package budgets', () => {
  it('uses only canonical v1 scan package keys', () => {
    expect(Object.keys(PACKAGE_BUDGETS).sort()).toEqual([
      'ai_blackhat_check',
      'authenticated_check',
      'free_hunter_snapshot',
    ]);
  });

  it('maps canonical packages to the intended existing budget profiles', () => {
    const budgets = PACKAGE_BUDGETS as Record<string, (typeof PACKAGE_BUDGETS)[keyof typeof PACKAGE_BUDGETS]>;

    expect(budgets.free_hunter_snapshot.maxLLMCallsPerScan).toBe(1);
    expect(budgets.ai_blackhat_check.maxLLMCallsPerScan).toBe(20);
    expect(budgets.authenticated_check.maxLLMCallsPerScan).toBe(35);
    expect(budgets.ai_blackhat_check.allowedUseCases).toContain('strix_reasoning');
    expect(budgets.authenticated_check.allowedUseCases).toContain('retest_reasoning');
  });
});
