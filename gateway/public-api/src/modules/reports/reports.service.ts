import { getPrisma } from '@x-hunter/db';
import { isLocalMode } from '../../middlewares/auth.middleware.js';
import {
  REPORT_FORMAT_VERSION,
  GuardrailError,
  normalizeReportSnapshotContent,
  normalizeReportLatestOverlay,
  reportSnapshotExport,
  deriveWorkerCoverage,
  intensityToProfile,
  isIndependentlyValidatedFinding,
  renderReportHtml,
  renderReportMarkdown,
  sanitizeReportContent,
  sanitizeText,
  type ReportContentV2,
} from '@x-hunter/shared';
import { reportCsv, reportDocx, type ReportExportFormat } from './report-downloads.js';

export class ReportsService {
  private readonly prisma = getPrisma();

  list(orgId: string) {
    return this.prisma.report.findMany({
      where: { state: 'final', ...(isLocalMode() ? {} : { project: { organizationId: orgId } }) },
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
      reports.map((report) => {
        const content = publicReportContent(report.content);
        return {
          ...report,
          content,
          headline: sanitizeText((content as any)?.ownerSummary?.headline ?? 'OpenHunterAI report'),
        };
      }),
    );
  }

  async get(id: string, orgId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, ...(isLocalMode() ? {} : { project: { organizationId: orgId } }) },
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

  async export(id: string, orgId: string, format: ReportExportFormat, view: 'snapshot' | 'latest') {
    const envelope = await this.get(id, orgId);
    if (!envelope) return null;
    if (envelope.snapshot.state !== 'final' && envelope.snapshot.state !== 'superseded') throw new GuardrailError('INVALID_INPUT', 'Report is still being prepared');
    const content = normalizeReportSnapshotContent(envelope.snapshot.content);
    const filename = `openhunter-report-${id.replace(/[^A-Za-z0-9_.-]/g, '_')}`;
    if (format === 'json') {
      const exported = { ...reportSnapshotExport({ ...envelope.snapshot, content }),
        ...(view === 'latest' ? { latestOverlay: normalizeReportLatestOverlay(envelope.latestOverlay, content.findings.map((finding) => finding.id)) } : {}) };
      return { contentType: 'application/json; charset=utf-8', filename: `${filename}.json`,
        body: Buffer.from(JSON.stringify(exported, null, 2), 'utf8') };
    }
    const latest = view === 'latest' ? renderOverlayMarkdown(envelope.latestOverlay) : undefined;
    if (format === 'csv') return { contentType: 'text/csv; charset=utf-8', filename: `${filename}.csv`, body: Buffer.from(reportCsv(content, latest), 'utf8') };
    if (format === 'docx') return { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: `${filename}.docx`, body: await reportDocx(content, latest) };
    const html = renderReportHtml(content, view === 'latest' ? envelope.latestOverlay : undefined);
    if (format === 'html') {
      return {
        contentType: 'text/html; charset=utf-8',
        filename: `${filename}.html`,
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
      filename: `${filename}.pdf`,
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
      sections: scan.reportDraftSections.map((section: any) => ({
        id: section.id,
        sectionKey: section.sectionKey,
        state: section.state,
        content: publicReportContent(section.content),
        updatedAt: section.updatedAt,
        errorCode: section.errorCode ?? null,
        errorMsg: section.errorMsg ? sanitizeText(section.errorMsg) : null,
      })),
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
    const publicContent = publicReportContent(report.content) as ReportContentV2;
    const snapshotFindingIds = new Set(
      (publicContent.findings ?? []).map((finding: { id: string }) => finding.id),
    );
    const findings = (report.scanJob.findings ?? []).filter((finding: any) => snapshotFindingIds.has(finding.id));
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
        content: publicContent,
        markdown: renderReportMarkdown(publicContent),
        generatedAt: report.generatedAt,
        finalizedAt: report.finalizedAt,
      },
      latestOverlay,
      exports: {
        formats: ['docx', 'csv', 'json', 'html', 'pdf'],
        generatedOnDemand: true,
      },
    };
  }
}

function renderOverlayMarkdown(overlay: {
  findingStatuses: Array<{ id: string; status: string; severity: string }>;
  retestStates: Array<{ findingId: string; result: string | null }>;
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
${retests}`);
}

export async function createInitialReportDraft(prisma: ReturnType<typeof getPrisma>, scanId: string) {
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    include: { project: true, authorization: true, findings: { include: { candidates: { include: { triageDecision: true } } } }, reportDraftSections: true, steps: true },
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
        profile: intensityToProfile(scan.testIntensityMode),
        targetType: scan.targetType,
        authScope: scan.authScope,
        testIntensityMode: scan.testIntensityMode,
        surfaceFlags: scan.surfaceFlags,
        scanPlan: publicScanPlanSummary(scan.scanPlan),
      }),
    },
    update: {
      state: 'ready',
      content: sanitizeReportContent({
        profile: intensityToProfile(scan.testIntensityMode),
        targetType: scan.targetType,
        authScope: scan.authScope,
        testIntensityMode: scan.testIntensityMode,
        surfaceFlags: scan.surfaceFlags,
        scanPlan: publicScanPlanSummary(scan.scanPlan),
      }),
    },
  });

  return prisma.report.upsert({
    where: { scanJobId_version: { scanJobId: scan.id, version: 1 } },
    create: {
      projectId: scan.projectId,
      scanJobId: scan.id,
      kind: 'human',
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

function buildReportContent(scan: any): ReportContentV2 {
  const scanPlan = (scan.scanPlan ?? {}) as {
    enabledWorkers?: Record<string, string>;
    enabledHunters?: string[];
    skippedHunters?: Array<{ hunter: string; reason: string }>;
  };
  const findings = ((scan.findings ?? []) as any[]).filter(isIndependentlyValidatedFinding);
  const reportFindings = findings.map((finding, index) => {
    const evidence = (finding.evidence ?? {}) as { description?: string; evidenceRefs?: string[]; demonstratedImpact?: string };
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
      impact: sanitizeText(evidence.demonstratedImpact ?? finding.description ?? 'Potential security impact requires review.'),
      fixSummary: sanitizeText(finding.fixPrompt ?? 'Review the affected asset and apply the recommended fix.'),
      retestScenario: sanitizeReportContent(finding.retestScenario ?? null),
      validationStatus: 'validated' as const,
    };
  });
  const coverageOnly = reportFindings.length === 0;
  const workerCoverage = deriveWorkerCoverage(scan.steps ?? [], Object.keys(scanPlan.enabledWorkers ?? {}));
  const incompleteCoverage = workerCoverage.coverageGaps.length > 0;

  return sanitizeReportContent({
    formatVersion: REPORT_FORMAT_VERSION,
    reportType: coverageOnly ? 'coverage_only' : 'finding_report',
    profile: intensityToProfile(scan.testIntensityMode),
    targetType: scan.targetType,
    authScope: scan.authScope,
    testIntensityMode: scan.testIntensityMode,
    surfaceFlags: scan.surfaceFlags,
    ownerSummary: {
      headline: coverageOnly && incompleteCoverage ? 'Assessment coverage is incomplete' : coverageOnly ? 'Coverage report is being prepared' : `${reportFindings.length} finding(s) ready for review`,
      riskLevel: coverageOnly ? 'none' : reportFindings[0].severity,
      whatWasTested: `${scan.targetType} under ${scan.testIntensityMode}`,
      topRiskOrOutcome: coverageOnly
        ? incompleteCoverage ? 'Some planned checks have not completed; no-finding status is inconclusive.' : 'No finding has been independently validated in this scope yet.'
        : reportFindings[0].title,
      businessImpact: coverageOnly
        ? incompleteCoverage ? 'Missing coverage may hide issues.' : 'The scan still provides coverage, hardening, and limitation context.'
        : reportFindings[0].impact,
      recommendedNextAction: coverageOnly ? 'Review coverage gaps and rerun incomplete checks.' : 'Fix the top finding and run retest.',
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
      workersRun: workerCoverage.workersRun.map(displayUnitCode),
      huntersPlanned: (scanPlan.enabledHunters ?? []).map(displayUnitCode),
      huntersRun: [],
      skippedHunters: (scanPlan.skippedHunters ?? []).map((item) => ({
        ...item,
        hunter: displayUnitCode(item.hunter),
      })),
      coverageGaps: workerCoverage.coverageGaps,
      limitations: [
        ...workerCoverage.limitations,
        'Hunter-family execution is not measured separately; planned families do not imply tested coverage.',
        ...(coverageOnly
          ? ['Coverage-only report; no finding was created.']
          : ['Report uses sanitized evidence only.']),
      ],
    },
    hardeningRecommendations: coverageOnly
      ? ['Review security headers, authentication boundaries, sensitive data exposure, and dependency hygiene.']
      : ['Prioritize the ranked findings before broad hardening work.'],
    retest: {
      eligibleFindings: reportFindings.map((finding) => finding.id),
      manualRetestActions: reportFindings.map((finding) => `Retest ${finding.title}`),
    },
    generatedAt: new Date().toISOString(),
  });
}

function displayUnitCode(key: string): string {
  switch (key.toLowerCase().replace(/[-\s]/g, '_')) {
    case 'browser':
    case 'browser_inspector':
      return 'Browser';
    case 'zap':
    case 'zap_signal':
    case 'Z':
      return 'Z';
    case 'nuclei':
    case 'nuclei_signal':
    case 'N':
      return 'N';
    case 'openhack':
    case 'openhack_hunter':
    case 'O':
      return 'Passive surface';
    case 'strix':
    case 'strix_core':
    case 'S':
      return 'S';
    case 'report':
      return 'RPT';
    case 'retest':
      return 'RT';
    default:
      return sanitizeText(key);
  }
}

function publicScanPlanSummary(scanPlan: unknown) {
  const obj = scanPlan && typeof scanPlan === 'object' ? (scanPlan as Record<string, any>) : {};
  return {
    workersPlanned: Object.keys(obj.enabledWorkers ?? {}).map(displayUnitCode),
    huntersPlanned: Array.isArray(obj.enabledHunters) ? obj.enabledHunters.map(displayUnitCode) : [],
    skippedHunters: Array.isArray(obj.skippedHunters)
      ? obj.skippedHunters.map((item: any) => ({
          hunter: displayUnitCode(String(item?.hunter ?? '')),
          reason: sanitizeText(String(item?.reason ?? 'skipped')),
        }))
      : [],
  };
}

function publicReportContent(content: unknown): unknown {
  const rewritten = rewritePublicWorkerLabels(sanitizeReportContent(content ?? {}));
  return rewritten && typeof rewritten === 'object' && (rewritten as any).formatVersion === REPORT_FORMAT_VERSION
    ? normalizeReportSnapshotContent(rewritten) : rewritten;
}

function rewritePublicWorkerLabels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewritePublicWorkerLabels);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'handoff') {
      out[key] = child;
    } else if (key === 'scanPlan' || key === 'enabledWorkers') {
      out[key] = publicScanPlanSummary(child);
    } else if (key === 'workersRun' || key === 'huntersRun' || key === 'workersPlanned' || key === 'huntersPlanned') {
      out[key] = Array.isArray(child) ? child.map((item) => displayUnitCode(String(item))) : [];
    } else if (key === 'skippedHunters') {
      out[key] = Array.isArray(child)
        ? child.map((item: any) => ({ ...item, hunter: displayUnitCode(String(item?.hunter ?? '')) }))
        : [];
    } else {
      out[key] = rewritePublicWorkerLabels(child);
    }
  }
  return out;
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
