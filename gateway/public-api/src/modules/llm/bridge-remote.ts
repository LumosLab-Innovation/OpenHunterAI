import type { CliProbeResult, CodingCliName } from '@x-hunter/shared';

export interface BridgeCapabilities {
  ready: boolean;
  completion: Partial<Record<CodingCliName, { state?: string; reason?: string }>>;
}

export async function readBridgeCapabilities(fetchImpl: typeof fetch = fetch): Promise<BridgeCapabilities> {
  const baseUrl = process.env.OPENHUNTER_LLM_BRIDGE_URL;
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!baseUrl || !token) return { ready: false, completion: {} };
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/capabilities`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return { ready: false, completion: {} };
    const body = await response.json() as { completion?: BridgeCapabilities['completion'] };
    return { ready: true, completion: body.completion ?? {} };
  } catch {
    return { ready: false, completion: {} };
  }
}

export function applyBridgeCompletion(
  probes: Partial<Record<CodingCliName, CliProbeResult>>,
  bridge: BridgeCapabilities,
): Partial<Record<CodingCliName, CliProbeResult>> {
  const next: Partial<Record<CodingCliName, CliProbeResult>> = { ...probes };
  for (const [cli, capability] of Object.entries(bridge.completion) as Array<[CodingCliName, { state?: string; reason?: string }]>) {
    const current = next[cli];
    const completion = capability.state === 'locked' ? 'locked' : 'unavailable';
    next[cli] = {
      cli,
      installed: current?.installed ?? false,
      authenticated: current?.authenticated ?? false,
      supportedModels: current?.supportedModels ?? [],
      ...(current?.version ? { version: current.version } : {}),
      ...(current?.errorCode ? { errorCode: current.errorCode } : {}),
      completion,
      ...(completion === 'locked' ? {} : { completionReason: capability.reason ?? 'CLI_COMPLETION_UNAVAILABLE' }),
    };
  }
  return next;
}

export async function probeViaBridge(fetchImpl: typeof fetch = fetch): Promise<Partial<Record<CodingCliName, CliProbeResult>> | null> {
  const baseUrl = process.env.OPENHUNTER_LLM_BRIDGE_URL;
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!baseUrl || !token) return null;
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/probe`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('LLM bridge probe failed');
  const body = await response.json() as { probes?: Partial<Record<CodingCliName, CliProbeResult>> };
  return body.probes ?? {};
}
