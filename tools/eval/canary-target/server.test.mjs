import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanaryServer } from './server.mjs';

async function withServer(fixed, run) {
  const server = createCanaryServer({ userAPassword: 'a-test-secret', userBPassword: 'b-test-secret', fixed });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function login(base, username, password) {
  const response = await fetch(`${base}/login`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  assert.equal(response.status, 303);
  return response.headers.get('set-cookie').split(';')[0];
}

test('vulnerable route is positive; fixed and own routes are controls', async () => {
  await withServer(false, async (base) => {
    const manifest = await fetch(`${base}/openhunter-canary/manifest.json`).then((res) => res.json());
    assert.equal(manifest.scenario, 'object_ownership');
    const a = await login(base, 'user-a', 'a-test-secret');
    const b = await login(base, 'user-b', 'b-test-secret');
    const status = (path, cookie) => fetch(`${base}${path}`, { headers: { cookie } }).then((res) => res.status);
    assert.equal(await status(manifest.userAOwnPath, a), 200);
    assert.equal(await status(manifest.userBOwnPath, b), 200);
    assert.equal(await status(manifest.userBOwnPath, a), 403);
    assert.equal(await status(manifest.vulnerablePath, a), 200);
    assert.equal(await status(manifest.fixedPath, a), 403);
    assert.equal(await status(manifest.fixedPath, b), 200);
  });
});

test('remediation blocks cross-user access without breaking own-account controls', async () => {
  await withServer(true, async (base) => {
    const a = await login(base, 'user-a', 'a-test-secret');
    const b = await login(base, 'user-b', 'b-test-secret');
    assert.equal((await fetch(`${base}/openhunter-canary/objects/vulnerable/user-b-object`, { headers: { cookie: a } })).status, 403);
    assert.equal((await fetch(`${base}/openhunter-canary/objects/vulnerable/user-b-object`, { headers: { cookie: b } })).status, 200);
  });
});

test('unauthenticated requests and wrong passwords never prove access', async () => {
  await withServer(false, async (base) => {
    assert.equal((await fetch(`${base}/openhunter-canary/objects/vulnerable/user-b-object`)).status, 401);
    const rejected = await fetch(`${base}/login`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'user-a', password: 'wrong' }),
    });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get('set-cookie'), null);
  });
});
