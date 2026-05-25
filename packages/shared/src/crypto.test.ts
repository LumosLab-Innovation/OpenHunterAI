import { describe, it, expect, beforeAll } from 'vitest';
import { encryptString, decryptString, constantTimeEqual, generateVerificationToken } from './crypto.js';

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = '0'.repeat(64); // deterministic key for tests
});

describe('encryptString / decryptString', () => {
  it('round-trips a string', () => {
    const blob = encryptString('hello world');
    expect(blob.ciphertext.startsWith('v1:')).toBe(true);
    expect(blob.ciphertext.includes('hello world')).toBe(false);
    expect(decryptString(blob)).toBe('hello world');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const a = encryptString('same');
    const b = encryptString('same');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects malformed blobs', () => {
    expect(() => decryptString('garbage')).toThrow();
    expect(() => decryptString('v1::::')).toThrow();
  });
});

describe('constantTimeEqual', () => {
  it('handles equal/unequal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('generateVerificationToken', () => {
  it('produces unique tokens with prefix', () => {
    const a = generateVerificationToken('xhunter-verify');
    const b = generateVerificationToken('xhunter-verify');
    expect(a).not.toBe(b);
    expect(a.startsWith('xhunter-verify-')).toBe(true);
    expect(a.length).toBeGreaterThan(20);
  });
});
