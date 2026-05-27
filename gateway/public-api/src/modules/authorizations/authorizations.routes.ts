import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createAuthorization, listAuthorizations } from './authorizations.controller.js';
import { CreateAuthorizationBody } from './authorizations.dto.js';

export const authorizationRoutes = Router();

authorizationRoutes.get('/:id/authorizations', requireUser, listAuthorizations);
authorizationRoutes.post('/:id/authorizations', requireUser, validateBody(CreateAuthorizationBody), createAuthorization);
