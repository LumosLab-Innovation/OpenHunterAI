import { Router } from 'express';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { SignInBody, SignUpBody } from './auth.dto.js';
import { me, signIn, signOut, signUp } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/signup', validateBody(SignUpBody), signUp);
authRoutes.post('/signin', validateBody(SignInBody), signIn);
authRoutes.post('/signout', signOut);
authRoutes.get('/me', requireUser, me);
