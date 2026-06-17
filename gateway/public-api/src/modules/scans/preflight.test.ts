import { describe, expect, it } from 'vitest';
import { evaluateAggressiveStagingPreflight } from './preflight.js';

const future = new Date('2026-06-17T10:30:00.000Z');
const now = new Date('2026-06-17T10:00:00.000Z');

describe('evaluateAggressiveStagingPreflight', () => {
  it('requires OpenAI primary aliases, DeepSeek fallback aliases, browser runtime, two fresh sessions, and canary readiness', () => {
    const result = evaluateAggressiveStagingPreflight({
      now,
      authorization: {
        scanMode: 'ai_blackhat_mindset_check',
        authScope: 'two_accounts',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: {
        lowPrimaryProvider: 'deepseek',
        lowFallbackProvider: 'openai',
        highPrimaryProvider: 'deepseek',
        highFallbackProvider: 'openai',
        openaiConfigured: false,
        deepseekConfigured: true,
      },
      browserSessionRuntimeReady: false,
      sessions: [
        { testAccountId: 'acct_a', status: 'active', expiresAt: future },
        { testAccountId: 'acct_b', status: 'expired', expiresAt: new Date('2026-06-17T09:00:00.000Z') },
      ],
      requireCanary: true,
      canaryReady: false,
    });

    expect(result.ok).toBe(false);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      'LLM_NOT_CONFIGURED',
      'BROWSER_SESSION_UNAVAILABLE',
      'AUTH_SESSION_REQUIRED',
      'CANARY_UNAVAILABLE',
    ]);
  });

  it('passes for a ready aggressive staging two-account canary run', () => {
    const result = evaluateAggressiveStagingPreflight({
      now,
      authorization: {
        scanMode: 'free_hunter',
        authScope: 'two_accounts',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: {
        lowPrimaryProvider: 'openai',
        lowFallbackProvider: 'deepseek',
        highPrimaryProvider: 'openai',
        highFallbackProvider: 'deepseek',
        openaiConfigured: true,
        deepseekConfigured: true,
      },
      browserSessionRuntimeReady: true,
      sessions: [
        { testAccountId: 'acct_a', status: 'active', expiresAt: future },
        { testAccountId: 'acct_b', status: 'active', expiresAt: future },
      ],
      requireCanary: true,
      canaryReady: true,
    });

    expect(result).toEqual({
      ok: true,
      checks: expect.arrayContaining([
        expect.objectContaining({ code: 'LLM_READY', ok: true }),
        expect.objectContaining({ code: 'AUTH_SESSIONS_READY', ok: true }),
        expect.objectContaining({ code: 'CANARY_READY', ok: true }),
      ]),
      failures: [],
    });
  });

  it('does not require the canary contract for non-aggressive scans', () => {
    const result = evaluateAggressiveStagingPreflight({
      now,
      authorization: {
        scanMode: 'free_hunter',
        authScope: 'none',
        testIntensityMode: 'controlled_attack_simulation',
        aggressiveStagingRiskAccepted: false,
      },
      llm: {
        lowPrimaryProvider: 'deepseek',
        lowFallbackProvider: 'openai',
        highPrimaryProvider: 'deepseek',
        highFallbackProvider: 'openai',
        openaiConfigured: false,
        deepseekConfigured: false,
      },
      browserSessionRuntimeReady: false,
      sessions: [],
      requireCanary: true,
      canaryReady: false,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('does not require canary readiness for ordinary aggressive staging scans without the canary E2E profile', () => {
    const result = evaluateAggressiveStagingPreflight({
      now,
      authorization: {
        scanMode: 'ai_blackhat_mindset_check',
        authScope: 'none',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: {
        lowPrimaryProvider: 'openai',
        lowFallbackProvider: 'deepseek',
        highPrimaryProvider: 'openai',
        highFallbackProvider: 'deepseek',
        openaiConfigured: true,
        deepseekConfigured: true,
      },
      browserSessionRuntimeReady: true,
      sessions: [],
      requireCanary: false,
      canaryReady: false,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.checks.map((check) => check.code)).not.toContain('CANARY_UNAVAILABLE');
  });
});
