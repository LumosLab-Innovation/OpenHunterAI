import type { NextFunction, Request, Response } from 'express';
import { GuardrailError, isGuardrailError } from '@x-hunter/shared';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Invalid request body', details: err.flatten() },
    });
    return;
  }

  if (isGuardrailError(err)) {
    res.status(statusForGuardrail(err)).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  logUnexpectedError(err, req);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal error' } });
}

function statusForGuardrail(err: GuardrailError): number {
  switch (err.code) {
    case 'INVALID_INPUT':
      return 400;
    case 'BUDGET_EXCEEDED':
      return 429;
    case 'TIMEOUT':
      return 504;
    case 'TOOL_UNAVAILABLE':
      return 503;
    default:
      return 422;
  }
}

function logUnexpectedError(err: unknown, req: Request) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'unexpected_request_error',
      method: req.method,
      path: req.originalUrl,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }),
  );
}
