import { getPrisma } from '@x-hunter/db';
import { sanitizeReportContent, sanitizeText } from '@x-hunter/shared';

type WorkerCode = 'Browser' | 'Z' | 'N' | 'O' | 'S' | 'RPT';

interface LiveScanInput {
  id: string;
  projectId: string;
  mode: string;
  targetType: string;
  authScope: string;
  testIntensityMode: string;
  state: string;
  scanPlan?: unknown;
  scopeSnapshot?: unknown;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  errorMessage?: string | null;
  steps?: LiveStepInput[];
  activityEvents?: LiveActivityEventInput[];
  findings?: LiveFindingInput[];
  reports?: LiveReportInput[];
  reportDraftSections?: LiveDraftSectionInput[];
}

interface LiveStepInput {
  id: string;
  kind: string;
  state: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  outputRef?: unknown;
  errorCode?: string | null;
  errorMsg?: string | null;
}

interface LiveFindingInput {
  id: string;
  title: string;
  severity: string;
  confidence: string;
  affectedAsset: string;
  category: string;
  status: string;
  createdAt: Date;
}

interface LiveReportInput {
  id: string;
  state: string;
  version: number;
  generatedAt: Date;
  finalizedAt?: Date | null;
}

interface LiveDraftSectionInput {
  id: string;
  sectionKey: string;
  state: string;
  content?: unknown;
  updatedAt: Date;
  errorCode?: string | null;
  errorMsg?: string | null;
}

interface LiveActivityEventInput {
  id?: string;
  scanJobId?: string;
  eventType: string;
  actor: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: unknown;
  status: string;
  severity?: string | null;
  sanitized?: boolean;
  visualArtifact?: unknown;
  createdAt?: Date;
}

export interface CreateScanActivityEventInput {
  scanJobId: string;
  eventType: string;
  actor: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: unknown;
  status: string;
  severity?: string | null;
  visualArtifact?: unknown;
}

