import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { canonicalArtifactBytes, canonicalJsonBytes } from './artifact-verifier.mjs';
import { scoreVerifiedBenchmark } from './verified-benchmark.mjs';

const json = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const catalog = await json('./catalog.json');
const copy = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => createHash('sha256').update(canonicalJsonBytes(value)).digest('hex');
const roles = { baseline: 'baseline_recorded', probe: 'probe_recorded', impact: 'impact_observed',
  negative: 'negative_control_observed', replay: 'replay_attested' };

async function fixture(t) {
  const prefix = join(tmpdir(), 'openhunter-verified-benchmark-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(prefix)));
    await rm(directory, { recursive: true, force: true });
  });
  const artifactRoot = join(directory, 'proofs'); await mkdir(artifactRoot);
  const benchmarkManifest = await json('./examples/web-benchmark.manifest.json');
  const run = await json('./examples/web-benchmark.synthetic-run.json');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const trustStore = { schemaVersion: 'country_security_validator_trust_v1', dataOrigin: 'synthetic_fixture',
    keys: [{ keyId: 'fixture-key', validatorId: 'reviewer-fixture', dataOrigin: 'synthetic_fixture',
      status: 'active', validFrom: '2026-01-01', validUntil: '2026-12-31',
      publicKeySpki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }] };
  const bundle = { schemaVersion: 'country_security_artifact_bundle_v1', dataOrigin: 'synthetic_fixture',
    assessmentId: 'fixture-assessment', runId: 'fixture-run', frameworkId: run.frameworkId,
    levelId: run.levelId, producerId: run.producerId, benchmarkManifestSHA256: digest(benchmarkManifest),
    benchmarkRunSHA256: digest(run), artifacts: [] };
  for (const result of run.results) for (const reference of result.evidenceRefs) {
    const [, role, artifactId] = reference.split(':');
    const artifact = { schemaVersion: 'country_security_artifact_v1', dataOrigin: 'synthetic_fixture',
      artifactId, assessmentId: bundle.assessmentId, runId: bundle.runId, frameworkId: run.frameworkId,
      levelId: run.levelId, producerId: run.producerId, validatorId: result.validatorId, keyId: 'fixture-key',
      caseId: result.caseId, role, observedAt: '2026-10-01', expiresAt: '2026-11-01',
      benchmarkManifestSHA256: bundle.benchmarkManifestSHA256, benchmarkRunSHA256: bundle.benchmarkRunSHA256,
      summary: { sanitized: true, assertionCode: roles[role], outcome: result.outcome,
        comparison: role === 'impact' ? 'changed' : 'unchanged', evidenceType: 'manual_observation' },
      signatureAlgorithm: 'Ed25519' };
    artifact.signature = sign(null, canonicalArtifactBytes(artifact), privateKey).toString('base64');
    const bytes = Buffer.from(JSON.stringify(artifact));
    const file = `${artifactId}.json`; await writeFile(join(artifactRoot, file), bytes);
    bundle.artifacts.push({ artifactId, file, sha256: createHash('sha256').update(bytes).digest('hex'), caseId: result.caseId, role });
  }
  const options = { catalog, benchmarkManifest, run, bundle, trustStore, artifactRoot, asOf: '2026-10-08' };
  return { options, directory, artifactRoot, bundle, run, benchmarkManifest, trustStore };
}

