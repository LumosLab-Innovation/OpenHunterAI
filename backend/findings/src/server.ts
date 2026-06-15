import express from 'express';
import helmet from 'helmet';
import { createRequire } from 'node:module';
import { getGateway } from './llm.js';
import { triageCandidates, type CandidateSummary } from './triage.js';

const app = express();
const port = Number(process.env.FINDINGS_PORT || 4300);
const require = createRequire(import.meta.url);
const { getPrisma } = require('@x-hunter/db') as { getPrisma: () => any };
const prisma = getPrisma();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, service: 'findings' }));

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

app.get('/internal/findings', async (req, res) => {
  const scanJobId = req.query.scanId as string | undefined;
  const where = scanJobId ? { scanJobId } : {};
  res.json({ findings: await prisma.finding.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }) });
});

/**
 * LLM-assisted triage of a scan's finding candidates. The LLM is
 * recommendation-only: it returns a ranking + duplicate clusters, never creates
 * findings or changes policy (PRODUCTION_READINESS.md §5).
 */
app.post('/internal/scans/:scanId/triage', async (req, res) => {
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
});

app.listen(port, '0.0.0.0', () => console.log(`findings listening on ${port}`));
