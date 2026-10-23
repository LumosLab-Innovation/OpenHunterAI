import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// MOCK / DEMO DATA: transport and user consent checks, never pentest evidence.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const base = new URL(process.env.QA_BASE_URL ?? 'http://127.0.0.1:3017');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Fixtures are local-only');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const output = join(tmpdir(), 'openhunter-workspace-qa');
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  const created = [];
  const decisions = [];
  let pending = ['approve', 'deny'];
  let offline = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const data = route.request().postDataJSON();
    if (path === '/v1/auth/me') return offline ? route.abort() : route.fulfill({ json: { user: { id: 'mock-operator', email: 'demo@example.test' } } });
    if (path === '/v1/projects') return route.fulfill({ json: { projects: [{ id: 'project-1', name: 'MOCK / DEMO DATA' }] } });
    if (path === '/v1/reports') return route.fulfill({ json: { reports: [] } });
    if (path === '/v1/llm-routes') return route.fulfill({ json: { preview: [], probedAt: null, completion: 'MOCK / DEMO DATA' } });
    if (path.endsWith('/test-accounts')) return route.fulfill({ json: { testAccounts: [] } });
    if (path === '/v1/scans/preflight') return route.fulfill({ json: { preflight: {
      ok: true, profile: data.profile, resolvedScope: { targetUrl: data.targetUrl, allowedHosts: ['example.test'], allowedPaths: data.scope.allowedPaths, excludedPaths: data.scope.excludedPaths },
      runtimes: [{ worker: 'Browser', installed: true, configured: true, reachable: true, executable: true }, { worker: 'Nuclei', installed: false, configured: false, reachable: false, executable: false, reason: 'MOCK missing worker' }],
      coverageGaps: ['nuclei:TOOL_UNAVAILABLE'],
    } } });
    if (path === '/v1/scans' && route.request().method() === 'POST') { created.push(data); return route.fulfill({ json: { scan: { id: 'scan-1' } } }); }
    if (path === '/v1/scans') return route.fulfill({ json: { scans: created.length ? [{ id: 'scan-1', projectId: 'project-1', state: 'awaiting_approval', target: 'https://example.test/app' }] : [] } });
    if (path.endsWith('/live-events')) return route.fulfill({ contentType: 'text/event-stream', body: `event: scan_snapshot\ndata: ${JSON.stringify({
      scan: { id: 'scan-1', state: 'awaiting_approval', target: 'https://example.test/app', profile: 'standard' },
      workers: [{ code: 'browser', title: 'Browser', state: 'succeeded', summary: 'MOCK observation only' }],
      activity: [{ id: 'event-1', at: '2026-10-24T00:00:00Z', title: 'MOCK completed observation', body: 'Sanitized fixture', sanitized: true }],
      findingsPreview: [], findingsSummary: { validatedFindings: [{ id: 'finding-1', title: 'MOCK validated finding', severity: 'medium' }], candidates: [{ id: 'candidate-1', title: 'MOCK candidate only', severity: 'low', validationState: 'needs_more_evidence' }], hardeningCoverage: [] },
      reportPreview: {},
    })}\n\n` });
    if (path === '/v1/approvals') return route.fulfill({ json: { approvals: pending.map((id) => ({ id, scanJobId: 'scan-1', action: `MOCK ${id}`, target: 'https://example.test/app', willNotPerform: ['Delete data'], residualRisk: 'MOCK test data may change', expiresAt: '2099-01-01T00:00:00Z' })) } });
    if (path.endsWith('/decision')) { decisions.push({ path, ...data }); pending = pending.filter((id) => !path.includes(`/${id}/`)); return route.fulfill({ json: { approval: { state: data.decision } } }); }
    if (path === '/v1/findings/finding-1') return route.fulfill({ json: { finding: { id: 'finding-1', title: 'MOCK validated finding', severity: 'medium', affectedAsset: 'https://example.test/app', description: 'MOCK / DEMO DATA', status: 'open', retestScenario: { title: 'MOCK replay' } } } });
    if (path.endsWith('/retest')) return route.fulfill({ status: 400, json: { error: { code: 'RETEST_UNSUPPORTED', message: 'No retest was run or counted.' } } });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'MOCK optional service unavailable' } } });
  });
  await page.goto(base.origin);
  await page.getByRole('heading', { name: 'Pentest workspace' }).waitFor();
  assert.equal(await page.getByLabel('Profile', { exact: true }).inputValue(), 'standard');
  await page.getByLabel('Public HTTPS URL', { exact: true }).fill('https://example.test/app');
  assert.equal(await page.getByRole('button', { name: 'Check plan', exact: true }).isDisabled(), true);
  await page.getByLabel(/I confirm I am authorized to test/).check();
  await page.getByRole('button', { name: 'Check plan', exact: true }).click();
  await page.getByText('Plan ready for review · standard', { exact: true }).waitFor();
  assert.equal(created.length, 0, 'Preflight cannot create a scan');
  await page.getByRole('button', { name: 'Run scan', exact: true }).click();
  await page.getByText('Acknowledge the coverage gaps before running.', { exact: true }).waitFor();
  assert.equal(created.length, 0, 'Missing coverage consent cannot create a scan');
  await page.getByLabel(/I accept these gaps/).check();
  await page.getByRole('button', { name: 'Run scan', exact: true }).click();
  await page.getByRole('heading', { name: 'Selected scan', exact: true }).waitFor();
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].scope.allowedPaths, ['/app']);
  assert.deepEqual(created[0].acceptedCoverageGaps, ['nuclei:TOOL_UNAVAILABLE']);
  assert.equal(created[0].schemaVersion, 'scan_request_v2');
  assert.equal(created[0].authorityConfirmed, true);
  assert.equal(created[0].profile, 'standard');
  assert(new URL(page.url()).searchParams.get('scan') === 'scan-1');
  await page.getByRole('heading', { name: 'Candidates awaiting independent evidence (1)' }).waitFor();
  await page.getByText('MOCK candidate only', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'MOCK candidate only', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Approve action', exact: true }).first().click();
  await page.getByRole('button', { name: 'Deny action', exact: true }).click();
  assert.deepEqual(decisions.map((item) => item.decision), ['approved', 'denied']);
  await page.getByRole('button', { name: 'MOCK validated finding', exact: true }).click();
  await page.getByRole('button', { name: 'Request manual retest', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Request manual retest', exact: true }).isDisabled(), true);
  await page.getByLabel(/I authorize this finding-specific retest/).check();
  await page.getByRole('button', { name: 'Request manual retest', exact: true }).click();
  await page.getByText('RETEST_UNSUPPORTED: No retest was run or counted.', { exact: true }).waitFor();
  await page.getByLabel('Profile', { exact: true }).selectOption('deep');
  assert.equal(await page.getByLabel(/I confirm I am authorized to test/).isChecked(), false);
  await page.getByLabel(/I confirm I am authorized to test/).check();
  assert.equal(await page.getByRole('button', { name: 'Check plan', exact: true }).isDisabled(), true);
  await page.getByLabel(/This is staging\/dev\/test I control/).check();
  assert.equal(await page.getByRole('button', { name: 'Check plan', exact: true }).isEnabled(), true);
  await page.getByLabel('Public HTTPS URL', { exact: true }).fill('https://example.test/other');
  assert.equal(await page.getByLabel(/I confirm I am authorized to test/).isChecked(), false);
  assert.equal(await page.getByLabel(/This is staging\/dev\/test I control/).isChecked(), false);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, `workspace-${width}.png`), fullPage: true });
  }
  await page.goto(`${base.origin}/projects/project-1`);
  await page.getByRole('heading', { name: 'Pentest workspace' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(new URL(page.url()).searchParams.get('project'), 'project-1');
  offline = true;
  await page.reload();
  await page.getByRole('heading', { name: 'Local engine unavailable' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(`PASS: single page; authority/path/preflight/gap/Deep gates; approvals; honest unsupported retest; legacy links; desktop/mobile; offline state. Screenshots: ${output}`);
} finally { await browser.close(); }
