import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { DomainsService } from './domains.service.js';

const service = new DomainsService();

export async function listDomains(req: Request, res: Response) {
  res.json({ domains: await service.list(req.params.id!, currentUser(req).orgId) });
}

export async function createDomain(req: Request, res: Response) {
  res.json({ domain: await service.create(req.params.id!, currentUser(req).orgId, req.body) });
}

export async function requestDomainVerification(req: Request, res: Response) {
  res.status(201).json({
    verification: await service.requestVerification(
      req.params.id!,
      req.params.domainId!,
      currentUser(req).orgId,
    ),
  });
}

export async function checkDomainVerification(req: Request, res: Response) {
  res.json({
    verification: await service.checkVerification(
      req.params.id!,
      req.params.domainId!,
      currentUser(req).orgId,
    ),
  });
}
