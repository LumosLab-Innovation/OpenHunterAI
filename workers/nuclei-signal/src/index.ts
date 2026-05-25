/**
 * Nuclei Signal worker.
 *
 * Runs the curated, low-impact Nuclei profile against the verified host(s)
 * and turns each match into a FindingCandidate. Only safe tag families are
 * included — `exposure`, `misconfig`, `network-misconfig`, `tls`,
 * `default-login` is intentionally NOT included (auth attacks are out of
 * scope for v1). See PLAN_V3 §6.3.
 *
 * If `NUCLEI_BIN` is missing, we return TOOL_UNAVAILABLE so the orchestrator
 * can mark the step skipped.
 */

import {
  assertInScope,
  createLogger,
  type FindingCandidate,
  GuardrailError,
  isGuardrailError,
  type Logger,
  type Severity,
  type ScopeSnapshot,
  sanitizeValue,
  sanitizeText,
} from '@x-hunter/shared';
import { BaseWorker, type WorkerContext, type WorkerResult } from '@x-hunter/worker-runtime';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export interface NucleiSignalInput {
  scanId: string;
  projectId: string;
  scope: ScopeSnapshot;
  targets: string[];
  /** Max wall time for nuclei. */
  timeoutMs?: number;
  logger?: Logger;
}

export interface NucleiSignalResult {
  candidates: FindingCandidate[];
  raw: { exitCode: number; durationMs: number };
}

interface NucleiJsonLine {
  'template-id'?: string;
  template?: string;
  info?: { name?: string; severity?: string; tags?: string[]; description?: string };
  host?: string;
  'matched-at'?: string;
  type?: string;
  request?: string;
  response?: string;
}

const SAFE_TAGS = ['exposure', 'misconfig', 'tls', 'network-misconfig', 'http', 'edb-id'];

class NucleiSignalWorker extends BaseWorker<NucleiSignalInput, NucleiSignalResult> {
  protected async run(input: NucleiSignalInput, signal: AbortSignal): Promise<NucleiSignalResult> {
    const bin = process.env.NUCLEI_BIN || 'nuclei';
    // Probe the binary first.
    try {
      await execFileP(bin, ['-version'], { signal, timeout: 10_000 });
    } catch {
      throw new GuardrailError('TOOL_UNAVAILABLE', `Nuclei binary not available (${bin})`);
    }

    if (input.targets.length === 0) {
      return { candidates: [], raw: { exitCode: 0, durationMs: 0 } };
    }
    for (const url of input.targets) {
      assertInScope(url, input.scope);
    }

    const start = Date.now();
    const args = [
      '-jsonl',
      '-silent',
      '-no-color',
      '-rl', '20', // rate-limit reqs/sec
      '-c', '10',  // concurrency
      '-timeout', '10',
      '-tags', SAFE_TAGS.join(','),
      '-exclude-tags', 'fuzz,intrusive,dos,brute-force',
      '-target', input.targets.join(','),
    ];

    let stdout = '';
    let exitCode = 0;
    try {
      const r = await execFileP(bin, args, { signal, timeout: input.timeoutMs ?? 300_000, maxBuffer: 32 * 1024 * 1024 });
      stdout = r.stdout;
    } catch (e) {
      const ex = e as { stdout?: string; code?: number; signal?: string };
      if (ex.stdout) {
        stdout = ex.stdout;
        exitCode = ex.code ?? 1;
      } else {
        throw e;
      }
    }
    const durationMs = Date.now() - start;

    const candidates: FindingCandidate[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      let parsed: NucleiJsonLine;
      try {
        parsed = JSON.parse(line) as NucleiJsonLine;
      } catch {
        continue;
      }
      const at = parsed['matched-at'] || parsed.host;
      if (!at) continue;
      // Re-check scope.
      try {
        assertInScope(at, input.scope);
      } catch (err) {
        if (isGuardrailError(err)) continue;
        throw err;
      }
      candidates.push({
        source: 'nuclei',
        title: sanitizeText(parsed.info?.name ?? parsed['template-id'] ?? 'Nuclei match').slice(0, 200),
        severity: severityFromNuclei(parsed.info?.severity),
        confidence: 'medium',
        category: 'nuclei',
        affectedAsset: at,
        evidence: {
          description: sanitizeText(parsed.info?.description ?? '').slice(0, 1000),
          sanitized: true,
        },
        rawSignal: sanitizeValue({
          template: parsed.template ?? parsed['template-id'],
          tags: parsed.info?.tags,
        }) as Record<string, unknown>,
      });
    }
    return { candidates, raw: { exitCode, durationMs } };
  }
}

function severityFromNuclei(s?: string): Severity {
  switch ((s || '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}

export async function runNucleiSignal(
  input: NucleiSignalInput,
): Promise<WorkerResult<NucleiSignalResult>> {
  const ctx: WorkerContext = {
    scanId: input.scanId,
    projectId: input.projectId,
    workerType: 'nuclei_signal',
    timeoutMs: input.timeoutMs ?? 600_000,
    maxAttempts: 1,
    logger: input.logger ?? createLogger({ component: 'nuclei-signal' }),
  };
  return new NucleiSignalWorker(ctx).execute(input);
}
