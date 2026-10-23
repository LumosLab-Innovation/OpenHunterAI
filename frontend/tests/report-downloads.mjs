import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Local UI transport check. Actual DOCX/CSV/JSON generation is tested in public-api.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ?? 'playwright');
const base = new URL(process.env.QA_BASE_URL ?? 'http://127.0.0.1:3017');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Fixtures are local-only');
const output = join(tmpdir(), 'openhunter-report-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let state = 'final';
  let rejectDownload = false;
  const requests = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: {
      user: { id: 'qa', email: 'qa@example.test', displayName: 'Local QA', orgName: 'MOCK / DEMO DATA' },
    } });
    if (url.pathname.endsWith('/export')) {
      requests.push(url.search);
      return route.fulfill(rejectDownload
        ? { status: 400, json: { error: { message: 'Report is still being prepared' } } }
        : { contentType: 'application/octet-stream', body: 'MOCK / DEMO DATA: download transport only' });
    }
    if (url.pathname.endsWith('/reports/qa-report')) return route.fulfill({ json: { report: {
      snapshot: { id: 'qa-report', version: 1, state, generatedAt: '2026-09-07T00:00:00.000Z', content: {
        ownerSummary: { headline: 'MOCK / DEMO DATA: report export QA', riskLevel: 'none',
          topRiskOrOutcome: 'No validated Critical/High findings in the tested scope.',
          businessImpact: 'Local UI fixture only.', recommendedNextAction: 'Review coverage and limitations.' },
        findings: [], coverage: { workersRun: ['Browser', 'R', 'Z', 'N', 'O', 'S'], huntersRun: [],
          limitations: ['UI fixture, not scan evidence.'] },
      } },
      latestOverlay: { findingStatuses: [], retestStates: [], monitor: { maxRetests: 1, cooldownDays: 7, maxMonitoredFindings: 1 } },
      exports: { formats: ['docx', 'csv', 'json', 'html', 'pdf'], generatedOnDemand: true },
    } } });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
  });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base.origin}/reports/qa-report`);
    const button = page.getByRole('button', { name: 'Download report', exact: true });
    await button.waitFor();
    for (const format of ['docx', 'csv', 'json']) {
      await page.getByLabel('Report format').selectOption(format);
      const pending = page.waitForEvent('download');
      await button.click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), `openhunter-report-qa-report.${format}`);
      assert.equal(requests.at(-1), `?format=${format}&view=snapshot`);
    }
    await page.getByLabel('Report view').selectOption('latest');
    const pending = page.waitForEvent('download');
    await button.click();
    await pending;
    assert.equal(requests.at(-1), '?format=json&view=latest');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, `reports-${viewport.width}.png`), fullPage: true });
  }
  rejectDownload = true;
  await page.getByRole('button', { name: 'Download report', exact: true }).click();
  await page.getByText('Report is still being prepared', { exact: true }).waitFor();
  state = 'draft';
  await page.reload();
  await page.getByRole('heading', { name: 'MOCK / DEMO DATA: report export QA' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download report', exact: true }).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(`PASS: desktop/mobile downloads, latest view, no overflow, error and draft states. Screenshots: ${output}`);
} finally {
  await browser.close();
}
