import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BenchmarkInputError, scoreCountryBenchmark } from './benchmark.mjs';

function fixture() {
  const catalog = { frameworks: [{
    id: 'vn-system-levels', countryCode: 'VN', levels: [{ id: 'level-3' }],
    controlIds: ['application_security', 'identity_access'],
  }] };
  const manifest = {
    schemaVersion: 'country_security_benchmark_manifest_v1', dataOrigin: 'synthetic_fixture',
    cases: ['xss', 'sqli', 'idor'].flatMap((category) => ['detected', 'clear'].map((expected) => ({
      id: `${category}-${expected}`, pairId: `${category}-pair`, category,
      controlId: category === 'idor' ? 'identity_access' : 'application_security', expected,
    }))),
    thresholds: { minRecall: 1, maxFalsePositiveRate: 0, minEvidenceCompleteness: 1, minExecutionCoverage: 1 },
  };
  const run = {
    schemaVersion: 'country_security_benchmark_run_v1', dataOrigin: 'synthetic_fixture',
    frameworkId: 'vn-system-levels', levelId: 'level-3', producerId: 'engine-fixture',
    results: manifest.cases.map((entry) => resultFor(entry.id, entry.expected)), coverageGaps: [],
  };
  return { catalog, manifest, run };
}

function resultFor(caseId, outcome) {
  const roles = ['baseline', 'probe', outcome === 'detected' ? 'impact' : 'negative', 'replay'];
  return { caseId, outcome, validatorId: 'reviewer-fixture',
    evidenceRefs: roles.map((role) => `artifact:${role}:${caseId}-${role}`) };
}

function score(input) {
  return scoreCountryBenchmark(input.catalog, input.manifest, input.run);
}

function invalid(input, code) {
  assert.throws(() => score(input), (error) => error instanceof BenchmarkInputError && error.code === code);
}

test('matched synthetic cases pass only the declared metadata gate', () => {
  const result = score(fixture());
  assert.equal(result.metadataGatePassed, true);
  assert.equal(result.assessmentConclusion, 'not_determined');
  assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false);
  assert.equal(result.gateScope, 'declared_benchmark_metadata');
  assert.equal(result.metrics.overall.recall, 1);
  assert.equal(result.metrics.overall.falsePositiveRate, 0);
  assert.equal(result.metrics.overall.evidenceCompleteness, 1);
  assert.equal(result.metrics.overall.executionCoverage, 1);
  assert.equal(Object.hasOwn(result, 'producerId'), false);
  assert.equal(JSON.stringify(result).includes('artifact:'), false);
});

test('operator supplied metadata retains the unverified conclusions', () => {
  const input = fixture();
  input.run.dataOrigin = 'operator_supplied';
  const result = score(input);
  assert.equal(result.metadataGatePassed, true);
  assert.equal(result.dataOrigin, 'operator_supplied');
  assert.equal(result.groundTruthOrigin, 'synthetic_fixture');
  assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false);
});

test('no results cannot pass even with zero false positives', () => {
  const input = fixture();
  input.run.results = [];
  const result = score(input);
  assert.equal(result.metadataGatePassed, false);
  assert.equal(result.metrics.overall.missing, 6);
  assert.equal(result.metrics.overall.recall, 0);
  assert.equal(result.metrics.overall.executionCoverage, 0);
  assert.ok(result.coverageGaps.includes('MISSING_CASE_RESULTS'));
});

test('unevidenced detections and clear declarations become inconclusive', () => {
  const input = fixture();
  input.run.results = input.run.results.map(({ caseId, outcome }) => ({ caseId, outcome }));
  const result = score(input);
  assert.equal(result.metadataGatePassed, false);
  assert.equal(result.metrics.overall.inconclusive, 6);
  assert.equal(result.metrics.overall.trueNegatives, 0);
  assert.equal(result.metrics.overall.truePositives, 0);
  assert.equal(result.metrics.overall.evidenceCompleteness, 0);
});

test('a detected negative counts as a false positive despite missing evidence', () => {
  const input = fixture();
  input.run.results[1] = { caseId: 'xss-clear', outcome: 'detected' };
  const result = score(input);
  assert.equal(result.metrics.byCategory.xss.falsePositives, 1);
  assert.equal(result.metrics.byCategory.xss.falsePositiveRate, 1);
  assert.equal(result.metrics.overall.falsePositiveRate, 1 / 3);
  assert.equal(result.metadataGatePassed, false);
});

