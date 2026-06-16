import { getPrisma } from '@x-hunter/db';
import { sanitize, sanitizeReportContent, sanitizeText } from '@x-hunter/shared';

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
  evidenceClass?: string;
  validationState?: string;
}

export interface WorkerActivityInput {
  eventType: string;
  actor: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, unknown>;
  status: string;
  severity?: string | null;
  visualArtifact?: unknown;
}

const SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);
const CONFIDENCES = new Set(['low', 'medium', 'high']);
const MAX_VISUAL_DATA_URL_LENGTH = 350_000;

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
    const step = await this.prisma.scanStep.create({
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
    const activity = activityForWorkerResult(kind, state, result);
    await recordActivity(this.prisma, {
      scanJobId: scanId,
      eventType: activity.eventType,
      actor: kind,
      titleKey: activity.titleKey,
      bodyKey: activity.bodyKey,
      bodyParams: {
        summary: result.summary ?? result.errorMsg ?? `${kind} ${state}`,
        errorCode: result.errorCode,
      },
      status: state,
      severity: activity.severity,
      visualArtifact: result.meta?.visualArtifact,
    });
    const retestUpdate = retestUpdateFromWorkerResult(result);
    if (retestUpdate) {
      await this.prisma.retestRun.update({
        where: { id: retestUpdate.retestRunId },
        data: retestUpdate.data,
      });
    }
    return step;
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
        evidenceClass: signal.evidenceClass ? sanitizeText(signal.evidenceClass).slice(0, 80) : 'signal',
        validationState: signal.validationState ? sanitizeText(signal.validationState).slice(0, 80) : 'unvalidated',
        sanitized: true,
      }) as object,
    }));
    const result = await this.prisma.findingCandidate.createMany({ data: rows });
    await recordActivity(this.prisma, {
      scanJobId: scanId,
      eventType: 'finding_candidate',
      actor: workerType,
      titleKey: 'activity.finding_candidate.title',
      bodyKey: 'activity.finding_candidate.body',
      bodyParams: { summary: `${result.count} candidate signal(s) recorded`, count: result.count },
      status: 'ready',
      severity: signals.some((signal) => signal.severity === 'critical' || signal.severity === 'high') ? 'high' : 'info',
    });
    return result;
  }

  async recordActivityEvent(scanId: string, activity: WorkerActivityInput) {
    await recordActivity(this.prisma, {
      scanJobId: scanId,
      eventType: activity.eventType,
      actor: activity.actor,
      titleKey: activity.titleKey,
      bodyKey: activity.bodyKey,
      bodyParams: activity.bodyParams,
      status: activity.status,
      severity: activity.severity,
      visualArtifact: activity.visualArtifact,
    });
    return { accepted: true };
  }
}

export function activityForWorkerResult(kind: string, state: string, result: Pick<WorkerStepResult, 'errorCode'>): {
  eventType: string;
  titleKey: string;
  bodyKey: string;
  severity: string | null;
} {
  if (result.errorCode === 'AUTH_SESSION_REQUIRED') {
    return {
      eventType: 'auth_session_required',
      titleKey: 'activity.auth_session_required.title',
      bodyKey: 'activity.auth_session_required.body',
      severity: 'medium',
    };
  }
  if (state === 'failed') {
    return {
      eventType: 'step_failed',
      titleKey: 'activity.step_failed.title',
      bodyKey: 'activity.step_failed.body',
      severity: 'high',
    };
  }
  return {
    eventType: 'step_completed',
    titleKey: 'activity.step_completed.title',
    bodyKey: 'activity.step_completed.body',
    severity: null,
  };
}

type RetestResultValue = 'fixed' | 'still_vulnerable' | 'partially_fixed' | 'cannot_verify';
const RETEST_RESULTS = new Set<RetestResultValue>(['fixed', 'still_vulnerable', 'partially_fixed', 'cannot_verify']);

