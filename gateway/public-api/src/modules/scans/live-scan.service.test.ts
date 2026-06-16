import { describe, expect, it } from 'vitest';
import { buildLiveScanSnapshot, normalizeActivityEvent } from './live-scan.service.js';

describe('buildLiveScanSnapshot', () => {
  it('builds a sanitized live snapshot with compact worker labels', () => {
    const snapshot = buildLiveScanSnapshot({
      id: 'scan_1',
      projectId: 'proj_1',
      mode: 'ai_blackhat_mindset_check',
      targetType: 'interactive_web_app',
      authScope: 'none',
      testIntensityMode: 'controlled_attack_simulation',
      state: 'running',
      scanPlan: {
        enabledWorkers: {
          browser: 'deep',
          zap: 'standard_safe',
          nuclei: 'standard_safe',
          openhack: 'medium',
          strix: 'deep',
        },
      },
      scopeSnapshot: { verifiedDomain: 'example.com' },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
      updatedAt: new Date('2026-06-16T10:01:00.000Z'),
      startedAt: new Date('2026-06-16T10:00:10.000Z'),
      finishedAt: null,
      errorMessage: null,
      steps: [
        {
          id: 'step_1',
          kind: 'zap_signal',
          state: 'succeeded',
          startedAt: new Date('2026-06-16T10:00:20.000Z'),
          finishedAt: new Date('2026-06-16T10:00:30.000Z'),
          outputRef: {
            summary: 'Checked headers with token sk-1234567890abcdef1234567890abcdef',
            signalCount: 2,
          },
          errorCode: null,
          errorMsg: null,
        },
      ],
      findings: [
        {
          id: 'finding_1',
          title: 'Missing security header',
          severity: 'medium',
          confidence: 'high',
          affectedAsset: 'https://example.com',
          category: 'headers',
          status: 'open',
          createdAt: new Date('2026-06-16T10:00:40.000Z'),
        },
      ],
      reports: [
        {
          id: 'report_1',
          state: 'draft',
          version: 1,
          generatedAt: new Date('2026-06-16T10:00:00.000Z'),
          finalizedAt: null,
        },
      ],
      reportDraftSections: [
        {
          id: 'section_1',
          sectionKey: 'scope',
          state: 'ready',
          content: { ownerSummary: { headline: 'Scope ready' } },
          updatedAt: new Date('2026-06-16T10:00:05.000Z'),
          errorCode: null,
          errorMsg: null,
        },
      ],
    });

    expect(snapshot.workers.map((worker) => worker.code)).toEqual(['browser_inspector', 'Z', 'N', 'O', 'S', 'RPT']);
    expect(snapshot.workers.find((worker) => worker.code === 'Z')?.state).toBe('succeeded');
    expect(snapshot.activity.some((event) => event.type === 'step_completed' && event.actor === 'Z')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(JSON.stringify(snapshot)).toContain('[REDACTED_TOKEN]');
    expect(snapshot.cursorPreview.caption).toContain('Z');
  });

  it('prefers persisted activity and drops expired visual artifacts', () => {
    const snapshot = buildLiveScanSnapshot({
      id: 'scan_1',
      projectId: 'proj_1',
      mode: 'ai_blackhat_mindset_check',
      targetType: 'interactive_web_app',
      authScope: 'none',
      testIntensityMode: 'controlled_attack_simulation',
      state: 'running',
      scanPlan: { enabledWorkers: { strix: 'deep' } },
      scopeSnapshot: { verifiedDomain: 'example.com' },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
      updatedAt: new Date('2026-06-16T10:01:00.000Z'),
      activityEvents: [
        {
          id: 'activity_1',
          eventType: 'reasoning_summary',
          actor: 'strix_core',
          titleKey: 'activity.reasoning_summary.title',
          bodyKey: 'activity.reasoning_summary.body',
          bodyParams: { summary: 'Cookie session=secret12345678901234567890 was ignored' },
          status: 'running',
          severity: null,
          sanitized: true,
          visualArtifact: {
            kind: 'thumbnail',
            dataUrl: 'data:image/png;base64,abc',
            expiresAt: '2026-06-17T10:00:00.000Z',
            width: 320,
            height: 180,
          },
          createdAt: new Date('2026-06-16T10:00:20.000Z'),
        },
        {
          id: 'activity_2',
          eventType: 'browser_action',
          actor: 'browser_inspector',
          titleKey: 'activity.browser_action.title',
          bodyKey: 'activity.browser_action.body',
          bodyParams: { summary: 'Expired image' },
          status: 'running',
          severity: null,
          sanitized: true,
          visualArtifact: {
            kind: 'thumbnail',
            dataUrl: 'data:image/png;base64,expired',
            expiresAt: '2026-06-15T10:00:00.000Z',
          },
          createdAt: new Date('2026-06-16T10:00:10.000Z'),
        },
      ],
      steps: [],
      findings: [],
      reports: [],
      reportDraftSections: [],
    }, undefined, new Date('2026-06-16T11:00:00.000Z'));

    expect(snapshot.activity).toHaveLength(2);
    expect(snapshot.activity[0].visualArtifact).toBeUndefined();
    expect(snapshot.activity[1].visualArtifact?.dataUrl).toBe('data:image/png;base64,abc');
    expect(JSON.stringify(snapshot)).not.toContain('secret12345678901234567890');
    expect(JSON.stringify(snapshot)).toContain('[REDACTED]');
    expect(snapshot.cursorPreview.visualArtifact?.dataUrl).toBe('data:image/png;base64,abc');
  });

  it('normalizes activity event payloads before persistence', () => {
    const event = normalizeActivityEvent({
      scanJobId: 'scan_1',
      eventType: 'browser_action',
      actor: 'ZAP Proxy',
      titleKey: 'activity.browser_action.title',
      bodyKey: 'activity.browser_action.body',
      bodyParams: { summary: 'Bearer abcdefghijklmnopqrstuvwxyz1234567890 token' },
      status: 'running',
      severity: 'medium',
      visualArtifact: {
        kind: 'thumbnail',
        dataUrl: 'data:image/png;base64,abc',
        rawRequest: 'GET /secret',
      },
    });

    expect(event.actor).toBe('Z');
    expect(JSON.stringify(event)).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
    expect(JSON.stringify(event)).not.toContain('rawRequest');
    expect(event.visualArtifact?.expiresAt).toBeTruthy();
  });
});
