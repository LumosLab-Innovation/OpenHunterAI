import { getPrisma } from '@x-hunter/db';
import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '../../middlewares/auth.middleware.js';
import type { Response } from 'express';
import type { SignInBody, SignUpBody } from './auth.dto.js';

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
    const token = signSession({
      userId: user.id,
      orgId: user.organizationId,
      email: user.email,
      role: user.role,
    });
    setSessionCookie(res, token);
    return { status: 200, body: { userId: user.id, orgId: user.organizationId, token } };
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
    const token = signSession({
      userId: user.id,
      orgId: user.organizationId,
      email: user.email,
      role: user.role,
    });
    setSessionCookie(res, token);
    return { status: 200, body: { userId: user.id, orgId: user.organizationId, token } };
  }

  signOut(res: Response) {
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