export interface LiveScanSnapshot {
  scan: {
    id: string;
    projectId: string;
    mode: string;
    targetType: string;
    authScope: string;
    testIntensityMode: string;
    state: string;
    target: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  workers: Array<{
    code: WorkerCode;
    state: string;
    title: string;
    summary: string | null;
    errorCode: string | null;
    updatedAt: string | null;
  }>;
  activity: Array<{
    id: string;
    at: string;
    type: string;
    actor: WorkerCode | 'scan' | 'report';
    title: string;
    body: string;
    titleKey?: string;
    bodyKey?: string;
    bodyParams?: Record<string, unknown>;
    status: string;
    severity?: string | null;
    sanitized: true;
    visualArtifact?: SanitizedVisualArtifact;
  }>;
  findingsPreview: Array<{
    id: string;
    title: string;
    severity: string;
    confidence: string;
    affectedAsset: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  reportPreview: {
    latestReportId: string | null;
    latestReportState: string | null;
    sections: Array<{
      id: string;
      sectionKey: string;
      state: string;
      summary: string;
      updatedAt: string;
    }>;
  };
  cursorPreview: {
    visible: boolean;
    actor: WorkerCode | 'scan' | 'report';
    xPercent: number;
    yPercent: number;
    caption: string;
    screenshotAlt: string;
    visualArtifact?: SanitizedVisualArtifact;
  };
  degraded?: { events: boolean; reason: string };
}

interface SanitizedVisualArtifact {
  kind: 'thumbnail';
  dataUrl: string;
  width?: number;
  height?: number;
  expiresAt: string;
  sanitized: true;
  synthetic?: true;
}

const MAX_VISUAL_DATA_URL_LENGTH = 350_000;

const WORKER_ORDER: WorkerCode[] = ['Browser', 'Z', 'N', 'O', 'S', 'RPT'];
const WORKER_TITLES: Record<WorkerCode, string> = {
  Browser: 'Browser',
  Z: 'Z',
  N: 'N',
  O: 'O',
  S: 'S',
  RPT: 'Report',
};

export interface LiveActivityFilter {
  cursor?: string;
  limit?: number;
  actor?: string;
  type?: string;
  severity?: string;
  view?: 'curated' | 'raw';
}

export class LiveScanService {
  private readonly prisma = getPrisma();

  async getSnapshot(scanId: string, orgId: string, degraded?: LiveScanSnapshot['degraded'], filter?: LiveActivityFilter) {
    const scan = await (this.prisma.scanJob as any).findFirst({
      where: { id: scanId, project: { organizationId: orgId } },
      include: {
        steps: { orderBy: [{ startedAt: 'asc' }, { finishedAt: 'asc' }] },
        activityEvents: { orderBy: { createdAt: 'asc' }, take: 200 },
        findings: { orderBy: { createdAt: 'desc' }, take: 5 },
        reports: { orderBy: { version: 'desc' } },
        reportDraftSections: { orderBy: { updatedAt: 'asc' } },
      },
    });
    if (!scan) return null;
    const snapshot = buildLiveScanSnapshot(scan as unknown as LiveScanInput, degraded);
    if (!filter) return snapshot;
    const filtered = filterLiveActivity(snapshot.activity, filter);
    return {
      ...snapshot,
      activity: filtered.items,
      liveCursor: {
        nextCursor: filtered.nextCursor,
        hasMore: filtered.hasMore,
      },
    } as LiveScanSnapshot & { liveCursor: { nextCursor: string | null; hasMore: boolean } };
  }
}

export function filterLiveActivity(
  activity: LiveScanSnapshot['activity'],
  filter: LiveActivityFilter,
): { items: LiveScanSnapshot['activity']; nextCursor: string | null; hasMore: boolean } {
  const limit = Math.max(1, Math.min(Number(filter.limit ?? (filter.view === 'raw' ? 100 : 25)), 100));
  const actor = filter.actor ? activityActor(filter.actor) : null;
  const cursor = parseCursor(filter.cursor);
  const filtered = activity.filter((event) => {
    if (cursor && `${event.at}|${event.id}` <= cursor) return false;
    if (actor && event.actor !== actor) return false;
    if (filter.type && event.type !== filter.type) return false;
    if (filter.severity && event.severity !== filter.severity) return false;
    if (filter.view !== 'raw' && isNoisyActivity(event)) return false;
    return true;
  });
  const items = filtered.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: last ? `${last.at}|${last.id}` : null,
    hasMore: filtered.length > items.length,
  };
}

function parseCursor(cursor: string | undefined): string | null {
  if (!cursor || !cursor.includes('|')) return null;
  return sanitizeText(cursor).slice(0, 240);
}

function isNoisyActivity(event: LiveScanSnapshot['activity'][number]): boolean {
  return event.type === 'step_completed' && event.status === 'skipped';
}

export function buildLiveScanSnapshot(
  scan: LiveScanInput,
  degraded?: LiveScanSnapshot['degraded'],
  now = new Date(),
): LiveScanSnapshot {
  const steps = scan.steps ?? [];
  const latestReport = (scan.reports ?? [])[0] ?? null;
  const workerCodes = expectedWorkerCodes(scan.scanPlan, steps);
  const scanTarget = targetFromScope(scan.scopeSnapshot);
  const activity =
    (scan.activityEvents ?? []).length > 0
      ? buildPersistedActivity(scan.activityEvents ?? [], now)
      : buildActivity(scan, steps, scan.reportDraftSections ?? [], scan.findings ?? [], latestReport);
  const stepByCode = latestStepByCode(steps);
  const cursorActivity =
    [...activity].reverse().find((event) => event.actor !== 'scan' && event.actor !== 'report') ??
    [...activity].reverse()[0];

  return {
    scan: {
      id: scan.id,
      projectId: scan.projectId,
      mode: scan.mode,
      targetType: scan.targetType,
      authScope: scan.authScope,
      testIntensityMode: scan.testIntensityMode,
      state: scan.state,
      target: scanTarget,
      createdAt: scan.createdAt.toISOString(),
      updatedAt: scan.updatedAt.toISOString(),
      startedAt: scan.startedAt?.toISOString() ?? null,
      finishedAt: scan.finishedAt?.toISOString() ?? null,
      errorMessage: scan.errorMessage ? publicWorkerText(scan.errorMessage) : null,
    },
    workers: workerCodes.map((code) => {
      const step = stepByCode.get(code);
      const output = unwrapObject(step?.outputRef);
      const summary = typeof output.summary === 'string' ? publicWorkerText(output.summary) : null;
      return {
        code,
        state: step?.state ?? inferredWorkerState(scan.state, code),
        title: WORKER_TITLES[code],
        summary,
        errorCode: step?.errorCode ?? null,
        updatedAt: (step?.finishedAt ?? step?.startedAt)?.toISOString() ?? null,
      };
    }),
    activity,
    findingsPreview: (scan.findings ?? []).map((finding) => ({
      id: finding.id,
      title: publicWorkerText(finding.title),
      severity: finding.severity,
      confidence: finding.confidence,
      affectedAsset: sanitizeText(finding.affectedAsset),
      category: publicWorkerText(finding.category),
      status: finding.status,
      createdAt: finding.createdAt.toISOString(),
    })),
    reportPreview: {
      latestReportId: latestReport?.id ?? null,
      latestReportState: latestReport?.state ?? null,
      sections: (scan.reportDraftSections ?? []).map((section) => ({
        id: section.id,
        sectionKey: section.sectionKey,
        state: section.state,
        summary: summarizeSection(section),
        updatedAt: section.updatedAt.toISOString(),
      })),
    },
    cursorPreview: buildCursorPreview(cursorActivity),
    ...(degraded ? { degraded } : {}),
  };
}

function expectedWorkerCodes(scanPlan: unknown, steps: LiveStepInput[]): WorkerCode[] {
  const enabledWorkers = unwrapObject(scanPlan).enabledWorkers;
  const fromPlan =
    enabledWorkers && typeof enabledWorkers === 'object'
      ? Object.keys(enabledWorkers as Record<string, unknown>).map(workerCode).filter(isWorkerCode)
      : [];
  const fromSteps = steps.map((step) => workerCode(step.kind)).filter(isWorkerCode);
  return [...new Set([...WORKER_ORDER.filter((code) => fromPlan.includes(code)), ...fromSteps, 'RPT' as WorkerCode])];
}

function latestStepByCode(steps: LiveStepInput[]): Map<WorkerCode, LiveStepInput> {
  const out = new Map<WorkerCode, LiveStepInput>();
  for (const step of steps) {
    const code = workerCode(step.kind);
    if (isWorkerCode(code)) out.set(code, step);
  }
  return out;
}

function buildActivity(
  scan: LiveScanInput,
  steps: LiveStepInput[],
  sections: LiveDraftSectionInput[],
  findings: LiveFindingInput[],
  latestReport: LiveReportInput | null,
): LiveScanSnapshot['activity'] {
  const events: LiveScanSnapshot['activity'] = [
    {
      id: `${scan.id}:queued`,
      at: scan.createdAt.toISOString(),
      type: 'scan_queued',
      actor: 'scan',
      title: 'Scan queued',
      body: `Scope locked for ${targetFromScope(scan.scopeSnapshot)}.`,
      status: scan.state,
      sanitized: true,
    },
  ];

  if (scan.startedAt) {
    events.push({
      id: `${scan.id}:started`,
      at: scan.startedAt.toISOString(),
      type: 'scan_started',
      actor: 'scan',
      title: 'Scan started',
      body: 'The live pipeline is checking the verified scope.',
      status: 'running',
      sanitized: true,
    });
  }

  for (const step of steps) {
    const code = workerCode(step.kind);
    const actor = isWorkerCode(code) ? code : 'report';
    const output = unwrapObject(step.outputRef);
    const summary = typeof output.summary === 'string' ? publicWorkerText(output.summary) : defaultStepBody(actor, step.state);
    const at = (step.finishedAt ?? step.startedAt ?? scan.updatedAt).toISOString();
    events.push({
      id: `${step.id}:${step.state}`,
      at,
      type: step.state === 'failed' ? 'step_failed' : 'step_completed',
      actor,
      title: `${actor} ${step.state}`,
      body: step.errorMsg ? publicWorkerText(step.errorMsg) : summary,
      status: step.state,
      sanitized: true,
    });
    if (actor === 'S' && step.state === 'succeeded') {
      events.push({
        id: `${step.id}:reasoning`,
        at,
        type: 'reasoning_summary',
        actor,
        title: 'S reasoning summary',
        body: summary || 'S produced a sanitized attacker-mindset summary for this scope.',
        status: step.state,
        sanitized: true,
      });
    }
  }

  for (const finding of findings) {
    events.push({
      id: `${finding.id}:candidate`,
      at: finding.createdAt.toISOString(),
      type: 'finding_candidate',
      actor: 'report',
      title: publicWorkerText(finding.title),
      body: `${finding.severity} candidate on ${sanitizeText(finding.affectedAsset)}.`,
      status: finding.status,
      sanitized: true,
    });
  }

  for (const section of sections) {
    if (section.state !== 'ready' && section.state !== 'failed') continue;
    events.push({
      id: `${section.id}:${section.state}`,
      at: section.updatedAt.toISOString(),
      type: section.state === 'failed' ? 'step_failed' : 'report_section_ready',
      actor: 'report',
      title: `${section.sectionKey} ${section.state}`,
      body: summarizeSection(section),
      status: section.state,
      sanitized: true,
    });
  }

  if (latestReport?.state === 'final') {
    events.push({
      id: `${latestReport.id}:final`,
      at: (latestReport.finalizedAt ?? latestReport.generatedAt).toISOString(),
      type: 'report_finalized',
      actor: 'report',
      title: `Report v${latestReport.version} finalized`,
      body: 'The sanitized report_v1 snapshot is ready.',
      status: 'final',
      sanitized: true,
    });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at));
}

