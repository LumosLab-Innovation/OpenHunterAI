import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ReportsService } from './reports.service.js';
import { REPORT_EXPORT_FORMATS, type ReportExportFormat } from './report-downloads.js';

const service = new ReportsService();

export async function listReports(req: Request, res: Response) {
  res.json({ reports: await service.list(currentUser(req).orgId) });
}

export async function getReport(req: Request, res: Response) {
  const report = await service.get(req.params.id!, currentUser(req).orgId);
  if (!report) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ report });
}

export async function exportReport(req: Request, res: Response) {
  const format = req.query.format ?? 'html';
  if (typeof format !== 'string' || !REPORT_EXPORT_FORMATS.includes(format as ReportExportFormat)) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Unsupported report format' } });
    return;
  }
  const view = req.query.view ?? 'latest';
  if (view !== 'snapshot' && view !== 'latest') {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Unsupported report view' } });
    return;
  }
  const exported = await service.export(req.params.id!, currentUser(req).orgId, format as ReportExportFormat, view);
  if (!exported) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.setHeader('Content-Type', exported.contentType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  res.send(exported.body);
}
