import { describe, it, expect } from 'vitest';
import { runOpenHackHunters } from './index.js';
import type { ScopeSnapshot } from '@x-hunter/shared';
import type { BrowserObservation } from '@x-hunter/browser-inspector';

const scope: ScopeSnapshot = {
  allowedHosts: ['example.com'],
  allowedPaths: [],
  excludedPaths: [],
  testAccountPermission: false,
  sensitiveActionPermission: false,
  scanPackage: 'free',
  verifiedDomain: 'example.com',
  capturedAt: '2025-01-01T00:00:00Z',
};

function obs(partial: Partial<BrowserObservation>): BrowserObservation {
  return {
    routes: [],
    apiEndpoints: [],
    cookies: [],
    storageKeys: [],
    consoleErrors: [],
    policyBlocks: [],
    ...partial,
  };
}

describe('OpenHack hunters', () => {
  it('flags exposed .env paths', async () => {
    const res = await runOpenHackHunters({
      scanId: 's',
      projectId: 'p',
      mode: 'free',
      scope,
      browser: obs({
        routes: [{ url: 'https://example.com/.env', method: 'GET', statusCode: 200 }],
      }),
    });
    expect(res.candidates.some((c) => /\.env/.test(c.title) || c.affectedAsset === '/.env')).toBe(
      true,
    );
  });

  it('flags localStorage tokens', async () => {
    const res = await runOpenHackHunters({
      scanId: 's',
      projectId: 'p',
      mode: 'free',
      scope,
      browser: obs({
        storageKeys: [{ scope: 'localStorage', keyName: 'access_token', looksTokenLike: true }],
      }),
    });
    expect(res.candidates.some((c) => c.category === 'frontend-secret')).toBe(true);
  });

  it('flags session cookies missing HttpOnly', async () => {
    const res = await runOpenHackHunters({
      scanId: 's',
      projectId: 'p',
      mode: 'free',
      scope,
      browser: obs({ cookies: [{ name: 'sessionid', httpOnly: false, secure: false }] }),
    });
    expect(res.candidates.some((c) => c.category === 'auth-session')).toBe(true);
  });

  it('flags direct LLM calls from the browser', async () => {
    const res = await runOpenHackHunters({
      scanId: 's',
      projectId: 'p',
      mode: 'free',
      scope,
      browser: obs({
        apiEndpoints: [{ url: 'https://api.openai.com/v1/chat/completions', methods: ['POST'] }],
      }),
    });
    expect(res.candidates.some((c) => c.category === 'ai-app')).toBe(true);
  });

  it('warns about mutating endpoints', async () => {
    const res = await runOpenHackHunters({
      scanId: 's',
      projectId: 'p',
      mode: 'free',
      scope,
      browser: obs({
        apiEndpoints: [
          {
            url: 'https://example.com/api/users/123',
            methods: ['DELETE'],
            pathPattern: '/api/users/:id',
          },
        ],
      }),
    });
    expect(res.warnings.length).toBeGreaterThanOrEqual(1);
  });
});
