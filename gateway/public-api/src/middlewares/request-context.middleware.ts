import type { NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  req.requestId =
    String(req.headers['x-request-id'] ?? '') ||
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  next();
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
