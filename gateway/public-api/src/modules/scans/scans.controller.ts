import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ReportsService } from '../reports/reports.service.js';
import { ScansService } from './scans.service.js';

const service = new ScansService();
const reports = new ReportsService();

export async function listScans(req: Request, res: Response) {
  res.json({ scans: await service.list(currentUser(req).orgId) });
}

export async function getScan(req: Request, res: Response) {
  const scan = await service.get(req.params.id!, currentUser(req).orgId);
  if (!scan) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ scan });
}

export async function createScan(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({ scan: await service.create(req.params.id!, user.orgId, user.userId, req.body) });
}

export async function getReportDraft(req: Request, res: Response) {
  const draft = await reports.getDraft(req.params.id!, currentUser(req).orgId);
  if (!draft) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ draft });
}

export async function streamReportEvents(req: Request, res: Response) {
  const user = currentUser(req);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastUpdatedAt: string | null = null;
  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  async function sendSnapshot(eventName = 'draft_snapshot') {
    const draft = await reports.getDraft(req.params.id!, user.orgId);
    if (!draft) {
      res.write(`event: section_failed\ndata: ${JSON.stringify({ code: 'NOT_FOUND' })}\n\n`);
      return false;
    }
    const updated = draft.updatedAt ?? '';
    if (eventName !== 'draft_snapshot' && updated === lastUpdatedAt) return true;
    lastUpdatedAt = updated;
    const hasFinalReport = draft.latestReportState === 'final';
    res.write(`event: ${hasFinalReport ? 'report_finalized' : eventName}\ndata: ${JSON.stringify(draft)}\n\n`);
    return true;
  }

  await sendSnapshot();
  const interval = setInterval(() => {
    if (closed) {
      clearInterval(interval);
      return;
    }
    void sendSnapshot('section_ready');
  }, 2000);
}
