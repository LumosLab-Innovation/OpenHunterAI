import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { hashPassword } from '../../middlewares/auth.middleware.js';
import { AuthService } from './auth.service.js';

const prisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  userSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  browserSessionState: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@x-hunter/db', () => ({
  getPrisma: () => prisma,
}));

describe('AuthService session lifecycle', () => {
  const originalCookieCrossSite = process.env.COOKIE_CROSS_SITE;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COOKIE_CROSS_SITE = 'true';
    process.env.NODE_ENV = 'production';
    process.env.BROWSER_SESSION_BASE_URL = 'http://browser-session.local';
    prisma.userSession.update.mockResolvedValue({});
    prisma.browserSessionState.findMany.mockResolvedValue([]);
    prisma.browserSessionState.update.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    if (originalCookieCrossSite === undefined) {
      delete process.env.COOKIE_CROSS_SITE;
    } else {
      process.env.COOKIE_CROSS_SITE = originalCookieCrossSite;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    delete process.env.BROWSER_SESSION_BASE_URL;
    vi.unstubAllGlobals();
  });

  it('creates a server-side session without returning a reusable token in the response body', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      passwordHash: hashPassword('correct-password'),
      organizationId: 'org_1',
      role: 'owner',
    });
    prisma.userSession.create.mockResolvedValue({ id: 'sess_1' });
    const res = fakeResponse();

    const result = await new AuthService().signIn(
      { email: 'user@example.com', password: 'correct-password' },
      res as unknown as Response,
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ userId: 'user_1', orgId: 'org_1' });
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      'xhunter_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', path: '/' }),
    );
  });

  it('revokes the current server-side session and clears the exact cross-site cookie on signout', async () => {
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'sess_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user_1',
        organizationId: 'org_1',
        email: 'user@example.com',
        role: 'owner',
      },
    });
    prisma.browserSessionState.findMany.mockResolvedValue([
      { id: 'runtime_pending', status: 'pending' },
      { id: 'runtime_active', status: 'active' },
    ]);
    const res = fakeResponse();
    const req = {
      cookies: { xhunter_session: 'raw-session-token' },
    } as unknown as Request;

    await (new AuthService().signOut as any)(req, res as unknown as Response);

    expect(prisma.browserSessionState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          status: { in: ['pending', 'active'] },
          OR: [{ createdByUserId: 'user_1' }, { createdByUserId: null }],
        }),
      }),
    );
    expect(fetch).toHaveBeenCalledWith('http://browser-session.local/sessions/runtime_pending', { method: 'DELETE' });
    expect(fetch).toHaveBeenCalledWith('http://browser-session.local/sessions/runtime_active', { method: 'DELETE' });
    expect(prisma.browserSessionState.update).toHaveBeenCalledWith({
      where: { id: 'runtime_pending' },
      data: { status: 'cancelled', cancelledAt: expect.any(Date), storageStateCipher: null },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'xhunter_session',
      expect.objectContaining({ secure: true, sameSite: 'none', path: '/' }),
    );
  });
});

function fakeResponse() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}
