import { describe, expect, it } from 'vitest';
import { stateActivityBodyParams } from './scan-state.service.js';

describe('stateActivityBodyParams', () => {
  it('preserves a readable sanitized summary instead of stringifying an object', () => {
    expect(stateActivityBodyParams('Scan state changed to running')).toEqual({
      summary: 'Scan state changed to running',
    });
  });
});
