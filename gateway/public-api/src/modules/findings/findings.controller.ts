import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { FindingsService } from './findings.service.js';

const service = new FindingsService();

export async function listFindings(req: Request, res: Response) {
  res.json({ findings: await service.list(currentUser(req).orgId) });
}

export async function getFinding(req: Request, res: Response) {
  const finding = await service.get(req.params.id!, currentUser(req).orgId);
  if (!finding) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ finding });
}

export async function updateFindingStatus(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({ finding: await service.updateStatus(req.params.id!, user.orgId, user.userId, req.body) });
}

export async function retestFinding(req: Request, res: Response) {
  res.json({ retestRun: await service.requestRetest(req.params.id!, currentUser(req).orgId) });
}