test('a fully evidenced false positive still fails the false positive gate', () => {
  const input = fixture();
  input.run.results[1] = resultFor('xss-clear', 'detected');
  const result = score(input);
  assert.equal(result.metrics.overall.evidenceCompleteness, 1);
  assert.equal(result.metadataGatePassed, false);
  assert.ok(result.gateFailures.includes('FALSE_POSITIVE_RATE_ABOVE_THRESHOLD'));
});

test('a complete clear declaration for a positive is a false negative', () => {
  const input = fixture();
  input.run.results[0] = resultFor('xss-detected', 'clear');
  const result = score(input);
  assert.equal(result.metrics.byCategory.xss.recall, 0);
  assert.equal(result.metrics.overall.falseNegatives, 1);
  assert.equal(result.metadataGatePassed, false);
});

test('an aggregate score cannot hide a category below its recall threshold', () => {
  const input = fixture();
  input.run.results[0] = resultFor('xss-detected', 'clear');
  input.manifest.thresholds.minRecall = 0.5;
  const result = score(input);
  assert.equal(result.metrics.overall.gates.recall, true);
  assert.equal(result.metrics.byCategory.xss.gates.recall, false);
  assert.equal(result.metadataGatePassed, false);
});

test('an arbitrary distinct reviewer ID never authenticates independent validation', () => {
  const input = fixture();
  input.run.results.forEach((result) => { result.validatorId = 'claimed-reviewer'; });
  const result = score(input);
  assert.equal(result.metadataGatePassed, true);
  assert.equal(result.evidenceVerification, 'reference_syntax_and_declared_validator_only');
  assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false);
  assert.equal(result.assessmentConclusion, 'not_determined');
});

test('producer cannot act as its own declared validator', () => {
  const input = fixture();
  input.run.results[0].validatorId = input.run.producerId;
  const result = score(input);
  assert.equal(result.metadataGatePassed, false);
  assert.equal(result.metrics.byCategory.xss.truePositives, 0);
  assert.ok(result.coverageGaps.includes('NON_INDEPENDENT_VALIDATOR'));
});

test('missing replay and relabeled duplicate artifacts cannot provide a complete chain', () => {
  for (const mutation of [
    (result) => { result.evidenceRefs = result.evidenceRefs.filter((ref) => !ref.startsWith('artifact:replay:')); },
    (result) => { result.evidenceRefs[1] = 'artifact:probe:xss-detected-baseline'; },
    (result) => { result.evidenceRefs.push(result.evidenceRefs[0]); },
  ]) {
    const input = fixture();
    mutation(input.run.results[0]);
    assert.equal(score(input).metrics.byCategory.xss.truePositives, 0);
    assert.equal(score(input).metadataGatePassed, false);
  }
});

test('clear declarations require negative control and replay references', () => {
  const input = fixture();
  input.run.results[1].evidenceRefs = input.run.results[1].evidenceRefs
    .filter((ref) => !ref.startsWith('artifact:negative:'));
  const result = score(input);
  assert.equal(result.metrics.byCategory.xss.trueNegatives, 0);
  assert.equal(result.metrics.byCategory.xss.inconclusive, 1);
  assert.equal(result.metadataGatePassed, false);
});

test('one declared proof cannot be reused to inflate recall across categories', () => {
  const input = fixture();
  const positiveRefs = input.run.results[0].evidenceRefs;
  input.run.results.filter((result) => result.outcome === 'detected')
    .forEach((result) => { result.evidenceRefs = [...positiveRefs]; });
  const result = score(input);
  assert.equal(result.metadataGatePassed, false);
  assert.equal(result.metrics.overall.truePositives, 0);
  assert.equal(result.metrics.overall.recall, 0);
  assert.equal(result.metrics.overall.inconclusive, 3);
  assert.ok(result.coverageGaps.includes('REUSED_CASE_EVIDENCE_METADATA'));
});

