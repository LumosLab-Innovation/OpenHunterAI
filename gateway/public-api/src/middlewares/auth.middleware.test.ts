import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { requireAllowedOrigin, requireUser, sessionCookieName } from './auth.middleware.js';

const prisma = vi.hoisted(() => ({
  userSession: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@x-hunter/db', () => ({
  getPrisma: () => prisma,
}));

describe('requireUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.userSession.update.mockResolvedValue({});
  });

  it('does not accept legacy bearer tokens after logout support moves to server-side sessions', async () => {
    const legacyToken = signSession({
      userId: 'user_1',
      orgId: 'org_1',
      email: 'user@example.com',
      role: 'owner',
    });
    const req = {
      headers: { authorization: `Bearer ${legacyToken}` },
      cookies: {},
    } as any;
    const res = fakeResponse();
    const next = vi.fn();

    requireUser(req, res as any, next);
    await Promise.resolve();

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } });
  });

  it('authenticates an active opaque cookie session from the database', async () => {
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
    const req = {
      headers: {},
      cookies: { [sessionCookieName()]: 'raw-session-token' },
    } as any;
    const res = fakeResponse();
    const next = vi.fn();

    requireUser(req, res as any, next);

    await vi.waitFor(() => expect(req.user).toEqual({
      userId: 'user_1',
      orgId: 'org_1',
      email: 'user@example.com',
      role: 'owner',
    }));
    expect(req.user).toEqual({
      userId: 'user_1',
      orgId: 'org_1',
      email: 'user@example.com',
      role: 'owner',
    });
    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('requireAllowedOrigin', () => {
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://openhunterai.pages.dev';
  });

  afterEach(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('rejects cross-site mutating auth requests outside the configured origins', () => {
    const req = fakeRequestWithHeaders({
      origin: 'https://evil.example',
      host: 'api.openhunter.ai',
    });
    const res = fakeResponse();
    const next = vi.fn();

    requireAllowedOrigin(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not allowed' },
    });
  });

  it('rejects production mutating auth requests when Origin is missing', () => {
    const req = fakeRequestWithHeaders({
      host: 'api.openhunter.ai',
    });
    const res = fakeResponse();
    const next = vi.fn();

    requireAllowedOrigin(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows configured SPA origins and same-origin requests', () => {
    const res = fakeResponse();
    const allowedNext = vi.fn();
    const sameOriginNext = vi.fn();

    requireAllowedOrigin(
      fakeRequestWithHeaders({ origin: 'https://openhunterai.pages.dev', host: 'api.openhunter.ai' }) as any,
      res as any,
      allowedNext,
    );
    requireAllowedOrigin(
      fakeRequestWithHeaders({ origin: 'https://api.openhunter.ai', host: 'api.openhunter.ai' }) as any,
      res as any,
      sameOriginNext,
    );

    expect(allowedNext).toHaveBeenCalledWith();
    expect(sameOriginNext).toHaveBeenCalledWith();
  });
});

function fakeResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  return res;
}

function fakeRequestWithHeaders(headers: Record<string, string>) {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function signSession(payload: Record<string, unknown>): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }),
  ).toString('base64url');
  const sig = createHmac('sha256', process.env.APP_JWT_SECRET || 'dev-only-rotate-me')
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}
