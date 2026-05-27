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

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit({ limit: 300, windowMs: 60_000 }));
  app.use(requestContext);

  app.use('/health', healthRoutes);
  app.use('/v1/auth', authRoutes);
  app.use('/v1/projects', projectRoutes);
  app.use('/v1', domainRoutes);
  app.use('/v1/projects', authorizationRoutes);
  app.use('/v1', scanRoutes);
  app.use('/v1', findingRoutes);
  app.use('/v1/reports', reportRoutes);

  app.use(errorHandler);
  return app;
}