test('cross-case artifact reuse with a different role invalidates both cases', () => {
  const input = fixture();
  input.run.results[1].evidenceRefs[1] = 'artifact:probe:xss-detected-baseline';
  const result = score(input);
  assert.equal(result.metrics.byCategory.xss.truePositives, 0);
  assert.equal(result.metrics.byCategory.xss.trueNegatives, 0);
  assert.equal(result.metrics.byCategory.xss.inconclusive, 2);
  assert.equal(result.metadataGatePassed, false);
});

test('an evidenced false positive retains its count when evidence is reused', () => {
  const input = fixture();
  input.run.results[1] = resultFor('xss-clear', 'detected');
  input.run.results[1].evidenceRefs = [...input.run.results[0].evidenceRefs];
  const result = score(input);
  assert.equal(result.metrics.byCategory.xss.falsePositives, 1);
  assert.equal(result.metrics.byCategory.xss.inconclusive, 2);
  assert.equal(result.metadataGatePassed, false);
});

test('missing, skipped and inconclusive cases remain in category denominators', () => {
  const input = fixture();
  input.run.results = input.run.results.filter((result) => result.caseId !== 'xss-detected');
  input.run.results.find((result) => result.caseId === 'sqli-detected').outcome = 'skipped';
  input.run.results.find((result) => result.caseId === 'idor-clear').outcome = 'inconclusive';
  const result = score(input);
  assert.equal(result.metrics.overall.positives, 3);
  assert.equal(result.metrics.overall.negatives, 3);
  assert.equal(result.metrics.overall.recall, 1 / 3);
  assert.equal(result.metrics.overall.executionCoverage, 3 / 6);
  assert.equal(result.metrics.byCategory.xss.positives, 1);
  assert.equal(result.metrics.byCategory.sqli.skipped, 1);
  assert.equal(result.metrics.byCategory.idor.inconclusive, 1);
});

test('supplied coverage gaps always fail even if thresholds are permissive', () => {
  const input = fixture();
  input.run.coverageGaps = ['EXECUTION_UNAVAILABLE'];
  input.manifest.thresholds = { minRecall: 0, maxFalsePositiveRate: 1, minEvidenceCompleteness: 0, minExecutionCoverage: 0 };
  assert.equal(score(input).metadataGatePassed, false);
});

test('duplicate result and unknown case reject instead of inflating recall', () => {
  const duplicate = fixture();
  duplicate.run.results.push(structuredClone(duplicate.run.results[0]));
  invalid(duplicate, 'DUPLICATE_RESULT');
  const unknown = fixture();
  unknown.run.results[0].caseId = 'unknown-case';
  invalid(unknown, 'UNKNOWN_CASE');
});

test('paired ground truth rejects duplicate, unmatched, inconsistent and absent categories', () => {
  const duplicate = fixture();
  duplicate.manifest.cases[1].id = duplicate.manifest.cases[0].id;
  invalid(duplicate, 'DUPLICATE_CASE');
  const unmatched = fixture();
  unmatched.manifest.cases.pop();
  invalid(unmatched, 'INVALID_CASE_PAIRS');
  const sameExpectation = fixture();
  sameExpectation.manifest.cases[1].expected = 'detected';
  invalid(sameExpectation, 'INVALID_CASE_PAIRS');
  const missingCategory = fixture();
  missingCategory.manifest.cases = missingCategory.manifest.cases.filter((entry) => entry.category !== 'idor');
  invalid(missingCategory, 'MISSING_CATEGORY');
  const wrongControl = fixture();
  wrongControl.manifest.cases[0].controlId = 'identity_access';
  invalid(wrongControl, 'INVALID_CASE');
});

test('empty ground truth and no expected positives are invalid', () => {
  const empty = fixture();
  empty.manifest.cases = [];
  invalid(empty, 'INVALID_MANIFEST_CASES');
  const noPositives = fixture();
  noPositives.manifest.cases.forEach((entry) => { entry.expected = 'clear'; });
  invalid(noPositives, 'INVALID_CASE_PAIRS');
});

test('framework, level and control mismatches reject', () => {
  const framework = fixture();
  framework.run.frameworkId = 'unknown-framework';
  invalid(framework, 'UNKNOWN_FRAMEWORK');
  const level = fixture();
  level.run.levelId = 'level-4';
  invalid(level, 'UNKNOWN_LEVEL');
  const control = fixture();
  control.catalog.frameworks[0].controlIds = ['application_security'];
  invalid(control, 'UNMAPPED_CONTROL');
});

