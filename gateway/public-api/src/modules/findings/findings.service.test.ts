import { describe, expect, it } from 'vitest';
import { buildRetestRequestedPayload } from './findings.service.js';

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
          scanMode: 'free_hunter',
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
      scanMode: 'free_hunter',
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
