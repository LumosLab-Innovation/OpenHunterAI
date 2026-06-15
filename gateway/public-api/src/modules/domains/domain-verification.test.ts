import { describe, expect, it } from 'vitest';
import { dnsTxtContainsToken } from './domain-verification.js';

describe('dnsTxtContainsToken', () => {
  it('matches tokens split across DNS TXT chunks', () => {
    expect(
      dnsTxtContainsToken(
        [
          ['unrelated'],
          ['xhunter-verify-', 'expected-token'],
        ],
        'xhunter-verify-expected-token',
      ),
    ).toBe(true);
  });

  it('rejects partial or unrelated TXT records', () => {
    expect(dnsTxtContainsToken([['xhunter-verify-expected']], 'xhunter-verify-expected-token')).toBe(
      false,
    );
  });
});
