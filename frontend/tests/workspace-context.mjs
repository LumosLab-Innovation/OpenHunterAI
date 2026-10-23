import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// MOCK / DEMO DATA: delayed local API responses, no real credentials or targets.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const base = new URL(process.env.QA_BASE_URL ?? 'http://127.0.0.1:3017');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Fixtures are local-only');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  let delayedPreflight;
  let delayedAccount;
  let delayedLogin;
  let deferPreflight = false;
  let deferAccount = false;
  let deferLogin = false;
  const scanCreates = [];
  const cancelled = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (path === '/v1/auth/me') return route.fulfill({ json: { user: { id: 'mock', email: 'mock@example.test' } } });
    if (path === '/v1/projects') return route.fulfill({ json: { projects: [{ id: 'p1', name: 'MOCK project one' }, { id: 'p2', name: 'MOCK project two' }] } });
    if (path === '/v1/reports') return route.fulfill({ json: { reports: [] } });
    if (path === '/v1/llm-routes') return route.fulfill({ json: { preview: [] } });
    if (path === '/v1/scans' && route.request().method() === 'POST') { scanCreates.push(route.request().postDataJSON()); return route.fulfill({ json: { scan: { id: 'unwanted-scan' } } }); }
    if (path === '/v1/scans') return route.fulfill({ json: { scans: [{ id: 'old-p2-scan', projectId: 'p2', target: 'MOCK project two scan', state: 'completed' }] } });
    if (path === '/v1/scans/preflight') {
      const result = { preflight: { ok: true, coverageGaps: [], runtimes: [] } };
      if (deferPreflight) { delayedPreflight = () => route.fulfill({ json: result }); return; }
      return route.fulfill({ json: result });
    }
    if (/\/test-accounts$/.test(path)) {
      const project = path.includes('/p1/') ? 'p1' : 'p2';
      if (route.request().method() === 'POST' && deferAccount) { delayedAccount = () => route.fulfill({ json: { testAccount: { id: 'late-old-account' } } }); return; }
      return route.fulfill({ json: { testAccounts: [{ id: `${project}-account`, label: `MOCK ${project} account`, loginUrl: 'https://example.test/login' }] } });
    }
    if (/\/test-accounts\/[^/]+\/login-sessions$/.test(path)) {
      const payload = { loginSession: { id: deferLogin ? 'late-login' : 'active-login', loginUrl: 'https://example.test/login', runtimeStatus: 'unavailable', status: 'pending', expiresAt: '2099-01-01T00:00:00Z' } };
      if (deferLogin) { delayedLogin = () => route.fulfill({ json: payload }); return; }
      return route.fulfill({ json: payload });
    }
    if (/\/login-sessions\/[^/]+\/cancel$/.test(path)) { cancelled.push(path); return route.fulfill({ json: {} }); }
    if (path === '/v1/approvals') return route.fulfill({ json: { approvals: [] } });
    if (path.endsWith('/live-events')) return route.fulfill({ contentType: 'text/event-stream', body: '' });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'MOCK optional service unavailable' } } });
  });
  const project = () => page.getByLabel('Project (optional)', { exact: true });
  async function settle() { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
  async function openSettings() {
    const summary = page.locator('summary').filter({ hasText: 'Access and model settings' });
    if (!(await summary.evaluate((element) => element.parentElement.open))) await summary.click();
  }
  await page.goto(`${base.origin}/?project=p1&settings=1`);
  await page.getByText('MOCK p1 account', { exact: true }).waitFor();
  await page.getByLabel('Username (optional)', { exact: true }).fill('synthetic@example.test');
  await page.getByLabel('Password (optional)', { exact: true }).fill('MOCK-ONLY-NOT-A-CREDENTIAL');
  await project().selectOption('p2');
  await page.getByText('MOCK p2 account', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Username (optional)', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Password (optional)', { exact: true }).inputValue(), '');

  deferAccount = true;
  await page.getByLabel('Account label', { exact: true }).fill('MOCK late account');
  await page.getByLabel('Login URL', { exact: true }).fill('https://example.test/login');
  const oldAccount = page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/p2/test-accounts'));
  await page.getByRole('button', { name: 'Save test account', exact: true }).click();
  await oldAccount;
  await project().selectOption('p1');
  await page.getByText('MOCK p1 account', { exact: true }).waitFor();
  const oldAccountResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/p2/test-accounts'));
  await delayedAccount(); await oldAccountResponse; await settle();
  assert.equal(await page.getByText('MOCK p2 account', { exact: true }).count(), 0);
  assert.equal(await page.getByText('MOCK p1 account', { exact: true }).count(), 1);

  deferLogin = true;
  const oldLogin = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/login-sessions'));
  await page.getByRole('button', { name: 'Browser login', exact: true }).click(); await oldLogin;
  await project().selectOption('p2');
  const lateCancellation = page.waitForRequest((request) => request.url().endsWith('/late-login/cancel'));
  await delayedLogin(); await lateCancellation;
  assert.equal(await page.getByRole('button', { name: 'Cancel login', exact: true }).count(), 0);
  deferLogin = false;
  await page.getByRole('button', { name: 'Browser login', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel login', exact: true }).waitFor();
  const activeCancellation = page.waitForRequest((request) => request.url().endsWith('/active-login/cancel'));
  await project().selectOption('p1'); await activeCancellation;
  assert.equal(await page.getByRole('button', { name: 'Cancel login', exact: true }).count(), 0);
  assert.equal(cancelled.length, 2);

  await page.getByLabel('Public HTTPS URL', { exact: true }).fill('https://example.test/app');
  await page.getByLabel(/I confirm I am authorized to test/).check();
  await page.getByRole('button', { name: 'Check plan', exact: true }).click();
  await page.getByRole('button', { name: 'Run scan', exact: true }).waitFor();
  deferPreflight = true;
  const oldPlan = page.waitForRequest((request) => request.url().endsWith('/scans/preflight'));
  await page.getByRole('button', { name: 'Run scan', exact: true }).click(); await oldPlan;
  await page.getByLabel('Selected scan', { exact: true }).selectOption('old-p2-scan');
  await page.getByLabel('Public HTTPS URL', { exact: true }).fill('https://example.test/changed');
  const oldPlanResponse = page.waitForResponse((response) => response.url().endsWith('/scans/preflight'));
  await delayedPreflight(); await oldPlanResponse; await settle();
  assert.equal(scanCreates.length, 0, 'A changed project/input must prevent old consent from creating a scan');
  assert.equal(await page.getByLabel(/I confirm I am authorized to test/).isChecked(), false);
  assert.equal(await page.getByRole('button', { name: 'Run scan', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Check plan', exact: true }).isDisabled(), true);
  assert.equal(new URL(page.url()).searchParams.get('project'), 'p2');
  assert.equal(new URL(page.url()).searchParams.get('scan'), 'old-p2-scan');
  assert.deepEqual(errors, []);
  console.log('PASS: project switch resets credential form; stale account writes cannot replace current rows; late and active old login sessions cancelled; delayed preflight cannot create after project/input consent invalidation.');
} finally { await browser.close(); }
