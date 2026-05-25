import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { hashPassword, verifyPassword } from '../auth.js';

const SignUpBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
  orgName: z.string().min(1).max(64),
});

const SignInBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export function registerAuthRoutes(app: FastifyInstance): void {
  const cookieName = process.env.APP_SESSION_COOKIE || 'xhunter_session';

  app.post('/v1/auth/signup', async (req, reply) => {
    const body = SignUpBody.parse(req.body);
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      reply.code(409).send({ error: { code: 'CONFLICT', message: 'Email already registered' } });
      return;
    }

    const org = await prisma.organization.create({
      data: { name: body.orgName, slug: slugify(body.orgName) + '-' + randomSlug() },
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
    const token = await reply.jwtSign(
      { userId: user.id, orgId: user.organizationId, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply
      .setCookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      .send({ userId: user.id, orgId: user.organizationId, token });
  });

  app.post('/v1/auth/signin', async (req, reply) => {
    const body = SignInBody.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      reply
        .code(401)
        .send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }
    const token = await reply.jwtSign(
      { userId: user.id, orgId: user.organizationId, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply
      .setCookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
      .send({ userId: user.id, orgId: user.organizationId, token });
  });

  app.post('/v1/auth/signout', async (_req, reply) => {
    reply.clearCookie(cookieName, { path: '/' }).send({ ok: true });
  });

  app.get('/v1/auth/me', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
      return;
    }
    reply.send({ user: (req as { user?: unknown }).user });
  });
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
