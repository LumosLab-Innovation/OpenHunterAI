import express from 'express';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { intensityToProfile, isIndependentlyValidatedFinding, REPORT_FORMAT_VERSION, renderReportMarkdown, sanitizeReportContent, sanitizeText } from '@x-hunter/shared';
import { routeFor } from '@x-hunter/llm-gateway';
import { bridgeFromEnv, generateFixPrompt, snapshotFromPlan } from './llm.js';
import { publishEvent } from '@openhunter/event-core';
import { buildFinalContent } from './content.js';

const app = express();
const port = Number(process.env.REPORTING_PORT || 4400);
const require = createRequire(import.meta.url);
const { getPrisma } = require('@x-hunter/db') as { getPrisma: () => any };
const prisma = getPrisma();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'reporting' }));
app.get('/health/llm', (_req, res) => res.json(llmHealth()));

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
  await recordActivity(scan.id, {
    eventType: section.state === 'failed' ? 'report_section_failed' : 'report_section_ready',
    actor: 'report',
    titleKey: section.state === 'failed' ? 'activity.report_section_failed.title' : 'activity.report_section_ready.title',
    bodyKey: section.state === 'failed' ? 'activity.report_section_failed.body' : 'activity.report_section_ready.body',
    bodyParams: {
      sectionKey: req.params.sectionKey,
      summary: req.body.errorMsg ?? `${req.params.sectionKey} section is ${section.state}`,
    },
    status: section.state,
    severity: section.state === 'failed' ? 'medium' : null,
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
      authorization: true,
      findings: { include: { retestRuns: true, candidates: { include: { triageDecision: true } } } },
      reportDraftSections: true,
      reports: { orderBy: { version: 'desc' } },
      steps: true,
    },
  });
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  if (scan.state === 'cancelled') {
    res.json({ skipped: true, reason: 'SCAN_CANCELLED' });
    return;
  }
  const existingFinal = (scan.reports ?? []).find((report: any) => report.state === 'final');
  if (existingFinal) {
    res.json({ report: existingFinal, idempotent: true });
    return;
  }
  if ((scan.steps ?? []).some((step: any) => step.state === 'pending' || step.state === 'running')) {
    res.status(409).json({ error: { code: 'WORKERS_NOT_TERMINAL' } });
    return;
  }
  const candidateRows = await prisma.findingCandidate.findMany({
    where: { scanJobId: scan.id }, include: { triageDecision: true },
  });
  if (candidateRows.some((candidate: any) => !candidate.triageDecision || candidate.triageDecision.state === 'candidate')) {
    res.status(409).json({ error: { code: 'TRIAGE_NOT_TERMINAL' } });
    return;
  }
  (scan as any).unvalidatedCandidates = candidateRows.filter((candidate: any) => candidate.triageDecision?.state !== 'validated').length;

  // Enrich findings that lack a developer fix prompt via the LLM Gateway
  // (recommendation-only; falls back deterministically and never blocks).
  const fixResults = await Promise.all(
    (scan.findings ?? []).filter(isIndependentlyValidatedFinding)
      .filter((f: any) => !f.fixPrompt)
      .map(async (f: any) => {
        const result = await generateFixPrompt({
          snapshot: snapshotFromPlan(scan.scanPlan),
          bridge: bridgeFromEnv(),
          projectId: scan.projectId,
          scanId: scan.id,
          findingId: f.id,
          profile: intensityToProfile(scan.testIntensityMode),
          title: f.title,
          category: f.category,
          affectedAsset: f.affectedAsset,
          description: f.description ?? '',
        });
        f.fixPrompt = result.text;
        await prisma.finding.update({ where: { id: f.id }, data: { fixPrompt: result.text } });
        return result;
      }),
  );
  if (fixResults.length > 0) {
    const currentBudget = scan.budgetUsed && typeof scan.budgetUsed === 'object' && !Array.isArray(scan.budgetUsed) ? scan.budgetUsed : {};
    const nextBudget = {
      ...currentBudget,
      llmAudits: [
        ...(Array.isArray((currentBudget as any).llmAudits) ? (currentBudget as any).llmAudits : []),
        ...fixResults.flatMap((result) => result.audits),
      ],
      llmCoverageGaps: [
        ...(Array.isArray((currentBudget as any).llmCoverageGaps) ? (currentBudget as any).llmCoverageGaps : []),
        ...fixResults.flatMap((result) => result.coverageGap ? [result.coverageGap] : []),
      ],
    };
    await prisma.scanJob.update({ where: { id: scan.id }, data: { budgetUsed: nextBudget } });
    (scan as any).budgetUsed = nextBudget;
  }
  const guard = await prisma.scanJob.updateMany({
    where: { id: scan.id, state: { notIn: ['cancelled', 'failed', 'timeout'] } },
    data: { updatedAt: new Date() },
  });
  if (guard.count !== 1) {
    res.json({ skipped: true, reason: 'SCAN_TERMINAL' });
    return;
  }

  const content = buildFinalContent(scan as any);
  const report = await prisma.$transaction(async (tx: any) => {
    const locked = await tx.scanJob.findFirst({
      where: { id: scan.id, state: { notIn: ['cancelled', 'failed', 'timeout'] } },
      select: { id: true },
    });
    if (!locked) return null;
    const current = await tx.report.findFirst({
      where: { scanJobId: scan.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (current?.version ?? 0) + 1;
    return tx.report.upsert({
      where: { scanJobId_finalizationKey: { scanJobId: scan.id, finalizationKey: 'scan-final' } },
      create: {
        projectId: scan.projectId,
        scanJobId: scan.id,
        finalizationKey: 'scan-final',
        kind: 'human',
        version,
        state: 'final',
        formatVersion: REPORT_FORMAT_VERSION,
        content,
        markdown: renderReportMarkdown(content),
        finalizedAt: new Date(),
      },
      update: {},
    });
  });
  if (!report) {
    res.json({ skipped: true, reason: 'SCAN_TERMINAL' });
    return;
  }
  await recordActivity(scan.id, {
    eventType: 'report_finalized',
    actor: 'report',
    titleKey: 'activity.report_finalized.title',
    bodyKey: 'activity.report_finalized.body',
    bodyParams: { reportId: report.id, version: report.version },
    status: 'final',
    dedupeKey: 'report-finalized',
  });
  // Notify SSE subscribers that the report is finalized so they close cleanly.
  await publishEvent(`report.${scan.id}.finalized`, { reportId: report.id, version: report.version });
  res.json({ report });
}));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[reporting] request_failed', err instanceof Error ? err.message : err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
});

