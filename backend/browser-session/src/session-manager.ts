import type { Server } from 'node:http';

export interface CreateBrowserSessionInput {
  sessionId: string;
  loginUrl: string;
  ttlSeconds: number;
  allowedHosts?: string[];
}

export interface RuntimeHandle {
  streamBaseUrl: string;
  finalUrl(): Promise<string>;
  storageState(): Promise<unknown>;
  dispose(): Promise<void>;
}

export interface BrowserRuntime {
  start(input: CreateBrowserSessionInput): Promise<RuntimeHandle>;
}

export interface BrowserSessionRecord {
  sessionId: string;
  loginUrl: string;
  allowedHosts: string[];
  expiresAt: Date;
  status: 'active' | 'cancelled' | 'expired';
}

interface ManagedSession extends BrowserSessionRecord {
  handle: RuntimeHandle;
  timeout: NodeJS.Timeout;
}

interface BrowserSessionManagerOptions {
  now?: () => Date;
}

export class BrowserSessionManager {
  private readonly sessions = new Map<string, ManagedSession>();

  constructor(
    private readonly runtime: BrowserRuntime,
    private readonly options: BrowserSessionManagerOptions = {},
  ) {}

  async create(input: CreateBrowserSessionInput): Promise<{ sessionId: string; streamUrl: string; expiresAt: string }> {
    const sessionId = safeSessionId(input.sessionId);
    if (this.sessions.has(sessionId)) {
      throw new Error('Browser session already exists');
    }
    const ttlSeconds = Math.max(30, Math.min(Math.floor(input.ttlSeconds || 900), 900));
    const expiresAt = new Date(this.now().getTime() + ttlSeconds * 1000);
    const handle = await this.runtime.start({
      ...input,
      sessionId,
      ttlSeconds,
      allowedHosts: sanitizeAllowedHosts(input.allowedHosts),
    });
    const timeout = setTimeout(() => {
      void this.cancel(sessionId, 'expired');
    }, ttlSeconds * 1000);
    timeout.unref?.();
    this.sessions.set(sessionId, {
      sessionId,
      loginUrl: input.loginUrl,
      allowedHosts: sanitizeAllowedHosts(input.allowedHosts),
      expiresAt,
      status: 'active',
      handle,
      timeout,
    });
    return {
      sessionId,
      streamUrl: streamUrlForSession(sessionId, '/sessions'),
      expiresAt: expiresAt.toISOString(),
    };
  }

  get(sessionId: string): BrowserSessionRecord | null {
    const session = this.sessions.get(safeSessionId(sessionId));
    if (!session) return null;
    return {
      sessionId: session.sessionId,
      loginUrl: session.loginUrl,
      allowedHosts: session.allowedHosts,
      expiresAt: session.expiresAt,
      status: session.expiresAt.getTime() > this.now().getTime() ? session.status : 'expired',
    };
  }

  async storageState(sessionId: string): Promise<{ finalUrl: string; storageState: unknown }> {
    const session = this.requireSession(sessionId);
    return {
      finalUrl: await session.handle.finalUrl(),
      storageState: await session.handle.storageState(),
    };
  }

  streamTarget(sessionId: string): string {
    const session = this.requireSession(sessionId);
    return session.handle.streamBaseUrl;
  }

  async cancel(sessionId: string, status: 'cancelled' | 'expired' = 'cancelled'): Promise<void> {
    const safeId = safeSessionId(sessionId);
    const session = this.sessions.get(safeId);
    if (!session) return;
    this.sessions.delete(safeId);
    clearTimeout(session.timeout);
    session.status = status;
    await session.handle.dispose();
  }

  private requireSession(sessionId: string): ManagedSession {
    const safeId = safeSessionId(sessionId);
    const session = this.sessions.get(safeId);
    if (!session) throw new Error('Browser session not found');
    if (session.expiresAt.getTime() <= this.now().getTime()) {
      void this.cancel(safeId, 'expired');
      throw new Error('Browser session expired');
    }
    return session;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}

export function safeSessionId(sessionId: string): string {
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(sessionId)) {
    throw new Error('Invalid session id');
  }
  return sessionId;
}

export function streamUrlForSession(sessionId: string, prefix: string): string {
  const safeId = safeSessionId(sessionId);
  const trimmedPrefix = prefix.replace(/\/+$/, '');
  const wsPathPrefix = trimmedPrefix.replace(/^\/+/, '');
  const path = encodeURIComponent(`${wsPathPrefix}/${safeId}/stream/websockify`);
  return `${trimmedPrefix}/${safeId}/stream/vnc.html?autoconnect=1&resize=scale&path=${path}`;
}

export function attachNoVncProxy(server: Server, manager: BrowserSessionManager) {
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const match = path.match(/^\/sessions\/([^/]+)\/stream\/websockify$/);
    if (!match) return;
    import('http-proxy')
      .then(({ default: httpProxy }) => {
        const target = manager.streamTarget(match[1]!);
        const proxy = httpProxy.createProxyServer({ target, ws: true, changeOrigin: true });
        req.url = '/websockify';
        proxy.ws(req, socket, head);
      })
      .catch(() => socket.destroy());
  });
}

function sanitizeAllowedHosts(hosts: string[] | undefined): string[] {
  return Array.isArray(hosts)
    ? hosts.map((host) => host.trim().toLowerCase()).filter(Boolean).slice(0, 50)
    : [];
}
