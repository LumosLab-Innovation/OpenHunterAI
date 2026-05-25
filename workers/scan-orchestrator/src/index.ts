/**
 * Scan orchestrator. One BullMQ Worker reads from QUEUE_SCAN and runs the
 * full pipeline for a scan job:
 *
 *   browser-inspector → zap-signal → nuclei-signal → openhack-hunter →
 *   (strix-core for standard/auth/launch) → report
 *
 * Every step is mediated by:
 *   - the Product Policy Gate (scope, redirect, sensitive-action approvals)
 *   - the LLM Gateway (when Strix or report-writer is involved)
 *   - the evidence sanitizer (every artifact persisted)
 *
 * Failures in optional steps degrade gracefully: the scan continues with
 * a documented coverage gap, but Free reports must still say "không thấy
 * Critical/High đáng kể trong phạm vi đã quét" per ACCEPTANCE_CRITERIA §16.
 */

import { Worker } from 'bullmq';
import {
  QUEUE_SCAN,
  getQueueConnectionOptions,
  type ScanJobPayload,
  type WorkerResult,
} from '@x-hunter/worker-runtime';
import { getPrisma, Prisma } from '@x-hunter/db';
import { createLogger, sanitizeValue, type ScopeSnapshot } from '@x-hunter/shared';
import { runBrowserInspector, type BrowserObservation } from '@x-hunter/browser-inspector';
import { runZapSignal, type ZapSignalResult } from '@x-hunter/zap-signal';
import { runNucleiSignal, type NucleiSignalResult } from '@x-hunter/nuclei-signal';
import { runOpenHackHunters, type OpenHackResult } from '@x-hunter/openhack-hunter';
import { runStrixCore, type StrixResult } from '@x-hunter/strix-core';
import { generateReports } from '@x-hunter/report-worker';
import { LLMGateway } from '@x-hunter/llm-gateway';

const logger = createLogger({ component: 'scan-orchestrator' });

