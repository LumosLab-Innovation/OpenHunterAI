export type PlannedWorker = 'browser' | 'zap' | 'nuclei' | 'openhack' | 'strix';

export interface RuntimeReadiness {
  worker: PlannedWorker;
  installed: boolean;
  configured: boolean;
  reachable: boolean;
  executable: boolean;
  reasoningOnly?: boolean;
  nativeRuntime?: boolean;
  reason?: string;
}

const DEFAULT_HEALTH_URLS: Record<PlannedWorker, string> = {
  browser: 'http://browser-inspector:5110/health',
  zap: 'http://zaproxy-adapter:6100/health',
  nuclei: 'http://nuclei-adapter:6110/health',
  openhack: 'http://openhack-adapter:6120/health',
  strix: 'http://strix-adapter:6130/health',
};

const HEALTH_ENV: Record<PlannedWorker, string> = {
  browser: 'OPENHUNTER_BROWSER_HEALTH_URL',
  zap: 'OPENHUNTER_ZAP_HEALTH_URL',
  nuclei: 'OPENHUNTER_NUCLEI_HEALTH_URL',
  openhack: 'OPENHUNTER_PASSIVE_HEALTH_URL',
  strix: 'OPENHUNTER_STRIX_HEALTH_URL',
};

/** Probe the packaged runtime, not merely the presence of its config variable. */
export async function probeRuntime(worker: PlannedWorker): Promise<RuntimeReadiness> {
  const url = process.env[HEALTH_ENV[worker]] || DEFAULT_HEALTH_URLS[worker];
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(worker === 'strix' ? 8_000 : 2_000) });
    const body = await response.json() as Record<string, unknown>;
    const reachable = true;
    const reasoningOnly = worker === 'strix' && body.reasoning_available === true && body.execution_mode === 'codex_reasoning';
    const nativeRuntime = worker === 'strix' && body.execution_mode === 'strix_runtime' && body.runtime_available === true && body.runtime_configured === true;
    const installed = body.runtime_available === undefined
      ? true : body.runtime_available === true || body.builtin_planner === true || reasoningOnly;
    const configured = body.runtime_configured === undefined ? true : body.runtime_configured === true || body.builtin_planner === true || reasoningOnly;
    const executable = response.ok && body.ok === true && installed && configured;
    return {
      worker, installed, configured, reachable, executable,
      ...(reasoningOnly ? { reasoningOnly: true } : {}),
      ...(worker === 'strix' ? { nativeRuntime } : {}),
      ...(executable ? {} : { reason: !installed ? 'RUNTIME_NOT_INSTALLED' : !configured ? 'RUNTIME_NOT_CONFIGURED' : 'RUNTIME_NOT_EXECUTABLE' }),
    };
  } catch {
    return { worker, installed: false, configured: false, reachable: false, executable: false, reason: 'HEALTH_UNREACHABLE' };
  }
}

export async function probePlannedRuntimes(plannedWorkers: string[]): Promise<RuntimeReadiness[]> {
  const known = plannedWorkers.filter((worker): worker is PlannedWorker => worker in DEFAULT_HEALTH_URLS);
  return Promise.all(known.map(probeRuntime));
}
