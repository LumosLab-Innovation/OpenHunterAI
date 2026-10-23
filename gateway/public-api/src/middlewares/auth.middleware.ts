import type { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';

export interface SessionUser {
  userId: string;
  orgId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}

const cookieName = process.env.APP_SESSION_COOKIE || 'xhunter_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function sessionCookieName(): string {
  return cookieName;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.startsWith('scrypt$')) return false;
  const [, saltHex, derivedHex] = stored.split('$');
  if (!saltHex || !derivedHex) return false;
  const expected = Buffer.from(derivedHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

export async function readSessionFromCookieHeaderAsync(cookieHeader?: string): Promise<SessionUser | null> {
  const cookies = parseCookieHeader(cookieHeader);
  return authenticateSessionToken(cookies[cookieName]);
}

export async function createSessionForUser(
  user: { id: string; organizationId: string; email: string; role: SessionUser['role'] },
  res: Response,
): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await (getPrisma() as any).userSession.create({
    data: {
      userId: user.id,
      tokenHash: sessionTokenHash(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  setSessionCookie(res, token);
}

export async function authenticateSessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  const prisma = getPrisma();
  const session = await (prisma as any).userSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: {
      user: {
        select: {
          id: true,
          organizationId: true,
          email: true,
          role: true,
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  await Promise.resolve(
    (prisma as any).userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    }),
  ).catch(() => {});
  return {
    userId: session.user.id,
    orgId: session.user.organizationId,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function revokeSessionToken(token?: string): Promise<void> {
  if (!token) return;
  await (getPrisma() as any).userSession.updateMany({
    where: { tokenHash: sessionTokenHash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function setSessionCookie(res: Response, token: string) {
  // For a cross-site frontend (e.g. openhunterai.pages.dev calling the API on
  // *.run.app), the browser only sends the cookie if it is SameSite=None;Secure.
  // Controlled via COOKIE_CROSS_SITE so local dev can keep Lax.
  res.cookie(cookieName, token, { ...sessionCookieOptions(), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookieName, sessionCookieOptions());
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (isLocalMode()) {
    if (!isTrustedLocalRequest(req)) {
      res.status(403).json({ error: { code: 'LOCAL_ONLY', message: 'Local mode only accepts requests from the configured loopback UI or CLI' } });
      return;
    }
    void localUser().then((user) => {
      res.setHeader('Cache-Control', 'no-store');
      req.user = user;
      next();
    }).catch(next);
    return;
  }
  void authenticateSessionToken(req.cookies?.[cookieName])
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      req.user = user;
      next();
    })
    .catch(next);
}

export function isLocalMode(): boolean {
  return process.env.OPENHUNTER_LOCAL_MODE === '1';
}

export function isTrustedLocalRequest(req: Pick<Request, 'header'>): boolean {
  const host = req.header('host')?.toLowerCase() ?? '';
  if (!/^((127\.0\.0\.1|localhost)(:\d+)?)$/.test(host)) return false;
  if (req.header('sec-fetch-site') === 'cross-site') return false;
  const origin = req.header('origin');
  if (!origin) return true;
  const allowed = (process.env.OPENHUNTER_LOCAL_UI_ORIGINS ?? 'http://127.0.0.1:3001,http://localhost:3001')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin);
}

async function localUser(): Promise<SessionUser> {
  const prisma = getPrisma();
  const organization = await prisma.organization.upsert({
    where: { slug: 'openhunter-local' },
    update: {},
    create: { slug: 'openhunter-local', name: 'Local' },
  });
  const user = await prisma.user.upsert({
    where: { email: 'local@openhunter.invalid' },
    update: {},
    create: {
      email: 'local@openhunter.invalid',
      passwordHash: '!local-mode-no-password',
      displayName: 'Local operator',
      role: 'owner',
      organizationId: organization.id,
    },
  });
  return { userId: user.id, orgId: organization.id, email: user.email, role: 'owner' };
}

export function requireAllowedOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.header('origin');
  if (origin && isAllowedOrigin(origin, req.header('host'))) {
    next();
    return;
  }
  if (!origin && process.env.NODE_ENV !== 'production') {
    next();
    return;
  }
  res.status(403).json({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not allowed' } });
}

export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new GuardrailError('INVALID_INPUT', 'Sign in required');
  return req.user;
}

export function sessionTokenHash(token: string): string {
  return createHmac('sha256', process.env.APP_JWT_SECRET || 'dev-only-rotate-me')
    .update(token)
    .digest('hex');
}

function sessionCookieOptions() {
  const crossSite = process.env.COOKIE_CROSS_SITE === 'true';
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' as const : 'lax' as const,
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function isAllowedOrigin(origin: string, hostHeader?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (hostHeader && parsed.host === hostHeader) return true;

  const allowed = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production';
  return allowed.includes(parsed.origin);
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
