import { describe, it, expect } from 'vitest';
import type { CodingCliBridge } from '@x-hunter/llm-gateway';
import type { LlmRouteSnapshot } from '@x-hunter/shared';
import {
  deterministicRanking,
  parseTriageOutput,
  selectPromotionCandidates,
  triageCandidates,
  type CandidateSummary,
} from './triage.js';

const snapshot = {
  capturedAt: '2026-09-27T00:00:00.000Z',
  routes: {
    candidate_dedupe: {
      primary: { transport: 'coding_cli', cli: 'claude', model: 'cli-default', reasoningLevel: 'low' },
      fallback: { transport: 'coding_cli', cli: 'grok', model: 'cli-default', reasoningLevel: 'low' },
    },
  },
  accepted: { candidate_dedupe: { primary: true, fallback: false } },
} as LlmRouteSnapshot;

function bridgeReturning(outputText: string, errorCode?: string): CodingCliBridge {
  return { async complete() { return { outputText, latencyMs: 1, ...(errorCode ? { errorCode } : {}) }; } };
}

const candidates: CandidateSummary[] = [
  { id: 'c1', title: 'XSS', severity: 'high', confidence: 'medium', category: 'xss', affectedAsset: '/a' },
  { id: 'c2', title: 'Info leak', severity: 'low', confidence: 'high', category: 'exposure', affectedAsset: '/b' },
  { id: 'c3', title: 'SQLi', severity: 'critical', confidence: 'low', category: 'sqli', affectedAsset: '/c' },
];

describe('deterministicRanking', () => {
  it('orders by severity then confidence', () => {
    // critical > high > low; c3 critical first, then c1 high, then c2 low.
    expect(deterministicRanking(candidates)).toEqual(['c3', 'c1', 'c2']);
  });
});

describe('parseTriageOutput', () => {
  it('keeps only known ids and appends omitted ones deterministically', () => {
    const rec = parseTriageOutput('{"rankedIds":["c1","bogus"],"duplicateClusters":[]}', candidates);
    expect(rec).not.toBeNull();
    // c1 first (from model), then remaining in deterministic order (c3, c2).
    expect(rec!.rankedIds).toEqual(['c1', 'c3', 'c2']);
    expect(rec!.fallback).toBe(false);
  });

  it('drops duplicate clusters with unknown or single ids', () => {
    const rec = parseTriageOutput('{"rankedIds":[],"duplicateClusters":[["c1","c3"],["c2","x"],["c1"]]}', candidates);
    expect(rec!.duplicateClusters).toEqual([['c1', 'c3']]);
  });

  it('returns null on invalid JSON', () => {
    expect(parseTriageOutput('not json', candidates)).toBeNull();
  });
});

describe('triageCandidates', () => {
  it('uses the snapshot CLI output when the bridge returns known ids', async () => {
    const rec = await triageCandidates({
      snapshot,
      bridge: bridgeReturning('{"rankedIds":["c3","c1","c2"],"duplicateClusters":[["c1","c3"]]}'),
      projectId: 'p1',
      scanId: 's1',
      profile: 'standard',
      candidates,
    });
    expect(rec.rankedIds).toEqual(['c3', 'c1', 'c2']);
    expect(rec.duplicateClusters).toEqual([['c1', 'c3']]);
    expect(rec.fallback).toBe(false);
    expect(rec.audits[0]?.cli).toBe('claude');
  });

  it('falls back to deterministic ranking when the snapshot route is unavailable', async () => {
    const rec = await triageCandidates({
      snapshot,
      bridge: bridgeReturning('', 'BRIDGE_UNAVAILABLE'),
      projectId: 'p1',
      scanId: 's1',
      profile: 'standard',
      candidates,
    });
    expect(rec.fallback).toBe(true);
    expect(rec.rankedIds).toEqual(['c3', 'c1', 'c2']);
    expect(rec.coverageGap).toContain('candidate_dedupe');
  });

  it('does not call the bridge for a single candidate', async () => {
    const rec = await triageCandidates({
      snapshot,
      bridge: { async complete() { throw new Error('should not be called'); } },
      projectId: 'p1',
      scanId: 's1',
      profile: 'quick',
      candidates: [candidates[0]!],
    });
    expect(rec.rankedIds).toEqual(['c1']);
    expect(rec.fallback).toBe(true);
  });
});

