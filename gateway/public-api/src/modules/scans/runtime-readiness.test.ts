import { afterEach, describe, expect, it, vi } from 'vitest';
import { probePlannedRuntimes, probeRuntime } from './runtime-readiness.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('runtime readiness', () => {
  it('marks a reachable but unavailable runtime as a gap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, runtime_available: false }), { status: 503 })));
    expect(await probeRuntime('strix')).toMatchObject({
      worker: 'strix', installed: false, reachable: true, executable: false, reason: 'RUNTIME_NOT_INSTALLED',
    });
  });

  it('marks an unreachable runtime as a gap without claiming it ran', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await probeRuntime('nuclei')).toMatchObject({
      worker: 'nuclei', installed: false, reachable: false, executable: false, reason: 'HEALTH_UNREACHABLE',
    });
  });

  it('exposes the Codex reasoning lane without claiming the Strix runtime exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, runtime_available: false, runtime_configured: false, reasoning_available: true, execution_mode: 'codex_reasoning',
    }))));
    expect(await probeRuntime('strix')).toMatchObject({
      worker: 'strix', installed: true, configured: true, executable: true, reasoningOnly: true, nativeRuntime: false,
    });
  });

  it('probes only planned workers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, runtime_available: true })));
    vi.stubGlobal('fetch', fetcher);
    expect((await probePlannedRuntimes(['browser', 'nuclei'])).map((runtime) => runtime.worker)).toEqual(['browser', 'nuclei']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
