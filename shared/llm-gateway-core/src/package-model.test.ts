import { describe, expect, it } from 'vitest';
import { PROFILE_BUDGETS, USE_CASE_TO_ALIAS } from './config.js';

describe('LLM profile budgets and aliases', () => {
  it('uses canonical self-host profiles', () => {
    expect(Object.keys(PROFILE_BUDGETS).sort()).toEqual(['deep', 'quick', 'standard']);
  });

  it('routes product logic through low/high reasoning aliases', () => {
    expect(USE_CASE_TO_ALIAS.signal_summary).toBe('low_reasoning_model');
    expect(USE_CASE_TO_ALIAS.candidate_dedupe).toBe('low_reasoning_model');
    expect(USE_CASE_TO_ALIAS.first_valuable_finding).toBe('high_reasoning_model');
    expect(USE_CASE_TO_ALIAS.validation_plan).toBe('high_reasoning_model');
  });

  it('applies resource ceilings, not use-case entitlements', () => {
    expect(PROFILE_BUDGETS.quick.maxLLMCallsPerScan).toBeGreaterThan(3);
    expect(PROFILE_BUDGETS.standard.maxLLMCallsPerScan).toBeGreaterThan(PROFILE_BUDGETS.quick.maxLLMCallsPerScan);
    expect(PROFILE_BUDGETS.quick).not.toHaveProperty('allowedUseCases');
  });
});