app.listen(port, '0.0.0.0', () => console.log(`reporting listening on ${port}`));

function llmHealth() {
  const low = routeFor('low_reasoning_model');
  const high = routeFor('high_reasoning_model');
  const configured = (provider: string) => Boolean(process.env[`${provider.toUpperCase()}_API_KEY`]);
  const ready = (route: ReturnType<typeof routeFor>) => configured(route.primary.provider) || Boolean(route.fallback && configured(route.fallback.provider));
  return {
    ok: ready(low) && ready(high),
    service: 'reporting',
    aliases: {
      low_reasoning_model: low,
      high_reasoning_model: high,
    },
    providers: {
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
      deepseek: { configured: Boolean(process.env.DEEPSEEK_API_KEY) },
      claude: { configured: Boolean(process.env.CLAUDE_API_KEY) },
    },
  };
}

async function recordActivity(
  scanJobId: string,
  input: {
    eventType: string;
    actor: string;
    titleKey: string;
    bodyKey: string;
    bodyParams?: Record<string, unknown>;
    status: string;
    severity?: string | null;
    dedupeKey?: string;
  },
) {
  const data = {
        scanJobId,
        dedupeKey: input.dedupeKey ?? null,
        eventType: sanitizeText(input.eventType).slice(0, 100),
        actor: input.actor === 'report' ? 'RPT' : sanitizeText(input.actor).slice(0, 80),
        titleKey: sanitizeText(input.titleKey).slice(0, 160),
        bodyKey: sanitizeText(input.bodyKey).slice(0, 160),
        bodyParams: unwrapObject(sanitizeReportContent(input.bodyParams ?? {})),
        status: sanitizeText(input.status).slice(0, 80),
        severity: input.severity ? sanitizeText(input.severity).slice(0, 40) : null,
        sanitized: true,
      };
  const write = input.dedupeKey
    ? (prisma as any).scanActivityEvent.upsert({
        where: { scanJobId_dedupeKey: { scanJobId, dedupeKey: input.dedupeKey } },
        create: data,
        update: data,
      })
    : (prisma as any).scanActivityEvent.create({ data });
  await write.catch(() => {});
}

function unwrapObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  if ('value' in value && value.value && typeof value.value === 'object') {
    return value.value as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}
