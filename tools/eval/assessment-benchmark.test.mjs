import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreAssessment } from './assessment-benchmark.mjs';
import truth from './canary-ground-truth.json' with { type: 'json' };

const validFinding = {
  title: 'Object ownership bypass',
  severity: 'high',
  category: 'access_control_object_ownership',
  affectedAsset: 'https://example.com/openhunter-canary/objects/vulnerable/user-b-object',
  sanitizedProof: {
    description: 'Sanitized cross-account status comparison.',
    sanitized: true,
    evidenceRefs: ['http_exchange:exploit:canary-vulnerable', 'http_exchange:baseline:canary-fixed'],
  },
};

test('passes the positive canary and fixed-route negative control', () => {
  const result = scoreAssessment(
    { formatVersion: 'report_v2', findings: [validFinding], coverage: { coverageGaps: [] } },
    truth,
    { elapsedMs: 1250, costUsd: 0.03 },
  );
  assert.equal(result.passed, true);
  assert.equal(result.metrics.recall, 1);
  assert.equal(result.metrics.recallByClass.access_control_object_ownership, 1);
  assert.equal(result.metrics.falsePositives, 0);
  assert.equal(result.metrics.falsePositiveRate, 0);
  assert.equal(result.metrics.elapsedMs, 1250);
  assert.equal(result.metrics.costUsd, 0.03);
});

test('fails a high finding without independent baseline evidence', () => {
  const finding = structuredClone(validFinding);
  finding.sanitizedProof.evidenceRefs = ['http_exchange:exploit:only'];
  const result = scoreAssessment({ findings: [finding] }, truth);
  assert.equal(result.passed, false);
  assert.equal(result.metrics.invalidHighCritical, 1);
});

test('counts a fixed-route finding as a false positive', () => {
  const result = scoreAssessment({ findings: [{ ...validFinding, affectedAsset: '/openhunter-canary/objects/fixed/user-b-object' }] }, truth);
  assert.equal(result.passed, false);
  assert.equal(result.metrics.falsePositives, 1);
  assert.equal(result.metrics.falsePositiveRate, 1);
});
