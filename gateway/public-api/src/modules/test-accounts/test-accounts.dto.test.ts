import { describe, expect, it } from 'vitest';
import { CreateTestAccountBody } from './test-accounts.dto.js';

describe('CreateTestAccountBody', () => {
  it('allows manual-login accounts without stored password', () => {
    expect(
      CreateTestAccountBody.parse({
        label: 'Manual user',
        loginUrl: 'https://example.com/login',
      }),
    ).toEqual({
      label: 'Manual user',
      loginUrl: 'https://example.com/login',
    });
  });
});
