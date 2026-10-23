#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const severityRank = { info: 1, low: 2, medium: 3, high: 4, critical: 5 };

export function scoreAssessment(report, truth, runMetrics = {}) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const expected = Array.isArray(truth?.expectedFindings) ? truth.expectedFindings : [];
  const forbidden = Array.isArray(truth?.forbiddenFindings) ? truth.forbiddenFindings : [];

  const matched = expected.filter((item) => findings.some((finding) => matchesFinding(finding, item))).length;
  const recallByClass = Object.fromEntries(
    [...new Set(expected.map((item) => item.category ?? 'uncategorized'))].map((category) => {
      const fixtures = expected.filter((item) => (item.category ?? 'uncategorized') === category);
      const found = fixtures.filter((item) => findings.some((finding) => matchesFinding(finding, item))).length;
      return [category, found / fixtures.length];
    }),
  );
  const falsePositives = findings.filter((finding) => forbidden.some((item) => matchesFinding(finding, item))).length;
  const evidenceComplete = findings.filter(hasCompleteEvidence).length;
  const invalidHighCritical = findings.filter((finding) =>
    ['high', 'critical'].includes(finding.severity) && !hasBaselineAndExploit(finding),
  ).length;

  const metrics = {
    recall: expected.length === 0 ? 1 : matched / expected.length,
    recallByClass,
    falsePositives,
    falsePositiveRate: forbidden.length === 0 ? 0 : falsePositives / forbidden.length,
    evidenceCompleteness: findings.length === 0 ? (expected.length === 0 ? 1 : 0) : evidenceComplete / findings.length,
    invalidHighCritical,
    findingCount: findings.length,
    coverageGapCount: Array.isArray(report?.coverage?.coverageGaps) ? report.coverage.coverageGaps.length : 0,
    elapsedMs: finiteNumber(runMetrics.elapsedMs),
    costUsd: finiteNumber(runMetrics.costUsd),
  };
  const thresholds = truth?.thresholds ?? {};
  const failures = [];
  if (metrics.recall < (thresholds.minRecall ?? 1)) failures.push(`recall ${metrics.recall} below threshold`);
  if (metrics.falsePositives > (thresholds.maxFalsePositives ?? 0)) failures.push(`${metrics.falsePositives} forbidden finding(s)`);
  if (metrics.falsePositiveRate > (thresholds.maxFalsePositiveRate ?? 1)) failures.push('false-positive rate above threshold');
  if (metrics.evidenceCompleteness < (thresholds.minEvidenceCompleteness ?? 1)) failures.push('evidence completeness below threshold');
  if (metrics.invalidHighCritical > 0) failures.push(`${metrics.invalidHighCritical} High/Critical finding(s) lack baseline+exploit evidence`);
  if (metrics.elapsedMs !== null && metrics.elapsedMs > (thresholds.maxElapsedMs ?? Number.POSITIVE_INFINITY)) failures.push('elapsed time above threshold');
  if (metrics.costUsd !== null && metrics.costUsd > (thresholds.maxCostUsd ?? Number.POSITIVE_INFINITY)) failures.push('cost above threshold');
  return { metrics, failures, passed: failures.length === 0 };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function matchesFinding(finding, expectation) {
  if (expectation.category && finding?.category !== expectation.category) return false;
  if (expectation.assetIncludes && !String(finding?.affectedAsset ?? '').includes(expectation.assetIncludes)) return false;
  if (expectation.minSeverity && (severityRank[finding?.severity] ?? 0) < (severityRank[expectation.minSeverity] ?? 0)) return false;
  return true;
}

function hasCompleteEvidence(finding) {
  const proof = finding?.sanitizedProof ?? {};
  return proof.sanitized === true && typeof proof.description === 'string' && proof.description.length > 0 &&
    Array.isArray(proof.evidenceRefs) && proof.evidenceRefs.length > 0;
}

function hasBaselineAndExploit(finding) {
  const refs = finding?.sanitizedProof?.evidenceRefs ?? [];
  return refs.some((ref) => String(ref).startsWith('http_exchange:baseline:')) &&
    refs.some((ref) => String(ref).startsWith('http_exchange:exploit:'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [reportPath, truthPath] = process.argv.slice(2);
  if (!reportPath || !truthPath) throw new Error('Usage: assessment-benchmark.mjs <report_v2.json> <ground-truth.json>');
  const [report, truth] = await Promise.all([
    readFile(reportPath, 'utf8').then(JSON.parse),
    readFile(truthPath, 'utf8').then(JSON.parse),
  ]);
  const result = scoreAssessment(report, truth);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
