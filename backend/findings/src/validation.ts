export type IndependentDecisionState = 'candidate' | 'rejected' | 'needs_more_evidence' | 'validated';

export interface IndependentDecision {
  state: IndependentDecisionState;
  rationale: string;
  counterevidence?: string;
  validator: 'evidence_policy_v1';
  evidenceRefs: string[];
}

export interface ValidationCandidate {
  severity: string;
  evidence: unknown;
}

const RAW_EVIDENCE_KEYS = ['rawRequest', 'rawResponse', 'rawHar', 'rawCookie', 'rawToken', 'rawSecret'];
const REPLAYABLE_PREFIXES = [
  'http_exchange:',
  'screenshot:',
  'artifact_sha256:',
  'tool_output_sha256:',
  'openhunter-canary:',
];

/**
 * Deterministic metadata gate. Worker confidence and validationState are
 * deliberately ignored. Worker-supplied evidence references are claims, not
 * independently verified artifacts; this gate cannot validate a finding.
 */
export function evaluateIndependentDecision(candidate: ValidationCandidate): IndependentDecision {
  const evidence = objectValue(candidate.evidence);
  const refs = stringArray(evidence.evidenceRefs).filter((ref) => REPLAYABLE_PREFIXES.some((p) => ref.startsWith(p)));
  const counterevidence = textValue(evidence.counterevidence);
  const impact = textValue(evidence.demonstratedImpact);

  if (RAW_EVIDENCE_KEYS.some((key) => evidence[key] !== undefined)) {
    return decision('rejected', 'Raw or sensitive evidence is forbidden.', refs, counterevidence);
  }
  if (evidence.evidenceClass === 'hardening_warning' || evidence.evidenceClass === 'signal') {
    return decision('rejected', 'Hardening and passive signals are not promotable findings.', refs, counterevidence);
  }
  if (evidence.sanitized !== true) {
    return decision('needs_more_evidence', 'Evidence must be sanitized before validation.', refs, counterevidence);
  }
  if (!impact) {
    return decision('needs_more_evidence', 'Demonstrated impact is missing.', refs, counterevidence);
  }
  if (refs.length === 0) {
    return decision('needs_more_evidence', 'No replayable evidence reference is attached.', refs, counterevidence);
  }

  if (candidate.severity === 'high' || candidate.severity === 'critical') {
    const hasBaseline = refs.some((ref) => ref.startsWith('http_exchange:baseline:') || ref.includes(':fixed_route'));
    const hasExploit = refs.some((ref) => ref.startsWith('http_exchange:exploit:') || ref.includes(':vulnerable_route'));
    if (!hasBaseline || !hasExploit) {
      return decision('needs_more_evidence', 'High/Critical findings require both baseline and exploit evidence.', refs, counterevidence);
    }
    if (!counterevidence) {
      return decision('needs_more_evidence', 'High/Critical findings require explicit counterevidence.', refs);
    }
  }

  return decision('needs_more_evidence', 'Evidence metadata is complete, but independent replay/artifact verification is not implemented.', refs, counterevidence);
}

function decision(
  state: IndependentDecisionState,
  rationale: string,
  evidenceRefs: string[],
  counterevidence?: string,
): IndependentDecision {
  return { state, rationale, evidenceRefs, counterevidence, validator: 'evidence_policy_v1' };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
