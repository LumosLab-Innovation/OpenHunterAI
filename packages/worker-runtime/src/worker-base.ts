/**
 * BaseWorker — every X-hunter worker extends this to inherit:
 *   - structured logs (scan_id, project_id, worker_type baked in)
 *   - hard timeout
 *   - retry-with-backoff for retryable errors only
 *   - audit-log emission on success/failure
 *
 * Satisfies WORKER_SPEC.md §1 and SECURITY_GUARDRAILS.md §5.
 */

import { createLogger, type Logger, GuardrailError, isGuardrailError } from '@x-hunter/shared';

export interface WorkerContext {
  scanId: string;
  projectId: string;
  workerType: string;
  /** Hard timeout in ms; the worker MUST abort if exceeded. */
  timeoutMs: number;
  /** Number of attempts allowed for retryable errors. */
  maxAttempts: number;
  logger?: Logger;
}

export interface WorkerOutcome<T> {
  ok: true;
  value: T;
  durationMs: number;
}
export interface WorkerFailure {
  ok: false;
  errorCode: string;
  errorMessage: string;
  durationMs: number;
  retryable: boolean;
}
export type WorkerResult<T> = WorkerOutcome<T> | WorkerFailure;

export abstract class BaseWorker<TInput, TOutput> {
  protected readonly ctx: WorkerContext;
  protected readonly logger: Logger;

  constructor(ctx: WorkerContext) {
    this.ctx = ctx;
    this.logger =
      ctx.logger?.child({
        scan_id: ctx.scanId,
        project_id: ctx.projectId,
        worker: ctx.workerType,
      }) ??
      createLogger({
        scan_id: ctx.scanId,
        project_id: ctx.projectId,
        worker: ctx.workerType,
      });
  }

  /** Subclasses implement the actual work here. */
  protected abstract run(input: TInput, signal: AbortSignal): Promise<TOutput>;

  async execute(input: TInput): Promise<WorkerResult<TOutput>> {
    let lastError: { code: string; message: string; retryable: boolean } | null = null;
    for (let attempt = 1; attempt <= this.ctx.maxAttempts; attempt++) {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.ctx.timeoutMs);
      try {
        this.logger.info('worker_start', { attempt });
        const value = await this.run(input, controller.signal);
        const durationMs = Date.now() - start;
        this.logger.info('worker_ok', { duration_ms: durationMs, attempt });
        return { ok: true, value, durationMs };
      } catch (err: unknown) {
        clearTimeout(timer);
        const isAbort = controller.signal.aborted;
        if (isAbort) {
          lastError = { code: 'TIMEOUT', message: 'Worker exceeded timeout', retryable: false };
        } else if (isGuardrailError(err)) {
          lastError = { code: err.code, message: err.message, retryable: false };
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          const retryable = /ECONNRESET|ETIMEDOUT|EAI_AGAIN|rate.?limit|503|502/i.test(msg);
          lastError = { code: 'WORKER_ERROR', message: msg, retryable };
        }
        const durationMs = Date.now() - start;
        this.logger.warn('worker_attempt_failed', {
          attempt,
          duration_ms: durationMs,
          code: lastError.code,
          msg: lastError.message,
          retryable: lastError.retryable,
        });
        if (!lastError.retryable || attempt >= this.ctx.maxAttempts) {
          return {
            ok: false,
            errorCode: lastError.code,
            errorMessage: lastError.message,
            durationMs,
            retryable: lastError.retryable,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    const code = lastError?.code ?? 'WORKER_ERROR';
    const message = lastError?.message ?? 'unknown error';
    return { ok: false, errorCode: code, errorMessage: message, durationMs: 0, retryable: false };
  }
}

export { GuardrailError };