function buildPersistedActivity(events: LiveActivityEventInput[], now: Date): LiveScanSnapshot['activity'] {
  return events
    .map((event) => {
      const normalized = normalizeActivityEvent({
        scanJobId: event.scanJobId ?? '',
        eventType: event.eventType,
        actor: event.actor,
        titleKey: event.titleKey,
        bodyKey: event.bodyKey,
        bodyParams: event.bodyParams,
        status: event.status,
        severity: event.severity,
        visualArtifact: event.visualArtifact,
      });
      return {
        id: event.id ?? `${normalized.scanJobId}:${normalized.eventType}:${event.createdAt?.toISOString() ?? ''}`,
        at: (event.createdAt ?? new Date()).toISOString(),
        type: normalized.eventType,
        actor: normalized.actor,
        title: localActivityTitle(normalized.titleKey, normalized.actor),
        body: localActivityBody(normalized.bodyKey, normalized.bodyParams),
        titleKey: normalized.titleKey,
        bodyKey: normalized.bodyKey,
        bodyParams: normalized.bodyParams,
        status: normalized.status,
        severity: normalized.severity,
        sanitized: true as const,
        ...(visualIsFresh(normalized.visualArtifact, now) ? { visualArtifact: normalized.visualArtifact } : {}),
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function normalizeActivityEvent(input: CreateScanActivityEventInput): {
  scanJobId: string;
  eventType: string;
  actor: WorkerCode | 'scan' | 'report';
  titleKey: string;
  bodyKey: string;
  bodyParams: Record<string, unknown>;
  status: string;
  severity: string | null;
  sanitized: true;
  visualArtifact?: SanitizedVisualArtifact;
} {
  return {
    scanJobId: input.scanJobId,
    eventType: sanitizeText(input.eventType).slice(0, 100),
    actor: activityActor(input.actor),
    titleKey: sanitizeText(input.titleKey).slice(0, 160),
    bodyKey: sanitizeText(input.bodyKey).slice(0, 160),
        bodyParams: publicBodyParams(input.bodyParams ?? {}),
    status: sanitizeText(input.status).slice(0, 80),
    severity: input.severity ? sanitizeText(input.severity).slice(0, 40) : null,
    sanitized: true,
    ...(sanitizeVisualArtifact(input.visualArtifact) ? { visualArtifact: sanitizeVisualArtifact(input.visualArtifact) } : {}),
  };
}

export async function recordScanActivity(
  prisma: ReturnType<typeof getPrisma>,
  input: CreateScanActivityEventInput,
): Promise<void> {
  const event = normalizeActivityEvent(input);
  await (prisma as any).scanActivityEvent.create({
    data: {
      scanJobId: event.scanJobId,
      eventType: event.eventType,
      actor: event.actor,
      titleKey: event.titleKey,
      bodyKey: event.bodyKey,
      bodyParams: event.bodyParams,
      status: event.status,
      severity: event.severity,
      sanitized: true,
      visualArtifact: event.visualArtifact ?? undefined,
    },
  });
}

function sanitizeVisualArtifact(value: unknown): SanitizedVisualArtifact | undefined {
  const obj = unwrapObject(sanitizeReportContent(value ?? {}));
  if (obj.kind !== 'thumbnail') return undefined;
  if (obj.sanitized !== true || obj.synthetic !== true) return undefined;
  const dataUrl = typeof obj.dataUrl === 'string' ? obj.dataUrl : '';
  if (dataUrl.length > MAX_VISUAL_DATA_URL_LENGTH) return undefined;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)) return undefined;
  const expiresAt =
    typeof obj.expiresAt === 'string' && !Number.isNaN(Date.parse(obj.expiresAt))
      ? obj.expiresAt
      : new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  return {
    kind: 'thumbnail',
    dataUrl,
    expiresAt,
    sanitized: true,
    synthetic: true as const,
    ...(typeof obj.width === 'number' ? { width: obj.width } : {}),
    ...(typeof obj.height === 'number' ? { height: obj.height } : {}),
  };
}

function visualIsFresh(artifact: SanitizedVisualArtifact | undefined, now: Date): artifact is SanitizedVisualArtifact {
  return Boolean(artifact && Date.parse(artifact.expiresAt) > now.getTime());
}

function localActivityTitle(titleKey: string, actor: WorkerCode | 'scan' | 'report'): string {
  if (titleKey.includes('auth_session_required')) return 'Auth session required';
  if (titleKey.includes('reasoning')) return `${actor} reasoning summary`;
  if (titleKey.includes('browser')) return 'Browser action';
  if (titleKey.includes('finding')) return 'Finding candidate';
  if (titleKey.includes('report')) return 'Report update';
  return `${actor} update`;
}

function localActivityBody(bodyKey: string, params: Record<string, unknown>): string {
  if (typeof params.summary === 'string') return publicWorkerText(params.summary);
  if (typeof params.message === 'string') return publicWorkerText(params.message);
  if (bodyKey.includes('auth_session_required')) return 'Log in again with a saved test account before running authenticated coverage.';
  if (bodyKey.includes('reasoning')) return 'Sanitized reasoning summary is ready.';
  if (bodyKey.includes('browser')) return 'A browser action was observed in the verified scope.';
  if (bodyKey.includes('report')) return 'The sanitized report is being updated.';
  return 'Live activity updated.';
}

function summarizeSection(section: LiveDraftSectionInput): string {
  if (section.errorMsg) return publicWorkerText(section.errorMsg);
  const content = sanitizeReportContent(section.content ?? {});
  const obj = unwrapObject(content);
  const ownerSummary = unwrapObject(obj.ownerSummary);
  const headline = ownerSummary.headline ?? obj.headline ?? obj.summary ?? obj.title;
  if (typeof headline === 'string' && headline.trim()) return publicWorkerText(headline);
  return `${section.sectionKey} section is ${section.state}.`;
}

function buildCursorPreview(activity?: LiveScanSnapshot['activity'][number]): LiveScanSnapshot['cursorPreview'] {
  if (!activity) {
    return {
      visible: false,
      actor: 'scan',
      xPercent: 50,
      yPercent: 50,
      caption: 'Waiting for live activity.',
      screenshotAlt: 'No browser action preview yet.',
    };
  }
  return {
    visible: true,
    actor: activity.actor,
    xPercent: cursorX(activity.actor),
    yPercent: cursorY(activity.type),
    caption: `${activity.actor}: ${activity.body}`,
    screenshotAlt: 'Sanitized browser action preview. Raw target screenshots are not persisted.',
    ...(activity.visualArtifact ? { visualArtifact: activity.visualArtifact } : {}),
  };
}

function inferredWorkerState(scanState: string, code: WorkerCode): string {
  if (code === 'RPT') return scanState === 'completed' ? 'succeeded' : 'pending';
  if (scanState === 'failed' || scanState === 'timeout' || scanState === 'cancelled') return 'skipped';
  return scanState === 'running' ? 'running' : 'pending';
}

function defaultStepBody(actor: WorkerCode | 'report', state: string): string {
  if (actor === 'Z') return `Z finished passive signal checks with state ${state}.`;
  if (actor === 'N') return `N finished curated safe template checks with state ${state}.`;
  if (actor === 'O') return `O finished scenario-first hunter checks with state ${state}.`;
  if (actor === 'S') return `S finished sanitized reasoning with state ${state}.`;
  if (actor === 'Browser') return `Browser finished with state ${state}.`;
  return `Report step finished with state ${state}.`;
}

function targetFromScope(scope: unknown): string {
  const obj = unwrapObject(scope);
  const verifiedDomain = obj.verifiedDomain;
  if (typeof verifiedDomain === 'string' && verifiedDomain) return sanitizeText(verifiedDomain);
  const hosts = obj.allowedHosts;
  if (Array.isArray(hosts) && typeof hosts[0] === 'string') return sanitizeText(hosts[0]);
  return 'verified scope';
}

function workerCode(kind: string): string {
  const normalized = kind.toLowerCase().replace(/[-\s]/g, '_');
  switch (normalized) {
    case 'browser':
    case 'browser_inspector':
      return 'Browser';
    case 'zap':
    case 'zap_proxy':
    case 'zap_signal':
    case 'z':
    case 'z_signal':
      return 'Z';
    case 'nuclei':
    case 'nuclei_proxy':
    case 'nuclei_signal':
    case 'n':
    case 'n_signal':
      return 'N';
    case 'openhack':
    case 'openhack_proxy':
    case 'openhack_hunter':
    case 'o':
    case 'o_hunter':
      return 'O';
    case 'strix':
    case 'strix_proxy':
    case 'strix_core':
    case 's':
    case 's_core':
      return 'S';
    case 'report':
    case 'rpt':
      return 'RPT';
    default:
      return kind;
  }
}

function activityActor(actor: string): WorkerCode | 'scan' | 'report' {
  const code = workerCode(actor);
  if (isWorkerCode(code)) return code;
  const normalized = actor.toLowerCase();
  if (normalized.includes('scan')) return 'scan';
  if (normalized.includes('report')) return 'report';
  return 'report';
}

function isWorkerCode(value: string): value is WorkerCode {
  return (WORKER_ORDER as string[]).includes(value);
}

function unwrapObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  if ('value' in value && value.value && typeof value.value === 'object') {
    return value.value as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function cursorX(actor: LiveScanSnapshot['cursorPreview']['actor']): number {
  if (actor === 'Browser') return 28;
  if (actor === 'Z') return 42;
  if (actor === 'N') return 52;
  if (actor === 'O') return 62;
  if (actor === 'S') return 72;
  return 82;
}

function cursorY(type: string): number {
  if (type === 'finding_candidate') return 62;
  if (type === 'reasoning_summary') return 38;
  if (type === 'report_section_ready') return 70;
  return 48;
}

function publicBodyParams(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeReportContent(value ?? {});
  const rewritten = rewritePublicWorkerLabels(sanitized);
  return unwrapObject(rewritten);
}

function rewritePublicWorkerLabels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewritePublicWorkerLabels);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? publicWorkerText(value) : value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = rewritePublicWorkerLabels(child);
  }
  return out;
}

function publicWorkerText(value: string): string {
  return sanitizeText(value)
    .replace(/\bbrowser[_-]inspector\b/gi, 'Browser')
    .replace(/\bzap[_-]signal\b/gi, 'Z')
    .replace(/\bzap\b/gi, 'Z')
    .replace(/\bnuclei[_-]signal\b/gi, 'N')
    .replace(/\bnuclei\b/gi, 'N')
    .replace(/\bopenhack[_-]hunter\b/gi, 'O')
    .replace(/\bopenhack\b/gi, 'O')
    .replace(/\bstrix[_-]core\b/gi, 'S')
    .replace(/\bstrix\b/gi, 'S')
    .replace(/\bZ_signal\b/g, 'Z')
    .replace(/\bN_signal\b/g, 'N')
    .replace(/\bO_hunter\b/g, 'O')
    .replace(/\bS_core\b/g, 'S');
}