test('unknown fields and unsafe secrets reject without echoing values or keys', () => {
  const sentinel = 'TOP_SECRET_PASSWORD=do-not-echo';
  for (const mutation of [
    (input) => { input.run.password = sentinel; },
    (input) => { input.manifest[sentinel] = true; },
    (input) => { input.run.results[0].evidenceRefs[0] = `https://example.invalid/?token=${sentinel}`; },
    (input) => { input.run.producerId = sentinel; },
    (input) => { input.run.coverageGaps = [sentinel]; },
    (input) => { input.run.producerId = 'review_sk-syntheticabcdefghijk'; },
    (input) => { input.run.results[0].evidenceRefs[0] = 'artifact:baseline:proof_ghp_syntheticvalue'; },
  ]) {
    const input = fixture();
    mutation(input);
    assert.throws(() => score(input), (error) => error instanceof BenchmarkInputError
      && !error.message.includes(sentinel) && !error.stack.includes(sentinel));
  }
});

test('malformed thresholds and unrecognized origins reject', () => {
  const threshold = fixture();
  threshold.manifest.thresholds.minRecall = Number.NaN;
  invalid(threshold, 'INVALID_THRESHOLDS');
  const manifestOrigin = fixture();
  manifestOrigin.manifest.dataOrigin = 'operator_supplied';
  invalid(manifestOrigin, 'INVALID_MANIFEST');
  const runOrigin = fixture();
  runOrigin.run.dataOrigin = 'verified_live';
  invalid(runOrigin, 'INVALID_RUN');
});

test('CLI returns 0 for metadata gate, 1 for failed gate and 2 for invalid input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'country-benchmark-test-'));
  try {
    const input = fixture();
    const paths = ['catalog', 'manifest', 'run'].map((name) => join(directory, `${name}.json`));
    await Promise.all(paths.map((path, index) => writeFile(path, JSON.stringify(input[['catalog', 'manifest', 'run'][index]]))));
    const script = fileURLToPath(new URL('./benchmark.mjs', import.meta.url));
    const args = [script, paths[1], paths[2], '--catalog', paths[0]];
    const passing = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(passing.status, 0);
    assert.equal(JSON.parse(passing.stdout).metadataGatePassed, true);
    await Promise.all(paths.map((path, index) => writeFile(path,
      `\uFEFF${JSON.stringify(input[['catalog', 'manifest', 'run'][index]])}`)));
    const withBom = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(withBom.status, 0);
    assert.equal(JSON.parse(withBom.stdout).metadataGatePassed, true);
    input.run.results = [];
    await writeFile(paths[2], JSON.stringify(input.run));
    const failed = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(failed.status, 1);
    assert.equal(JSON.parse(failed.stdout).metadataGatePassed, false);
    await writeFile(paths[2], '{invalid json');
    const invalidJson = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(invalidJson.status, 2);
    assert.deepEqual(JSON.parse(invalidJson.stderr), { error: 'INPUT_JSON_INVALID' });
    const invalidArgs = spawnSync(process.execPath, [script, '--token=TOP_SECRET'], { encoding: 'utf8' });
    assert.equal(invalidArgs.status, 2);
    assert.equal(invalidArgs.stderr.includes('TOP_SECRET'), false);
    await writeFile(paths[2], ' '.repeat(1024 * 1024 + 1));
    const oversized = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(oversized.status, 2);
    assert.deepEqual(JSON.parse(oversized.stderr), { error: 'INPUT_FILE_TOO_LARGE' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('published schema exposes both input contracts and forbids verification claims', async () => {
  const schema = JSON.parse(await readFile(new URL('./benchmark.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.$defs.manifest.properties.schemaVersion.const, 'country_security_benchmark_manifest_v1');
  assert.equal(schema.$defs.run.properties.schemaVersion.const, 'country_security_benchmark_run_v1');
  assert.equal(schema.$defs.score.properties.replayVerified.const, false);
  assert.equal(schema.$defs.score.properties.engineEfficacyVerified.const, false);
  assert.equal(schema.$defs.score.properties.assessmentConclusion.const, 'not_determined');
});
