import { describe, expect, it } from 'vitest';
import { DEFAULT_SURFACE_FLAGS } from '@x-hunter/shared';
import { buildScanListWhere, canaryManifestInScope, parseScanListQuery, ScansService } from './scans.service.js';

describe('canary manifest scope', () => {
  const manifestUrl = 'https://staging.example.com/openhunter-canary/manifest.json';
  const manifest = {
    scenario: 'object_ownership',
    vulnerablePath: '/openhunter-canary/objects/vulnerable/user-b-object',
    fixedPath: '/openhunter-canary/objects/fixed/user-b-object',
    userAOwnPath: '/openhunter-canary/objects/own/user-a-object',
    userBOwnPath: '/openhunter-canary/objects/own/user-b-object',
  };
  const scope = {
    allowedHosts: ['staging.example.com'],
    allowedPaths: ['/openhunter-canary'],
    excludedPaths: [] as string[],
    testAccountPermission: true,
    sensitiveActionPermission: true,
    profile: 'deep' as const,
    authScope: 'two_accounts' as const,
    targetType: 'interactive_web_app' as const,
    testIntensityMode: 'aggressive_staging' as const,
    surfaceFlags: DEFAULT_SURFACE_FLAGS,
    aggressiveStagingRiskAccepted: true,
  };

  it('accepts all four scoped control paths', () => {
    expect(canaryManifestInScope(manifest, manifestUrl, scope)).toBe(true);
  });

  it('rejects missing or out-of-scope controls', () => {
    expect(canaryManifestInScope({ ...manifest, userAOwnPath: undefined }, manifestUrl, scope)).toBe(false);
    expect(canaryManifestInScope({ ...manifest, userAOwnPath: 'https://other.example.com/openhunter-canary/objects/a' }, manifestUrl, scope)).toBe(false);
    expect(canaryManifestInScope(manifest, manifestUrl, { ...scope, excludedPaths: ['/openhunter-canary/objects/own'] })).toBe(false);
    expect(canaryManifestInScope(manifest, manifestUrl, { ...scope, allowedPaths: ['/public'] })).toBe(false);
  });
});

describe('scan list query helpers', () => {
  it('builds org-scoped list filters and hides soft-deleted scans', () => {
    const query = parseScanListQuery({
      state: 'running',
      profile: 'standard',
      q: ' kopymatch ',
      sort: 'oldest',
      pageToken: '2026-06-16T10:00:00.000Z|scan_1',
    });

    expect(query).toEqual({
      state: 'running',
      profile: 'standard',
      q: 'kopymatch',
      sort: 'oldest',
      pageToken: '2026-06-16T10:00:00.000Z|scan_1',
      limit: 50,
    });
    expect(buildScanListWhere('org_1', query)).toEqual({
      project: { organizationId: 'org_1' },
      hiddenAt: null,
      state: 'running',
      testIntensityMode: 'controlled_attack_simulation',
      createdAt: { gt: new Date('2026-06-16T10:00:00.000Z') },
    });
  });

  it('ignores unsupported filter values', () => {
    const query = parseScanListQuery({
      state: 'done',
      profile: 'root',
      sort: 'bad',
      limit: '1000',
    });

    expect(query).toEqual({ sort: 'newest', limit: 100 });
    expect(buildScanListWhere('org_1', query)).toEqual({
      project: { organizationId: 'org_1' },
      hiddenAt: null,
    });
  });
});

describe('public scan DTO', () => {
  it('shows profile and plan while hiding raw worker output', () => {
    const service = new ScansService();
    const dto = service.toPublicScan({
      id: 'scan_1',
      projectId: 'proj_1',
      authorizationId: 'auth_1',
      targetType: 'interactive_web_app',
      authScope: 'none',
      testIntensityMode: 'controlled_attack_simulation',
      state: 'running',
      scopeSnapshot: {
        targetUrl: 'https://example.com',
        allowedHosts: ['example.com'],
      },
      scanPlan: { enabledWorkers: { zap: 'standard_safe' } },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
      updatedAt: new Date('2026-06-16T10:01:00.000Z'),
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      steps: [
        {
          id: 'step_1',
          kind: 'zap_signal',
          state: 'succeeded',
          outputRef: { summary: 'zap_signal completed', signalCount: 1 },
          errorCode: null,
          errorMsg: null,
        },
      ],
      reports: [],
      reportDraftSections: [],
    });

    const serialized = JSON.stringify(dto);
    expect(dto.profile).toBe('standard');
    expect(dto.scanPlan).toEqual({ enabledWorkers: { zap: 'standard_safe' } });
    expect(serialized).not.toContain('outputRef');
    expect(dto.steps?.[0]?.summary).toBe('Z completed');
    expect(dto.steps?.[0]?.kind).toBe('Z');
  });
});
