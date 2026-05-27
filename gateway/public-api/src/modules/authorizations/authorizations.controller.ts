import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { AuthorizationsService } from './authorizations.service.js';

const service = new AuthorizationsService();

export async function listAuthorizations(req: Request, res: Response) {
  res.json({ authorizations: await service.list(req.params.id!, currentUser(req).orgId) });
}

export async function createAuthorization(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({
    authorization: await service.create(req.params.id!, user.orgId, user.userId, req.body),
  });
}
