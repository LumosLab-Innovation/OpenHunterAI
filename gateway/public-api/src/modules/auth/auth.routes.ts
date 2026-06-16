import { Router } from 'express';
import { requireAllowedOrigin, requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { SignInBody, SignUpBody } from './auth.dto.js';
import { me, signIn, signOut, signUp } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/signup', validateBody(SignUpBody), asyncRoute(signUp));
authRoutes.post('/signin', validateBody(SignInBody), asyncRoute(signIn));
authRoutes.post('/signout', requireAllowedOrigin, asyncRoute(signOut));
authRoutes.get('/me', requireUser, me);
