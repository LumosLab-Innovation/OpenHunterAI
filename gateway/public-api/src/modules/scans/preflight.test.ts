import { describe, expect, it } from 'vitest';
import type { LlmRouteSnapshot } from '@x-hunter/shared';
import { evaluateAggressiveStagingPreflight, moduleLlmReadiness } from './preflight.js';

const future = new Date('2026-06-17T10:30:00.000Z');
const now = new Date('2026-06-17T10:00:00.000Z');

describe('evaluateAggressiveStagingPreflight', () => {
  it('uses accepted Codex module routes for Deep readiness without API keys', () => {
    const snapshot = { accepted: {
      signal_summary: { primary: true, fallback: true },
      candidate_dedupe: { primary: true, fallback: true },
      attacker_hypothesis: { primary: true, fallback: true },
      validation_plan: { primary: true, fallback: true },
      report_generation: { primary: true, fallback: true },
    } } as LlmRouteSnapshot;
    expect(moduleLlmReadiness(snapshot)).toEqual({ lowReady: true, highReady: true });
    snapshot.accepted.validation_plan.primary = false;
    snapshot.accepted.validation_plan.fallback = false;
    expect(moduleLlmReadiness(snapshot)).toEqual({ lowReady: true, highReady: false });
  });
  it('requires both model aliases, browser runtime, two fresh sessions, and canary readiness', () => {
    const result = evaluateAggressiveStagingPreflight({
      now,
      authorization: {
        authScope: 'two_accounts',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: { lowReady: true, highReady: false },
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
        authScope: 'two_accounts',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: { lowReady: true, highReady: true },
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
        authScope: 'none',
        testIntensityMode: 'controlled_attack_simulation',
        aggressiveStagingRiskAccepted: false,
      },
      llm: { lowReady: false, highReady: false },
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
        authScope: 'none',
        testIntensityMode: 'aggressive_staging',
        aggressiveStagingRiskAccepted: true,
      },
      llm: { lowReady: true, highReady: true },
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
