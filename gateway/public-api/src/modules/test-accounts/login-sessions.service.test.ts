import { describe, expect, it } from 'vitest';
import {
  isBrowserSessionFresh,
  publicLoginSessionStreamUrl,
  sanitizeBrowserStorageState,
  validateLoginUrlInVerifiedScope,
} from './login-sessions.service.js';
import { isGuardrailError } from '@x-hunter/shared';

describe('login session helpers', () => {
  it('rejects login URLs outside verified project scope', () => {
    expect(() => validateLoginUrlInVerifiedScope('https://app.example.com/login', ['app.example.com'])).not.toThrow();

    try {
      validateLoginUrlInVerifiedScope('https://evil.example.net/login', ['app.example.com']);
      throw new Error('expected out-of-scope URL to be rejected');
    } catch (error) {
      expect(isGuardrailError(error)).toBe(true);
      if (isGuardrailError(error)) expect(error.code).toBe('OUT_OF_SCOPE_HOST');
    }
  });

  it('redacts unsupported storage state fields and never keeps passwords', () => {
    const state = sanitizeBrowserStorageState({
      cookies: [
        {
          name: 'session',
          value: 'secret-cookie',
          domain: 'app.example.com',
          path: '/',
          expires: 1799999999,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [
        {
          origin: 'https://app.example.com',
          localStorage: [
            { name: 'authToken', value: 'token-value' },
            { name: 'password', value: 'should-not-persist' },
          ],
          sessionStorage: [{ name: 'csrf', value: 'csrf-value' }],
          indexedDB: [{ raw: 'nope' }],
        },
      ],
      password: 'raw-password',
      requestHeaders: { cookie: 'session=secret-cookie' },
    });

    expect(JSON.stringify(state)).toContain('secret-cookie');
    expect(JSON.stringify(state)).toContain('token-value');
    expect(JSON.stringify(state)).not.toContain('should-not-persist');
    expect(JSON.stringify(state)).not.toContain('raw-password');
    expect(JSON.stringify(state)).not.toContain('requestHeaders');
    expect(JSON.stringify(state)).not.toContain('indexedDB');
  });

  it('treats expired session state as unavailable', () => {
    expect(isBrowserSessionFresh({ status: 'active', expiresAt: new Date('2026-06-17T00:00:00.000Z') }, new Date('2026-06-16T00:00:00.000Z'))).toBe(true);
    expect(isBrowserSessionFresh({ status: 'active', expiresAt: new Date('2026-06-15T00:00:00.000Z') }, new Date('2026-06-16T00:00:00.000Z'))).toBe(false);
    expect(isBrowserSessionFresh({ status: 'pending', expiresAt: new Date('2026-06-17T00:00:00.000Z') }, new Date('2026-06-16T00:00:00.000Z'))).toBe(false);
  });

  it('builds public proxied noVNC URLs instead of runtime URLs', () => {
    expect(publicLoginSessionStreamUrl('sess_1')).toBe(
      '/v1/login-sessions/sess_1/stream/vnc.html?autoconnect=1&resize=scale&path=v1%2Flogin-sessions%2Fsess_1%2Fstream%2Fwebsockify',
    );
  });
});
