import { describe, expect, it, vi } from 'vitest';
import { AuthorizationsService, normalizeAllowedHostsForAuthorization } from './authorizations.service.js';
import { CreateAuthorizationBody } from './authorizations.dto.js';
import { isGuardrailError } from '@x-hunter/shared';

const prisma = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  testAccount: { count: vi.fn() },
  domain: { upsert: vi.fn() },
  scanAuthorization: { create: vi.fn() },
}));
vi.mock('@x-hunter/db', () => ({ getPrisma: () => prisma }));

describe('normalizeAllowedHostsForAuthorization', () => {
  it('rejects private, local, and metadata hosts before authorization is created', () => {
    for (const host of ['127.0.0.1', 'localhost', '169.254.169.254', 'metadata.google.internal']) {
      try {
        normalizeAllowedHostsForAuthorization([host]);
        throw new Error(`expected ${host} to be rejected`);
      } catch (error) {
        expect(isGuardrailError(error)).toBe(true);
        if (isGuardrailError(error)) {
          expect(error.code).toBe('PRIVATE_OR_RESERVED_TARGET');
        }
      }
    }
  });

  it('deduplicates and lowercases public hostnames', () => {
    expect(normalizeAllowedHostsForAuthorization(['Example.com', 'example.com', 'API.Example.com'])).toEqual([
      'example.com',
      'api.example.com',
    ]);
  });

  it('rejects a URL or path in the host field instead of silently broadening scope', () => {
    for (const host of ['https://example.com', 'example.com/admin', 'example.com:8443', 'user@example.com']) {
      expect(() => normalizeAllowedHostsForAuthorization([host])).toThrow();
    }
  });
});

describe('self-host authorization without DNS proof', () => {
  const input = {
    authScope: 'none',
    targetType: 'interactive_web_app',
    testIntensityMode: 'safe_discovery',
    surfaceFlags: {},
    aggressiveStagingRiskAccepted: false,
    allowedHosts: ['Lab029s-Demo.Pages.Dev'],
    allowedPaths: [],
    excludedPaths: [],
    authorityConfirmed: true,
    consentText: 'I am authorized to test this public host.',
  };

  it('requires explicit authority confirmation', () => {
    expect(CreateAuthorizationBody.safeParse({ ...input, authorityConfirmed: false }).success).toBe(false);
    expect(CreateAuthorizationBody.safeParse(input).success).toBe(true);
  });

  it('creates an authorization for a public host without DNS verification', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'project_1' });
    prisma.domain.upsert.mockResolvedValue({ id: 'domain_1' });
    prisma.scanAuthorization.create.mockResolvedValue({ id: 'auth_1' });
    const body = CreateAuthorizationBody.parse(input);

    await new AuthorizationsService().create('project_1', 'org_1', 'user_1', body);

    expect(prisma.domain.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_hostname: { projectId: 'project_1', hostname: 'lab029s-demo.pages.dev' } },
    }));
    expect(prisma.scanAuthorization.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ allowedHosts: ['lab029s-demo.pages.dev'], acceptedByUserId: 'user_1' }),
    }));
  });
});
