#!/usr/bin/env node
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60_000;
const MANIFEST = Object.freeze({
  scenario: 'object_ownership',
  vulnerablePath: '/openhunter-canary/objects/vulnerable/user-b-object',
  fixedPath: '/openhunter-canary/objects/fixed/user-b-object',
  userAOwnPath: '/openhunter-canary/objects/own/user-a-object',
  userBOwnPath: '/openhunter-canary/objects/own/user-b-object',
});

export function createCanaryServer({ userAPassword, userBPassword, fixed = false, secureCookie = false }) {
  if (!userAPassword || !userBPassword || userAPassword === userBPassword) {
    throw new Error('Two distinct test-account passwords are required');
  }
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://canary.invalid').pathname;
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');

    if (req.method === 'GET' && path === '/health') return json(res, 200, { ok: true, fixture: 'object-ownership-canary' });
    if (req.method === 'GET' && path === '/openhunter-canary/manifest.json') return json(res, 200, MANIFEST);
    if (req.method === 'GET' && path === '/login') return html(res, 200, '<form method="post" action="/login"><input name="username" autocomplete="username"><input name="password" type="password" autocomplete="current-password"><button type="submit">Log in</button></form>');
    if (req.method === 'POST' && path === '/login') {
      const body = await readBoundedBody(req, 1024);
      if (body === null) return json(res, 413, { error: 'request_too_large' });
      const form = new URLSearchParams(body);
      const username = form.get('username') ?? '';
      const password = form.get('password') ?? '';
      const expected = username === 'user-a' ? userAPassword : username === 'user-b' ? userBPassword : '';
      if (!expected || !safeEqual(password, expected)) return json(res, 401, { error: 'invalid_credentials' });
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
      res.writeHead(303, {
        location: '/',
        'set-cookie': `canary_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800${secureCookie ? '; Secure' : ''}`,
      });
      return res.end();
    }

    const actor = sessionUser(req.headers.cookie);
    if (req.method === 'GET' && path === '/') return html(res, 200, actor ? `<p>Signed in as ${actor}</p>` : '<a href="/login">Log in</a>');
    if (req.method !== 'GET' || !path.startsWith('/openhunter-canary/objects/')) return json(res, 404, { error: 'not_found' });
    if (!actor) return json(res, 401, { error: 'login_required' });

    if (path === MANIFEST.userAOwnPath) return actor === 'user-a' ? object(res, 'user-a') : json(res, 403, { error: 'forbidden' });
    if (path === MANIFEST.userBOwnPath || path === MANIFEST.fixedPath) return actor === 'user-b' ? object(res, 'user-b') : json(res, 403, { error: 'forbidden' });
    if (path === MANIFEST.vulnerablePath) {
      // Intentional positive fixture: when fixed=false, User A can read User B's
      // synthetic object. Never deploy this outside an explicitly authorized
      // staging environment.
      return actor === 'user-b' || (!fixed && actor === 'user-a') ? object(res, 'user-b') : json(res, 403, { error: 'forbidden' });
    }
    return json(res, 404, { error: 'not_found' });
  });
}

function sessionUser(cookieHeader) {
  const token = /(?:^|;\s*)canary_session=([a-f0-9]{64})(?:;|$)/.exec(cookieHeader ?? '')?.[1];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.username;
}

function safeEqual(actual, expected) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBoundedBody(req, maxBytes) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString('utf8');
    if (Buffer.byteLength(body) > maxBytes) return null;
  }
  return body;
}

function object(res, owner) {
  return json(res, 200, { id: `${owner}-object`, owner, marker: 'synthetic-canary-only' });
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function html(res, status, value) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="en"><title>OpenHunter canary</title><body>${value}</body></html>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.CANARY_BIND_HOST || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1' && process.env.CANARY_PUBLIC_STAGING !== '1') {
    throw new Error('Non-loopback binding requires CANARY_PUBLIC_STAGING=1');
  }
  const server = createCanaryServer({
    userAPassword: process.env.CANARY_USER_A_PASSWORD,
    userBPassword: process.env.CANARY_USER_B_PASSWORD,
    fixed: process.env.CANARY_FIX_VULNERABLE === '1',
    secureCookie: process.env.CANARY_COOKIE_SECURE === '1',
  });
  server.listen(Number(process.env.PORT || 8080), host, () => {
    console.log(`OpenHunter synthetic canary listening on ${host}:${server.address().port}; fixed=${process.env.CANARY_FIX_VULNERABLE === '1'}`);
  });
}
