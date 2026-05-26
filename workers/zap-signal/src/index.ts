/**
 * ZAP Signal worker.
 *
 * Talks to a running ZAP daemon via the REST API (passive + baseline). The
 * v1 implementation is intentionally narrow — we run the baseline policy
 * against a small set of seed URLs (provided by the orchestrator from the
 * browser-inspector's observation), poll until completion, and pull alerts.
 *
 * If `ZAP_BASE_URL` is not configured, the worker returns TOOL_UNAVAILABLE
 * so the orchestrator can mark the step `skipped` and continue.
 *
 * The worker NEVER performs active attacks. Active scan is explicitly
 * disabled by guardrail (PLAN_V3 §3 + SECURITY_GUARDRAILS §5).
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

export interface ZapSignalInput {
  scanId: string;
  projectId: string;
  scope: ScopeSnapshot;
  seedUrls: string[];
  /** Max wait for the spider+baseline to complete. */
  timeoutMs?: number;
  logger?: Logger;
}

export interface ZapSignalResult {
  candidates: FindingCandidate[];
  /** ZAP-level summary for the report-writer. */
  summary: {
    alertsHigh: number;
    alertsMedium: number;
    alertsLow: number;
    alertsInfo: number;
  };
}

interface ZapAlert {
  alert: string;
  risk: string;
  confidence: string;
  url: string;
  description?: string;
  cweid?: string;
  wascid?: string;
}

class ZapSignalWorker extends BaseWorker<ZapSignalInput, ZapSignalResult> {
  protected async run(input: ZapSignalInput, signal: AbortSignal): Promise<ZapSignalResult> {
    const baseUrl = process.env.ZAP_BASE_URL;
    if (!baseUrl) {
      throw new GuardrailError('TOOL_UNAVAILABLE', 'ZAP_BASE_URL is not configured');
    }
    const apiKey = process.env.ZAP_API_KEY ?? '';

    // 1. Pre-scope every seed.
    for (const url of input.seedUrls) {
      assertInScope(url, input.scope);
    }
    if (input.seedUrls.length === 0) {
      return emptyResult();
    }

    const fetcher = makeFetcher(baseUrl, apiKey, signal);
    // 2. Add seeds to ZAP context as URLs to access (passive crawl only).
    for (const url of input.seedUrls) {
      await fetcher.get('/JSON/core/action/accessUrl/', { url, followRedirects: 'false' });
    }
    // 3. Trigger the spider in passive mode (no active scan).
    const spiderResp = await fetcher.get<{ scan: string }>('/JSON/spider/action/scan/', {
      url: input.seedUrls[0]!,
      recurse: 'true',
      contextName: '',
    });
    const spiderId = spiderResp.scan;
    await pollUntil(
      async () =>
        Number(
          (await fetcher.get<{ status: string }>('/JSON/spider/view/status/', { scanId: spiderId }))
            .status,
        ),
      (v) => v >= 100,
      input.timeoutMs ?? 600_000,
      signal,
    );

    // 4. Read alerts limited to seed hosts.
    const alerts = await fetcher.get<{ alerts: ZapAlert[] }>('/JSON/core/view/alerts/', {
      start: '0',
      count: '500',
    });
    const candidates: FindingCandidate[] = [];
    let high = 0;
    let medium = 0;
    let low = 0;
    let info = 0;
    for (const a of alerts.alerts) {
      // Re-check scope on alert URL to be safe.
      try {
        assertInScope(a.url, input.scope);
      } catch (e) {
        if (isGuardrailError(e)) continue;
        throw e;
      }
      const sev = riskToSeverity(a.risk);
      if (sev === 'high' || sev === 'critical') high++;
      else if (sev === 'medium') medium++;
      else if (sev === 'low') low++;
      else info++;
      candidates.push({
        source: 'zap',
        title: sanitizeText(a.alert).slice(0, 200),
        severity: sev,
        confidence: confidenceFromZap(a.confidence),
        category: 'zap',
        affectedAsset: a.url,
        evidence: {
          description: sanitizeText(a.description ?? a.alert).slice(0, 1000),
          sanitized: true,
        },
        rawSignal: sanitizeValue({ cweid: a.cweid, wascid: a.wascid, risk: a.risk }) as Record<
          string,
          unknown
        >,
      });
    }
    return {
      candidates,
      summary: { alertsHigh: high, alertsMedium: medium, alertsLow: low, alertsInfo: info },
    };
  }
}

function emptyResult(): ZapSignalResult {
  return {
    candidates: [],
    summary: { alertsHigh: 0, alertsMedium: 0, alertsLow: 0, alertsInfo: 0 },
  };
}

function makeFetcher(baseUrl: string, apiKey: string, signal: AbortSignal) {
  return {
    async get<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
      const url = new URL(path, baseUrl);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      if (apiKey) url.searchParams.set('apikey', apiKey);
      const res = await fetch(url.toString(), { signal });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`ZAP API ${res.status} ${path}: ${text.slice(0, 200)}`);
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        return { raw: text } as unknown as T;
      }
    },
  };
}

async function pollUntil(
  read: () => Promise<number>,
  done: (v: number) => boolean,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new GuardrailError('TIMEOUT', 'zap_signal aborted');
    const v = await read();
    if (done(v)) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new GuardrailError('TIMEOUT', 'ZAP spider polling timed out');
}

function riskToSeverity(risk: string): Severity {
  switch ((risk || '').toLowerCase()) {
    case 'informational':
      return 'info';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    default:
      return 'info';
  }
}

function confidenceFromZap(c: string): 'low' | 'medium' | 'high' {
  switch ((c || '').toLowerCase()) {
    case 'high':
    case 'confirmed':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

export async function runZapSignal(input: ZapSignalInput): Promise<WorkerResult<ZapSignalResult>> {
  const ctx: WorkerContext = {
    scanId: input.scanId,
    projectId: input.projectId,
    workerType: 'zap_signal',
    timeoutMs: input.timeoutMs ?? 600_000,
    maxAttempts: 1,
    logger: input.logger ?? createLogger({ component: 'zap-signal' }),
  };
  return new ZapSignalWorker(ctx).execute(input);
}
