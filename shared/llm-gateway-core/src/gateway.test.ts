import { describe, it, expect, beforeEach } from 'vitest';
import { LLMGateway } from './gateway.js';
import type { LLMProvider, LLMResponse, ProviderName, SanitizedLLMRequest } from './types.js';
import { isGuardrailError } from '@x-hunter/shared';

function stub(name: ProviderName, response: Partial<LLMResponse>, isConfig = true): LLMProvider {
  const calls: SanitizedLLMRequest[] = [];
  const provider: LLMProvider & { calls: SanitizedLLMRequest[] } = {
    name,
    isConfigured: () => isConfig,
    generate: async (req: SanitizedLLMRequest) => {
      calls.push(req);
      return {
        provider: name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText: 'ok',
        latencyMs: 1,
        ...response,
      } as LLMResponse;
    },
    calls,
  };
  return provider;
}

describe('LLMGateway', () => {
  let openai: ReturnType<typeof stub>;
  let claude: ReturnType<typeof stub>;
  let deepseek: ReturnType<typeof stub>;
  let gw: LLMGateway;

  beforeEach(() => {
    openai = stub('openai', { outputText: 'openai-out' });
    claude = stub('claude', { outputText: 'claude-out' });
    deepseek = stub('deepseek', { outputText: 'deepseek-out' });
    gw = new LLMGateway({ providers: { openai, claude, deepseek } });
  });

  it('refuses use cases not allowed by package', async () => {
    try {
      await gw.generate({
        useCase: 'strix_reasoning',
        projectId: 'p1',
        scanId: 's1',
        packageTier: 'free_hunter_snapshot',
        systemPrompt: 'sys',
        userPrompt: 'hello',
      });
      throw new Error('expected to throw');
    } catch (e) {
      expect(isGuardrailError(e)).toBe(true);
      if (isGuardrailError(e)) expect(e.code).toBe('PACKAGE_DOES_NOT_PERMIT_ACTION');
    }
  });

  it('blocks raw secrets in prompt (sanitizer)', async () => {
    try {
      await gw.generate({
        useCase: 'free_hunter_summary',
        projectId: 'p1',
        scanId: 's1',
        packageTier: 'free_hunter_snapshot',
        systemPrompt: 'sys',
        userPrompt: 'token: sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        // Use a key value the sanitizer text-pass can't drop fully:
        // we expect either the sanitizer to mask it OR the gateway to refuse.
      });
    } catch (e) {
      // ok — sanitizer blocked or call still went through after masking
    }
    // Either provider was never called OR was called without the raw token:
    const allCalls = [
      ...(openai as ReturnType<typeof stub> & { calls: SanitizedLLMRequest[] }).calls,
      ...(deepseek as ReturnType<typeof stub> & { calls: SanitizedLLMRequest[] }).calls,
    ];
    for (const call of allCalls) {
      expect(call.userPrompt).not.toContain('sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    }
  });

  it('routes free_hunter_summary primary=deepseek, fallback=openai', async () => {
    const res = await gw.generate({
      useCase: 'free_hunter_summary',
      projectId: 'p1',
      scanId: 's1',
      packageTier: 'free_hunter_snapshot',
      systemPrompt: 'sys',
      userPrompt: 'hello world',
    });
    expect(res.provider).toBe('deepseek');
    expect(res.error).toBeUndefined();
  });

  it('falls back when primary is unconfigured', async () => {
    deepseek = stub('deepseek', {}, false);
    gw = new LLMGateway({ providers: { openai, claude, deepseek } });
    const res = await gw.generate({
      useCase: 'free_hunter_summary',
      projectId: 'p1',
      scanId: 's1',
      packageTier: 'free_hunter_snapshot',
      systemPrompt: 'sys',
      userPrompt: 'hello world',
    });
    expect(res.provider).toBe('openai');
  });

  it('falls back when primary errors', async () => {
    deepseek = stub('deepseek', {
      error: { code: 'HTTP_500', message: 'boom', retryable: false },
    });
    gw = new LLMGateway({ providers: { openai, claude, deepseek } });
    const res = await gw.generate({
      useCase: 'free_hunter_summary',
      projectId: 'p1',
      scanId: 's1',
      packageTier: 'free_hunter_snapshot',
      systemPrompt: 'sys',
      userPrompt: 'hello world',
    });
    expect(res.provider).toBe('openai');
  });

  it('returns NO_PROVIDER_AVAILABLE when none configured', async () => {
    openai = stub('openai', {}, false);
    claude = stub('claude', {}, false);
    deepseek = stub('deepseek', {}, false);
    gw = new LLMGateway({ providers: { openai, claude, deepseek } });
    const res = await gw.generate({
      useCase: 'free_hunter_summary',
      projectId: 'p1',
      scanId: 's1',
      packageTier: 'free_hunter_snapshot',
      systemPrompt: 'sys',
      userPrompt: 'hello world',
    });
    expect(res.error?.code).toBe('NO_PROVIDER_AVAILABLE');
    expect(res.outputText).toBe('');
  });

  it('enforces max calls per scan', async () => {
    // Free Hunter Snapshot = 1 call per scan
    const first = await gw.generate({
      useCase: 'free_hunter_summary',
      projectId: 'p1',
      scanId: 's-budget',
      packageTier: 'free_hunter_snapshot',
      systemPrompt: 'sys',
      userPrompt: 'hi',
    });
    expect(first.error).toBeUndefined();

    try {
      await gw.generate({
        useCase: 'free_hunter_summary',
        projectId: 'p1',
        scanId: 's-budget',
        packageTier: 'free_hunter_snapshot',
        systemPrompt: 'sys',
        userPrompt: 'hi',
      });
      throw new Error('expected to throw');
    } catch (e) {
      expect(isGuardrailError(e)).toBe(true);
      if (isGuardrailError(e)) expect(e.code).toBe('BUDGET_EXCEEDED');
    }
  });
});
