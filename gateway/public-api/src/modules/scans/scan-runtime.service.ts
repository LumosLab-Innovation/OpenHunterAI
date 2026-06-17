export interface ScanRuntimeConfig {
  enabled: boolean;
  healthUrl: string | null;
  project: string | null;
  zone: string | null;
  instance: string | null;
  wakeTimeoutMs: number;
  pollIntervalMs: number;
  requestTimeoutMs: number;
}

export type RuntimeActivity = {
  eventType: string;
  titleKey: string;
  bodyKey: string;
  bodyParams: Record<string, unknown>;
  status: string;
  severity?: string;
};

export class ScanRuntimeUnavailableError extends Error {
  readonly code = 'SCAN_RUNTIME_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'ScanRuntimeUnavailableError';
  }
}

export function readScanRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ScanRuntimeConfig {
  const enabled = String(env.SCAN_RUNTIME_WAKE_ENABLED ?? '').toLowerCase() === 'true';
  const healthUrl = cleanUrl(env.SCAN_RUNTIME_HEALTH_URL);
  const project = cleanValue(env.SCAN_RUNTIME_GCP_PROJECT);
  const zone = cleanValue(env.SCAN_RUNTIME_GCP_ZONE);
  const instance = cleanValue(env.SCAN_RUNTIME_GCP_INSTANCE);
  const config: ScanRuntimeConfig = {
    enabled,
    healthUrl,
    project,
    zone,
    instance,
    wakeTimeoutMs: boundedNumber(env.SCAN_RUNTIME_WAKE_TIMEOUT_MS, 180_000, 30_000, 600_000),
    pollIntervalMs: boundedNumber(env.SCAN_RUNTIME_POLL_INTERVAL_MS, 5_000, 1_000, 30_000),
    requestTimeoutMs: boundedNumber(env.SCAN_RUNTIME_REQUEST_TIMEOUT_MS, 2_500, 500, 10_000),
  };
  if (enabled) {
    for (const [name, value] of [
      ['SCAN_RUNTIME_HEALTH_URL', healthUrl],
      ['SCAN_RUNTIME_GCP_PROJECT', project],
      ['SCAN_RUNTIME_GCP_ZONE', zone],
      ['SCAN_RUNTIME_GCP_INSTANCE', instance],
    ] as const) {
      if (!value) throw new Error(`${name} is required when SCAN_RUNTIME_WAKE_ENABLED=true`);
    }
  }
  return config;
}

export async function ensureScanRuntimeReady(
  emitActivity: (activity: RuntimeActivity) => Promise<void>,
  config = readScanRuntimeConfig(),
): Promise<void> {
  if (!config.enabled) return;
  if (await isRuntimeHealthy(config)) {
    await emitActivity(runtimeActivity('runtime_ready', 'ready', 'Scan runtime is ready.'));
    return;
  }
  await emitActivity(runtimeActivity('runtime_starting', 'queued', 'Scan runtime is sleeping; starting VM runtime.'));
  await startComputeInstance(config);
  const deadline = Date.now() + config.wakeTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(config.pollIntervalMs);
    if (await isRuntimeHealthy(config)) {
      await emitActivity(runtimeActivity('runtime_ready', 'ready', 'Scan runtime is ready.'));
      return;
    }
  }
  await emitActivity(runtimeActivity('runtime_unavailable', 'failed', 'Scan runtime did not become healthy before timeout.', 'high'));
  throw new ScanRuntimeUnavailableError('Scan runtime did not become healthy before timeout');
}

async function isRuntimeHealthy(config: ScanRuntimeConfig): Promise<boolean> {
  if (!config.healthUrl) return false;
  try {
    const response = await fetchWithTimeout(config.healthUrl, config.requestTimeoutMs, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return false;
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

async function startComputeInstance(config: ScanRuntimeConfig): Promise<void> {
  const token = await metadataAccessToken(config.requestTimeoutMs);
  const url = `https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(
    config.project!,
  )}/zones/${encodeURIComponent(config.zone!)}/instances/${encodeURIComponent(config.instance!)}/start`;
  const response = await fetchWithTimeout(url, config.requestTimeoutMs, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!response.ok && response.status !== 409) {
    throw new ScanRuntimeUnavailableError(`Unable to start scan runtime VM: HTTP_${response.status}`);
  }
}

async function metadataAccessToken(timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    timeoutMs,
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  if (!response.ok) throw new ScanRuntimeUnavailableError(`Unable to get runtime wake token: HTTP_${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new ScanRuntimeUnavailableError('Runtime wake token response did not include access_token');
  return body.access_token;
}

async function fetchWithTimeout(url: string, timeoutMs: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function runtimeActivity(eventType: string, status: string, summary: string, severity?: string): RuntimeActivity {
  return {
    eventType,
    titleKey: `activity.${eventType}.title`,
    bodyKey: `activity.${eventType}.body`,
    bodyParams: { summary },
    status,
    ...(severity ? { severity } : {}),
  };
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

function cleanValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanUrl(value: string | undefined): string | null {
  const trimmed = cleanValue(value);
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
