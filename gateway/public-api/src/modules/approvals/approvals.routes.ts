import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { decideApproval, listApprovals } from './approvals.controller.js';
import { DecisionBody } from './approvals.dto.js';

export const approvalRoutes = Router();

approvalRoutes.get('/approvals', requireUser, listApprovals);
approvalRoutes.post('/approvals/:id/decision', requireUser, validateBody(DecisionBody), decideApproval);
