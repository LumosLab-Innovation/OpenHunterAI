import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestContext } from './middlewares/request-context.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { authorizationRoutes } from './modules/authorizations/authorizations.routes.js';
import { domainRoutes } from './modules/domains/domains.routes.js';
import { findingRoutes } from './modules/findings/findings.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { projectRoutes } from './modules/projects/projects.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { scanRoutes } from './modules/scans/scans.routes.js';
import { approvalRoutes } from './modules/approvals/approvals.routes.js';
import { billingRoutes } from './modules/billing/billing.routes.js';
import { testAccountRoutes } from './modules/test-accounts/test-accounts.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  // Allow the SPA origin(s) with credentials. CORS_ORIGINS is a comma-separated
  // allowlist (e.g. https://openhunterai.pages.dev); falls back to reflecting any
  // origin in dev.
  const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    }),
  );
  // Webhook routes need the raw body for signature verification, so the global
  // JSON parser skips them; those routes apply express.raw() themselves.
  app.use((req, res, next) => {
    if (req.path.startsWith('/v1/webhooks/')) return next();
    return express.json({ limit: '1mb' })(req, res, next);
  });
  app.use(cookieParser());
  app.use(rateLimit({ limit: 300, windowMs: 60_000 }));
  app.use(requestContext);

  app.use('/health', healthRoutes);
  app.use('/v1/auth', authRoutes);
  app.use('/v1/projects', projectRoutes);
  app.use('/v1', domainRoutes);
  app.use('/v1', testAccountRoutes);
  app.use('/v1/projects', authorizationRoutes);
  app.use('/v1', scanRoutes);
  app.use('/v1', findingRoutes);
  app.use('/v1', approvalRoutes);
  app.use('/v1', billingRoutes);
  app.use('/v1/reports', reportRoutes);

  app.use(errorHandler);
  return app;
}
