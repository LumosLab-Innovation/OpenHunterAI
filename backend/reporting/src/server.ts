import express from 'express';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { REPORT_FORMAT_VERSION, renderReportMarkdown, sanitizeReportContent, type ReportContentV1 } from '@x-hunter/shared';
import { generateFixPrompt, getGateway } from './llm.js';
import { publishEvent } from '@openhunter/event-core';

const app = express();
const port = Number(process.env.REPORTING_PORT || 4400);
const require = createRequire(import.meta.url);
const { getPrisma } = require('@x-hunter/db') as { getPrisma: () => any };
const prisma = getPrisma();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'reporting' }));

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

// Worker/orchestrator callbacks into /internal/* require the shared worker
// token (set WORKER_TOKEN on both sides). Mirrors gateway/internal-api.
let warnedMissingToken = false;
app.use('/internal', (req, res, next) => {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) {
    if (!warnedMissingToken) {
      console.warn('[reporting] WORKER_TOKEN is unset; /internal callbacks are UNAUTHENTICATED (dev only)');
      warnedMissingToken = true;
    }
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: { code: 'WORKER_AUTH_NOT_CONFIGURED' } });
      return;
    }
    next();
    return;
  }
  if (req.header('x-worker-token') !== expected) {
    res.status(401).json({ error: { code: 'WORKER_UNAUTHORIZED' } });
    return;
  }
  next();
});

app.get('/internal/reports', asyncRoute(async (_req, res) => {
  res.json({ reports: await prisma.report.findMany({ orderBy: { generatedAt: 'desc' }, take: 50 }) });
}));

app.post('/internal/reports/:scanId/draft-sections/:sectionKey', asyncRoute(async (req, res) => {
  const scan = await prisma.scanJob.findUnique({ where: { id: req.params.scanId! } });
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  const section = await prisma.reportDraftSection.upsert({
    where: {
      scanJobId_sectionKey: {
        scanJobId: scan.id,
        sectionKey: req.params.sectionKey as any,
      },
    },
    create: {
      scanJobId: scan.id,
      sectionKey: req.params.sectionKey as any,
      state: req.body.state ?? 'ready',
      content: sanitizeReportContent(req.body.content ?? {}),
      errorCode: req.body.errorCode,
      errorMsg: req.body.errorMsg,
    },
    update: {
      state: req.body.state ?? 'ready',
      content: sanitizeReportContent(req.body.content ?? {}),
      errorCode: req.body.errorCode,
      errorMsg: req.body.errorMsg,
    },
  });
  // Push an SSE-visible event so subscribed clients refresh without polling.
  await publishEvent(`report.${scan.id}.section`, { sectionKey: req.params.sectionKey, state: section.state });
  res.json({ section });
}));

app.post('/internal/reports/:scanId/finalize', asyncRoute(async (req, res) => {
  const scan = await prisma.scanJob.findUnique({
    where: { id: req.params.scanId! },
    include: {
      project: true,
      findings: { include: { retestRuns: true } },
      reportDraftSections: true,
      reports: { orderBy: { version: 'desc' } },
    },
  });
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }

  // Enrich findings that lack a developer fix prompt via the LLM Gateway
  // (recommendation-only; falls back deterministically and never blocks).
  await Promise.all(
    (scan.findings ?? [])
      .filter((f: any) => !f.fixPrompt)
      .map(async (f: any) => {
        const { text } = await generateFixPrompt(getGateway(), {
          projectId: scan.projectId,
          scanId: scan.id,
          findingId: f.id,
          packageTier: scan.project.packageTier,
          title: f.title,
          category: f.category,
          affectedAsset: f.affectedAsset,
          description: f.description ?? '',
        });
        f.fixPrompt = text;
        await prisma.finding.update({ where: { id: f.id }, data: { fixPrompt: text } });
      }),
  );

  const content = buildFinalContent(scan as any);
  const version = (scan.reports[0]?.version ?? 0) + 1;
  await prisma.report.updateMany({
    where: { scanJobId: scan.id, state: 'final' },
    data: { state: 'superseded' },
  });
  const report = await prisma.report.create({
    data: {
      projectId: scan.projectId,
      scanJobId: scan.id,
      kind: scan.mode === 'free_hunter' ? 'free_hunter' : 'human',
      version,
      state: 'final',
      formatVersion: REPORT_FORMAT_VERSION,
      content,
      markdown: renderReportMarkdown(content),
      finalizedAt: new Date(),
    },
  });
  // Notify SSE subscribers that the report is finalized so they close cleanly.
  await publishEvent(`report.${scan.id}.finalized`, { reportId: report.id, version });
  res.json({ report });
}));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[reporting] request_failed', err instanceof Error ? err.message : err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
});

