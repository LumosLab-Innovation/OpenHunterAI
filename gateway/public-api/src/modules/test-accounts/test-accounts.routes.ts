import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import {
  createTestAccount,
  deleteTestAccount,
  listTestAccounts,
} from './test-accounts.controller.js';
import { CreateTestAccountBody } from './test-accounts.dto.js';

export const testAccountRoutes = Router();

testAccountRoutes.get('/projects/:id/test-accounts', requireUser, asyncRoute(listTestAccounts));
testAccountRoutes.post(
  '/projects/:id/test-accounts',
  requireUser,
  validateBody(CreateTestAccountBody),
  asyncRoute(createTestAccount),
);
testAccountRoutes.delete(
  '/projects/:id/test-accounts/:accountId',
  requireUser,
  asyncRoute(deleteTestAccount),
);
