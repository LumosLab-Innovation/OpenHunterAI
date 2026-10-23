import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ORCAROUTER_API_BASE_URL,
  ORCAROUTER_AUTH_BASE_URL,
  OrcaRouterProvider,
  maskOrcaRouterKey,
  normalizeOrigin,
  orcaRouterApiBase,
  orcaRouterAuthBase,
} from './orcarouter.js';
import type { SanitizedLLMRequest } from '../types.js';

function req(overrides: Partial<SanitizedLLMRequest> = {}): SanitizedLLMRequest {
  return {
    useCase: 'signal_summary',
    projectId: 'p1',
    scanId: 's1',
    packageTier: 'free_hunter',
    systemPrompt: 'system',
    userPrompt: 'user',
    sanitized: true,
    modelAlias: 'low_reasoning_model',
    resolvedProvider: 'orcarouter',
    resolvedModel: 'orcarouter/auto',
    effectiveMaxOutputTokens: 256,
    effectiveTimeoutMs: 5_000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const FAKE_KEY = 'sk-orca-test-000000000000000000000000';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('OrcaRouterProvider', () => {
  it('routes inference to the OrcaRouter API origin with Bearer auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        choices: [{ message: { content: 'routed' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      });
    });

    const provider = new OrcaRouterProvider({ apiKey: FAKE_KEY });
    const res = await provider.generate(req());

    expect(res.outputText).toBe('routed');
    expect(res.provider).toBe('orcarouter');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.orcarouter.ai/v1/chat/completions');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${FAKE_KEY}`);
    expect(JSON.parse(String(calls[0].init?.body)).model).toBe('orcarouter/auto');
  });

  it('reports a 401 as a terminal reauthentication requirement', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ error: { message: 'invalid key', code: 'invalid_api_key' } }, 401),
    );
    const res = await new OrcaRouterProvider({ apiKey: FAKE_KEY }).generate(req());
    expect(res.error?.code).toBe('NEEDS_REAUTH');
    expect(res.error?.retryable).toBe(false);
    expect(res.error?.message).not.toContain(FAKE_KEY);
  });

  it('keeps 429/5xx retryable and surfaces the provider message', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ error: { message: 'slow down', code: 'rate_limited' } }, 429),
    );
    const res = await new OrcaRouterProvider({ apiKey: FAKE_KEY }).generate(req());
    expect(res.error?.code).toBe('rate_limited');
    expect(res.error?.retryable).toBe(true);
  });

  it('does not call the network without a key', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const res = await new OrcaRouterProvider({ apiKey: '' }).generate(req());
    expect(res.error?.code).toBe('NOT_CONFIGURED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an unsanitized request', async () => {
    const provider = new OrcaRouterProvider({ apiKey: FAKE_KEY });
    await expect(provider.generate(req({ sanitized: false } as never))).rejects.toThrow(
      /non-sanitized/,
    );
  });
});

describe('OrcaRouter origins', () => {
  it('keeps auth and API origins separate by default', () => {
    expect(orcaRouterApiBase({})).toBe(ORCAROUTER_API_BASE_URL);
    expect(orcaRouterAuthBase({})).toBe(ORCAROUTER_AUTH_BASE_URL);
    expect(orcaRouterApiBase({})).not.toContain('/auth');
  });

  it('honours explicit overrides over the shared self-hosted base', () => {
    const env = {
      ORCA_BASE_URL: 'https://shared.example',
      ORCA_API_BASE_URL: 'https://api.example/v1/',
      ORCA_AUTH_BASE_URL: 'https://auth.example',
    };
    expect(orcaRouterApiBase(env)).toBe('https://api.example/v1');
    expect(orcaRouterAuthBase(env)).toBe('https://auth.example');
    expect(orcaRouterApiBase({ ORCA_BASE_URL: 'https://shared.example' })).toBe(
      'https://shared.example',
    );
  });

  it('rejects remote plaintext origins but permits loopback HTTP', () => {
    expect(() => normalizeOrigin('http://example.com', 'test')).toThrow(/HTTPS/);
    expect(normalizeOrigin('http://127.0.0.1:4000', 'test')).toBe('http://127.0.0.1:4000');
    expect(() => normalizeOrigin('https://user:pass@example.com', 'test')).toThrow(/userinfo/);
  });
});

describe('maskOrcaRouterKey', () => {
  it('never returns the whole secret', () => {
    const masked = maskOrcaRouterKey(FAKE_KEY);
    expect(masked).not.toBe(FAKE_KEY);
    expect(masked).toContain('…');
    expect(masked.length).toBeLessThan(FAKE_KEY.length);
  });
});

describe('provider registry regression', () => {
  it('accepts orcarouter as an alias provider', async () => {
    vi.resetModules();
    process.env.LLM_LOW_REASONING_PROVIDER = 'orcarouter';
    process.env.LLM_LOW_REASONING_MODEL = 'orcarouter/auto';
    const { ALIAS_ROUTES } = await import('../config.js');
    expect(ALIAS_ROUTES.low_reasoning_model.primary).toEqual({
      provider: 'orcarouter',
      model: 'orcarouter/auto',
    });
    delete process.env.LLM_LOW_REASONING_PROVIDER;
    delete process.env.LLM_LOW_REASONING_MODEL;
    vi.resetModules();
  });
});
