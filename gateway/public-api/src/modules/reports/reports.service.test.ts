import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReportHandoff, type ReportContentV2 } from '@x-hunter/shared';
import { ReportsService } from './reports.service.js';

const prisma = vi.hoisted(() => ({
  report: { findMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock('@x-hunter/db', () => ({ getPrisma: () => prisma }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('historical report access', () => {
  it('lets the loopback-only local operator read archived reports from old organizations', async () => {
    vi.stubEnv('OPENHUNTER_LOCAL_MODE', '1');
    prisma.report.findMany.mockResolvedValue([]);
    prisma.report.findFirst.mockResolvedValue(null);
    const service = new ReportsService();

    await service.list('local_org');
    await service.get('legacy_report', 'local_org');

    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { state: 'final' } }));
    expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'legacy_report' } }));
  });

  it('keeps organization isolation outside local mode', async () => {
    vi.stubEnv('OPENHUNTER_LOCAL_MODE', '0');
    prisma.report.findMany.mockResolvedValue([]);
    prisma.report.findFirst.mockResolvedValue(null);
    const service = new ReportsService();

    await service.list('org_1');
    await service.get('report_1', 'org_1');

    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { state: 'final', project: { organizationId: 'org_1' } },
    }));
    expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report_1', project: { organizationId: 'org_1' } },
    }));
  });
});


describe('structured report identity and legacy context', () => {
  it('only publicizes worker display fields and preserves URLs, evidence identities and historical fixes through JSON export', async () => {
    vi.stubEnv('OPENHUNTER_LOCAL_MODE', '0');
    const content: ReportContentV2 = {
      formatVersion: 'report_v2', reportType: 'finding_report', profile: 'standard', targetType: 'interactive_web_app', authScope: 'none',
      testIntensityMode: 'controlled_attack_simulation', surfaceFlags: {} as ReportContentV2['surfaceFlags'],
      ownerSummary: { headline: 'nuclei observation', riskLevel: 'medium', whatWasTested: 'https://strix.example.com/app',
        topRiskOrOutcome: 'Review nuclei observation', businessImpact: 'Test impact', recommendedNextAction: 'Review strix route' },
      findings: [{ id: 'finding_nuclei_1', rank: 1, title: 'nuclei observation', severity: 'medium', confidence: 'high',
        affectedAsset: 'https://strix.example.com/app', category: 'authorization', attackerPath: 'Inspect /nuclei',
        sanitizedProof: { description: 'Synthetic strix observation', evidenceRefs: ['http_exchange:baseline:nuclei:one'], sanitized: true },
        impact: 'Test impact', fixSummary: 'Review /strix endpoint', validationStatus: 'validated' }],
      developerFixPack: [],
      coverage: { targetType: 'interactive_web_app', workersRun: ['strix_core', 'nuclei_signal'], huntersRun: [], skippedHunters: [], coverageGaps: [], limitations: [] },
      hardeningRecommendations: [], retest: { eligibleFindings: [], manualRetestActions: [] }, generatedAt: '2026-10-24T00:00:00.000Z',
    };
    content.historicalFindings = [{ ...content.findings[0]!, id: 'old1', validationStatus: 'legacy_unverified' }];
    content.historicalDeveloperFixPack = [{ findingId: 'old1', rootCauseHypothesis: 'Legacy /strix root cause', concreteFixPrompt: 'Review Bearer synthetic-secret-value',
      validationSteps: ['Inspect /nuclei'], regressionTestIdeas: ['Check old path'], acceptanceCriteria: 'Manual replay needed' }];
    content.handoff = buildReportHandoff({ projectId: 'p1', id: 's1', findings: [{ id: 'finding_nuclei_1', candidates: [{ triageDecision: {
      state: 'validated', validator: 'independent_policy_v1', evidenceRefs: ['http_exchange:baseline:nuclei:one'],
    } }] }] }, content.findings);
    prisma.report.findFirst.mockResolvedValue({ id: 'r1', projectId: 'p1', scanJobId: 's1', state: 'final', kind: 'human', formatVersion: 'report_v2',
      version: 1, generatedAt: new Date(content.generatedAt), finalizedAt: new Date(content.generatedAt), content, scanJob: { findings: [] } });
    const service = new ReportsService();
    const read = await service.get('r1', 'org1');
    expect(read!.snapshot.content.findings[0]!.affectedAsset).toBe('https://strix.example.com/app');
    expect(read!.snapshot.content.findings[0]!.sanitizedProof.evidenceRefs).toEqual(['http_exchange:baseline:nuclei:one']);
    expect(read!.snapshot.content.coverage.workersRun).toEqual(['S', 'N']);
    const exported = await service.export('r1', 'org1', 'json', 'snapshot');
    const parsed = JSON.parse(exported!.body.toString());
    expect(parsed.snapshot.content.handoff.validation[0].decisionEvidenceRefs).toEqual(['http_exchange:baseline:nuclei:one']);
    expect(parsed.snapshot.content.historicalDeveloperFixPack[0]).toMatchObject({ findingId: 'old1', rootCauseHypothesis: 'Legacy /strix root cause', acceptanceCriteria: 'Manual replay needed' });
    expect(exported!.body.toString()).not.toContain('synthetic-secret-value');
    expect(content.historicalDeveloperFixPack[0]!.concreteFixPrompt).toContain('synthetic-secret-value');
  });
});