test('full matched benchmark verifies 24 actual signed files while keeping replay and engine gates unverified', async (t) => {
  const { options } = await fixture(t); const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.metadataGatePassed, true); assert.equal(result.attestationGatePassed, true);
  assert.equal(result.artifactVerification.artifactCount, 24);
  assert.equal(result.artifactIntegrityVerified, true); assert.equal(result.validatorAttestationVerified, true);
  assert.equal(result.dataOrigin, 'synthetic_fixture'); assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false); assert.equal(result.assessmentConclusion, 'not_determined');
  assert.deepEqual(result.coverageGaps, []);
});
test('changed thresholds cannot reuse trusted signatures for a different manifest', async (t) => {
  const { options } = await fixture(t); options.benchmarkManifest = copy(options.benchmarkManifest);
  options.benchmarkManifest.thresholds.minRecall = 0.9;
  const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.metadataGatePassed, true); assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'BENCHMARK_INPUT_DIGEST_MISMATCH'));
});
test('producer/profile binding and exact run digest are both required', async (t) => {
  const { options } = await fixture(t); options.run = copy(options.run); options.run.producerId = 'different-engine';
  const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'BENCHMARK_BUNDLE_BINDING_MISMATCH'));
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'BENCHMARK_INPUT_DIGEST_MISMATCH'));
});
test('a missing signed role cannot pass with metadata-only references', async (t) => {
  const { options } = await fixture(t); options.bundle = copy(options.bundle); options.bundle.artifacts.pop();
  const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.metadataGatePassed, true); assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'BENCHMARK_ARTIFACT_MISSING'));
});
test('tampered artifact cannot pass after bundle hash recomputation', async (t) => {
  const { options, artifactRoot } = await fixture(t); const entry = options.bundle.artifacts[0];
  const path = join(artifactRoot, entry.file); const artifact = JSON.parse(await readFile(path, 'utf8'));
  artifact.summary.comparison = 'changed'; const bytes = Buffer.from(JSON.stringify(artifact)); await writeFile(path, bytes);
  entry.sha256 = createHash('sha256').update(bytes).digest('hex');
  const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.artifactIntegrityVerified, true); assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'ARTIFACT_SIGNATURE_INVALID'));
});
test('a validator change cannot reuse a different reviewer attestation', async (t) => {
  const { options } = await fixture(t); options.run = copy(options.run); options.run.results[0].validatorId = 'reviewer-other';
  const result = await scoreVerifiedBenchmark(options); assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'BENCHMARK_ATTESTATION_BINDING_MISMATCH'));
});
test('an unused but valid proof does not silently enter an attested benchmark', async (t) => {
  const { options } = await fixture(t);
  options.run = copy(options.run); options.run.results[0].evidenceRefs.pop();
  const result = await scoreVerifiedBenchmark(options);
  assert.equal(result.metadataGatePassed, false); assert.equal(result.attestationGatePassed, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === 'UNREFERENCED_BUNDLE_ARTIFACT'));
});
test('synthetic trusted keys cannot be used to authenticate an operator supplied run', async (t) => {
  const { options } = await fixture(t); options.bundle.dataOrigin = 'operator_supplied';
  options.run.dataOrigin = 'operator_supplied';
  await assert.rejects(() => scoreVerifiedBenchmark(options), /TRUST_ORIGIN_MISMATCH/);
});
test('actual CLI binds separate files and returns exit0/1/2 for attestation, missing proof and malformed input', async (t) => {
  const { options, directory } = await fixture(t);
  const inputFiles = [];
  for (const field of ['benchmarkManifest', 'run', 'bundle', 'trustStore']) {
    const file = join(directory, `${field}.json`); await writeFile(file, JSON.stringify(options[field])); inputFiles.push(file);
  }
  const script = fileURLToPath(new URL('./verified-benchmark.mjs', import.meta.url));
  const args = [script, ...inputFiles, options.artifactRoot, '--as-of', options.asOf];
  const passed = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: directory });
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(JSON.parse(passed.stdout).attestationGatePassed, true);
  options.bundle.artifacts.pop(); await writeFile(inputFiles[2], JSON.stringify(options.bundle));
  const incomplete = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: directory });
  assert.equal(incomplete.status, 1, incomplete.stderr);
  assert.equal(JSON.parse(incomplete.stdout).attestationGatePassed, false);
  await writeFile(inputFiles[0], '{malformed-fixture-json');
  const invalid = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: directory });
  assert.equal(invalid.status, 2); assert.equal(invalid.stdout, '');
  assert.deepEqual(JSON.parse(invalid.stderr), { error: { code: 'BENCHMARK_INPUT_READ_FAILED' } });
});
