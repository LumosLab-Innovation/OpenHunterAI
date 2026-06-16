import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isGuardrailError } from '@x-hunter/shared';
import { LoginSessionsService } from './login-sessions.service.js';

const prisma = vi.hoisted(() => ({
  browserSessionState: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@x-hunter/db', () => ({
  getPrisma: () => prisma,
}));

describe('LoginSessionsService interactive runtime lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BROWSER_SESSION_BASE_URL = 'http://browser-session.local';
    prisma.browserSessionState.update.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    delete process.env.BROWSER_SESSION_BASE_URL;
    vi.unstubAllGlobals();
  });

  it('allows stream proxy access only while the login session is still interactive', async () => {
    prisma.browserSessionState.findFirst.mockResolvedValue({
      id: 'sess_1',
      organizationId: 'org_1',
      createdByUserId: 'user_1',
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
    });

    try {
      await new LoginSessionsService().assertInteractiveSessionAccess('sess_1', 'org_1', 'user_1');
      throw new Error('expected inactive interactive session to be rejected');
    } catch (error) {
      expect(isGuardrailError(error)).toBe(true);
      if (isGuardrailError(error)) expect(error.code).toBe('INVALID_INPUT');
    }
    expect(fetch).toHaveBeenCalledWith('http://browser-session.local/sessions/sess_1', { method: 'DELETE' });
  });

  it('rejects access to another user login session in the same organization', async () => {
    prisma.browserSessionState.findFirst.mockResolvedValue(null);

    try {
      await new LoginSessionsService().assertInteractiveSessionAccess('sess_1', 'org_1', 'user_2');
      throw new Error('expected cross-user session access to be rejected');
    } catch (error) {
      expect(isGuardrailError(error)).toBe(true);
      if (isGuardrailError(error)) expect(error.code).toBe('INVALID_INPUT');
    }
    expect(prisma.browserSessionState.findFirst).toHaveBeenCalledWith({
      where: { id: 'sess_1', organizationId: 'org_1', createdByUserId: 'user_2' },
      select: expect.any(Object),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels user-owned interactive runtimes on logout without deleting active saved state', async () => {
    prisma.browserSessionState.findMany.mockResolvedValue([
      { id: 'pending_1', status: 'pending' },
      { id: 'active_1', status: 'active' },
    ]);

    await new LoginSessionsService().cancelInteractiveSessionsForUser('org_1', 'user_1');

    expect(prisma.browserSessionState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          status: { in: ['pending', 'active'] },
          OR: [{ createdByUserId: 'user_1' }, { createdByUserId: null }],
        }),
      }),
    );
    expect(fetch).toHaveBeenCalledWith('http://browser-session.local/sessions/pending_1', { method: 'DELETE' });
    expect(fetch).toHaveBeenCalledWith('http://browser-session.local/sessions/active_1', { method: 'DELETE' });
    expect(prisma.browserSessionState.update).toHaveBeenCalledTimes(1);
    expect(prisma.browserSessionState.update).toHaveBeenCalledWith({
      where: { id: 'pending_1' },
      data: { status: 'cancelled', cancelledAt: expect.any(Date), storageStateCipher: null },
    });
  });
});