export function retestUpdateFromWorkerResult(result: WorkerStepResult): null | {
  retestRunId: string;
  data: {
    result: RetestResultValue;
    notes: string | null;
    startedAt: Date | null;
    finishedAt: Date;
    errorCode: string | null;
  };
} {
  if (result.workerType !== 'retest') return null;
  const retestRunId = typeof result.meta?.retestRunId === 'string' ? result.meta.retestRunId : '';
  if (!retestRunId) return null;
  const rawResult = typeof result.meta?.result === 'string' ? result.meta.result : '';
  const retestResult: RetestResultValue =
    result.state === 'done' && isRetestResult(rawResult) ? rawResult : 'cannot_verify';
  const notes = result.state === 'done' ? result.summary : result.errorMsg || result.summary || null;
  return {
    retestRunId,
    data: {
      result: retestResult,
      notes: notes ? sanitizeText(notes) : null,
      startedAt: result.startedAt ? new Date(result.startedAt) : null,
      finishedAt: result.finishedAt ? new Date(result.finishedAt) : new Date(),
      errorCode: result.state === 'done' ? null : result.errorCode ?? null,
    },
  };
}

function isRetestResult(value: string): value is RetestResultValue {
  return RETEST_RESULTS.has(value as RetestResultValue);
}

async function recordActivity(
  prisma: ReturnType<typeof getPrisma>,
  input: {
    scanJobId: string;
    eventType: string;
    actor: string;
    titleKey: string;
    bodyKey: string;
    bodyParams?: Record<string, unknown>;
    status: string;
    severity?: string | null;
    visualArtifact?: unknown;
  },
) {
  const bodyParams = sanitizeReportContent(input.bodyParams ?? {});
  const visualArtifact = sanitizeVisualArtifact(input.visualArtifact);
  await (prisma as any).scanActivityEvent
    .create({
      data: {
        scanJobId: input.scanJobId,
        eventType: sanitizeText(input.eventType).slice(0, 100),
        actor: compactActor(input.actor),
        titleKey: sanitizeText(input.titleKey).slice(0, 160),
        bodyKey: sanitizeText(input.bodyKey).slice(0, 160),
        bodyParams: unwrapObject(bodyParams),
        status: sanitizeText(input.status).slice(0, 80),
        severity: input.severity ? sanitizeText(input.severity).slice(0, 40) : null,
        sanitized: true,
        visualArtifact: visualArtifact ?? undefined,
      },
    })
    .catch(() => {});
}

function compactActor(actor: string): string {
  switch (actor.toLowerCase().replace(/[-\s]/g, '_')) {
    case 'browser':
    case 'browser_inspector':
      return 'browser_inspector';
    case 'zap':
    case 'zap_signal':
    case 'z':
      return 'Z';
    case 'nuclei':
    case 'nuclei_signal':
    case 'n':
      return 'N';
    case 'openhack':
    case 'openhack_hunter':
    case 'o':
      return 'O';
    case 'strix':
    case 'strix_core':
    case 's':
      return 'S';
    case 'report':
      return 'RPT';
    default:
      return sanitizeText(actor).slice(0, 80);
  }
}

function sanitizeVisualArtifact(value: unknown): Record<string, unknown> | undefined {
  const artifact = unwrapObject(sanitizeReportContent(value ?? {}));
  if (artifact.kind !== 'thumbnail' || typeof artifact.dataUrl !== 'string') return undefined;
  if (artifact.sanitized !== true || artifact.synthetic !== true) return undefined;
  if (artifact.dataUrl.length > MAX_VISUAL_DATA_URL_LENGTH) return undefined;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(artifact.dataUrl)) return undefined;
  return {
    kind: 'thumbnail',
    dataUrl: artifact.dataUrl,
    expiresAt:
      typeof artifact.expiresAt === 'string' && !Number.isNaN(Date.parse(artifact.expiresAt))
        ? artifact.expiresAt
        : new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    sanitized: true,
    synthetic: true,
    ...(typeof artifact.width === 'number' ? { width: artifact.width } : {}),
    ...(typeof artifact.height === 'number' ? { height: artifact.height } : {}),
  };
}

function unwrapObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  if ('value' in value && value.value && typeof value.value === 'object') {
    return value.value as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}
