import { describe, expect, it } from 'vitest';
import type { CodingCliBridge } from '@x-hunter/llm-gateway';
import type { LlmRouteSnapshot } from '@x-hunter/shared';
import { reasonWithCodex, selectedIds } from './strix-reasoning.js';

const snapshot = {
  capturedAt: '2026-09-28T00:00:00.000Z',
  routes: {
    attacker_hypothesis: {
      primary: { transport: 'coding_cli', cli: 'codex', model: 'cli-default', reasoningLevel: 'high' },
      fallback: { transport: 'coding_cli', cli: 'codex', model: 'cli-default', reasoningLevel: 'medium' },
    },
    validation_plan: {
      primary: { transport: 'coding_cli', cli: 'codex', model: 'cli-default', reasoningLevel: 'high' },
      fallback: { transport: 'coding_cli', cli: 'codex', model: 'cli-default', reasoningLevel: 'medium' },
    },
  },
  accepted: {
    attacker_hypothesis: { primary: true, fallback: true },
    validation_plan: { primary: true, fallback: true },
  },
} as LlmRouteSnapshot;

describe('Codex-guided S reasoning', () => {
  it('accepts only planned IDs from model output', () => {
    expect(selectedIds('["api_surface","out_of_scope","api_surface","session_auth"]', ['api_surface', 'session_auth'], 2))
      .toEqual(['api_surface', 'session_auth']);
    expect(selectedIds('not JSON', ['api_surface'], 1)).toEqual([]);
  });

  it('records two Codex calls and emits only unverified review signals', async () => {
    const prompts: string[] = [];
    const bridge: CodingCliBridge = { async complete(request) {
      prompts.push(request.userPrompt);
      return { outputText: prompts.length === 1 ? '["session_auth","invented"]' : '["read_only_baseline"]', latencyMs: 3 };
    } };
    const result = await reasonWithCodex({
      snapshot, bridge, target: 'https://example.com/', targetType: 'interactive_web_app',
      profile: 'standard', authScope: 'none', hunterIds: ['api_surface', 'session_auth'],
    });
    expect(result.audits.map((audit) => audit.useCase)).toEqual(['attacker_hypothesis', 'validation_plan']);
    expect(result.audits.every((audit) => audit.cli === 'codex')).toBe(true);
    expect(result.signals).toHaveLength(2);
    expect(result.signals.every((signal) => signal.evidenceClass === 'hypothesis' && signal.validationState === 'candidate')).toBe(true);
    expect(JSON.stringify(result.signals)).not.toContain('invented');
    expect(result.gaps).toContain('STRIX_RUNTIME_NOT_EXECUTED');
  });

  it('does not fabricate a signal when both routes fail', async () => {
    const bridge: CodingCliBridge = { async complete() { return { outputText: '', errorCode: 'CLI_QUOTA_EXHAUSTED', latencyMs: 1 }; } };
    const result = await reasonWithCodex({
      snapshot, bridge, target: 'https://example.com/', targetType: 'interactive_web_app',
      profile: 'standard', authScope: 'none', hunterIds: ['session_auth'],
    });
    expect(result.signals).toEqual([]);
    expect(result.gaps.some((gap) => gap.startsWith('llm:attacker_hypothesis:'))).toBe(true);
  });
});
