#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { scoreAssessment } from '../eval/assessment-benchmark.mjs';

/**
 * Gated staging acceptance runner.
 *
 * This intentionally does not automate login/captcha/MFA. Operators must first
 * create two saved login sessions in the UI, then run this with an authenticated
 * browser session cookie copied from the OpenHunter app.
 */

const apiBase = required('OPENHUNTER_API_BASE').replace(/\/+$/, '');
const projectId = required('OPENHUNTER_PROJECT_ID');
const aiAuthorizationId = required('OPENHUNTER_AI_AUTHORIZATION_ID');
const freeAuthorizationId = required('OPENHUNTER_FREE_AUTHORIZATION_ID');
const cookie = required('OPENHUNTER_SESSION_COOKIE');

const headers = {
  'content-type': 'application/json',
  cookie,
};
const groundTruth = JSON.parse(await readFile(new URL('../eval/canary-ground-truth.json', import.meta.url), 'utf8'));

const scanBody = (authorizationId) => JSON.stringify({ authorizationId, acceptanceProfile: 'canary_e2e' });

await runAcceptance('AI Black-hat Mindset Check', aiAuthorizationId);
await runAcceptance('Free Hunter', freeAuthorizationId);

async function runAcceptance(label, authorizationId) {
  const benchmarkStartedAt = Date.now();
  console.log(`\n== ${label}: preflight ==`);
  const preflight = await post(`/v1/projects/${projectId}/scans/preflight`, scanBody(authorizationId));
  console.log(JSON.stringify(preflight.preflight, null, 2));
  if (!preflight.preflight?.ok) {
    throw new Error(`${label} preflight failed: ${(preflight.preflight?.failures ?? []).map((f) => f.code).join(', ')}`);
  }

  console.log(`== ${label}: create canary E2E scan ==`);
  const created = await post(`/v1/projects/${projectId}/scans`, scanBody(authorizationId));
  const scanId = created.scan?.id;
  if (!scanId) throw new Error(`${label} did not return scan id`);
  console.log(`scanId=${scanId}`);

  const deadline = Date.now() + 10 * 60_000;
  let snapshot;
  do {
    await sleep(5000);
    snapshot = await get(`/v1/scans/${scanId}`);
    const state = snapshot.scan?.state;
    console.log(`${label} state=${state}`);
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(state)) break;
  } while (Date.now() < deadline);

  const final = await get(`/v1/scans/${scanId}`);
  const state = final.scan?.state;
  if (!['completed', 'failed', 'cancelled', 'timeout'].includes(state)) {
    throw new Error(`${label} exceeded 10 minute budget without terminal state`);
  }
  if (state !== 'completed') {
    throw new Error(`${label} terminal state was ${state}`);
  }
  const reportId = final.scan?.reports?.find((report) => report.state === 'final')?.id;
  if (!reportId) throw new Error(`${label} completed without a final report`);
  const reportResponse = await get(`/v1/reports/${reportId}`);
  const content = reportResponse.report?.snapshot?.content;
  if (content?.formatVersion !== 'report_v2') throw new Error(`${label} did not produce report_v2`);
  const budgetUsed = final.scan?.budgetUsed ?? {};
  const benchmark = scoreAssessment(content, groundTruth, {
    elapsedMs: Date.now() - benchmarkStartedAt,
    costUsd: budgetUsed.costUsd ?? budgetUsed.estimatedCostUsd,
  });
  console.log(`${label} benchmark=${JSON.stringify(benchmark.metrics)}`);
  if (!benchmark.passed) throw new Error(`${label} benchmark failed: ${benchmark.failures.join('; ')}`);
}

async function get(path) {
  const res = await fetch(`${apiBase}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${apiBase}${path}`, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
