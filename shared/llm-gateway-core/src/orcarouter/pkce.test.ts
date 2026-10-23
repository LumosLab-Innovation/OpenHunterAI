import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ORCA_EXCHANGE_PATH,
  OrcaRouterPkceFlow,
  buildAuthorizeUrl,
  createPkceSecrets,
  exchangePkceCode,
  pkceChallenge,
  stateMatches,
} from './pkce.js';
import { apiKeyCredential, pkceCredential } from './credentials.js';

const AUTH_BASE = 'https://www.orcarouter.ai';
const FAKE_CODE = 'fake-auth-code';
const FAKE_KEY = 'sk-orca-test-333333333333333333333333';

afterEach(() => {
  vi.restoreAllMocks();
});

function okExchange(body: unknown = { key: FAKE_KEY, user_id: 'u1', scope: 'api' }) {
  return vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
}

describe('PKCE primitives', () => {
  it('matches the RFC 7636 S256 test vector', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('creates a fresh verifier and state for every attempt', () => {
    const a = createPkceSecrets();
    const b = createPkceSecrets();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
    expect(a.challenge).toBe(pkceChallenge(a.verifier));
    expect(a.challenge).not.toMatch(/=/);
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('compares state in constant time and rejects null/length mismatch', () => {
    expect(stateMatches('abc', 'abc')).toBe(true);
    expect(stateMatches('abc', 'abd')).toBe(false);
    expect(stateMatches('abc', 'abcd')).toBe(false);
    expect(stateMatches('abc', null)).toBe(false);
  });
});

describe('authorize URL', () => {
  it('uses the auth origin, /auth and S256 without leaking the verifier', () => {
    const { verifier, challenge, state } = createPkceSecrets();
    const url = new URL(
      buildAuthorizeUrl({
        authBaseUrl: AUTH_BASE,
        callbackUrl: 'http://127.0.0.1:51733/cb',
        challenge,
        state,
        appName: 'OpenHunterAI',
      }),
    );
    expect(url.origin).toBe(AUTH_BASE);
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(challenge);
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('scope')).toBe('api');
    expect(url.toString()).not.toContain(verifier);
  });
});

describe('code exchange', () => {
  it('posts to /api/v1/auth/keys on the auth origin with the S256 body', async () => {
    const fetchImpl = okExchange();
    const result = await exchangePkceCode({
      authBaseUrl: AUTH_BASE,
      code: FAKE_CODE,
      verifier: 'v'.repeat(43),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${AUTH_BASE}${ORCA_EXCHANGE_PATH}`);
    expect(url).not.toContain('api.orcarouter.ai/v1/auth');
    expect(JSON.parse(String(init.body))).toEqual({
      code: FAKE_CODE,
      code_verifier: 'v'.repeat(43),
      code_challenge_method: 'S256',
    });
  });

  it('maps 403 to an invalid/expired/reused code error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 403 }));
    const result = await exchangePkceCode({
      authBaseUrl: AUTH_BASE,
      code: FAKE_CODE,
      verifier: 'v'.repeat(43),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PKCE_CODE_INVALID');
      expect(result.message).not.toContain(FAKE_CODE);
      expect(result.message).not.toContain(FAKE_KEY);
    }
  });

  it('maps 429 to a rate-limit error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429 }));
    const result = await exchangePkceCode({
      authBaseUrl: AUTH_BASE,
      code: FAKE_CODE,
      verifier: 'v'.repeat(43),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(!result.ok && result.code).toBe('PKCE_RATE_LIMITED');
  });

  it('rejects a downgraded granted scope instead of assuming the requested one', async () => {
    const fetchImpl = okExchange({ key: FAKE_KEY, scope: 'connector' });
    const result = await exchangePkceCode({
      authBaseUrl: AUTH_BASE,
      code: FAKE_CODE,
      verifier: 'v'.repeat(43),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PKCE_SCOPE_MISMATCH');
  });

  it('maps transport failures without leaking credentials', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`connect ECONNRESET ${FAKE_KEY}`);
    });
    const result = await exchangePkceCode({
      authBaseUrl: AUTH_BASE,
      code: FAKE_CODE,
      verifier: 'v'.repeat(43),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PKCE_NETWORK');
      expect(result.message).not.toContain(FAKE_KEY);
    }
  });
});

async function getCallback(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      })
      .on('error', reject);
  });
}

describe('Flow A loopback', () => {
  it('completes the flow and persists a masked credential', async () => {
    const persisted: unknown[] = [];
    const fetchImpl = okExchange();
    const flow = new OrcaRouterPkceFlow({
      authBaseUrl: AUTH_BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idFactory: () => 'attempt-1',
      onCredential: (result) => {
        persisted.push(result);
      },
    });
    const view = await flow.startLoopback();
    expect(view.callbackUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/cb$/);
    expect(JSON.stringify(view)).not.toMatch(/code_verifier/);

    const callback = new URL(view.callbackUrl);
    callback.searchParams.set('state', new URL(view.authorizeUrl).searchParams.get('state')!);
    callback.searchParams.set('code', FAKE_CODE);
    expect(await getCallback(callback.toString())).toBe(200);

    await vi.waitFor(() => expect(flow.get('attempt-1')?.status).toBe('complete'));
    const done = flow.get('attempt-1');
    expect(done?.maskedKey).toBeTruthy();
    expect(done?.maskedKey).not.toContain(FAKE_KEY);
    expect(persisted).toHaveLength(1);

    // A replayed callback cannot re-exchange a single-use code. The listener
    // may already be released, so a transport failure is also acceptable.
    await getCallback(callback.toString()).catch(() => 0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a callback with a mismatched state before using the code', async () => {
    const fetchImpl = okExchange();
    const flow = new OrcaRouterPkceFlow({
      authBaseUrl: AUTH_BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idFactory: () => 'attempt-2',
      onCredential: () => undefined,
    });
    const view = await flow.startLoopback();
    const callback = new URL(view.callbackUrl);
    callback.searchParams.set('state', 'attacker-state');
    callback.searchParams.set('code', FAKE_CODE);
    await getCallback(callback.toString());
    await vi.waitFor(() => expect(flow.get('attempt-2')?.status).toBe('error'));
    expect(flow.get('attempt-2')?.error?.code).toBe('PKCE_STATE_MISMATCH');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles denial and explicit cancellation', async () => {
    const flow = new OrcaRouterPkceFlow({
      authBaseUrl: AUTH_BASE,
      fetchImpl: okExchange() as unknown as typeof fetch,
      idFactory: () => 'attempt-3',
      onCredential: () => undefined,
    });
    const view = await flow.startLoopback();
    const callback = new URL(view.callbackUrl);
    callback.searchParams.set('state', new URL(view.authorizeUrl).searchParams.get('state')!);
    callback.searchParams.set('error', 'access_denied');
    await getCallback(callback.toString());
    await vi.waitFor(() => expect(flow.get('attempt-3')?.status).toBe('error'));
    expect(flow.get('attempt-3')?.error?.code).toBe('PKCE_DENIED');

    const second = await flow.startLoopback();
    expect(flow.cancel(second.id)).toBe(true);
    expect(flow.get(second.id)?.status).toBe('cancelled');
  });

  it('expires pending attempts and releases the listener', async () => {
    vi.useFakeTimers();
    try {
      const flow = new OrcaRouterPkceFlow({
        authBaseUrl: AUTH_BASE,
        fetchImpl: okExchange() as unknown as typeof fetch,
        idFactory: () => 'attempt-4',
        onCredential: () => undefined,
      });
      const view = await flow.startLoopback();
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
      expect(flow.get('attempt-4')?.status).toBe('expired');
      await expect(fetch(view.callbackUrl, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Flow B out-of-band', () => {
  it('redeems a pasted code with S256 and completes once', async () => {
    const fetchImpl = okExchange();
    const flow = new OrcaRouterPkceFlow({
      authBaseUrl: AUTH_BASE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idFactory: () => 'attempt-oob',
      onCredential: () => undefined,
    });
    const view = flow.startOutOfBand();
    expect(new URL(view.authorizeUrl).searchParams.get('callback_url')).toBe('oob');
    expect(new URL(view.authorizeUrl).searchParams.get('code_challenge_method')).toBe('S256');

    const done = await flow.submitCode('attempt-oob', FAKE_CODE);
    expect(done.status).toBe('complete');
    expect(done.maskedKey).not.toContain(FAKE_KEY);

    await flow.submitCode('attempt-oob', FAKE_CODE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('adapter parity through the connect seam', () => {
  it('yields the same credential result from API-key and PKCE adapters', () => {
    const api = apiKeyCredential(FAKE_KEY);
    const pkce = pkceCredential({ key: FAKE_KEY, scope: 'api' });
    expect(api.ok && pkce.ok).toBe(true);
    if (api.ok && pkce.ok) {
      expect(pkce.credential.apiKey).toBe(api.credential.apiKey);
      expect(pkce.maskedKey).toBe(api.maskedKey);
    }
  });
});