async function processScan(scanJobId: string): Promise<void> {
  const prisma = getPrisma();
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanJobId },
    include: { project: true, authorization: true },
  });
  if (!scan) {
    logger.warn('scan_not_found', { scanJobId });
    return;
  }

  const log = logger.child({ scan_id: scan.id, project_id: scan.projectId });

  await prisma.scanJob.update({
    where: { id: scan.id },
    data: { state: 'running', startedAt: new Date() },
  });

  const scope = scan.scopeSnapshot as unknown as ScopeSnapshot;
  const gateway = new LLMGateway();

  // ---------------------------------------------------------------------
  // 1) Browser Inspector (always; produces the security context)
  // ---------------------------------------------------------------------
  const browserStep = await prisma.scanStep.create({
    data: {
      scanJobId: scan.id,
      kind: 'browser_inspector',
      state: 'running',
      startedAt: new Date(),
    },
  });
  let browserOut: BrowserObservation | undefined;
  try {
    const result: WorkerResult<BrowserObservation> = await runBrowserInspector({
      scanId: scan.id,
      projectId: scan.projectId,
      packageTier: scope.scanPackage,
      scope,
      mode: scan.mode,
      logger: log,
    });
    if (result.ok) {
      browserOut = result.value;
      await prisma.scanStep.update({
        where: { id: browserStep.id },
        data: {
          state: 'succeeded',
          finishedAt: new Date(),
          outputRef: sanitizeValue(summary(browserOut)) as Prisma.InputJsonValue,
        },
      });
    } else {
      await prisma.scanStep.update({
        where: { id: browserStep.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorCode: result.errorCode,
          errorMsg: result.errorMessage,
        },
      });
    }
  } catch (err) {
    log.error('browser_inspector_threw', { msg: String(err) });
    await prisma.scanStep.update({
      where: { id: browserStep.id },
      data: {
        state: 'failed',
        finishedAt: new Date(),
        errorCode: 'WORKER_ERROR',
        errorMsg: String(err),
      },
    });
  }

  // ---------------------------------------------------------------------
  // 2) ZAP passive/baseline (optional; TOOL_UNAVAILABLE → graceful skip)
  // ---------------------------------------------------------------------
  let zapOut: ZapSignalResult | undefined;
  if (browserOut) {
    const zapStep = await prisma.scanStep.create({
      data: { scanJobId: scan.id, kind: 'zap_signal', state: 'running', startedAt: new Date() },
    });
    try {
      const res = await runZapSignal({
        scanId: scan.id,
        projectId: scan.projectId,
        scope,
        seedUrls: browserOut.routes.map((r) => r.url).slice(0, 25),
        logger: log,
      });
      if (res.ok) {
        zapOut = res.value;
        await prisma.scanStep.update({
          where: { id: zapStep.id },
          data: {
            state: 'succeeded',
            finishedAt: new Date(),
            outputRef: { alertCount: res.value.candidates.length },
          },
        });
      } else {
        await prisma.scanStep.update({
          where: { id: zapStep.id },
          data: {
            state: res.errorCode === 'TOOL_UNAVAILABLE' ? 'skipped' : 'failed',
            finishedAt: new Date(),
            errorCode: res.errorCode,
            errorMsg: res.errorMessage,
          },
        });
      }
    } catch (err) {
      await prisma.scanStep.update({
        where: { id: zapStep.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorCode: 'WORKER_ERROR',
          errorMsg: String(err),
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // 3) Nuclei signal (optional)
  // ---------------------------------------------------------------------
  let nucleiOut: NucleiSignalResult | undefined;
  if (browserOut) {
    const step = await prisma.scanStep.create({
      data: { scanJobId: scan.id, kind: 'nuclei_signal', state: 'running', startedAt: new Date() },
    });
    try {
      const res = await runNucleiSignal({
        scanId: scan.id,
        projectId: scan.projectId,
        scope,
        targets: Array.from(new Set(browserOut.routes.map((r) => new URL(r.url).origin))).slice(
          0,
          5,
        ),
        logger: log,
      });
      if (res.ok) {
        nucleiOut = res.value;
        await prisma.scanStep.update({
          where: { id: step.id },
          data: {
            state: 'succeeded',
            finishedAt: new Date(),
            outputRef: { findings: res.value.candidates.length },
          },
        });
      } else {
        await prisma.scanStep.update({
          where: { id: step.id },
          data: {
            state: res.errorCode === 'TOOL_UNAVAILABLE' ? 'skipped' : 'failed',
            finishedAt: new Date(),
            errorCode: res.errorCode,
            errorMsg: res.errorMessage,
          },
        });
      }
    } catch (err) {
      await prisma.scanStep.update({
        where: { id: step.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorCode: 'WORKER_ERROR',
          errorMsg: String(err),
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // 4) OpenHack mini hunters (always when we have a browser observation)
  // ---------------------------------------------------------------------
  let hunterOut: OpenHackResult | undefined;
  if (browserOut) {
    const step = await prisma.scanStep.create({
      data: {
        scanJobId: scan.id,
        kind: 'openhack_hunter',
        state: 'running',
        startedAt: new Date(),
      },
    });
    try {
      hunterOut = await runOpenHackHunters({
        scanId: scan.id,
        projectId: scan.projectId,
        scope,
        mode: scan.mode,
        browser: browserOut,
        zap: zapOut,
        nuclei: nucleiOut,
        logger: log,
      });
      await prisma.scanStep.update({
        where: { id: step.id },
        data: {
          state: 'succeeded',
          finishedAt: new Date(),
          outputRef: { findings: hunterOut.candidates.length, warnings: hunterOut.warnings.length },
        },
      });
    } catch (err) {
      await prisma.scanStep.update({
        where: { id: step.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorCode: 'WORKER_ERROR',
          errorMsg: String(err),
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // 5) Strix Core reasoning (standard/auth/launch only)
  // ---------------------------------------------------------------------
  let strixOut: StrixResult | undefined;
  const stRixEligible = scope.scanPackage !== 'free' && scope.scanPackage !== 'light';
  if (stRixEligible && hunterOut && browserOut) {
    const step = await prisma.scanStep.create({
      data: { scanJobId: scan.id, kind: 'strix_core', state: 'running', startedAt: new Date() },
    });
    try {
      strixOut = await runStrixCore({
        scanId: scan.id,
        projectId: scan.projectId,
        scope,
        mode: scan.mode,
        browser: browserOut,
        hunter: hunterOut,
        zap: zapOut,
        nuclei: nucleiOut,
        gateway,
        logger: log,
      });
      await prisma.scanStep.update({
        where: { id: step.id },
        data: {
          state: 'succeeded',
          finishedAt: new Date(),
          outputRef: {
            observations: strixOut.observations.length,
            findings: strixOut.findings.length,
          },
        },
      });
    } catch (err) {
      await prisma.scanStep.update({
        where: { id: step.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorCode: 'WORKER_ERROR',
          errorMsg: String(err),
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // 6) Persist findings (merge hunter + strix), then generate reports
  // ---------------------------------------------------------------------
  const finalCandidates = [
    ...(hunterOut?.candidates ?? []),
    ...(strixOut?.findings ?? []),
    ...(zapOut?.candidates ?? []),
    ...(nucleiOut?.candidates ?? []),
  ];

  for (const c of finalCandidates) {
    const finding = await prisma.finding.create({
      data: {
        projectId: scan.projectId,
        scanJobId: scan.id,
        title: c.title,
        description: c.evidence.description,
        severity: c.severity,
        confidence: c.confidence,
        affectedAsset: c.affectedAsset,
        category: c.category,
        evidence: sanitizeValue({
          description: c.evidence.description,
          source: c.source,
          rawSignal: c.rawSignal,
        }) as Prisma.InputJsonValue,
        fixPrompt: null,
        retestScenario:
          c.rawSignal && typeof c.rawSignal === 'object' && 'retest' in c.rawSignal
            ? ((c.rawSignal as { retest?: unknown }).retest as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
    await prisma.findingCandidate.create({
      data: {
        scanJobId: scan.id,
        source: c.source,
        title: c.title,
        severity: c.severity,
        confidence: c.confidence,
        category: c.category,
        affectedAsset: c.affectedAsset,
        evidence: sanitizeValue(c.evidence) as Prisma.InputJsonValue,
        rawSignal: c.rawSignal
          ? (sanitizeValue(c.rawSignal) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        promotedToId: finding.id,
      },
    });
  }

  // ---------------------------------------------------------------------
  // 7) Reports
  // ---------------------------------------------------------------------
  const reportStep = await prisma.scanStep.create({
    data: { scanJobId: scan.id, kind: 'report', state: 'running', startedAt: new Date() },
  });
  try {
    await generateReports({
      scanId: scan.id,
      projectId: scan.projectId,
      scope,
      mode: scan.mode,
      browser: browserOut,
      hunter: hunterOut,
      strix: strixOut,
      gateway,
      logger: log,
    });
    await prisma.scanStep.update({
      where: { id: reportStep.id },
      data: { state: 'succeeded', finishedAt: new Date() },
    });
  } catch (err) {
    log.error('report_failed', { msg: String(err) });
    await prisma.scanStep.update({
      where: { id: reportStep.id },
      data: {
        state: 'failed',
        finishedAt: new Date(),
        errorCode: 'WORKER_ERROR',
        errorMsg: String(err),
      },
    });
  }

  await prisma.scanJob.update({
    where: { id: scan.id },
    data: { state: 'completed', finishedAt: new Date() },
  });
  log.info('scan_completed');
}

function summary(o: BrowserObservation) {
  return {
    routeCount: o.routes.length,
    apiEndpointCount: o.apiEndpoints.length,
    cookieCount: o.cookies.length,
    storageKeyCount: o.storageKeys.length,
  };
}

function main() {
  logger.info('scan_orchestrator_starting');
  const worker = new Worker<ScanJobPayload>(
    QUEUE_SCAN,
    async (job) => {
      await processScan(job.data.scanJobId);
    },
    {
      ...getQueueConnectionOptions(),
      concurrency: Number(process.env.SCAN_WORKER_CONCURRENCY || 2),
      autorun: true,
    },
  );
  worker.on('failed', (job, err) => {
    logger.error('worker_job_failed', { jobId: job?.id, msg: err.message });
  });
  worker.on('error', (err) => {
    logger.error('worker_error', { msg: err.message });
  });
  process.on('SIGTERM', async () => {
    logger.info('sigterm_received');
    await worker.close();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
