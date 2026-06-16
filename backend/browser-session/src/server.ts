import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import httpProxy from 'http-proxy';
import { BrowserSessionManager, attachNoVncProxy } from './session-manager.js';
import { PlaywrightXvfbRuntime } from './playwright-runtime.js';

const port = Number(process.env.BROWSER_SESSION_PORT || 4700);
const manager = new BrowserSessionManager(new PlaywrightXvfbRuntime());
const app = express();
const proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true });

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'browser-session' });
});

app.post('/sessions', async (req, res, next) => {
  try {
    const result = await manager.create({
      sessionId: String(req.body?.sessionId ?? ''),
      loginUrl: String(req.body?.loginUrl ?? ''),
      ttlSeconds: Number(req.body?.ttlSeconds ?? 900),
      allowedHosts: Array.isArray(req.body?.allowedHosts) ? req.body.allowedHosts : [],
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/sessions/:sessionId', (req, res, next) => {
  try {
    const session = manager.get(req.params.sessionId!);
    if (!session) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Browser session not found' } });
      return;
    }
    res.json({
      sessionId: session.sessionId,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/sessions/:sessionId/storage-state', async (req, res, next) => {
  try {
    res.json(await manager.storageState(req.params.sessionId!));
    await manager.cancel(req.params.sessionId!, 'cancelled');
  } catch (error) {
    next(error);
  }
});

app.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    await manager.cancel(req.params.sessionId!, 'cancelled');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use('/sessions/:sessionId/stream', (req, res, next) => {
  try {
    const target = manager.streamTarget(req.params.sessionId!);
    proxy.web(req, res, { target }, (error) => next(error));
  } catch (error) {
    next(error);
  }
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Browser session error';
  const status = /not found/i.test(message) ? 404 : /outside|invalid|expired|already/i.test(message) ? 400 : 503;
  res.status(status).json({ error: { code: status === 503 ? 'RUNTIME_UNAVAILABLE' : 'INVALID_INPUT', message } });
});

const server = http.createServer(app);
attachNoVncProxy(server, manager);
server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'browser_session_listen', port }));
});
