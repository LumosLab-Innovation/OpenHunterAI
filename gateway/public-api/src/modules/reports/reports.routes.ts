import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { exportReport, getReport, listReports } from './reports.controller.js';

export const reportRoutes = Router();

reportRoutes.get('/', requireUser, asyncRoute(listReports));
reportRoutes.get('/:id/export', requireUser, asyncRoute(exportReport));
reportRoutes.get('/:id', requireUser, asyncRoute(getReport));
