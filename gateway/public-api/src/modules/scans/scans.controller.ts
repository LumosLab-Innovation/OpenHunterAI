import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ScansService } from './scans.service.js';

const service = new ScansService();

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
