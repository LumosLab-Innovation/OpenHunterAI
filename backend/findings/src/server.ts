import express from 'express';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { intensityToProfile, sanitizeReportContent, sanitizeText } from '@x-hunter/shared';
import { routeFor } from '@x-hunter/llm-gateway';
import { bridgeFromEnv, snapshotFromPlan, storeLlmAudits } from './snapshot-llm.js';
import { summarizeSignals } from './signal-summary.js';
import { selectPromotionCandidates, triageCandidates, type CandidateSummary, type PromotionCandidate } from './triage.js';
import { evaluateIndependentDecision } from './validation.js';
import { reasonWithCodex } from './strix-reasoning.js';

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
  res.json({ findings: await prisma.finding.findMany({ where, orderBy: { createdAt: 'desc' } }) });
}));

// S can use the locked Codex completion lane for reasoning. This health check
// never presents the third-party Strix runtime as installed or validated.
app.get('/internal/strix-reasoning/health', asyncRoute(async (_req, res) => {
  const base = process.env.OPENHUNTER_LLM_BRIDGE_URL;
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!base || !token) {
    res.status(503).json({ ok: false, reason: 'BRIDGE_UNAVAILABLE' });
    return;
  }
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/capabilities`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json() as { completion?: { codex?: { state?: string } } };
    const ok = response.ok && body.completion?.codex?.state === 'locked';
    res.status(ok ? 200 : 503).json({ ok, reason: ok ? undefined : 'CODEX_COMPLETION_UNAVAILABLE' });
  } catch {
    res.status(503).json({ ok: false, reason: 'BRIDGE_UNAVAILABLE' });
  }
}));

app.post('/internal/scans/:scanId/strix-reason', asyncRoute(async (req, res) => {
  const scanId = req.params.scanId!;
  const scan = await prisma.scanJob.findUnique({ where: { id: scanId } });
  if (!scan || scan.state !== 'running') {
    res.status(404).json({ error: { code: 'SCAN_NOT_RUNNING' } });
    return;
  }
  const scope = scan.scopeSnapshot as { targetUrl?: unknown };
  const target = scope?.targetUrl;
  if (typeof target !== 'string' || target !== req.body?.target) {
    res.status(400).json({ error: { code: 'SCOPE_MISMATCH' } });
    return;
  }
  const plan = scan.scanPlan as { enabledHunters?: unknown; budgets?: { maxLLMCalls?: number } } | null;
  const snapshot = snapshotFromPlan(plan);
  if (!snapshot) {
    res.status(503).json({ error: { code: 'LLM_ROUTE_SNAPSHOT_MISSING' } });
    return;
  }
  const used = Array.isArray((scan.budgetUsed as any)?.llmAudits) ? (scan.budgetUsed as any).llmAudits.length : 0;
  if (used + 4 > (plan?.budgets?.maxLLMCalls ?? 0)) {
    res.status(503).json({ error: { code: 'LLM_BUDGET_EXCEEDED' } });
    return;
  }
  const hunterIds = Array.isArray(plan?.enabledHunters) ? plan.enabledHunters.filter((id): id is string => typeof id === 'string') : [];
  const result = await reasonWithCodex({
    snapshot,
    bridge: bridgeFromEnv(),
    target,
    targetType: scan.targetType,
    profile: intensityToProfile(scan.testIntensityMode),
    authScope: scan.authScope,
    hunterIds,
  });
  await storeLlmAudits(prisma, scanId, result.audits, result.gaps.filter((gap) => gap.startsWith('llm:')));
  if (result.signals.length === 0) {
    res.status(503).json({ error: { code: 'CODEX_REASONING_UNAVAILABLE' } });
    return;
  }
  res.json({
    signals: result.signals,
    status: 'partial',
    summary: 'Codex prioritized Strix-style review hypotheses. No Strix runtime or validation probe ran.',
    coverage: { surfacesSkipped: ['strix_runtime_validation'], gaps: result.gaps },
    limitations: ['Reasoning only: no Strix runtime, sandbox, or active validation was executed.'],
    runtimeProvenance: {
      upstreamId: 'openhunter_core',
      upstreamRef: 'codex-guided-reasoning-v1',
      adapterVersion: 'openhunter-strix-adapter/v1',
      playbookRevisions: ['strix-methodology-v1.6.2'],
    },
  });
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

  const snapshot = snapshotFromPlan(scan.scanPlan);
  const bridge = bridgeFromEnv();
  const recommendation = await triageCandidates({
    snapshot,
    bridge,
    projectId: scan.projectId,
    scanId,
    profile: intensityToProfile(scan.testIntensityMode),
    candidates,
  });
  const gaps = recommendation.coverageGap ? [recommendation.coverageGap] : [];
  await storeLlmAudits(prisma, scanId, recommendation.audits, gaps);
  res.json({ recommendation, llmAudits: recommendation.audits, coverageGaps: gaps });
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
  const configured = (provider: string) => Boolean(process.env[`${provider.toUpperCase()}_API_KEY`]);
  const ready = (route: ReturnType<typeof routeFor>) => configured(route.primary.provider) || Boolean(route.fallback && configured(route.fallback.provider));
  return {
    ok: ready(low) && ready(high),
    service: 'findings',
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

async function promoteScanCandidates(scanId: string) {
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    include: { project: true, findings: true, steps: true },
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
  const decisions = new Map<string, any>();
  for (const row of rows) {
    const existing = await (prisma as any).triageDecision.findUnique({ where: { candidateId: row.id } });
    if (existing?.state === 'validated' && existing.validator === 'independent_policy_v1') {
      decisions.set(row.id, existing);
      continue;
    }
    const decision = evaluateIndependentDecision({ severity: row.severity, evidence: row.evidence });
    const saved = await (prisma as any).triageDecision.upsert({
      where: { candidateId: row.id },
      create: {
        candidateId: row.id,
        state: decision.state,
        rationale: sanitizeText(decision.rationale),
        counterevidence: decision.counterevidence ? sanitizeText(decision.counterevidence) : null,
        validator: decision.validator,
        evidenceRefs: decision.evidenceRefs,
      },
      update: {
        state: decision.state,
        rationale: sanitizeText(decision.rationale),
        counterevidence: decision.counterevidence ? sanitizeText(decision.counterevidence) : null,
        validator: decision.validator,
        evidenceRefs: decision.evidenceRefs,
      },
    });
    decisions.set(row.id, saved);
  }
  const candidates: PromotionCandidate[] = rows.map((c: any) => ({
    id: c.id,
    title: c.title,
    severity: c.severity,
    confidence: c.confidence,
    category: c.category,
    affectedAsset: c.affectedAsset,
    evidence: c.evidence,
    decision: decisions.get(c.id),
  }));

  const snapshot = snapshotFromPlan(scan.scanPlan);
  const bridge = bridgeFromEnv();
  const summary = await summarizeSignals({ snapshot, bridge, scan, candidateCount: rows.length });
  const recommendation = await triageCandidates({
    snapshot,
    bridge,
    projectId: scan.projectId,
    scanId,
    profile: intensityToProfile(scan.testIntensityMode),
    candidates,
  });
  const gaps = [summary.coverageGap, recommendation.coverageGap].filter((gap): gap is string => Boolean(gap));
  await storeLlmAudits(prisma, scanId, [...summary.audits, ...recommendation.audits], gaps);
  const selected = selectPromotionCandidates(candidates, recommendation);

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
        typeof (evidence as any)?.demonstratedImpact === 'string'
          ? sanitizeText((evidence as any).demonstratedImpact)
          : typeof (evidence as any)?.description === 'string'
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

  return { recommendation, promoted, signalSummary: summary.text, llmAudits: [...summary.audits, ...recommendation.audits], coverageGaps: gaps };
}
