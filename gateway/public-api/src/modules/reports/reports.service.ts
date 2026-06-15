import { getPrisma } from '@x-hunter/db';
import {
  REPORT_FORMAT_VERSION,
  renderReportHtml,
  renderReportMarkdown,
  sanitizeReportContent,
  sanitizeText,
  type ReportContentV1,
} from '@x-hunter/shared';

export class ReportsService {
  private readonly prisma = getPrisma();

  list(orgId: string) {
    return this.prisma.report.findMany({
      where: { state: 'final', project: { organizationId: orgId } },
      select: {
        id: true,
        projectId: true,
        scanJobId: true,
        version: true,
        state: true,
        kind: true,
        content: true,
        generatedAt: true,
        finalizedAt: true,
      },
      orderBy: { generatedAt: 'desc' },
    }).then((reports: any[]) =>
      reports.map((report) => ({
        ...report,
        headline: sanitizeText(report.content?.ownerSummary?.headline ?? 'OpenHunterAI report'),
      })),
    );
  }

  async get(id: string, orgId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, project: { organizationId: orgId } },
      include: {
        scanJob: {
          include: {
            findings: { include: { retestRuns: { orderBy: { createdAt: 'desc' } } } },
            reportDraftSections: { orderBy: { sectionKey: 'asc' } },
          },
        },
      },
    });
    if (!report) return null;
    return this.toEnvelope(report);
  }

  async export(id: string, orgId: string, format: 'html' | 'pdf', view: 'snapshot' | 'latest') {
    const envelope = await this.get(id, orgId);
    if (!envelope) return null;
    const content = sanitizeReportContent(envelope.snapshot.content as ReportContentV1);
    const html = renderReportHtml(content, view === 'latest' ? envelope.latestOverlay : undefined);
    if (format === 'html') {
      return {
        contentType: 'text/html; charset=utf-8',
        filename: `openhunter-report-${id}.html`,
        body: Buffer.from(html, 'utf8'),
      };
    }
    const markdown =
      view === 'latest'
        ? `${renderReportMarkdown(content)}

## Latest Status

${renderOverlayMarkdown(envelope.latestOverlay)}`
        : renderReportMarkdown(content);
    return {
      contentType: 'application/pdf',
      filename: `openhunter-report-${id}.pdf`,
      body: renderSimplePdf(markdown),
    };
  }

  async getDraft(scanId: string, orgId: string) {
    const scan = await this.prisma.scanJob.findFirst({
      where: { id: scanId, project: { organizationId: orgId } },
      include: { reportDraftSections: { orderBy: { sectionKey: 'asc' } }, reports: { orderBy: { version: 'desc' } } },
    });
    if (!scan) return null;
    return {
      scanId,
      sections: scan.reportDraftSections,
      latestReportId: scan.reports[0]?.id ?? null,
      latestReportState: scan.reports[0]?.state ?? null,
      updatedAt: scan.reportDraftSections.reduce(
        (latest: string | null, section: { updatedAt: Date }) =>
          !latest || section.updatedAt.toISOString() > latest ? section.updatedAt.toISOString() : latest,
        null,
      ),
    };
  }

  private toEnvelope(report: any) {
    const snapshotFindingIds = new Set(
      ((report.content as ReportContentV1)?.findings ?? []).map((finding: { id: string }) => finding.id),
    );
    const findings =
      report.scanJob.mode === 'free_hunter'
        ? (report.scanJob.findings ?? []).filter((finding: any) => snapshotFindingIds.has(finding.id)).slice(0, 1)
        : (report.scanJob.findings ?? []);
    const latestOverlay = {
      findingStatuses: findings.map((finding: any) => ({
        id: finding.id,
        status: finding.status,
        severity: finding.severity,
        updatedAt: finding.updatedAt,
      })),
      retestStates: findings.flatMap((finding: any) =>
        (finding.retestRuns ?? []).map((run: any) => ({
          findingId: finding.id,
          retestRunId: run.id,
          result: run.result,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        })),
      ),
      monitor: {
        maxMonitoredFindings: report.scanJob.mode === 'free_hunter' ? 1 : 50,
        maxRetests: report.scanJob.mode === 'free_hunter' ? 1 : 10,
        cooldownDays: report.scanJob.mode === 'free_hunter' ? 7 : 0,
      },
    };

    return {
      snapshot: {
        id: report.id,
        projectId: report.projectId,
        scanJobId: report.scanJobId,
        version: report.version,
        state: report.state,
        kind: report.kind,
        formatVersion: report.formatVersion,
        content: report.content,
        markdown: report.markdown,
        generatedAt: report.generatedAt,
        finalizedAt: report.finalizedAt,
      },
      latestOverlay,
      exports: {
        formats: ['html', 'pdf'],
        generatedOnDemand: true,
      },
    };
  }
}

