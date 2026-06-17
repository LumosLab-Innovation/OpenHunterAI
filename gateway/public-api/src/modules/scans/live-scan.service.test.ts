import { describe, expect, it } from 'vitest';
import { buildLiveScanSnapshot, filterLiveActivity, normalizeActivityEvent } from './live-scan.service.js';

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
      findingCandidates: [
        {
          id: 'candidate_1',
          title: 'Unvalidated reflected input',
          severity: 'medium',
          confidence: 'medium',
          affectedAsset: 'https://example.com/search',
          category: 'xss',
          evidence: { evidenceClass: 'candidate', validationState: 'unvalidated', description: 'Needs validation.' },
          createdAt: new Date('2026-06-16T10:00:35.000Z'),
        },
        {
          id: 'candidate_2',
          title: 'Content Security Policy (CSP) Header Not Set',
          severity: 'low',
          confidence: 'high',
          affectedAsset: 'https://example.com',
          category: 'missing_security_header',
          evidence: { evidenceClass: 'hardening_warning', validationState: 'passive_signal', description: 'Passive header gap.' },
          createdAt: new Date('2026-06-16T10:00:36.000Z'),
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

    expect(snapshot.workers.map((worker) => worker.code)).toEqual(['Browser', 'Z', 'N', 'O', 'S', 'RPT']);
    expect(snapshot.workers.find((worker) => worker.code === 'Z')?.state).toBe('succeeded');
    expect(snapshot.activity.some((event) => event.type === 'step_completed' && event.actor === 'Z')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(JSON.stringify(snapshot)).toContain('[REDACTED_TOKEN]');
    expect(snapshot.cursorPreview.caption).toContain('Z');
    expect(snapshot.findingsSummary.validatedFindings).toHaveLength(1);
    expect(snapshot.findingsSummary.candidates.map((candidate) => candidate.id)).toEqual(['candidate_1']);
    expect(snapshot.findingsSummary.hardeningCoverage.map((item) => item.id)).toEqual(['candidate_2']);
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
            sanitized: true,
            synthetic: true,
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
            sanitized: true,
            synthetic: true,
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
        sanitized: true,
        synthetic: true,
        rawRequest: 'GET /secret',
      },
    });

    expect(event.actor).toBe('Z');
    expect(JSON.stringify(event)).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
    expect(JSON.stringify(event)).not.toContain('rawRequest');
    expect(event.visualArtifact?.expiresAt).toBeTruthy();
    expect(event.visualArtifact?.synthetic).toBe(true);
  });

  it('accepts real visual artifacts only when masked and rejects unmasked thumbnails', () => {
    const masked = normalizeActivityEvent({
      scanJobId: 'scan_1',
      eventType: 'browser_action',
      actor: 'browser_inspector',
      titleKey: 'activity.browser_action.title',
      bodyKey: 'activity.browser_action.body',
      bodyParams: { summary: 'masked screenshot' },
      status: 'running',
      visualArtifact: {
        kind: 'thumbnail',
        dataUrl: 'data:image/png;base64,abc',
        sanitized: true,
        masked: true,
      },
    });
    const event = normalizeActivityEvent({
      scanJobId: 'scan_1',
      eventType: 'browser_action',
      actor: 'browser_inspector',
      titleKey: 'activity.browser_action.title',
      bodyKey: 'activity.browser_action.body',
      bodyParams: { summary: 'raw screenshot attempt' },
      status: 'running',
      visualArtifact: {
        kind: 'thumbnail',
        dataUrl: 'data:image/png;base64,abc',
        sanitized: true,
      },
    });

    expect(masked.visualArtifact?.masked).toBe(true);
    expect(masked.visualArtifact?.synthetic).toBeUndefined();
    expect(event.visualArtifact).toBeUndefined();
  });

  it('curates live activity by cursor, actor, type, and limit', () => {
    const activity = Array.from({ length: 6 }, (_, index) => ({
      id: `activity_${index + 1}`,
      at: `2026-06-16T10:00:0${index}.000Z`,
      type: index % 2 === 0 ? 'step_completed' : 'browser_action',
      actor: index % 2 === 0 ? 'Z' as const : 'Browser' as const,
      title: 'update',
      body: 'body',
      status: 'running',
      sanitized: true as const,
    }));

    const filtered = filterLiveActivity(activity, {
      cursor: '2026-06-16T10:00:01.000Z|activity_2',
      actor: 'Browser',
      type: 'browser_action',
      limit: 2,
    });

    expect(filtered.items.map((item) => item.id)).toEqual(['activity_4', 'activity_6']);
    expect(filtered.nextCursor).toBe('2026-06-16T10:00:05.000Z|activity_6');
  });

  it('uses compact public summaries for derived worker activity', () => {
    const snapshot = buildLiveScanSnapshot({
      id: 'scan_1',
      projectId: 'proj_1',
      mode: 'ai_blackhat_mindset_check',
      targetType: 'interactive_web_app',
      authScope: 'none',
      testIntensityMode: 'controlled_attack_simulation',
      state: 'running',
      scanPlan: { enabledWorkers: { zap: 'standard_safe', nuclei: 'standard_safe', openhack: 'medium', strix: 'deep' } },
      scopeSnapshot: { verifiedDomain: 'example.com' },
      createdAt: new Date('2026-06-16T10:00:00.000Z'),
      updatedAt: new Date('2026-06-16T10:01:00.000Z'),
      steps: [
        {
          id: 'step_z',
          kind: 'zap_signal',
          state: 'succeeded',
          startedAt: new Date('2026-06-16T10:00:20.000Z'),
          finishedAt: new Date('2026-06-16T10:00:30.000Z'),
          outputRef: {},
          errorCode: null,
          errorMsg: null,
        },
      ],
      findings: [],
      reports: [],
      reportDraftSections: [],
    });

    expect(JSON.stringify(snapshot)).not.toMatch(/zap|nuclei|openhack|strix|Z_signal|N_signal|O_hunter|S_core|browser_inspector/i);
  });
});
