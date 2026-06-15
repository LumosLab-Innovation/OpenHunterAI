import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { getFinding, listFindings, retestFinding, updateFindingStatus } from './findings.controller.js';
import { StatusChangeBody } from './findings.dto.js';

export const findingRoutes = Router();

findingRoutes.get('/findings', requireUser, asyncRoute(listFindings));
findingRoutes.get('/findings/:id', requireUser, asyncRoute(getFinding));
findingRoutes.post(
  '/findings/:id/status',
  requireUser,
  validateBody(StatusChangeBody),
  asyncRoute(updateFindingStatus),
);
findingRoutes.post('/findings/:id/retest', requireUser, asyncRoute(retestFinding));
