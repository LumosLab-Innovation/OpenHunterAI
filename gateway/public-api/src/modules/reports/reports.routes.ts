import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { getReport } from './reports.controller.js';

export const reportRoutes = Router();

reportRoutes.get('/:id', requireUser, getReport);
