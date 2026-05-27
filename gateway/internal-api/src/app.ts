import express from 'express';
import helmet from 'helmet';
import { healthRoutes } from './modules/health/health.routes.js';
import { integrationRoutes } from './modules/integrations/integrations.routes.js';
import { scanRoutes } from './modules/scans/scans.routes.js';

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/health', healthRoutes);
  app.use('/internal/scans', scanRoutes);
  app.use('/internal/integrations', integrationRoutes);
  return app;
}
