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

export async function exportReport(req: Request, res: Response) {
  const format = req.query.format === 'pdf' ? 'pdf' : 'html';
  const view = req.query.view === 'snapshot' ? 'snapshot' : 'latest';
  const exported = await service.export(req.params.id!, currentUser(req).orgId, format, view);
  if (!exported) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.setHeader('Content-Type', exported.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  res.send(exported.body);
}
