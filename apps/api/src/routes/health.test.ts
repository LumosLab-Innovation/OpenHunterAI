import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerHealthRoutes } from './health.js';

describe('health endpoints', () => {
  it('healthz returns ok', async () => {
    const app = Fastify();
    registerHealthRoutes(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    await app.close();
  });

  it('readyz returns ok', async () => {
    const app = Fastify();
    registerHealthRoutes(app);
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
