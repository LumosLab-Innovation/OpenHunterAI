import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { getFinding, listFindings, retestFinding, updateFindingStatus } from './findings.controller.js';
import { StatusChangeBody } from './findings.dto.js';

export const findingRoutes = Router();

findingRoutes.get('/findings', requireUser, listFindings);
findingRoutes.get('/findings/:id', requireUser, getFinding);
findingRoutes.post('/findings/:id/status', requireUser, validateBody(StatusChangeBody), updateFindingStatus);
findingRoutes.post('/findings/:id/retest', requireUser, retestFinding);
