import type { Request, Response } from 'express';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { TestAccountsService } from './test-accounts.service.js';
import { LoginSessionsService } from './login-sessions.service.js';

const service = new TestAccountsService();
const loginSessions = new LoginSessionsService();

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

export async function createLoginSession(req: Request, res: Response) {
  const user = currentUser(req);
  res.status(201).json({
    loginSession: await loginSessions.create(req.params.id!, req.params.accountId!, user.orgId, user.userId),
  });
}

export async function getLoginSession(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({
    loginSession: await loginSessions.get(req.params.sessionId!, user.orgId, user.userId),
  });
}

export async function completeLoginSession(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({
    loginSession: await loginSessions.complete(req.params.sessionId!, user.orgId, user.userId, req.body),
  });
}

export async function cancelLoginSession(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({
    loginSession: await loginSessions.cancel(req.params.sessionId!, user.orgId, user.userId),
  });
}

export async function revokeSavedLoginSessions(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(await loginSessions.revokeSavedSessionsForTestAccount(req.params.id!, req.params.accountId!, user.orgId));
}
