import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CredentialGenerationTracker,
  EnvFileCredentialStore,
  activeOrcaRouterKey,
  apiKeyCredential,
  looksLikeOrcaRouterKey,
  persistCredential,
  pkceCredential,
} from './credentials.js';

const FAKE_API_KEY = 'sk-orca-test-111111111111111111111111';
const FAKE_PKCE_KEY = 'sk-orca-test-222222222222222222222222';

let dir: string;
let envFile: string;

beforeEach(async () => {
  delete process.env.ORCAROUTER_API_KEY;
  dir = await mkdtemp(join(tmpdir(), 'orca-credentials-'));
  envFile = join(dir, '.env.local');
});

afterEach(async () => {
  delete process.env.ORCAROUTER_API_KEY;
  vi.restoreAllMocks();
});

describe('EnvFileCredentialStore', () => {
  it('saves, reads and clears the key in the existing env file', async () => {
    await writeFile(envFile, 'OPENAI_API_KEY=sk-existing\n# comment\n', 'utf8');
    const store = new EnvFileCredentialStore(envFile);

    await store.save(FAKE_API_KEY);
    expect(await store.read()).toBe(FAKE_API_KEY);
    const contents = await readFile(envFile, 'utf8');
    expect(contents).toContain('ORCAROUTER_API_KEY=');
    expect(contents).toContain('OPENAI_API_KEY=sk-existing');
    expect(contents).toContain('# comment');
    if (process.platform !== 'win32') expect((await stat(envFile)).mode & 0o777).toBe(0o600);

    await store.clear();
    expect(await store.read()).toBeUndefined();
    expect(await readFile(envFile, 'utf8')).not.toContain('ORCAROUTER_API_KEY');
    expect(await readFile(envFile, 'utf8')).toContain('OPENAI_API_KEY=sk-existing');
  });

  it('replaces an existing value instead of appending a second line', async () => {
    const store = new EnvFileCredentialStore(envFile);
    await store.save(FAKE_API_KEY);
    await store.save(FAKE_PKCE_KEY);
    const contents = await readFile(envFile, 'utf8');
    expect(contents.match(/ORCAROUTER_API_KEY=/g)).toHaveLength(1);
    expect(await store.read()).toBe(FAKE_PKCE_KEY);
  });

  it('does not leak the key through error messages', async () => {
    const store = new EnvFileCredentialStore('/proc/definitely-not-writable/.env.local');
    try {
      await store.save(FAKE_API_KEY);
      throw new Error('expected save to fail');
    } catch (e) {
      expect(String(e)).not.toContain(FAKE_API_KEY);
    }
  });
});

describe('API-key adapter', () => {
  it('accepts a well-shaped key and masks it', () => {
    const result = apiKeyCredential(FAKE_API_KEY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credential.source).toBe('api_key');
      expect(result.credential.apiKey).toBe(FAKE_API_KEY);
      expect(result.maskedKey).not.toContain(FAKE_API_KEY);
    }
  });

  it('rejects a key without the OrcaRouter prefix', () => {
    const result = apiKeyCredential('sk-openai-nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_KEY');
      expect(result.error.message).not.toContain('sk-openai-nope');
    }
    expect(looksLikeOrcaRouterKey('sk-openai-nope')).toBe(false);
  });
});

describe('PKCE adapter', () => {
  it('produces the same credential result shape as the API-key adapter', () => {
    const api = apiKeyCredential(FAKE_API_KEY);
    const pkce = pkceCredential({ key: FAKE_PKCE_KEY, scope: 'api', userId: '42', generation: 2 });
    expect(api.ok && pkce.ok).toBe(true);
    if (api.ok && pkce.ok) {
      // Downstream code consumes apiKey/generation only; the source differs for audit.
      expect(Object.keys(pkce.credential).sort()).toEqual(
        expect.arrayContaining(['apiKey', 'generation', 'scope', 'source', 'userId']),
      );
      expect(pkce.credential.apiKey.startsWith('sk-orca-')).toBe(true);
      expect(pkce.maskedKey).not.toContain(FAKE_PKCE_KEY);
    }
  });

  it('rejects an unusable key returned by the exchange', () => {
    const result = pkceCredential({ key: 'not-a-key', scope: 'api' });
    expect(result.ok).toBe(false);
  });
});

describe('credential seam', () => {
  it('persists both adapters through the same store and downstream key reader', async () => {
    const store = new EnvFileCredentialStore(envFile);
    const api = apiKeyCredential(FAKE_API_KEY);
    const pkce = pkceCredential({ key: FAKE_PKCE_KEY, scope: 'api' });

    expect((await persistCredential(store, api)).ok).toBe(true);
    expect(await activeOrcaRouterKey(store)).toBe(FAKE_API_KEY);

    // The model provider/catalog path does not care which adapter produced it.
    expect((await persistCredential(store, pkce)).ok).toBe(true);
    expect(await activeOrcaRouterKey(store)).toBe(FAKE_PKCE_KEY);
  });

  it('reports a store failure without exposing the key', async () => {
    const store = new EnvFileCredentialStore('/proc/definitely-not-writable/.env.local');
    const result = await persistCredential(store, apiKeyCredential(FAKE_API_KEY));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('STORE_IO');
      expect(result.error.message).not.toContain(FAKE_API_KEY);
    }
  });
});

describe('CredentialGenerationTracker', () => {
  it('marks only the exact rejected generation for reauthentication', () => {
    const tracker = new CredentialGenerationTracker();
    const first = tracker.begin('account-a');
    expect(tracker.markRejected('account-a', first)).toBe(true);
    expect(tracker.needsReauth('account-a')).toBe(true);

    const reconnected = tracker.begin('account-a');
    expect(tracker.needsReauth('account-a')).toBe(false);
    // A late 401 from the old generation must not poison the new credential.
    expect(tracker.markRejected('account-a', first)).toBe(false);
    expect(tracker.needsReauth('account-a')).toBe(false);
    expect(tracker.markRejected('account-a', reconnected)).toBe(true);
  });

  it('isolates accounts', () => {
    const tracker = new CredentialGenerationTracker();
    const a = tracker.begin('account-a');
    tracker.markRejected('account-a', a);
    expect(tracker.needsReauth('account-b')).toBe(false);
  });
});
