import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createAuthorization, listAuthorizations } from './authorizations.controller.js';
import { CreateAuthorizationBody } from './authorizations.dto.js';

export const authorizationRoutes = Router();

authorizationRoutes.get('/:id/authorizations', requireUser, asyncRoute(listAuthorizations));
authorizationRoutes.post(
  '/:id/authorizations',
  requireUser,
  validateBody(CreateAuthorizationBody),
  asyncRoute(createAuthorization),
);
