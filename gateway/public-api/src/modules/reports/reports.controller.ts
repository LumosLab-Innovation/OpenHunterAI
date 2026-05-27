import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ReportsService } from './reports.service.js';

const service = new ReportsService();

export async function getReport(req: Request, res: Response) {
  const report = await service.get(req.params.id!, currentUser(req).orgId);
  if (!report) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ report });
}
