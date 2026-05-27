import { Router } from 'express';

export const integrationRoutes = Router();

integrationRoutes.get('/capabilities', (_req, res) => {
  res.json({ integrations: [] });
});
