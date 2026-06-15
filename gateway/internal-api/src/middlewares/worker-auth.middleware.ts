import type { NextFunction, Request, Response } from 'express';

/**
 * Worker callback authentication. Workers authenticate to internal-api with a
 * shared secret in the `x-worker-token` header (set as WORKER_TOKEN on both
 * sides). internal-api is a private surface, but this prevents any in-cluster
 * service from forging scan steps/findings.
 *
 * If WORKER_TOKEN is unset we are in local/dev: requests are allowed but a
 * warning is logged once so this is never silently shipped to production.
 */
let warnedMissingToken = false;

export function workerAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) {
    if (!warnedMissingToken) {
      console.warn('[internal-api] WORKER_TOKEN is unset; worker callbacks are UNAUTHENTICATED (dev only)');
      warnedMissingToken = true;
    }
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: { code: 'WORKER_AUTH_NOT_CONFIGURED' } });
      return;
    }
    next();
    return;
  }
  const provided = req.header('x-worker-token');
  if (!provided || provided !== expected) {
    res.status(401).json({ error: { code: 'WORKER_UNAUTHORIZED' } });
    return;
  }
  next();
}
