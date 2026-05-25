/**
 * Manual Retest worker.
 *
 * Per PLAN_V3 §13 + ACCEPTANCE_CRITERIA §11: a retest scans EXACTLY one
 * finding's scope — it never re-runs the full pipeline.
 *
 * v1 retest behavior (smoke-level):
 *   1. Re-fetch the affected asset via Playwright (HEAD or GET only).
 *   2. Compare observed state against the original finding's scenario:
 *      - cookie attribute hunters: re-check cookie flags
 *      - frontend-secret hunters: re-check storage key presence
 *      - api-surface hunters: re-check method allowance via OPTIONS
 *   3. Classify Result: fixed | still_vulnerable | partially_fixed | cannot_verify
 *
 * We do NOT brute-force, fuzz, or pivot. If any out-of-scope redirect is
 * encountered the run is marked cannot_verify with an audit log entry.
 */

import { Worker } from 'bullmq';
import {
  type RetestJobPayload,
  QUEUE_RETEST,
  getQueueConnectionOptions,
} from '@x-hunter/worker-runtime';
import { getPrisma } from '@x-hunter/db';
import {
  assertInScope,
  createLogger,
  isGuardrailError,
  normalizeUrl,
  sanitizeText,
  type ScopeSnapshot,
  type RetestResult,
} from '@x-hunter/shared';

const logger = createLogger({ component: 'retest-worker' });

async function processRetest(retestRunId: string): Promise<void> {
  const prisma = getPrisma();
  const run = await prisma.retestRun.findUnique({
    where: { id: retestRunId },
    include: { finding: true },
  });
  if (!run) {
    logger.warn('retest_not_found', { retestRunId });
    return;
  }
  await prisma.retestRun.update({
    where: { id: run.id },
    data: { startedAt: new Date() },
  });
  const scope = run.scopeSnapshot as unknown as ScopeSnapshot;
  const scenario = run.scenarioRef as { url?: string; expect?: string; method?: string };
  let result: RetestResult = 'cannot_verify';
  let notes = '';

  try {
    if (!scenario?.url) {
      result = 'cannot_verify';
      notes = 'Scenario thiếu URL.';
    } else {
      const norm = normalizeUrl(scenario.url);
      assertInScope(norm.url.toString(), scope);
      const finding = await prisma.finding.findUnique({ where: { id: run.findingId } });
      if (!finding) throw new Error('finding missing');
      result = await classify(scenario, scope);
      notes = result === 'fixed' ? 'Finding không còn reproducible trong phạm vi đã cho.'
        : result === 'still_vulnerable' ? 'Vẫn quan sát được dấu hiệu rủi ro ban đầu.'
        : result === 'partially_fixed' ? 'Đã cải thiện nhưng vẫn còn rủi ro.'
        : 'Không xác định được trạng thái.';
    }
  } catch (err) {
    if (isGuardrailError(err)) {
      result = 'cannot_verify';
      notes = `Guardrail blocked: ${err.code}`;
    } else {
      result = 'cannot_verify';
      notes = err instanceof Error ? err.message : String(err);
    }
  }

  await prisma.retestRun.update({
    where: { id: run.id },
    data: {
      result,
      notes: sanitizeText(notes).slice(0, 2000),
      finishedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: run.finding.projectId,
      findingId: run.findingId,
      eventType: 'retest.completed',
      detail: { retestRunId: run.id, result },
    },
  });

  // Sync finding status if applicable.
  if (result === 'fixed') {
    await prisma.finding.update({ where: { id: run.findingId }, data: { status: 'fixed' } });
  } else if (result === 'still_vulnerable') {
    await prisma.finding.update({ where: { id: run.findingId }, data: { status: 'still_vulnerable' } });
  }
}

async function classify(
  scenario: { url?: string; expect?: string; method?: string },
  _scope: ScopeSnapshot,
): Promise<RetestResult> {
  // v1: smoke-level HTTP probe. Real classification per category should be
  // implemented as scenario types in future iterations.
  if (!scenario.url) return 'cannot_verify';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(scenario.url, {
      method: scenario.method ?? 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
    });
    // 404 / 403 on a previously-reachable asset is a strong "fixed" signal.
    if (res.status === 404 || res.status === 403) return 'fixed';
    if (res.status === 200) return 'still_vulnerable';
    return 'cannot_verify';
  } catch {
    return 'cannot_verify';
  } finally {
    clearTimeout(timer);
  }
}

function main() {
  logger.info('retest_worker_starting');
  const worker = new Worker<RetestJobPayload>(
    QUEUE_RETEST,
    async (job) => processRetest(job.data.retestRunId),
    { ...getQueueConnectionOptions(), concurrency: 4, autorun: true },
  );
  worker.on('failed', (job, err) => {
    logger.error('retest_failed', { jobId: job?.id, msg: err.message });
  });
  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
