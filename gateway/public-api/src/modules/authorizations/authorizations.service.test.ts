import { describe, expect, it } from 'vitest';
import { normalizeAllowedHostsForAuthorization } from './authorizations.service.js';
import { isGuardrailError } from '@x-hunter/shared';

describe('normalizeAllowedHostsForAuthorization', () => {
  it('rejects private, local, and metadata hosts before authorization is created', () => {
    for (const host of ['127.0.0.1', 'localhost', '169.254.169.254', 'metadata.google.internal']) {
      try {
        normalizeAllowedHostsForAuthorization([host]);
        throw new Error(`expected ${host} to be rejected`);
      } catch (error) {
        expect(isGuardrailError(error)).toBe(true);
        if (isGuardrailError(error)) {
          expect(error.code).toBe('PRIVATE_OR_RESERVED_TARGET');
        }
      }
    }
  });

  it('deduplicates and lowercases public hostnames', () => {
    expect(normalizeAllowedHostsForAuthorization(['Example.com', 'example.com', 'API.Example.com'])).toEqual([
      'example.com',
      'api.example.com',
    ]);
  });
});
