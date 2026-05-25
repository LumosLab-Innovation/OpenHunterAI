import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/healthz', async () => ({ ok: true, ts: new Date().toISOString() }));
  app.get('/readyz', async () => ({ ok: true }));
}
