import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createScan,
  cancelScan,
  getReportDraft,
  getScan,
  hideScan,
  listScans,
  streamLiveEvents,
  streamReportEvents,
} from './scans.controller.js';
import { CreateScanBody } from './scans.dto.js';

export const scanRoutes = Router();

scanRoutes.get('/scans', requireUser, asyncRoute(listScans));
scanRoutes.get('/scans/:id/report-draft', requireUser, asyncRoute(getReportDraft));
scanRoutes.get('/scans/:id/report-events', requireUser, asyncRoute(streamReportEvents));
scanRoutes.get('/scans/:id/live-events', requireUser, asyncRoute(streamLiveEvents));
scanRoutes.get('/scans/:id', requireUser, asyncRoute(getScan));
scanRoutes.get('/scans/:id/progress', requireUser, asyncRoute(getScan));
scanRoutes.post('/scans/:id/cancel', requireUser, asyncRoute(cancelScan));
scanRoutes.delete('/scans/:id', requireUser, asyncRoute(hideScan));
scanRoutes.post('/projects/:id/scans', requireUser, validateBody(CreateScanBody), asyncRoute(createScan));