app.listen(port, '0.0.0.0', () => console.log(`reporting listening on ${port}`));

function buildFinalContent(scan: any): ReportContentV1 {
  const findings = (scan.findings ?? []).slice(0, scan.mode === 'free_hunter' ? 1 : 50);
  const reportFindings = findings.map((finding: any, index: number) => ({
    id: finding.id,
    rank: index + 1,
    title: finding.title,
    severity: finding.severity,
    confidence: finding.confidence,
    affectedAsset: finding.affectedAsset,
    category: finding.category,
    attackerPath: finding.description,
    sanitizedProof: {
      description: finding.evidence?.description ?? 'Sanitized evidence is unavailable.',
      evidenceRefs: finding.evidence?.evidenceRefs ?? [],
      sanitized: true as const,
    },
    impact: finding.description,
    fixSummary: finding.fixPrompt ?? 'Apply the recommended fix and retest.',
    retestScenario: finding.retestScenario ?? null,
  }));
  const coverageOnly = reportFindings.length === 0;
  const scanPlan = scan.scanPlan ?? {};

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
      headline: coverageOnly ? 'Coverage report' : `${reportFindings.length} finding(s) confirmed`,
      riskLevel: coverageOnly ? 'none' : reportFindings[0].severity,
      whatWasTested: `${scan.targetType} under ${scan.testIntensityMode}`,
      topRiskOrOutcome: coverageOnly ? 'No valuable finding was confirmed within budget.' : reportFindings[0].title,
      businessImpact: coverageOnly ? 'Review coverage and hardening recommendations.' : reportFindings[0].impact,
      recommendedNextAction: coverageOnly ? 'Review limitations and consider a paid deeper scan.' : 'Fix and retest the ranked findings.',
    },
    findings: reportFindings,
    developerFixPack: reportFindings.map((finding: any) => ({
      findingId: finding.id,
      rootCauseHypothesis: finding.attackerPath,
      concreteFixPrompt: finding.fixSummary,
      validationSteps: ['Apply fix.', 'Run manual retest.', 'Confirm no regression.'],
      regressionTestIdeas: ['Add a targeted regression test for this affected asset.'],
      acceptanceCriteria: 'Retest no longer reproduces the issue.',
    })),
    coverage: {
      targetType: scan.targetType,
      workersRun: Object.keys(scanPlan.enabledWorkers ?? {}).map(displayUnitCode),
      huntersRun: scanPlan.enabledHunters ?? [],
      skippedHunters: scanPlan.skippedHunters ?? [],
      coverageGaps: coverageOnly ? ['No valuable finding was confirmed within this scan budget.'] : [],
      limitations: coverageOnly ? ['Coverage-only report; no finding was created.'] : ['Report uses sanitized evidence only.'],
    },
    hardeningRecommendations: coverageOnly
      ? ['Review headers, auth boundaries, file upload exposure, API docs exposure, and sensitive data handling.']
      : ['Prioritize confirmed findings before broad hardening.'],
    retestAndMonitor: {
      eligibleFindings: reportFindings.map((finding: any) => finding.id),
      remainingRetestQuota: scan.mode === 'free_hunter' ? 1 : 10,
      cooldownDays: scan.mode === 'free_hunter' ? 7 : 0,
      manualRetestActions: reportFindings.map((finding: any) => `Retest ${finding.title}`),
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
