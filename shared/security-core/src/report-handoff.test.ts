import { DEFAULT_SURFACE_FLAGS } from './packages.js';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildReportHandoff, canonicalReportJson, normalizeReportSnapshotContent, normalizeReportLatestOverlay, reportSnapshotExport } from './report-handoff.js';
import { sanitizeReportContent, type ReportContentV2 } from './report.js';

const finding = { id: 'f1', rank: 1, title: 'Test finding', severity: 'medium', confidence: 'high', affectedAsset: 'https://example.com/app',
  category: 'authorization', attackerPath: 'Test observation', sanitizedProof: { description: 'Bearer secret-test-value', evidenceRefs: ['artifact:one'], sanitized: true },
  impact: 'Test impact', fixSummary: 'Review ownership', validationStatus: 'validated' };
const report = { formatVersion: 'report_v2', reportType: 'finding_report', profile: 'standard', targetType: 'interactive_web_app', authScope: 'none',
  testIntensityMode: 'controlled_attack_simulation', surfaceFlags: DEFAULT_SURFACE_FLAGS, ownerSummary: { headline: 'Test', riskLevel: 'medium', whatWasTested: 'App',
    topRiskOrOutcome: 'Observation', businessImpact: 'Test', recommendedNextAction: 'Review' }, findings: [finding], developerFixPack: [],
  coverage: { targetType: 'interactive_web_app', workersRun: [], huntersRun: [], skippedHunters: [], coverageGaps: ['incomplete'], limitations: ['No replay'] },
  hardeningRecommendations: [], retest: { eligibleFindings: ['f1'], manualRetestActions: [] }, generatedAt: '2026-10-24T00:00:00.000Z' } as ReportContentV2;
const snapshot = { id: 'r1', projectId: 'p1', scanJobId: 's1', version: 2, state: 'final', kind: 'human', formatVersion: 'report_v2',
  generatedAt: report.generatedAt, finalizedAt: report.generatedAt, content: report };

