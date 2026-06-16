import { getPrisma } from '@x-hunter/db';
import {
  authenticateSessionToken,
  createSessionForUser,
  clearSessionCookie,
  hashPassword,
  revokeSessionToken,
  sessionCookieName,
  verifyPassword,
} from '../../middlewares/auth.middleware.js';
import type { Request, Response } from 'express';
import type { SignInBody, SignUpBody } from './auth.dto.js';
import { LoginSessionsService } from '../test-accounts/login-sessions.service.js';

const loginSessions = new LoginSessionsService();

export class AuthService {
  async signUp(body: SignUpBody, res: Response) {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return { status: 409, body: { error: { code: 'CONFLICT', message: 'Email already registered' } } };

    const org = await prisma.organization.create({
      data: { name: body.orgName, slug: `${slugify(body.orgName)}-${randomSlug()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: hashPassword(body.password),
        organizationId: org.id,
        displayName: body.displayName ?? null,
        role: 'owner',
      },
    });
    await createSessionForUser(user, res);
    return { status: 200, body: { userId: user.id, orgId: user.organizationId } };
  }

  async signIn(body: SignInBody, res: Response) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return {
        status: 401,
        body: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } },
      };
    }
    await createSessionForUser(user, res);
    return { status: 200, body: { userId: user.id, orgId: user.organizationId } };
  }

  async signOut(req: Request, res: Response) {
    const token = req.cookies?.[sessionCookieName()];
    const user = await authenticateSessionToken(token);
    if (user) {
      await loginSessions.cancelInteractiveSessionsForUser(user.orgId, user.userId);
    }
    await revokeSessionToken(token);
    clearSessionCookie(res);
    return { ok: true };
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8);
}
