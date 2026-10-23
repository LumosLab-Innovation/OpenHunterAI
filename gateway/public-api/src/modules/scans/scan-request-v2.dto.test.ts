import { describe, expect, it } from 'vitest';
import { assertInScope, DEFAULT_SURFACE_FLAGS, profileToIntensity } from '@x-hunter/shared';
import { resolveScanRequest, ScanRequestV2 } from './scan-request-v2.dto.js';

function request(targetUrl: string, scope?: { allowedPaths?: string[]; excludedPaths?: string[] }) {
  return ScanRequestV2.parse({
    schemaVersion: 'scan_request_v2', targetUrl, authorityConfirmed: true,
    ...(scope ? { scope } : {}),
  });
}

describe('scan_request_v2 path scope', () => {
  it('defaults to Standard and limits a path URL to that subtree', () => {
    const parsed = request('https://example.com/vi/trang-chu/');
    const resolved = resolveScanRequest(parsed);
    expect(parsed.profile).toBe('standard');
    expect(profileToIntensity(parsed.profile)).toBe('controlled_attack_simulation');
    expect(resolved).toMatchObject({ targetHost: 'example.com', allowedPaths: ['/vi/trang-chu'] });
    const authorization = {
      ...resolved, profile: parsed.profile, authScope: parsed.authScope,
      targetType: parsed.targetType, testIntensityMode: profileToIntensity(parsed.profile),
      surfaceFlags: DEFAULT_SURFACE_FLAGS, aggressiveStagingRiskAccepted: false,
      testAccountPermission: false, sensitiveActionPermission: false,
    };
    expect(() => assertInScope('https://example.com/vi/trang-chu/child', authorization)).not.toThrow();
    expect(() => assertInScope('https://example.com/vi/other', authorization)).toThrow();
    expect(() => assertInScope('https://other.example.com/vi/trang-chu', authorization)).toThrow();
  });

  it('widens to the exact host only when scope explicitly says so', () => {
    expect(resolveScanRequest(request('https://example.com/app', { allowedPaths: [] })).allowedPaths).toEqual([]);
    expect(resolveScanRequest(request('https://example.com/app')).allowedPaths).toEqual(['/app']);
  });

  it.each([
    'http://example.com/app', 'https://localhost/app', 'https://127.0.0.1/app',
    'https://user:pass@example.com/app', 'https://example.com:8443/app',
    'https://example.com/app?q=1', 'https://example.com/app#section',
  ])('rejects unsafe or non-canonical target %s', (targetUrl) => {
    expect(() => resolveScanRequest(request(targetUrl))).toThrow();
  });

  it('rejects a target excluded by the requested scope', () => {
    const parsed = request('https://example.com/app/admin', { allowedPaths: ['/app'], excludedPaths: ['/app/admin'] });
    const resolved = resolveScanRequest(parsed);
    expect(() => assertInScope(resolved.targetUrl, {
      ...resolved, profile: parsed.profile, authScope: parsed.authScope,
      targetType: parsed.targetType, testIntensityMode: profileToIntensity(parsed.profile),
      surfaceFlags: DEFAULT_SURFACE_FLAGS, aggressiveStagingRiskAccepted: false,
      testAccountPermission: false, sensitiveActionPermission: false,
    })).toThrow();
  });
});