describe('bounded report handoff', () => {
  it('preserves frozen scope and records unknown lineage and replay honestly', () => {
    const handoff = buildReportHandoff({ id: 's1', projectId: 'p1', authorizationId: 'a1', authorization: { acceptedByUserId: 'u1', consentText: 'Authorized' },
      scopeSnapshot: { targetUrl: 'https://example.com/app', allowedHosts: ['example.com'], allowedPaths: ['/app'], excludedPaths: ['/app/admin'], capturedAt: report.generatedAt },
      startedAt: new Date(report.generatedAt), findings: [{ id: 'f1', candidates: [{ triageDecision: { state: 'validated', validator: 'independent_policy_v1', evidenceRefs: ['artifact:one'] } }] }] }, report.findings);
    expect(handoff.scope.allowedPaths).toEqual(['/app']);
    expect(handoff.scope.status).toBe('recorded');
    expect(buildReportHandoff({ scopeSnapshot: { ...handoff.scope, targetUrl: 'https://outside.example/app' } }, report.findings).scope.status).toBe('incomplete');
    expect(buildReportHandoff({ scopeSnapshot: { ...handoff.scope, targetUrl: 'https://example.com/app/admin' } }, report.findings).scope.status).toBe('incomplete');
    expect(handoff.scope.authorityConfirmation).toBe('recorded');
    expect(handoff.scanWindow.finishedAt).toBeNull();
    expect(handoff.validation[0]).toMatchObject({ validator: 'independent_policy_v1', replayStatus: 'not_attested' });
    expect(handoff.evidence[0]).toMatchObject({ sha256: null, collector: null, lineage: [] });
    expect(handoff).toMatchObject({ grantsAuthority: false, manualIntakeRequired: true, connectorStatus: 'not_implemented' });
  });

  it('never takes authority, evidence metadata or producer identity from untrusted scan fields', () => {
    const handoff = buildReportHandoff({ authorityConfirmed: true, producer: { version: 'forged' }, handoff: { grantsAuthority: true },
      scopeSnapshot: { targetUrl: 'https://user:password@example.com/app?token=secret' } }, report.findings);
    expect(handoff.scope.authorityConfirmation).toBe('unknown');
    expect(handoff.scope.targetUrl).toBeNull();
    expect(handoff.scope.status).toBe('incomplete');
    expect(handoff.producer.version).toBeNull();
    expect(handoff.source.scanId).toBeNull();
  });

  it('exports stable snapshot digest outside the content without mutable state or extra raw fields', () => {
    const input = { ...snapshot, content: { ...report, password: 'never-export', arbitrary: { token: 'never-export' },
      findings: [{ ...finding, rawRequest: 'never-export', retestScenario: { title: 'Manual replay', steps: ['Review'], command: 'never-execute' } }] }, latestOverlay: { status: 'fixed' } };
    const first = reportSnapshotExport(input);
    const second = reportSnapshotExport({ ...input, latestOverlay: { status: 'open' } });
    expect(first.integrity.digest).toBe(second.integrity.digest);
    expect(first.integrity.digest).toBe(createHash('sha256').update(canonicalReportJson(first.snapshot)).digest('hex'));
    expect(JSON.stringify(first)).not.toMatch(/never-export|never-execute|secret-test-value|latestOverlay/);
    expect(first.integrity.authenticityVerified).toBe(false);
    expect(canonicalReportJson({ z: 0, omitted: undefined, a: 1 })).toBe('{"a":1,"z":0}');
    expect(reportSnapshotExport(Object.fromEntries(Object.entries(snapshot).reverse())).integrity.digest).toBe(reportSnapshotExport(snapshot).integrity.digest);
    expect(input.content.findings[0].sanitizedProof.description).toContain('secret-test-value');
    expect(reportSnapshotExport({ ...snapshot, version: 3 }).integrity.digest).not.toBe(first.integrity.digest);
  });

  it('retains only validated producer version and build metadata through re-sanitization', () => {
    const handoff = buildReportHandoff({}, report.findings, { version: '0.1.0', buildRef: 'a'.repeat(40) });
    expect(sanitizeReportContent({ ...report, handoff }).handoff?.producer.buildRef).toBe('a'.repeat(40));
    expect(buildReportHandoff({}, report.findings, { version: 'Bearer secret-test-value', buildRef: 'forged' }).producer).toMatchObject({ version: null, buildRef: null });
  });

  it('rejects draft, candidates, unknown versions and oversized content without echoing input', () => {
    expect(() => reportSnapshotExport({ ...snapshot, state: 'draft' })).toThrow('finalized');
    expect(reportSnapshotExport({ ...snapshot, state: 'superseded' }).snapshot.state).toBe('superseded');
    expect(() => normalizeReportSnapshotContent({ ...report, formatVersion: 'report_v9' })).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent(Object.create(report))).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent({ ...report, findings: [{ ...finding, validationStatus: 'needs_more_evidence' }] })).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent({ ...report, findings: Array(1001).fill(finding) })).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent({ ...report, ownerSummary: { ...report.ownerSummary, headline: 'x'.repeat(8001) } })).toThrow('unsupported');
  });

  it('keeps mutable status claims bounded and linked to known findings', () => {
    const overlay = normalizeReportLatestOverlay({ findingStatuses: [{ id: 'f1', status: 'fixed', severity: 'medium', credential: 'never-export' },
      { id: 'foreign', status: 'open', severity: 'high' }], retestStates: [], command: 'never-execute' }, ['f1']);
    expect(overlay.findingStatuses.map((item) => item.id)).toEqual(['f1']);
    expect(JSON.stringify(overlay)).not.toMatch(/never-export|never-execute/);
    expect(() => normalizeReportLatestOverlay({ findingStatuses: [{ id: 'f1', status: 'arbitrary', severity: 'high' }] }, ['f1'])).toThrow('malformed');
  });

  it('preserves historical status and rejects forged authority or cross-finding lineage', () => {
    const handoff = buildReportHandoff({}, report.findings);
    const old = normalizeReportSnapshotContent({ ...report, handoff, historicalFindings: [{ ...finding, id: 'old1', validationStatus: 'legacy_unverified' }] });
    expect(old.historicalFindings?.[0].validationStatus).toBe('legacy_unverified');
    expect(() => normalizeReportSnapshotContent({ ...report, handoff: { ...handoff, grantsAuthority: true } })).toThrow('unsupported');
    expect(() => reportSnapshotExport({ ...snapshot, content: { ...report, handoff: { ...handoff, source: { ...handoff.source, projectId: 'foreign' } } } })).toThrow('identity');
    expect(() => normalizeReportSnapshotContent({ ...report, handoff: { ...handoff, validation: [{ ...handoff.validation[0], findingId: 'foreign' }] } })).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent({ ...report, handoff: { ...handoff, validation: [{ ...handoff.validation[0], decisionEvidenceRefs: ['artifact:foreign'] }] } })).toThrow('unsupported');
    expect(() => normalizeReportSnapshotContent({ ...report, handoff: { ...handoff, evidence: [], validation: [{ ...handoff.validation[0], decisionEvidenceRefs: ['artifact:one'] }] } })).toThrow('unsupported');
  });
});
