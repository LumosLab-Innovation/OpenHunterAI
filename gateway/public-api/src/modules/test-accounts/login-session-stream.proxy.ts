import type { Request, Response, NextFunction } from 'express';
import type { Server } from 'node:http';
import httpProxy from 'http-proxy';
import { GuardrailError } from '@x-hunter/shared';
import { readSessionFromCookieHeaderAsync } from '../../middlewares/auth.middleware.js';
import { browserSessionRuntimeBaseUrl, LoginSessionsService } from './login-sessions.service.js';

const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });
const service = new LoginSessionsService();

export async function proxyLoginSessionStream(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw new GuardrailError('INVALID_INPUT', 'Sign in required');
    const baseUrl = browserSessionRuntimeBaseUrl();
    if (!baseUrl) throw new GuardrailError('TOOL_UNAVAILABLE', 'Browser session runtime is unavailable');
    const sessionId = req.params.sessionId!;
    await service.assertInteractiveSessionAccess(sessionId, user.orgId, user.userId);
    req.url = `/sessions/${encodeURIComponent(sessionId)}/stream${req.url === '/' ? '/vnc.html' : req.url}`;
    proxy.web(req, res, { target: baseUrl }, (error) => next(error));
  } catch (error) {
    next(error);
  }
}

export function attachLoginSessionStreamProxy(server: Server) {
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const match = path.match(/^\/v1\/login-sessions\/([^/]+)\/stream\/websockify$/);
    if (!match) return;

    void (async () => {
      try {
        const user = await readSessionFromCookieHeaderAsync(req.headers.cookie);
        const baseUrl = browserSessionRuntimeBaseUrl();
        if (!user || !baseUrl) {
          socket.destroy();
          return;
        }
        const sessionId = decodeURIComponent(match[1]!);
        await service.assertInteractiveSessionAccess(sessionId, user.orgId, user.userId);
        req.url = `/sessions/${encodeURIComponent(sessionId)}/stream/websockify`;
        proxy.ws(req, socket, head, { target: baseUrl });
      } catch {
        socket.destroy();
      }
    })();
  });
}
