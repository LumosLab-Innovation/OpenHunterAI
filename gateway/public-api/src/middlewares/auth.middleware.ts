import type { NextFunction, Request, Response } from 'express';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { GuardrailError } from '@x-hunter/shared';

export interface SessionUser {
  userId: string;
  orgId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}

const cookieName = process.env.APP_SESSION_COOKIE || 'xhunter_session';

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

export function signSession(payload: SessionUser): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }),
  ).toString('base64url');
  const sig = hmac(body);
  return `${body}.${sig}`;
}

export function readSession(token?: string): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !timingSafeEqualString(hmac(body), sig)) return null;
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionUser & {
    exp?: number;
  };
  if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { userId: parsed.userId, orgId: parsed.orgId, email: parsed.email, role: parsed.role };
}

export function setSessionCookie(res: Response, token: string) {
  // For a cross-site frontend (e.g. openhunterai.pages.dev calling the API on
  // *.run.app), the browser only sends the cookie if it is SameSite=None;Secure.
  // Controlled via COOKIE_CROSS_SITE so local dev can keep Lax.
  const crossSite = process.env.COOKIE_CROSS_SITE === 'true';
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookieName, { path: '/' });
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const user = readSession(auth || req.cookies?.[cookieName]);
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
    return;
  }
  req.user = user;
  next();
}

export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new GuardrailError('INVALID_INPUT', 'Sign in required');
  return req.user;
}

function hmac(body: string): string {
  return createHmac('sha256', process.env.APP_JWT_SECRET || 'dev-only-rotate-me')
    .update(body)
    .digest('base64url');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
