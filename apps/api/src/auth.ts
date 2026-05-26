/**
 * Auth & session helpers. v1 ships a minimal email/password flow good
 * enough for the dashboard. The token is a JWT signed with APP_JWT_SECRET
 * and stored both in an HttpOnly cookie and Authorization header.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';

export interface SessionUser {
  userId: string;
  orgId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('scrypt$')) {
    const [, saltHex, derivedHex] = stored.split('$');
    if (!saltHex || !derivedHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(derivedHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(expected, actual);
  }
  // Legacy seed hash: sha256
  return createHash('sha256').update(password).digest('hex') === stored;
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<SessionUser> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
    throw new GuardrailError('INVALID_INPUT', 'unauthorized');
  }
  const payload = (req as { user?: SessionUser }).user;
  if (!payload?.userId) {
    reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
    throw new GuardrailError('INVALID_INPUT', 'no user payload');
  }
  return payload;
}

export async function loadUserById(userId: string): Promise<SessionUser> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new GuardrailError('INVALID_INPUT', 'User not found');
  return { userId: user.id, orgId: user.organizationId, email: user.email, role: user.role };
}
