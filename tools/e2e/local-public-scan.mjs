#!/usr/bin/env node

const apiBase = process.env.OPENHUNTER_API_BASE ?? 'http://127.0.0.1:4000';
const targetHost = process.env.OPENHUNTER_TARGET_HOST?.trim().toLowerCase();
if (new URL(apiBase).hostname !== '127.0.0.1' && new URL(apiBase).hostname !== 'localhost') {
  throw new Error('Local E2E runner only accepts a loopback OpenHunter API');
}
if (process.env.OPENHUNTER_AUTHORITY_CONFIRMED !== '1') {
  throw new Error('Set OPENHUNTER_AUTHORITY_CONFIRMED=1 only when you may test the target');
}
if (!targetHost || !/^[a-z0-9.-]+$/.test(targetHost)) {
  throw new Error('Set OPENHUNTER_TARGET_HOST to a bare public hostname');
}

const mode = await request('/v1/auth/mode');
if (!mode.localMode) throw new Error('Local E2E runner requires a local-mode API');
const scanBody = {
  schemaVersion: 'scan_request_v2',
  targetUrl: `https://${targetHost}/`,
  profile: process.env.OPENHUNTER_PROFILE ?? 'standard',
  authorityConfirmed: true,
};
const preflight = (await request('/v1/scans/preflight', { method: 'POST', body: scanBody })).preflight;
if (!preflight?.ok) throw new Error(`Preflight failed: ${JSON.stringify(preflight?.failures ?? [])}`);
const gaps = preflight.coverageGaps ?? [];
console.log(JSON.stringify({ stage: 'preflight', profile: preflight.profile, coverageGaps: gaps, runtimes: preflight.runtimes }));
const scan = (await request('/v1/scans', { method: 'POST', body: { ...scanBody, acceptedCoverageGaps: gaps } })).scan;
if (!scan?.id) throw new Error('Scan creation failed');
console.log(JSON.stringify({ stage: 'started', scanId: scan.id, targetHost }));

const deadline = Date.now() + 12 * 60_000;
let current;
while (Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  current = (await request(`/v1/scans/${scan.id}`)).scan;
  if (['completed', 'failed', 'cancelled', 'timeout'].includes(current?.state)) break;
}
if (!current || current.state !== 'completed') {
  throw new Error(`Scan did not complete: ${current?.state ?? 'timeout waiting for final state'}`);
}

const finalReport = current.reports?.find((report) => report.state === 'final');
if (!finalReport) throw new Error('Completed scan has no final report');
const report = (await request(`/v1/reports/${finalReport.id}`)).report?.snapshot?.content;
if (report?.formatVersion !== 'report_v2') throw new Error('Final report is not report_v2');
console.log(JSON.stringify({
  stage: 'complete',
  scanId: scan.id,
  reportId: finalReport.id,
  reportType: report.reportType,
  findingCount: report.findings?.length ?? 0,
  workersRun: report.coverage?.workersRun ?? [],
  coverageGaps: report.coverage?.coverageGaps ?? [],
  limitations: report.coverage?.limitations ?? [],
}));

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase.replace(/\/+$/, '')}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${JSON.stringify(result.error ?? {})}`);
  return result;
}
