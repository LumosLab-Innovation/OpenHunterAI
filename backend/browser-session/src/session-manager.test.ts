import { describe, expect, it, vi } from 'vitest';
import { BrowserSessionManager, safeSessionId, streamUrlForSession, type BrowserRuntime } from './session-manager.js';

describe('browser-session manager', () => {
  it('rejects unsafe session ids before spawning a browser', () => {
    expect(() => safeSessionId('cm123abc')).not.toThrow();
    expect(() => safeSessionId('../secret')).toThrow(/Invalid session id/);
    expect(() => safeSessionId('abc/def')).toThrow(/Invalid session id/);
  });

  it('builds a noVNC URL whose websocket path stays behind the same proxy', () => {
    expect(streamUrlForSession('sess_1', '/v1/login-sessions')).toBe(
      '/v1/login-sessions/sess_1/stream/vnc.html?autoconnect=1&resize=scale&path=v1%2Flogin-sessions%2Fsess_1%2Fstream%2Fwebsockify',
    );
  });

  it('prevents duplicate live sessions and cleans up on cancel', async () => {
    const dispose = vi.fn();
    const runtime: BrowserRuntime = {
      start: vi.fn(async () => ({
        streamBaseUrl: 'http://127.0.0.1:6901',
        dispose,
        finalUrl: async () => 'https://example.com/dashboard',
        storageState: async () => ({ cookies: [], origins: [] }),
      })),
    };
    const manager = new BrowserSessionManager(runtime, { now: () => new Date('2026-06-16T00:00:00Z') });

    await manager.create({ sessionId: 'sess_1', loginUrl: 'https://example.com/login', ttlSeconds: 900 });
    await expect(manager.create({ sessionId: 'sess_1', loginUrl: 'https://example.com/login', ttlSeconds: 900 })).rejects.toThrow(
      /already exists/,
    );

    await manager.cancel('sess_1');
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(manager.storageState('sess_1')).rejects.toThrow(/not found/);
  });
});