function renderOverlayMarkdown(overlay: {
  findingStatuses: Array<{ id: string; status: string; severity: string }>;
  retestStates: Array<{ findingId: string; result: string | null }>;
  monitor: { maxMonitoredFindings: number; maxRetests: number; cooldownDays: number };
}) {
  const statuses =
    overlay.findingStatuses.length > 0
      ? overlay.findingStatuses.map((finding) => `- ${finding.id}: ${finding.status} (${finding.severity})`).join('\n')
      : '- No current finding status.';
  const retests =
    overlay.retestStates.length > 0
      ? overlay.retestStates.map((run) => `- ${run.findingId}: ${run.result ?? 'pending'}`).join('\n')
      : '- No retest runs.';
  return sanitizeText(`${statuses}

Retests:
${retests}

Monitor quota: ${overlay.monitor.maxMonitoredFindings} findings, ${overlay.monitor.maxRetests} retests, ${overlay.monitor.cooldownDays} cooldown days.`);
}

export async function createInitialReportDraft(prisma: ReturnType<typeof getPrisma>, scanId: string) {
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    include: { project: true, authorization: true, findings: true, reportDraftSections: true },
  });
  if (!scan) return null;
  const content = buildReportContent(scan);
  const markdown = renderReportMarkdown(content);

  await prisma.reportDraftSection.upsert({
    where: { scanJobId_sectionKey: { scanJobId: scan.id, sectionKey: 'scope' } },
    create: {
      scanJobId: scan.id,
      sectionKey: 'scope',
      state: 'ready',
      content: sanitizeReportContent({
        packageTier: scan.project.packageTier,
        scanMode: scan.mode,
        targetType: scan.targetType,
        authScope: scan.authScope,
        testIntensityMode: scan.testIntensityMode,
        surfaceFlags: scan.surfaceFlags,
        scanPlan: scan.scanPlan,
      }),
    },
    update: {
      state: 'ready',
      content: sanitizeReportContent({
        packageTier: scan.project.packageTier,
        scanMode: scan.mode,
        targetType: scan.targetType,
        authScope: scan.authScope,
        testIntensityMode: scan.testIntensityMode,
        surfaceFlags: scan.surfaceFlags,
        scanPlan: scan.scanPlan,
      }),
    },
  });

  return prisma.report.upsert({
    where: { scanJobId_version: { scanJobId: scan.id, version: 1 } },
    create: {
      projectId: scan.projectId,
      scanJobId: scan.id,
      kind: scan.mode === 'free_hunter' ? 'free_hunter' : 'human',
      version: 1,
      state: 'draft',
      formatVersion: REPORT_FORMAT_VERSION,
      content: content as object,
      markdown,
    },
    update: {
      content: content as object,
      markdown,
    },
  });
}

