import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { TestAccountsService } from './test-accounts.service.js';

const service = new TestAccountsService();

export async function listTestAccounts(req: Request, res: Response) {
  res.json({
    testAccounts: await service.list(req.params.id!, currentUser(req).orgId),
  });
}

export async function createTestAccount(req: Request, res: Response) {
  res.status(201).json({
    testAccount: await service.create(req.params.id!, currentUser(req).orgId, req.body),
  });
}

export async function deleteTestAccount(req: Request, res: Response) {
  res.json(
    await service.delete(req.params.id!, req.params.accountId!, currentUser(req).orgId),
  );
}
