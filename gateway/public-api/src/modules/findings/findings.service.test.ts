import { describe, expect, it, vi } from 'vitest';
import { buildRetestRequestedPayload, FindingsService } from './findings.service.js';

const prisma = vi.hoisted(() => ({
  finding: { findFirst: vi.fn() },
  retestRun: { create: vi.fn() },
}));
vi.mock('@x-hunter/db', () => ({ getPrisma: () => prisma }));

describe('buildRetestRequestedPayload', () => {
  it('includes the complete scoped retest payload required by the retest worker', () => {
    const finding = {
      id: 'finding_1',
      scanJobId: 'scan_1',
      projectId: 'proj_1',
      scanJob: {
        id: 'scan_1',
        projectId: 'proj_1',
        scopeSnapshot: {
          profile: 'quick',
          targetUrl: 'https://example.com/app',
          targetType: 'static_content_website',
          authScope: 'none',
          testIntensityMode: 'safe_discovery',
          surfaceFlags: { has_login: false },
          verifiedDomain: 'example.com',
          allowedHosts: ['example.com'],
          allowedPaths: ['/app'],
          excludedPaths: ['/app/admin'],
        },
      },
      retestScenario: { title: 'Retest finding', steps: ['Load /app'] },
    };

    expect(buildRetestRequestedPayload('retest_1', finding)).toEqual({
      retestRunId: 'retest_1',
      findingId: 'finding_1',
      scanId: 'scan_1',
      projectId: 'proj_1',
      profile: 'quick',
      targetUrl: 'https://example.com/app',
      targetType: 'static_content_website',
      authScope: 'none',
      testIntensityMode: 'safe_discovery',
      surfaceFlags: { has_login: false },
      verifiedDomain: 'example.com',
      allowedHosts: ['example.com'],
      allowedPaths: ['/app'],
      excludedPaths: ['/app/admin'],
      retestScenario: { title: 'Retest finding', steps: ['Load /app'] },
    });
  });
});

describe('requestRetest before independent replay exists', () => {
  it('returns RETEST_UNSUPPORTED repeatedly without creating a fake retest or enforcing a quota', async () => {
    prisma.finding.findFirst.mockResolvedValue({ retestScenario: { steps: ['replay'] } });
    const service = new FindingsService();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(service.requestRetest('finding_1', 'org_1')).rejects.toMatchObject({ code: 'RETEST_UNSUPPORTED' });
    }
    expect(prisma.retestRun.create).not.toHaveBeenCalled();
  });
});
