import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  cancelLoginSession,
  completeLoginSession,
  createTestAccount,
  createLoginSession,
  deleteTestAccount,
  getLoginSession,
  listTestAccounts,
} from './test-accounts.controller.js';
import { CreateTestAccountBody } from './test-accounts.dto.js';
import { proxyLoginSessionStream } from './login-session-stream.proxy.js';

export const testAccountRoutes = Router();

testAccountRoutes.get('/projects/:id/test-accounts', requireUser, asyncRoute(listTestAccounts));
testAccountRoutes.post(
  '/projects/:id/test-accounts',
  requireUser,
  validateBody(CreateTestAccountBody),
  asyncRoute(createTestAccount),
);
testAccountRoutes.post(
  '/projects/:id/test-accounts/:accountId/login-sessions',
  requireUser,
  asyncRoute(createLoginSession),
);
testAccountRoutes.use('/login-sessions/:sessionId/stream', requireUser, proxyLoginSessionStream);
testAccountRoutes.get('/login-sessions/:sessionId', requireUser, asyncRoute(getLoginSession));
testAccountRoutes.post('/login-sessions/:sessionId/complete', requireUser, asyncRoute(completeLoginSession));
testAccountRoutes.post('/login-sessions/:sessionId/cancel', requireUser, asyncRoute(cancelLoginSession));
testAccountRoutes.delete(
  '/projects/:id/test-accounts/:accountId',
  requireUser,
  asyncRoute(deleteTestAccount),
);