function buildReportContent(scan: any): ReportContentV1 {
  const scanPlan = (scan.scanPlan ?? {}) as {
    enabledWorkers?: Record<string, string>;
    enabledHunters?: string[];
    skippedHunters?: Array<{ hunter: string; reason: string }>;
    budgets?: { maxRetests?: number; cooldownDays?: number };
  };
  const findings = ((scan.findings ?? []) as any[]).slice(0, scan.mode === 'free_hunter' ? 1 : 50);
  const reportFindings = findings.map((finding, index) => {
    const evidence = (finding.evidence ?? {}) as { description?: string; evidenceRefs?: string[] };
    return {
      id: finding.id,
      rank: index + 1,
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      affectedAsset: finding.affectedAsset,
      category: finding.category,
      attackerPath: sanitizeText(finding.description ?? 'Attacker path is based on sanitized finding context.'),
      sanitizedProof: {
        description: sanitizeText(evidence.description ?? 'Sanitized evidence is not available yet.'),
        evidenceRefs: Array.isArray(evidence.evidenceRefs) ? evidence.evidenceRefs.map(String) : [],
        sanitized: true as const,
      },
      impact: sanitizeText(finding.description ?? 'Potential security impact requires review.'),
      fixSummary: sanitizeText(finding.fixPrompt ?? 'Review the affected asset and apply the recommended fix.'),
      retestScenario: sanitizeReportContent(finding.retestScenario ?? null),
    };
  });
  const coverageOnly = reportFindings.length === 0;

  return sanitizeReportContent({
    formatVersion: REPORT_FORMAT_VERSION,
    reportType: coverageOnly ? 'coverage_only' : 'finding_report',
    packageTier: scan.project.packageTier,
    scanMode: scan.mode,
    targetType: scan.targetType,
    authScope: scan.authScope,
    testIntensityMode: scan.testIntensityMode,
    surfaceFlags: scan.surfaceFlags,
    ownerSummary: {
      headline: coverageOnly ? 'Coverage report is being prepared' : `${reportFindings.length} finding(s) ready for review`,
      riskLevel: coverageOnly ? 'none' : reportFindings[0].severity,
      whatWasTested: `${scan.targetType} under ${scan.testIntensityMode}`,
      topRiskOrOutcome: coverageOnly
        ? 'No valuable finding has been confirmed within the current budget yet.'
        : reportFindings[0].title,
      businessImpact: coverageOnly
        ? 'The scan still provides coverage, hardening, and limitation context.'
        : reportFindings[0].impact,
      recommendedNextAction: coverageOnly ? 'Review coverage gaps and hardening recommendations.' : 'Fix the top finding and run retest.',
    },
    findings: reportFindings,
    developerFixPack: reportFindings.map((finding) => ({
      findingId: finding.id,
      rootCauseHypothesis: finding.attackerPath,
      concreteFixPrompt: finding.fixSummary,
      validationSteps: ['Apply fix in a controlled environment.', 'Run the finding retest scenario.', 'Confirm no regression.'],
      regressionTestIdeas: ['Add a targeted regression test for the affected asset.'],
      acceptanceCriteria: 'The retest scenario no longer reproduces the issue and no raw secrets are exposed.',
    })),
    coverage: {
      targetType: scan.targetType,
      workersRun: Object.keys(scanPlan.enabledWorkers ?? {}).map(displayUnitCode),
      huntersRun: scanPlan.enabledHunters ?? [],
      skippedHunters: scanPlan.skippedHunters ?? [],
      coverageGaps: coverageOnly ? ['No valuable finding was confirmed within this scan budget.'] : [],
      limitations: coverageOnly
        ? ['Free Hunter may stop early based on budget and first valuable finding policy.']
        : ['Report uses sanitized evidence only.'],
    },
    hardeningRecommendations: coverageOnly
      ? ['Review security headers, authentication boundaries, sensitive data exposure, and dependency hygiene.']
      : ['Prioritize the ranked findings before broad hardening work.'],
    retestAndMonitor: {
      eligibleFindings: reportFindings.map((finding) => finding.id),
      remainingRetestQuota: scan.mode === 'free_hunter' ? 1 : (scanPlan.budgets?.maxRetests ?? 10),
      cooldownDays: scan.mode === 'free_hunter' ? 7 : (scanPlan.budgets?.cooldownDays ?? 0),
      manualRetestActions: reportFindings.map((finding) => `Retest ${finding.title}`),
    },
    generatedAt: new Date().toISOString(),
  });
}

function displayUnitCode(key: string): string {
  switch (key) {
    case 'browser':
    case 'browser-inspector':
      return 'browser_inspector';
    case 'zap':
    case 'Z':
      return 'Z_signal';
    case 'nuclei':
    case 'N':
      return 'N_signal';
    case 'openhack':
    case 'O':
      return 'O_hunter';
    case 'strix':
    case 'S':
      return 'S_core';
    default:
      return key;
  }
}

function renderSimplePdf(markdown: string): Buffer {
  const lines = sanitizeText(markdown).split(/\r?\n/).slice(0, 45);
  const text = lines.map((line, index) => `BT /F1 10 Tf 50 ${760 - index * 14} Td (${escapePdf(line.slice(0, 100))}) Tj ET`).join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`,
  ];
  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f '];
  const body = objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
      offset += object.length + 1;
      return object;
    })
    .join('\n');
  const startxref = offset;
  return Buffer.from(
    `%PDF-1.4\n${body}\nxref\n0 ${xref.length}\n${xref.join('\n')}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`,
    'utf8',
  );
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
