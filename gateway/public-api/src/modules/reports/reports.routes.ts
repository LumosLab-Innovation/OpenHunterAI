import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { exportReport, getReport } from './reports.controller.js';

export const reportRoutes = Router();

reportRoutes.get('/:id/export', requireUser, exportReport);
reportRoutes.get('/:id', requireUser, getReport);
