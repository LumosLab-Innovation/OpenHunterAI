import { describe, expect, it } from 'vitest';
import { PACKAGE_BUDGETS, USE_CASE_TO_ALIAS } from './config.js';

describe('LLM package budgets and aliases', () => {
  it('uses canonical commercial package keys', () => {
    expect(Object.keys(PACKAGE_BUDGETS).sort()).toEqual([
      'ai_blackhat_mindset_check',
      'enterprise_payg',
      'free_hunter',
      'monitor_workspace',
    ]);
  });

  it('routes product logic through low/high reasoning aliases', () => {
    expect(USE_CASE_TO_ALIAS.signal_summary).toBe('low_reasoning_model');
    expect(USE_CASE_TO_ALIAS.candidate_dedupe).toBe('low_reasoning_model');
    expect(USE_CASE_TO_ALIAS.first_valuable_finding).toBe('high_reasoning_model');
    expect(USE_CASE_TO_ALIAS.validation_plan).toBe('high_reasoning_model');
  });

  it('enforces Free Hunter limits while allowing first valuable finding reasoning', () => {
    expect(PACKAGE_BUDGETS.free_hunter.maxLLMCallsPerScan).toBe(3);
    expect(PACKAGE_BUDGETS.free_hunter.allowedUseCases).toContain('first_valuable_finding');
    expect(PACKAGE_BUDGETS.free_hunter.allowedUseCases).not.toContain('attacker_hypothesis');
  });
});
