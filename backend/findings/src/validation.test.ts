import { describe, expect, it } from 'vitest';
import { evaluateIndependentDecision } from './validation.js';

describe('evaluateIndependentDecision', () => {
  it('does not trust a worker validated_finding claim without replayable evidence', () => {
    expect(
      evaluateIndependentDecision({
        severity: 'critical',
        evidence: { sanitized: true, validationState: 'validated_finding', evidenceClass: 'validated_finding' },
      }).state,
    ).toBe('needs_more_evidence');
  });

  it('does not validate even complete worker-supplied metadata without independent replay', () => {
    const decision = evaluateIndependentDecision({
        severity: 'high',
        evidence: {
          sanitized: true,
          demonstratedImpact: 'User A read an object owned by User B.',
          counterevidence: 'The fixed route denied the same cross-user request.',
          evidenceRefs: ['http_exchange:exploit:req-1', 'http_exchange:baseline:req-2'],
        },
      });
    expect(decision.state).toBe('needs_more_evidence');
    expect(decision.rationale).toContain('independent replay');
    expect(decision.validator).toBe('evidence_policy_v1');
  });

  it('rejects passive hardening warnings and raw evidence', () => {
    expect(evaluateIndependentDecision({ severity: 'medium', evidence: { sanitized: true, evidenceClass: 'hardening_warning' } }).state).toBe('rejected');
    expect(evaluateIndependentDecision({ severity: 'high', evidence: { sanitized: true, rawRequest: 'secret' } }).state).toBe('rejected');
  });
});
