import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SURFACE_FLAGS, type ReportContentV1 } from '@x-hunter/shared';
import { reportCsv, reportDocx } from './report-downloads.js';
import { ReportsService } from './reports.service.js';

const report: ReportContentV1 = {
  formatVersion: 'report_v1', reportType: 'finding_report', packageTier: 'free_hunter', scanMode: 'free_hunter',
  targetType: 'interactive_web_app', authScope: 'none', testIntensityMode: 'safe_discovery', surfaceFlags: DEFAULT_SURFACE_FLAGS,
  ownerSummary: { headline: 'Test report', riskLevel: 'high', whatWasTested: 'Verified public scope',
    topRiskOrOutcome: 'Validated issue', businessImpact: 'Test impact', recommendedNextAction: 'Review fix' },
  findings: [{ id: 'f1', rank: 1, title: ' =HYPERLINK("https://example.com")', severity: 'high', confidence: 'high',
    affectedAsset: 'https://example.com', category: 'access_control', attackerPath: 'Controlled test',
    sanitizedProof: { description: 'Bearer secret-test-value', evidenceRefs: ['e1'], sanitized: true },
    impact: 'Test impact', fixSummary: 'Fix ownership checks' }],
  developerFixPack: [{ findingId: 'f1', rootCauseHypothesis: 'Ownership check missing', concreteFixPrompt: 'Check owner',
    validationSteps: ['Verify rejection'], regressionTestIdeas: ['Different owner'], acceptanceCriteria: 'Returns 403' }],
  coverage: { targetType: 'interactive_web_app', workersRun: ['Browser', 'R', 'Z'], huntersRun: [],
    skippedHunters: [{ hunter: 'S', reason: 'Disabled by user' }], coverageGaps: ['Authentication not tested'],
    limitations: ['Limited to authorized scope', 'Vietnamese: Tiếng Việt'] },
  hardeningRecommendations: ['Check headers'],
  retestAndMonitor: { eligibleFindings: ['f1'], remainingRetestQuota: 1, cooldownDays: 7, manualRetestActions: ['Manual retest f1'] },
  generatedAt: '2026-09-07T00:00:00.000Z',
};

describe('report downloads', () => {
  it('quotes CSV fields, neutralizes formulas, and keeps hardening separate from validated findings', () => {
    const csv = reportCsv(report);
    expect(csv).toContain('"\' =HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"validated_finding","f1"');
    expect(csv).toContain('"hardening"');
    expect(csv).toContain('"coverage_gap"');
    expect(csv).toContain('"skipped"');
    expect(csv).not.toContain('secret-test-value');
    expect(report.findings[0].sanitizedProof.description).toContain('secret-test-value');
  });

  it('creates a real DOCX with all report sections, Unicode and no raw token', async () => {
    // Read the archive with the same ZIP library already used by docx.
    const require = createRequire(import.meta.url);
    const JSZip = createRequire(require.resolve('docx'))('jszip');
    const archive = await JSZip.loadAsync(await reportDocx(report));
    const xml = await archive.file('word/document.xml').async('string');
    for (const text of ['Developer fix pack', 'Ownership check missing', 'Returns 403', 'Manual retest f1', 'Tiếng Việt', 'Limitations']) {
      expect(xml).toContain(text);
    }
    expect(xml).not.toContain('secret-test-value');
    expect(xml).toContain('[REDACTED_TOKEN]');
    expect(archive.file('[Content_Types].xml')).not.toBeNull();
  });

  it('exports empty findings as coverage without inventing a vulnerability', () => {
    const csv = reportCsv({ ...report, reportType: 'coverage_only', findings: [] });
    expect(csv).not.toContain('validated_finding');
    expect(csv).toContain('Limited to authorized scope');
  });

  it('uses the org-scoped report lookup and exports immutable JSON snapshot separately from latest state', async () => {
    const service = new ReportsService();
    const get = vi.spyOn(service, 'get').mockResolvedValue({
      snapshot: { id: 'r1', state: 'final', content: report, generatedAt: new Date(report.generatedAt) },
      latestOverlay: { findingStatuses: [] },
    } as any);
    const result = await service.export('r1', 'org1', 'json', 'snapshot');
    expect(get).toHaveBeenCalledWith('r1', 'org1');
    const parsed = JSON.parse(result!.body.toString());
    expect(parsed.snapshot.content.formatVersion).toBe('report_v1');
    expect(parsed.snapshot.generatedAt).toBe(report.generatedAt);
    expect(result!.body.toString()).not.toContain('secret-test-value');
    expect(parsed.latestOverlay).toBeUndefined();
    const latest = await service.export('r1', 'org1', 'json', 'latest');
    expect(JSON.parse(latest!.body.toString()).latestOverlay).toEqual({ findingStatuses: [] });
    get.mockResolvedValue(null);
    expect(await service.export('r1', 'other-org', 'docx', 'snapshot')).toBeNull();
    get.mockResolvedValue({ snapshot: { state: 'draft' } } as any);
    await expect(service.export('r1', 'org1', 'json', 'snapshot')).rejects.toThrow('still being prepared');
  });
});
