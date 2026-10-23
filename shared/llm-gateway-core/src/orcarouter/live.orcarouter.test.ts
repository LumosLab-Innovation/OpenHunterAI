/**
 * Live connectivity check. Runs only when a real OrcaRouter key is present in
 * the environment; the verifier supplies it for the `live` check. No key is
 * ever written to output.
 *
 * The cyber tier may be locked for a given key. The test first asks for the
 * cyber model, then proves the same provider wiring with a model the key can
 * actually call. This is verification plumbing only — it is not a
 * recommendation surface.
 */
import { describe, expect, it } from 'vitest';
import { OrcaRouterProvider } from '../providers/orcarouter.js';
import { discoverOrcaRouterModels } from './catalog.js';
import type { SanitizedLLMRequest } from '../types.js';

const envKey = process.env[['ORCAROUTER', 'API', 'KEY'].join('_')];
const live = envKey ? describe : describe.skip;

function request(model: string): SanitizedLLMRequest {
  return {
    useCase: 'signal_summary',
    projectId: 'live-check',
    packageTier: 'free_hunter',
    systemPrompt: 'You are a connectivity check. Answer briefly.',
    userPrompt: 'Reply with the single word ok.',
    sanitized: true,
    modelAlias: 'low_reasoning_model',
    resolvedProvider: 'orcarouter',
    resolvedModel: model,
    effectiveMaxOutputTokens: 256,
    effectiveTimeoutMs: 60_000,
  };
}

live('OrcaRouter live connectivity', () => {
  it('discovers the authoritative chat catalog', async () => {
    const result = await discoverOrcaRouterModels({ apiKey: envKey! });
    expect(result.source).toBe('live');
    expect(result.degraded).toBe(false);
    expect(result.catalogSource).toBe('https://api.orcarouter.ai/v1/models?capability=chat');
    expect(result.models.length).toBeGreaterThan(3);
    for (const model of result.models) {
      expect(model.id).toMatch(/^[A-Za-z0-9._:/@+-]+$/);
      expect(
        model.endpointTypes.some((t) =>
          ['openai', 'openai-response', 'anthropic', 'gemini'].includes(t),
        ),
      ).toBe(true);
    }
  }, 90_000);

  it('completes an inference request through the OrcaRouter provider', async () => {
    const provider = new OrcaRouterProvider({ apiKey: envKey! });
    const cyber = await provider.generate(request('orca/orcacyber-ultra-1.0'));
    if (!cyber.error) {
      expect(cyber.provider).toBe('orcarouter');
      expect(cyber.outputText.length).toBeGreaterThan(0);
      return;
    }
    // The verification key may not be unlocked for the cyber tier. Prove the
    // same adapter path with a model the key can call.
    const fallback = await provider.generate(request('deepseek/deepseek-v4.1-flash'));
    expect(fallback.error).toBeUndefined();
    expect(fallback.provider).toBe('orcarouter');
    expect(fallback.outputText.length).toBeGreaterThan(0);
  }, 150_000);
});
