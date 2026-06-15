import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ApprovalsService } from './approvals.service.js';

const service = new ApprovalsService();

export async function listApprovals(req: Request, res: Response) {
  const pendingOnly = req.query.state === 'pending';
  res.json({ approvals: await service.list(currentUser(req).orgId, pendingOnly) });
}

export async function decideApproval(req: Request, res: Response) {
  const user = currentUser(req);
  const approval = await service.decide(req.params.id!, user.orgId, user.userId, req.body.decision, req.body.reason);
  res.json({ approval });
}
