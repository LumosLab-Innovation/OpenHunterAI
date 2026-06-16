import { describe, expect, it } from 'vitest';
import { buildScanListWhere, parseScanListQuery, ScansService } from './scans.service.js';

describe('scan list query helpers', () => {
  it('builds org-scoped list filters and hides soft-deleted scans', () => {
    const query = parseScanListQuery({
      state: 'running',
      mode: 'free_hunter',
      q: ' kopymatch ',
      sort: 'oldest',
      pageToken: '2026-06-16T10:00:00.000Z|scan_1',
    });

    expect(query).toEqual({
      state: 'running',
      mode: 'free_hunter',
      q: 'kopymatch',
      sort: 'oldest',
      pageToken: '2026-06-16T10:00:00.000Z|scan_1',
      limit: 50,
    });
    expect(buildScanListWhere('org_1', query)).toEqual({
      project: { organizationId: 'org_1' },
      hiddenAt: null,
      state: 'running',
      mode: 'free_hunter',
      createdAt: { gt: new Date('2026-06-16T10:00:00.000Z') },
    });
  });

  it('ignores unsupported filter values', () => {
    const query = parseScanListQuery({
      state: 'done',
      mode: 'root',
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
  it('removes internal scan plan and worker labels from scan responses', () => {
    const service = new ScansService();
    const dto = service.toPublicScan({
      id: 'scan_1',
      projectId: 'proj_1',
      authorizationId: 'auth_1',
      mode: 'free_hunter',
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
    expect(serialized).not.toContain('scanPlan');
    expect(serialized).not.toContain('outputRef');
    expect(serialized).not.toMatch(/zap_signal|nuclei_signal|openhack_hunter|strix_core|browser_inspector/i);
    expect(dto.steps?.[0]?.kind).toBe('Z');
  });
});
