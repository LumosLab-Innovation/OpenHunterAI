import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  checkDomainVerification,
  createDomain,
  listDomains,
  requestDomainVerification,
} from './domains.controller.js';
import { CreateDomainBody } from './domains.dto.js';

export const domainRoutes = Router();

domainRoutes.get('/projects/:id/domains', requireUser, asyncRoute(listDomains));
domainRoutes.post(
  '/projects/:id/domains',
  requireUser,
  validateBody(CreateDomainBody),
  asyncRoute(createDomain),
);
domainRoutes.post(
  '/projects/:id/domains/:domainId/verification',
  requireUser,
  asyncRoute(requestDomainVerification),
);
domainRoutes.post(
  '/projects/:id/domains/:domainId/verification/check',
  requireUser,
  asyncRoute(checkDomainVerification),
);
