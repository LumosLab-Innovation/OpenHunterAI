import { Router, type RequestHandler } from 'express';
import { isLocalMode, requireAllowedOrigin, requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { SignInBody, SignUpBody } from './auth.dto.js';
import { me, signIn, signOut, signUp } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.get('/mode', (_req, res) => res.json({ localMode: isLocalMode() }));
const hideAccountRoutesInLocalMode: RequestHandler = (_req, res, next) => {
  if (isLocalMode()) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account routes are unavailable in local mode' } });
    return;
  }
  next();
};
authRoutes.post('/signup', hideAccountRoutesInLocalMode, validateBody(SignUpBody), asyncRoute(signUp));
authRoutes.post('/signin', hideAccountRoutesInLocalMode, validateBody(SignInBody), asyncRoute(signIn));
authRoutes.post('/signout', hideAccountRoutesInLocalMode, requireAllowedOrigin, asyncRoute(signOut));
authRoutes.get('/me', requireUser, me);
