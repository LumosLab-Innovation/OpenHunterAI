import { describe, expect, it } from 'vitest';
import type { LlmRouteSnapshot } from '@x-hunter/shared';
import type { CodingCliBridge } from '@x-hunter/llm-gateway';
import { signalSummaryInput, summarizeSignals } from './signal-summary.js';

const snapshot = {
  capturedAt: '2026-09-27T00:00:00.000Z',
  routes: {
    signal_summary: {
      primary: { transport: 'coding_cli', cli: 'gemini', model: 'cli-default', reasoningLevel: 'low' },
      fallback: { transport: 'coding_cli', cli: 'grok', model: 'cli-default', reasoningLevel: 'low' },
    },
  },
  accepted: { signal_summary: { primary: false, fallback: true } },
} as LlmRouteSnapshot;

describe('signal summary', () => {
  it('uses only the accepted snapshot hop and omits the prompt from the audit', async () => {
    const seen: string[] = [];
    const bridge: CodingCliBridge = {
      async complete(request) {
        seen.push(request.route.cli);
        return { outputText: 'No candidates were available to summarize.', latencyMs: 5, cost: 0 };
      },
    };
    const result = await summarizeSignals({
      snapshot,
      bridge,
      scan: { testIntensityMode: 'controlled_attack_simulation', steps: [{ kind: 'zap_signal', state: 'skipped' }] },
      candidateCount: 0,
    });
    expect(seen).toEqual(['grok']);
    expect(result.text).toContain('No candidates');
    expect(result.audits[0]).toMatchObject({ cli: 'grok', fallbackUsed: true, cost: 0 });
    expect(JSON.stringify(result.audits)).not.toContain('zap_signal');
    expect(signalSummaryInput({ testIntensityMode: 'controlled_attack_simulation' }, 0)).not.toContain('password');
  });

  it('records a coverage gap when the snapshot is missing instead of calling an API key', async () => {
    const result = await summarizeSignals({
      snapshot: null,
      bridge: { async complete() { throw new Error('should not be called'); } },
      scan: { testIntensityMode: 'safe_discovery' },
      candidateCount: 0,
    });
    expect(result.coverageGap).toBe('llm:signal_summary:SNAPSHOT_MISSING');
  });
});
