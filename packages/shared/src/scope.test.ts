import { describe, it, expect } from 'vitest';
import { assertInScope, isHostAllowed } from './scope.js';
import { isGuardrailError } from './errors.js';
import type { ScopeAuthorization } from './types.js';

const scope: ScopeAuthorization = {
  allowedHosts: ['example.com', '*.app.example.com'],
  allowedPaths: [],
  excludedPaths: ['/billing/delete', '/admin/destructive-actions'],
  testAccountPermission: true,
  sensitiveActionPermission: false,
};

describe('isHostAllowed', () => {
  it('matches apex and subdomain wildcards', () => {
    expect(isHostAllowed('example.com', scope.allowedHosts)).toBe(true);
    expect(isHostAllowed('foo.app.example.com', scope.allowedHosts)).toBe(true);
    expect(isHostAllowed('app.example.com', scope.allowedHosts)).toBe(true);
    expect(isHostAllowed('evil.com', scope.allowedHosts)).toBe(false);
    expect(isHostAllowed('example.com.evil.com', scope.allowedHosts)).toBe(false);
  });
});

describe('assertInScope', () => {
  it('passes for allowed host + neutral path', () => {
    expect(() => assertInScope('https://example.com/anything', scope)).not.toThrow();
  });

  it('blocks excluded paths', () => {
    try {
      assertInScope('https://example.com/billing/delete/now', scope);
      throw new Error('expected throw');
    } catch (e) {
      expect(isGuardrailError(e)).toBe(true);
      if (isGuardrailError(e)) expect(e.code).toBe('OUT_OF_SCOPE_PATH');
    }
  });

  it('blocks host not in allowedHosts', () => {
    try {
      assertInScope('https://evil.com/whatever', scope);
      throw new Error('expected throw');
    } catch (e) {
      expect(isGuardrailError(e)).toBe(true);
      if (isGuardrailError(e)) expect(e.code).toBe('OUT_OF_SCOPE_HOST');
    }
  });

  it('blocks private/local targets', () => {
    try {
      assertInScope('http://127.0.0.1/path', scope);
      throw new Error('expected throw');
    } catch (e) {
      expect(isGuardrailError(e)).toBe(true);
      if (isGuardrailError(e)) expect(e.code).toBe('PRIVATE_OR_RESERVED_TARGET');
    }
  });

  it('uses REDIRECT_OUT_OF_SCOPE code when asRedirect', () => {
    try {
      assertInScope('https://evil.com/x', scope, { asRedirect: true });
      throw new Error('expected throw');
    } catch (e) {
      if (isGuardrailError(e)) expect(e.code).toBe('REDIRECT_OUT_OF_SCOPE');
    }
  });

  it('enforces allowedPaths when set', () => {
    const tight: ScopeAuthorization = {
      ...scope,
      allowedPaths: ['/api/public'],
    };
    expect(() => assertInScope('https://example.com/api/public/v1', tight)).not.toThrow();
    try {
      assertInScope('https://example.com/api/internal', tight);
      throw new Error('expected throw');
    } catch (e) {
      if (isGuardrailError(e)) expect(e.code).toBe('OUT_OF_SCOPE_PATH');
    }
  });
});
