import { describe, expect, it } from 'vitest';
import { PACKAGE_BUDGETS } from './config.js';

describe('LLM package budgets', () => {
  it('uses only canonical v1 scan package keys', () => {
    expect(Object.keys(PACKAGE_BUDGETS).sort()).toEqual([
      'ai_blackhat_mindset_check',
      'enterprise_payg',
      'free_hunter',
      'monitor_workspace',
    ]);
  });

  it('maps canonical packages to the intended existing budget profiles', () => {
    const budgets = PACKAGE_BUDGETS as Record<string, (typeof PACKAGE_BUDGETS)[keyof typeof PACKAGE_BUDGETS]>;

    expect(budgets.free_hunter.maxLLMCallsPerScan).toBe(2);
    expect(budgets.ai_blackhat_mindset_check.maxLLMCallsPerScan).toBe(12);
    expect(budgets.monitor_workspace.maxLLMCallsPerScan).toBe(2);
    expect(budgets.enterprise_payg.maxLLMCallsPerScan).toBe(100);
    expect(budgets.ai_blackhat_mindset_check.allowedUseCases).toContain('blackhat_hypothesis');
    expect(budgets.enterprise_payg.allowedUseCases).toContain('enterprise_escalation_optional');
  });
});
