import { describe, expect, it, vi } from 'vitest';
import { asyncRoute } from './async-route.middleware.js';

describe('asyncRoute', () => {
  it('forwards rejected controller promises to Express error handling', async () => {
    const error = new Error('boom');
    const next = vi.fn();
    const handler = asyncRoute(async () => {
      throw error;
    });

    handler({} as never, {} as never, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(error));
  });
});
