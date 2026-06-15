import { describe, it, expect } from 'vitest';
import { LLMGateway } from '@x-hunter/llm-gateway';
import type { LLMProvider, LLMResponse, ProviderName, SanitizedLLMRequest } from '@x-hunter/llm-gateway';
import {
  deterministicRanking,
  parseTriageOutput,
  selectPromotionCandidates,
  triageCandidates,
  type CandidateSummary,
} from './triage.js';

const candidates: CandidateSummary[] = [
  { id: 'c1', title: 'XSS', severity: 'high', confidence: 'medium', category: 'xss', affectedAsset: '/a' },
  { id: 'c2', title: 'Info leak', severity: 'low', confidence: 'high', category: 'exposure', affectedAsset: '/b' },
  { id: 'c3', title: 'SQLi', severity: 'critical', confidence: 'low', category: 'sqli', affectedAsset: '/c' },
];

function stubProvider(name: ProviderName, output: string, configured = true): LLMProvider {
  return {
    name,
    isConfigured: () => configured,
    generate: async (req: SanitizedLLMRequest): Promise<LLMResponse> => ({
      provider: name,
      modelAlias: req.modelAlias,
      model: req.resolvedModel,
      outputText: output,
      latencyMs: 1,
    }),
  };
}

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
  it('uses LLM output when available', async () => {
    const gw = new LLMGateway({
      providers: {
        deepseek: stubProvider('deepseek', '{"rankedIds":["c3","c1","c2"],"duplicateClusters":[["c1","c3"]]}'),
        openai: stubProvider('openai', '', false),
        claude: stubProvider('claude', '', false),
      },
    });
    const rec = await triageCandidates(gw, { projectId: 'p1', scanId: 's1', packageTier: 'ai_blackhat_mindset_check', candidates });
    expect(rec.rankedIds).toEqual(['c3', 'c1', 'c2']);
    expect(rec.duplicateClusters).toEqual([['c1', 'c3']]);
    expect(rec.fallback).toBe(false);
  });

  it('falls back to deterministic ranking when no provider is configured', async () => {
    const gw = new LLMGateway({
      providers: {
        deepseek: stubProvider('deepseek', '', false),
        openai: stubProvider('openai', '', false),
        claude: stubProvider('claude', '', false),
      },
    });
    const rec = await triageCandidates(gw, { projectId: 'p1', scanId: 's1', packageTier: 'ai_blackhat_mindset_check', candidates });
    expect(rec.fallback).toBe(true);
    expect(rec.rankedIds).toEqual(['c3', 'c1', 'c2']);
  });

  it('does not call the LLM for a single candidate', async () => {
    const gw = new LLMGateway({
      providers: {
        deepseek: stubProvider('deepseek', 'should-not-be-used'),
        openai: stubProvider('openai', '', false),
        claude: stubProvider('claude', '', false),
      },
    });
    const rec = await triageCandidates(gw, {
      projectId: 'p1',
      scanId: 's1',
      packageTier: 'free_hunter',
      candidates: [candidates[0]!],
    });
    expect(rec.rankedIds).toEqual(['c1']);
    expect(rec.fallback).toBe(true);
  });
});

describe('selectPromotionCandidates', () => {
  it('promotes only valuable candidates with sanitized evidence and respects Free Hunter quota', () => {
    const selected = selectPromotionCandidates(
      [
        { id: 'info', title: 'Info', severity: 'info', confidence: 'high', category: 'headers', affectedAsset: '/', evidence: { description: 'ok', sanitized: true } },
        { id: 'weak', title: 'Weak', severity: 'medium', confidence: 'low', category: 'auth', affectedAsset: '/a', evidence: { description: 'ok', sanitized: true } },
        { id: 'good', title: 'Good', severity: 'high', confidence: 'medium', category: 'auth', affectedAsset: '/b', evidence: { description: 'ok', sanitized: true } },
        { id: 'raw', title: 'Raw', severity: 'critical', confidence: 'high', category: 'secret', affectedAsset: '/c', evidence: { rawRequest: 'GET /token=secret' } },
      ],
      { rankedIds: ['raw', 'good', 'weak', 'info', 'invented'], duplicateClusters: [], fallback: false },
      { scanMode: 'free_hunter' },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['good']);
  });

  it('does not let model-ranked unknown ids or duplicate cluster members create extra findings', () => {
    const selected = selectPromotionCandidates(
      [
        { id: 'a', title: 'A', severity: 'critical', confidence: 'high', category: 'api', affectedAsset: '/a', evidence: { description: 'sanitized', sanitized: true } },
        { id: 'b', title: 'B', severity: 'high', confidence: 'high', category: 'api', affectedAsset: '/b', evidence: { description: 'sanitized', sanitized: true } },
      ],
      { rankedIds: ['unknown', 'b', 'a'], duplicateClusters: [['b', 'a'], ['unknown', 'a']], fallback: false },
      { scanMode: 'ai_blackhat_mindset_check', maxFindings: 10 },
    );

    expect(selected.map((candidate) => candidate.id)).toEqual(['b']);
  });
});