describe('selectPromotionCandidates', () => {
  it('keeps two separately validated findings in the same scan', () => {
    const selected = selectPromotionCandidates([
      { id: 'a', title: 'A', severity: 'medium', confidence: 'high', category: 'xss', affectedAsset: '/a',
        evidence: { description: 'sanitized', sanitized: true },
        decision: { state: 'validated', rationale: 'replayed', evidenceRefs: ['http_exchange:a'] } },
      { id: 'b', title: 'B', severity: 'medium', confidence: 'high', category: 'sqli', affectedAsset: '/b',
        evidence: { description: 'sanitized', sanitized: true },
        decision: { state: 'validated', rationale: 'replayed', evidenceRefs: ['http_exchange:b'] } },
    ], { rankedIds: ['a', 'b'], duplicateClusters: [], fallback: false });
    expect(selected.map((candidate) => candidate.id)).toEqual(['a', 'b']);
  });

  it('promotes only valuable candidates with independent evidence', () => {
    const selected = selectPromotionCandidates(
      [
        { id: 'info', title: 'Info', severity: 'info', confidence: 'high', category: 'headers', affectedAsset: '/', evidence: { description: 'ok', sanitized: true } },
        { id: 'weak', title: 'Weak', severity: 'medium', confidence: 'low', category: 'auth', affectedAsset: '/a', evidence: { description: 'ok', sanitized: true } },
        {
          id: 'good',
          title: 'Good',
          severity: 'high',
          confidence: 'medium',
          category: 'auth',
          affectedAsset: '/b',
          evidence: { description: 'ok', sanitized: true, demonstratedImpact: 'impact', counterevidence: 'negative control' },
          decision: { state: 'validated', rationale: 'independent gate passed', evidenceRefs: ['artifact_sha256:abc'] },
        },
        { id: 'raw', title: 'Raw', severity: 'critical', confidence: 'high', category: 'secret', affectedAsset: '/c', evidence: { rawRequest: 'GET /token=secret' } },
      ],
      { rankedIds: ['raw', 'good', 'weak', 'info', 'invented'], duplicateClusters: [], fallback: false },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['good']);
  });

  it('does not let model-ranked unknown ids or duplicate cluster members create extra findings', () => {
    const selected = selectPromotionCandidates(
      [
        {
          id: 'a',
          title: 'A',
          severity: 'critical',
          confidence: 'high',
          category: 'api',
          affectedAsset: '/a',
          evidence: { description: 'sanitized', sanitized: true, demonstratedImpact: 'impact', counterevidence: 'negative control' },
          decision: { state: 'validated', rationale: 'independent gate passed', evidenceRefs: ['artifact_sha256:a'] },
        },
        {
          id: 'b',
          title: 'B',
          severity: 'high',
          confidence: 'high',
          category: 'api',
          affectedAsset: '/b',
          evidence: { description: 'sanitized', sanitized: true, demonstratedImpact: 'impact', counterevidence: 'negative control' },
          decision: { state: 'validated', rationale: 'independent gate passed', evidenceRefs: ['artifact_sha256:b'] },
        },
      ],
      { rankedIds: ['unknown', 'b', 'a'], duplicateClusters: [['b', 'a'], ['unknown', 'a']], fallback: false },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['b']);
  });

  it('does not promote passive missing CSP header evidence as a finding', () => {
    const selected = selectPromotionCandidates(
      [
        {
          id: 'csp',
          title: 'Content Security Policy (CSP) Header Not Set',
          severity: 'medium',
          confidence: 'high',
          category: 'missing_security_header',
          affectedAsset: 'https://kopymatch.com',
          evidence: {
            description: 'No CSP header observed during passive response inspection.',
            sanitized: true,
            evidenceClass: 'hardening_warning',
          },
        },
      ],
      { rankedIds: ['csp'], duplicateClusters: [], fallback: true },
    );

    expect(selected).toEqual([]);
  });

  it('promotes only candidates with a validated finding evidence gate', () => {
    const selected = selectPromotionCandidates(
      [
        {
          id: 'validated',
          title: 'Validated reflected XSS',
          severity: 'high',
          confidence: 'high',
          category: 'xss',
          affectedAsset: 'https://example.com/search',
          evidence: {
            description: 'Benign in-scope payload was reflected and executed in a controlled browser context.',
            sanitized: true,
            demonstratedImpact: 'script executed', counterevidence: 'safe baseline did not execute',
          },
          decision: { state: 'validated', rationale: 'independent gate passed', evidenceRefs: ['artifact_sha256:xss'] },
        },
      ],
      { rankedIds: ['validated'], duplicateClusters: [], fallback: true },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['validated']);
  });

  it('does not promote a worker claim without an independent validated decision', () => {
    const selected = selectPromotionCandidates(
      [{
        id: 'worker-only', title: 'Worker claim', severity: 'critical', confidence: 'high',
        category: 'auth', affectedAsset: '/admin',
        evidence: { description: 'claimed', sanitized: true, validationState: 'validated_finding', evidenceRefs: ['artifact_sha256:x'] },
      }],
      { rankedIds: ['worker-only'], duplicateClusters: [], fallback: true },
    );
    expect(selected).toEqual([]);
  });
});
