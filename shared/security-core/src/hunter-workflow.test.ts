import { describe, expect, it } from 'vitest';
import { canTransitionScenario, summarizeScenarioCoverage } from './hunter-workflow.js';

describe('hunter workflow', () => {
  it('does not finalize while a scenario is queued or running', () => {
    const coverage = summarizeScenarioCoverage([
      { id: 'a', hunterId: 'api_surface', state: 'completed', evidenceRefs: [] },
      { id: 'b', hunterId: 'api_auth', state: 'running', evidenceRefs: [] },
    ]);
    expect(coverage.canFinalize).toBe(false);
    expect(coverage.pending).toBe(1);
  });

  it('records blocked and skipped scenarios as explicit coverage gaps', () => {
    const coverage = summarizeScenarioCoverage([
      { id: 'a', hunterId: 'api_auth', state: 'blocked', evidenceRefs: [], coverageGap: 'approval denied' },
      { id: 'b', hunterId: 'data_exposure', state: 'skipped', evidenceRefs: [] },
    ]);
    expect(coverage.canFinalize).toBe(true);
    expect(coverage.gaps).toEqual(['approval denied', 'data_exposure:skipped']);
  });

  it('allows resume from blocked but not reopening completed scenarios', () => {
    expect(canTransitionScenario('blocked', 'running')).toBe(true);
    expect(canTransitionScenario('completed', 'running')).toBe(false);
  });
});
