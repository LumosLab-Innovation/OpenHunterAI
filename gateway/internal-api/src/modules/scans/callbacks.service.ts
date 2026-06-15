import { getPrisma } from '@x-hunter/db';
import { sanitize, sanitizeText } from '@x-hunter/shared';

/**
 * Persists sanitized worker callbacks (scan steps and finding candidates) to the
 * database. Workers send pre-sanitized results, but we sanitize again here as a
 * defense-in-depth boundary before anything touches the DB (AGENTS §6).
 */

// Worker result state -> ScanStepState.
const STATE_MAP: Record<string, string> = {
  done: 'succeeded',
  skipped: 'skipped',
  failed: 'failed',
};

// Worker type/key -> ScanStepKind.
const KIND_MAP: Record<string, string> = {
  browser: 'browser_inspector',
  'browser-inspector': 'browser_inspector',
  zap: 'zap_signal',
  Z: 'zap_signal',
  nuclei: 'nuclei_signal',
  N: 'nuclei_signal',
  openhack: 'openhack_hunter',
  O: 'openhack_hunter',
  strix: 'strix_core',
  S: 'strix_core',
  report: 'report',
  retest: 'retest',
};

export interface WorkerStepResult {
  scanId: string;
  projectId?: string;
  workerType: string;
  state: string;
  errorCode?: string;
  errorMsg?: string;
  coverageGap?: boolean;
  summary?: string;
  signals?: WorkerSignal[];
  startedAt?: string;
  finishedAt?: string;
  meta?: Record<string, unknown>;
}

export interface WorkerSignal {
  kind: string;
  title: string;
  severity?: string;
  confidence?: string;
  asset?: string;
  description?: string;
  evidenceRefs?: string[];
}

const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const CONFIDENCES = new Set(['low', 'medium', 'high']);

export class CallbacksService {
  private readonly prisma = getPrisma();

  /** Returns the scan job if it exists, else null (caller returns 404). */
  async findScan(scanId: string) {
    return this.prisma.scanJob.findUnique({ where: { id: scanId } });
  }

  /** Records a worker step result against a scan. */
  async recordStep(scanId: string, result: WorkerStepResult) {
    const kind = KIND_MAP[result.workerType] ?? 'report';
    const state = STATE_MAP[result.state] ?? 'failed';
    return this.prisma.scanStep.create({
      data: {
        scanJobId: scanId,
        kind: kind as never,
        state: state as never,
        startedAt: result.startedAt ? new Date(result.startedAt) : null,
        finishedAt: result.finishedAt ? new Date(result.finishedAt) : new Date(),
        // Only sanitized summary/coverage metadata is persisted, never raw output.
        outputRef: sanitize({
          summary: result.summary ? sanitizeText(result.summary) : undefined,
          coverageGap: Boolean(result.coverageGap),
          signalCount: result.signals?.length ?? 0,
          meta: result.meta ?? {},
        }) as object,
        errorCode: result.errorCode ?? null,
        errorMsg: result.errorMsg ? sanitizeText(result.errorMsg) : null,
      },
    });
  }

  /** Records sanitized signals as finding candidates for later promotion. */
  async recordFindings(scanId: string, workerType: string, signals: WorkerSignal[]) {
    if (!signals.length) return { count: 0 };
    const source = KIND_MAP[workerType] ?? workerType;
    const rows = signals.map((signal) => ({
      scanJobId: scanId,
      source,
      title: sanitizeText(signal.title ?? 'Untitled signal').slice(0, 300),
      severity: (SEVERITIES.has(signal.severity ?? '') ? signal.severity : 'info') as never,
      confidence: (CONFIDENCES.has(signal.confidence ?? '') ? signal.confidence : 'low') as never,
      category: sanitizeText(signal.kind ?? 'general').slice(0, 100),
      affectedAsset: sanitizeText(signal.asset ?? 'unknown').slice(0, 300),
      evidence: sanitize({
        description: signal.description ? sanitizeText(signal.description) : '',
        evidenceRefs: Array.isArray(signal.evidenceRefs) ? signal.evidenceRefs.map(String) : [],
        sanitized: true,
      }) as object,
    }));
    return this.prisma.findingCandidate.createMany({ data: rows });
  }
}
