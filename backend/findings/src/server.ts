import express from 'express';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { sanitizeReportContent, sanitizeText } from '@x-hunter/shared';
import { getGateway } from './llm.js';
import { routeFor } from '@x-hunter/llm-gateway';
import { selectPromotionCandidates, triageCandidates, type CandidateSummary, type PromotionCandidate } from './triage.js';

const app = express();
const port = Number(process.env.FINDINGS_PORT || 4300);
const require = createRequire(import.meta.url);
const { getPrisma } = require('@x-hunter/db') as { getPrisma: () => any };
const prisma = getPrisma();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'findings' }));
app.get('/health/llm', (_req, res) => res.json(llmHealth()));

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

// /internal/* requires the shared worker token (orchestrator/other services).
let warnedMissingToken = false;
app.use('/internal', (req, res, next) => {
  const expected = process.env.WORKER_TOKEN;
  if (!expected) {
    if (!warnedMissingToken) {
      console.warn('[findings] WORKER_TOKEN is unset; /internal is UNAUTHENTICATED (dev only)');
      warnedMissingToken = true;
    }
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: { code: 'WORKER_AUTH_NOT_CONFIGURED' } });
      return;
    }
    return next();
  }
  if (req.header('x-worker-token') !== expected) {
    res.status(401).json({ error: { code: 'WORKER_UNAUTHORIZED' } });
    return;
  }
  next();
});

app.get('/internal/findings', asyncRoute(async (req, res) => {
  const scanJobId = req.query.scanId as string | undefined;
  const where = scanJobId ? { scanJobId } : {};
  res.json({ findings: await prisma.finding.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }) });
}));

/**
 * LLM-assisted triage of a scan's finding candidates. The LLM is
 * recommendation-only: it returns a ranking + duplicate clusters, never creates
 * findings or changes policy (PRODUCTION_READINESS.md §5).
 */
app.post('/internal/scans/:scanId/triage', asyncRoute(async (req, res) => {
  const scanId = req.params.scanId!;
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    include: { project: true },
  });
  if (!scan) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  const rows = await prisma.findingCandidate.findMany({ where: { scanJobId: scanId } });
  const candidates: CandidateSummary[] = rows.map((c: any) => ({
    id: c.id,
    title: c.title,
    severity: c.severity,
    confidence: c.confidence,
    category: c.category,
    affectedAsset: c.affectedAsset,
  }));

  const recommendation = await triageCandidates(getGateway(), {
    projectId: scan.projectId,
    scanId,
    packageTier: scan.project.packageTier,
    candidates,
  });
  res.json({ recommendation });
}));

app.post('/internal/scans/:scanId/promote', asyncRoute(async (req, res) => {
  const scanId = req.params.scanId!;
  const result = await promoteScanCandidates(scanId);
  if (!result) {
    res.status(404).json({ error: { code: 'SCAN_NOT_FOUND' } });
    return;
  }
  res.json(result);
}));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[findings] request_failed', err instanceof Error ? err.message : err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
});

app.listen(port, '0.0.0.0', () => console.log(`findings listening on ${port}`));

function llmHealth() {
  const low = routeFor('low_reasoning_model');
  const high = routeFor('high_reasoning_model');
  return {
    ok: Boolean(process.env.OPENAI_API_KEY && process.env.DEEPSEEK_API_KEY),
    service: 'findings',
    aliases: {
      low_reasoning_model: low,
      high_reasoning_model: high,
    },
    providers: {
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
      deepseek: { configured: Boolean(process.env.DEEPSEEK_API_KEY) },
    },
  };
}

async function promoteScanCandidates(scanId: string) {
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    include: { project: true, findings: true },
  });
  if (!scan) return null;
  if (scan.state === 'cancelled') {
    return {
      recommendation: { rankedIds: [], duplicateClusters: [], fallback: true },
      promoted: [],
      skipped: true,
      reason: 'SCAN_CANCELLED',
    };
  }

  const rows = await prisma.findingCandidate.findMany({
    where: { scanJobId: scanId, promotedToId: null },
    orderBy: { createdAt: 'asc' },
  });
  const candidates: PromotionCandidate[] = rows.map((c: any) => ({
    id: c.id,
    title: c.title,
    severity: c.severity,
    confidence: c.confidence,
    category: c.category,
    affectedAsset: c.affectedAsset,
    evidence: c.evidence,
  }));

  const recommendation = await triageCandidates(getGateway(), {
    projectId: scan.projectId,
    scanId,
    packageTier: scan.project.packageTier,
    candidates,
  });
  const planBudgets = ((scan.scanPlan as any)?.budgets ?? {}) as { maxReturnedFindings?: number };
  const remainingQuota =
    scan.mode === 'free_hunter'
      ? Math.max(0, 1 - scan.findings.length)
      : Math.max(0, (planBudgets.maxReturnedFindings ?? 50) - scan.findings.length);
  const selected = selectPromotionCandidates(candidates, recommendation, {
    scanMode: scan.mode,
    maxFindings: remainingQuota,
  }).slice(0, remainingQuota);

  const promoted = await prisma.$transaction(async (tx: any) => {
    const guard = await tx.scanJob.updateMany({
      where: { id: scan.id, state: { notIn: ['cancelled', 'failed', 'timeout'] } },
      data: { updatedAt: new Date() },
    });
    if (guard.count !== 1) return [];
    const created: any[] = [];
    for (const candidate of selected) {
      const current = await tx.findingCandidate.findUnique({ where: { id: candidate.id } });
      if (!current || current.promotedToId) continue;
      const evidence = sanitizeReportContent(current.evidence ?? {});
      const evidenceDescription =
        typeof (evidence as any)?.description === 'string'
          ? sanitizeText((evidence as any).description)
          : `Sanitized evidence from ${current.source}.`;
      const finding = await tx.finding.create({
        data: {
          projectId: scan.projectId,
          scanJobId: scan.id,
          title: sanitizeText(current.title),
          description: evidenceDescription,
          severity: current.severity,
          confidence: current.confidence,
          affectedAsset: sanitizeText(current.affectedAsset),
          category: sanitizeText(current.category),
          evidence,
          retestScenario: {
            title: `Retest ${sanitizeText(current.title)}`,
            steps: ['Re-run the narrow scenario against the affected asset.', 'Confirm the sanitized proof no longer reproduces.'],
          },
          acceptanceCriteria: 'Retest no longer reproduces the issue and no raw secrets are exposed.',
        },
      });
      await tx.findingCandidate.update({ where: { id: candidate.id }, data: { promotedToId: finding.id } });
      for (const cluster of recommendation.duplicateClusters) {
        if (!cluster.includes(candidate.id)) continue;
        await tx.findingCandidate.updateMany({
          where: { id: { in: cluster.filter((id) => id !== candidate.id) }, scanJobId: scan.id, promotedToId: null },
          data: { promotedToId: finding.id },
        });
      }
      created.push(finding);
    }
    return created;
  });

  return { recommendation, promoted };
}
