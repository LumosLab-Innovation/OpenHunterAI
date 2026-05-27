import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { createScan, getScan, listScans } from './scans.controller.js';
import { CreateScanBody } from './scans.dto.js';

export const scanRoutes = Router();

scanRoutes.get('/scans', requireUser, listScans);
scanRoutes.get('/scans/:id', requireUser, getScan);
scanRoutes.get('/scans/:id/progress', requireUser, getScan);
scanRoutes.post('/projects/:id/scans', requireUser, validateBody(CreateScanBody), createScan);
