import { describe, it, expect } from 'vitest';
import { normalizeUrl, isPrivateIPv4, isPrivateIPv6 } from './url.js';
import { GuardrailError, isGuardrailError } from './errors.js';

describe('normalizeUrl', () => {
  it('lowercases hostname and strips fragment', () => {
    const r = normalizeUrl('HTTPS://Example.COM/foo#bar');
    expect(r.hostname).toBe('example.com');
    expect(r.url.hash).toBe('');
    expect(r.url.protocol).toBe('https:');
  });

  it('rejects userinfo', () => {
    expect(() => normalizeUrl('https://user:pass@example.com')).toThrow(GuardrailError);
  });

  it('rejects non-http(s) schemes', () => {
    for (const u of ['file:///etc/passwd', 'ftp://example.com', 'gopher://x']) {
      try {
        normalizeUrl(u);
        throw new Error(`expected ${u} to throw`);
      } catch (e) {
        expect(isGuardrailError(e)).toBe(true);
        if (isGuardrailError(e)) expect(e.code).toBe('UNSUPPORTED_SCHEME');
      }
    }
  });

  it('rejects malformed URLs', () => {
    expect(() => normalizeUrl('not a url')).toThrow(GuardrailError);
  });

  it('rejects localhost & private IPs', () => {
    for (const host of ['http://localhost', 'http://127.0.0.1', 'http://10.0.0.1', 'http://192.168.1.1', 'http://169.254.169.254']) {
      try {
        normalizeUrl(host);
        throw new Error(`expected ${host} to throw`);
      } catch (e) {
        expect(isGuardrailError(e)).toBe(true);
        if (isGuardrailError(e)) expect(e.code).toBe('PRIVATE_OR_RESERVED_TARGET');
      }
    }
  });

  it('rejects metadata endpoints', () => {
    expect(() => normalizeUrl('http://metadata.google.internal')).toThrow(GuardrailError);
  });

  it('rejects mDNS .local hostnames', () => {
    expect(() => normalizeUrl('http://printer.local')).toThrow(GuardrailError);
  });

  it('rejects numeric hostnames (IP smuggling)', () => {
    expect(() => normalizeUrl('http://2130706433')).toThrow(GuardrailError);
  });

  it('rejects IPv6 loopback and link-local', () => {
    expect(() => normalizeUrl('http://[::1]')).toThrow(GuardrailError);
    expect(() => normalizeUrl('http://[fe80::1]')).toThrow(GuardrailError);
  });

  it('accepts a normal https URL', () => {
    const r = normalizeUrl('https://example.com/foo?bar=baz');
    expect(r.hostname).toBe('example.com');
    expect(r.url.search).toBe('?bar=baz');
  });
});

describe('isPrivateIPv4', () => {
  it('flags private and reserved', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '224.0.0.1', '240.0.0.1', '0.0.0.0', '100.64.1.1']) {
      expect(isPrivateIPv4(ip)).toBe(true);
    }
  });
  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(isPrivateIPv4(ip)).toBe(false);
    }
  });
});

describe('isPrivateIPv6', () => {
  it('flags reserved IPv6', () => {
    for (const ip of ['::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIPv6(ip)).toBe(true);
    }
  });
});
