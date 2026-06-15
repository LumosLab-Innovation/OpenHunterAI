import { getPrisma } from '@x-hunter/db';

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

    const updated = await this.prisma.scanJob.update({ where: { id: scanId }, data, select: { state: true } });
    return { ok: true, state: updated.state as ScanState };
  }
}
