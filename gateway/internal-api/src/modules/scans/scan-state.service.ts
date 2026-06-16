import { getPrisma } from '@x-hunter/db';
import { sanitizeReportContent, sanitizeText } from '@x-hunter/shared';

/**
 * Drives ScanJob.state transitions in Postgres. The orchestrator owns the scan
 * state machine (it tracks fan-in progress in JetStream KV) and calls this to
 * reflect transitions into the database. Transitions are validated so a late or
 * duplicate callback cannot move a terminal scan back to running.
 */

type ScanState =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

const TERMINAL: ReadonlySet<ScanState> = new Set(['completed', 'failed', 'cancelled', 'timeout']);

// Allowed forward transitions. Terminal states accept no further transitions.
const ALLOWED: Record<ScanState, ReadonlySet<ScanState>> = {
  queued: new Set(['running', 'failed', 'cancelled', 'timeout']),
  running: new Set(['awaiting_approval', 'completed', 'failed', 'cancelled', 'timeout']),
  awaiting_approval: new Set(['running', 'completed', 'failed', 'cancelled', 'timeout']),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
  timeout: new Set(),
};

export class ScanStateService {
  private readonly prisma = getPrisma();

  /**
   * Transitions a scan to the target state if the move is allowed. Returns
   * { ok, state } where state is the resulting (or unchanged) state. Idempotent:
   * a no-op transition to the same state returns ok=true.
   */
  async transition(scanId: string, to: ScanState, errorMessage?: string): Promise<{ ok: boolean; state: ScanState | null; reason?: string }> {
    const scan = await this.prisma.scanJob.findUnique({ where: { id: scanId }, select: { state: true } });
    if (!scan) return { ok: false, state: null, reason: 'SCAN_NOT_FOUND' };

    const from = scan.state as ScanState;
    if (from === to) return { ok: true, state: from };
    if (TERMINAL.has(from)) return { ok: false, state: from, reason: 'SCAN_ALREADY_TERMINAL' };
    if (!ALLOWED[from].has(to)) return { ok: false, state: from, reason: 'TRANSITION_NOT_ALLOWED' };

    const data: Record<string, unknown> = { state: to };
    if (to === 'running') data.startedAt = new Date();
    if (TERMINAL.has(to)) data.finishedAt = new Date();
    if (errorMessage) data.errorMessage = errorMessage.slice(0, 2000);

    const result = await this.prisma.scanJob.updateMany({ where: { id: scanId, state: from }, data });
    if (result.count === 0) {
      const current = await this.prisma.scanJob.findUnique({ where: { id: scanId }, select: { state: true } });
      return { ok: false, state: (current?.state as ScanState | undefined) ?? null, reason: 'SCAN_STATE_CHANGED' };
    }
    await recordStateActivity(this.prisma, scanId, to, errorMessage);
    return { ok: true, state: to };
  }
}

async function recordStateActivity(
  prisma: ReturnType<typeof getPrisma>,
  scanId: string,
  state: ScanState,
  errorMessage?: string,
) {
  const eventType =
    state === 'running'
      ? 'scan_started'
      : state === 'completed'
        ? 'scan_completed'
        : state === 'failed'
          ? 'scan_failed'
          : `scan_${state}`;
  await (prisma as any).scanActivityEvent
    .create({
      data: {
        scanJobId: scanId,
        eventType,
        actor: 'scan',
        titleKey: `activity.${eventType}.title`,
        bodyKey: `activity.${eventType}.body`,
        bodyParams: unwrapObject(sanitizeReportContent({ summary: errorMessage ?? `Scan state changed to ${state}` })),
        status: state,
        severity: state === 'failed' || state === 'timeout' ? 'high' : null,
        sanitized: true,
      },
    })
    .catch(() => {});
}

function unwrapObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  if ('value' in value && value.value && typeof value.value === 'object') {
    return value.value as Record<string, unknown>;
  }
  return sanitizeText(String(value)) ? { summary: sanitizeText(String(value)) } : {};
}
