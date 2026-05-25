import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeValue, sanitize, sanitizeText } from './sanitizer.js';

describe('sanitizeString', () => {
  it('masks bearer and basic auth headers', () => {
    expect(sanitizeString('Authorization: Bearer abcdef1234567890.token.value')).not.toContain(
      'abcdef1234567890',
    );
    expect(sanitizeString('Authorization: Basic dXNlcjpwYXNz')).not.toContain('dXNlcjpwYXNz');
  });

  it('masks JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SIGNATURE_HERE_LONG';
    expect(sanitizeString(jwt)).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('masks API key prefixes', () => {
    expect(sanitizeString('sk-abcdefghijklmnop_secret')).toContain('[REDACTED');
    expect(sanitizeString('AIzaSyABCDEFGHIJ_____example_____1234567890XYZ')).toContain('[REDACTED');
    expect(sanitizeString('AKIAIOSFODNN7EXAMPLE')).toContain('[REDACTED');
  });

  it('masks emails', () => {
    expect(sanitizeString('contact alice@example.com today')).toContain('[REDACTED_EMAIL]');
  });

  it('masks long hex blobs (likely session tokens)', () => {
    const blob = 'a'.repeat(40);
    expect(sanitizeString(`session=${blob}`)).not.toContain(blob);
  });

  it('masks cookies in a Set-Cookie line', () => {
    const out = sanitizeString('SESSION=abcd1234abcd1234abcd1234; HttpOnly; Path=/');
    expect(out).not.toContain('abcd1234abcd1234abcd1234');
  });
});

describe('sanitizeValue (object recursion)', () => {
  it('masks values at sensitive keys regardless of value', () => {
    const out = sanitizeValue({
      password: 'p@ss',
      authorization: 'Bearer foo',
      cookie: 'a=b',
      nested: { token: 'short' },
      safe: 'hello',
    }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.cookie).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).token).toBe('[REDACTED]');
    expect(out.safe).toBe('hello');
  });

  it('keeps numbers/booleans/null', () => {
    const out = sanitizeValue({ a: 1, b: true, c: null }) as Record<string, unknown>;
    expect(out).toEqual({ a: 1, b: true, c: null });
  });
});

describe('sanitize<T>()', () => {
  it('returns a Sanitized<T> with sanitized: true', () => {
    const s = sanitize({ password: 'x', other: 'ok' });
    expect(s.sanitized).toBe(true);
    expect((s.value as { password: string }).password).toBe('[REDACTED]');
  });
});

describe('sanitizeText', () => {
  it('is a noop on safe text', () => {
    expect(sanitizeText('the quick brown fox jumps over the lazy dog')).toBe(
      'the quick brown fox jumps over the lazy dog',
    );
  });
});
