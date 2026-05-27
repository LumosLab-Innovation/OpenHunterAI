import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createDomain, listDomains } from './domains.controller.js';
import { CreateDomainBody } from './domains.dto.js';

export const domainRoutes = Router();

domainRoutes.get('/projects/:id/domains', requireUser, listDomains);
domainRoutes.post('/projects/:id/domains', requireUser, validateBody(CreateDomainBody), createDomain);
