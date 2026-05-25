/**
 * Fastify entry point.
 *
 * Endpoints per PLAN_V3.md §16:
 *   POST /v1/projects
 *   POST /v1/projects/:id/domains
 *   POST /v1/domains/:id/verify/dns
 *   POST /v1/domains/:id/verify/file
 *   POST /v1/projects/:id/scan-authorizations
 *   POST /v1/projects/:id/test-accounts
 *   POST /v1/projects/:id/scans
 *   GET  /v1/scans/:id
 *   GET  /v1/scans/:id/progress
 *   GET  /v1/projects/:id/findings
 *   GET  /v1/findings/:id
 *   POST /v1/findings/:id/status
 *   POST /v1/findings/:id/retest
 *   GET  /v1/reports/:id
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { createLogger, GuardrailError, isGuardrailError } from '@x-hunter/shared';

import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerDomainRoutes } from './routes/domains.js';
import { registerAuthorizationRoutes } from './routes/authorizations.js';
import { registerTestAccountRoutes } from './routes/test-accounts.js';
import { registerScanRoutes } from './routes/scans.js';
import { registerFindingRoutes } from './routes/findings.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerApprovalRoutes } from './routes/approvals.js';

const logger = createLogger({ component: 'api' });

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we use our own structured logger
    disableRequestLogging: true,
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MiB
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP is set by the web app
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin or configured PUBLIC_API_BASE_URL host
      cb(null, true);
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: process.env.APP_JWT_SECRET || 'dev-only-rotate-me',
    cookie: { cookieName: process.env.APP_SESSION_COOKIE || 'xhunter_session', signed: false },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(sensible);

  app.addHook('onRequest', async (req) => {
    const requestId = req.headers['x-request-id'] ?? cryptoRandomId();
    (req as { requestId?: string }).requestId = String(requestId);
  });

  app.addHook('onResponse', async (req, reply) => {
    logger.info('http_request', {
      request_id: (req as { requestId?: string }).requestId,
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      duration_ms: reply.elapsedTime,
    });
  });

  app.setErrorHandler((err, req, reply) => {
    if (isGuardrailError(err)) {
      reply.code(httpStatusForGuardrail(err)).send({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }
    logger.error('unhandled_error', {
      msg: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerProjectRoutes(app);
  registerDomainRoutes(app);
  registerAuthorizationRoutes(app);
  registerTestAccountRoutes(app);
  registerScanRoutes(app);
  registerFindingRoutes(app);
  registerReportRoutes(app);
  registerApprovalRoutes(app);

  return app;
}

function httpStatusForGuardrail(err: GuardrailError): number {
  switch (err.code) {
    case 'INVALID_INPUT':
      return 400;
    case 'DOMAIN_NOT_VERIFIED':
    case 'VERIFICATION_EXPIRED':
    case 'NO_SCAN_AUTHORIZATION':
    case 'AUTHORIZATION_EXPIRED':
    case 'OUT_OF_SCOPE_HOST':
    case 'OUT_OF_SCOPE_PATH':
    case 'PRIVATE_OR_RESERVED_TARGET':
    case 'UNSUPPORTED_SCHEME':
    case 'REDIRECT_OUT_OF_SCOPE':
    case 'PACKAGE_DOES_NOT_PERMIT_ACTION':
    case 'SENSITIVE_ACTION_REQUIRES_APPROVAL':
    case 'EVIDENCE_NOT_SANITIZED':
      return 422;
    case 'BUDGET_EXCEEDED':
      return 429;
    case 'TIMEOUT':
      return 504;
    case 'TOOL_UNAVAILABLE':
      return 503;
    default:
      return 500;
  }
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.API_PORT || 4000);
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info('api_listen', { port });
  } catch (err) {
    logger.error('api_listen_failed', { msg: String(err) });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
