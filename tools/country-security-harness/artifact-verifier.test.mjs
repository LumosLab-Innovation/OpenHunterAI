import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { ArtifactVerificationError, canonicalArtifactBytes, canonicalJsonBytes, verifyArtifactBundle } from './artifact-verifier.mjs';

const execFileAsync = promisify(execFile);
const asOf = '2026-10-08';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const prefix = path.join(tmpdir(), 'openhunter-signed-artifacts-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)));
    await rm(directory, { recursive: true, force: true });
  });
  const artifactRoot = path.join(directory, 'artifacts');
  await mkdir(artifactRoot);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const trustStore = {
    schemaVersion: 'country_security_validator_trust_v1', dataOrigin: 'synthetic_fixture',
    keys: [{ keyId: 'key-main', validatorId: 'validator-independent', dataOrigin: 'synthetic_fixture',
      status: 'active', validFrom: '2026-01-01', validUntil: '2026-12-31',
      publicKeySpki: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') }],
  };
  const artifact = {
    schemaVersion: 'country_security_artifact_v1', dataOrigin: 'synthetic_fixture',
    artifactId: 'baseline-001', assessmentId: 'assessment-001', runId: 'run-001',
    frameworkId: 'vn-system-levels', levelId: 'level-3', producerId: 'worker-a',
    validatorId: 'validator-independent', keyId: 'key-main', caseId: 'xss-positive', role: 'baseline',
    observedAt: '2026-10-01', expiresAt: '2026-11-01',
    benchmarkManifestSHA256: hash(Buffer.from('synthetic-benchmark-manifest')),
    benchmarkRunSHA256: hash(Buffer.from('synthetic-benchmark-run')),
    summary: { sanitized: true, assertionCode: 'baseline_recorded', outcome: 'detected',
      comparison: 'not_compared', evidenceType: 'browser_marker_comparison' },
    signatureAlgorithm: 'Ed25519',
  };
  const manifest = {
    schemaVersion: 'country_security_artifact_bundle_v1', dataOrigin: artifact.dataOrigin,
    assessmentId: artifact.assessmentId, runId: artifact.runId, frameworkId: artifact.frameworkId,
    levelId: artifact.levelId, producerId: artifact.producerId,
    benchmarkManifestSHA256: artifact.benchmarkManifestSHA256, benchmarkRunSHA256: artifact.benchmarkRunSHA256,
    artifacts: [{ artifactId: artifact.artifactId, file: `${artifact.artifactId}.json`,
      sha256: '0'.repeat(64), caseId: artifact.caseId, role: artifact.role }],
  };
  const write = async (value = artifact, { signArtifact = true, signingKey = privateKey, updateDigest = true } = {}) => {
    if (signArtifact) value.signature = sign(null, canonicalArtifactBytes(value), signingKey).toString('base64');
    const bytes = Buffer.from(JSON.stringify(value));
    await writeFile(path.join(artifactRoot, 'baseline-001.json'), bytes);
    if (updateDigest) manifest.artifacts[0].sha256 = hash(bytes);
    return bytes;
  };
  await write();
  return { directory, artifactRoot, trustStore, artifact, manifest, write,
    verify: () => verifyArtifactBundle({ artifactRoot, trustStore, manifest, asOf }) };
}

function assertGap(result, code) {
  assert.equal(result.validatorAttestationVerified, false);
  assert.ok(result.coverageGaps.some((gap) => gap.code === code));
  assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false);
}

test('verifies actual SHA256 and Ed25519 against separate configured trust, keeping fixture origin and no replay claim', async (t) => {
  const value = await fixture(t);
  const result = await value.verify();
  assert.equal(result.artifactIntegrityVerified, true);
  assert.equal(result.validatorAttestationVerified, true);
  assert.equal(result.dataOrigin, 'synthetic_fixture');
  assert.equal(result.replayVerified, false);
  assert.equal(result.engineEfficacyVerified, false);
  assert.equal(result.conclusion, 'not_determined');
  assert.deepEqual(result.coverageGaps, []);
  assert.equal(Object.hasOwn(result.artifacts[0], 'summary'), false);
  assert.equal(Object.hasOwn(result.artifacts[0], 'signature'), false);
  assert.equal(Object.hasOwn(result.artifacts[0], 'publicKeySpki'), false);
});

test('canonical signing bytes are order-independent and carry a fixed domain separator', async (t) => {
  const { artifact } = await fixture(t);
  const reordered = Object.fromEntries(Object.entries(artifact).reverse());
  reordered.summary = Object.fromEntries(Object.entries(artifact.summary).reverse());
  assert.deepEqual(canonicalArtifactBytes(artifact), canonicalArtifactBytes(reordered));
  assert.ok(canonicalArtifactBytes(artifact).toString().startsWith('OpenHunterAI.country-security-artifact.v1\n'));
});

test('benchmark canonical bytes bind the whole document and reject cycles or non-JSON values', () => {
  assert.equal(canonicalJsonBytes({ b: 2, a: 1 }).toString(), '{"a":1,"b":2}');
  assert.notEqual(hash(canonicalJsonBytes({ case: 'case-a' })), hash(canonicalJsonBytes({ case: 'case-b' })));
  const cycle = {}; cycle.self = cycle;
  for (const value of [cycle, { missing: undefined }, { value: Infinity }]) {
    assert.throws(() => canonicalJsonBytes(value), { code: 'ARTIFACT_CANONICAL_INVALID' });
  }
});

test('tampered file bytes fail integrity before attestation', async (t) => {
  const value = await fixture(t);
  value.artifact.summary.comparison = 'changed';
  await value.write(value.artifact, { signArtifact: false, updateDigest: false });
  const result = await value.verify();
  assert.equal(result.artifactIntegrityVerified, false);
  assertGap(result, 'ARTIFACT_HASH_MISMATCH');
});

test('recomputed hash cannot make a tampered summary pass its original signature', async (t) => {
  const value = await fixture(t);
  value.artifact.summary.comparison = 'changed';
  await value.write(value.artifact, { signArtifact: false });
  const result = await value.verify();
  assert.equal(result.artifactIntegrityVerified, true);
  assertGap(result, 'ARTIFACT_SIGNATURE_INVALID');
});

test('an untrusted key ID or attacker signing key cannot establish trust', async (t) => {
  const value = await fixture(t);
  value.artifact.keyId = 'key-untrusted';
  await value.write();
  assertGap(await value.verify(), 'VALIDATOR_UNTRUSTED');
  value.artifact.keyId = 'key-main';
  const attacker = generateKeyPairSync('ed25519');
  await value.write(value.artifact, { signingKey: attacker.privateKey });
  assertGap(await value.verify(), 'ARTIFACT_SIGNATURE_INVALID');
});

test('an embedded public key is rejected rather than accepted as self-signed trust', async (t) => {
  const value = await fixture(t);
  value.artifact.publicKeySpki = value.trustStore.keys[0].publicKeySpki;
  await value.write(value.artifact, { signArtifact: false });
  assertGap(await value.verify(), 'ARTIFACT_SCHEMA_INVALID');
});

test('producer cannot attest as its own independent validator', async (t) => {
  const value = await fixture(t);
  value.artifact.validatorId = value.manifest.producerId;
  value.trustStore.keys[0].validatorId = value.manifest.producerId;
  await value.write();
  assertGap(await value.verify(), 'NON_INDEPENDENT_VALIDATOR');
});

test('trusted signatures are bound to assessment, run, framework, level, producer, case and role', async (t) => {
  for (const field of ['assessmentId', 'runId', 'frameworkId', 'levelId', 'producerId', 'caseId', 'role', 'benchmarkManifestSHA256', 'benchmarkRunSHA256']) {
    const value = await fixture(t);
    value.artifact[field] = field.endsWith('SHA256') ? 'a'.repeat(64) : field === 'role' ? 'probe' : 'different-binding';
    if (field === 'role') value.artifact.summary.assertionCode = 'probe_recorded';
    await value.write();
    assertGap(await value.verify(), 'ARTIFACT_BINDING_MISMATCH');
  }
});

test('expired and future signed artifacts are rejected', async (t) => {
  const value = await fixture(t);
  value.artifact.expiresAt = '2026-10-07';
  await value.write();
  assertGap(await value.verify(), 'ARTIFACT_EXPIRED');
  value.artifact.observedAt = '2026-10-09'; value.artifact.expiresAt = '2026-11-01';
  await value.write();
  assertGap(await value.verify(), 'ARTIFACT_FROM_FUTURE');
});

test('revoked and out-of-validity trusted keys cannot attest', async (t) => {
  const value = await fixture(t);
  value.trustStore.keys[0].status = 'revoked';
  assertGap(await value.verify(), 'VALIDATOR_KEY_REVOKED');
  value.trustStore.keys[0].status = 'active';
  value.trustStore.keys[0].validUntil = '2026-10-07';
  assertGap(await value.verify(), 'VALIDATOR_KEY_EXPIRED');
});

test('synthetic store or synthetic key cannot upgrade an operator-supplied run', async (t) => {
  const value = await fixture(t);
  value.manifest.dataOrigin = 'operator_supplied'; value.artifact.dataOrigin = 'operator_supplied';
  await value.write();
  await assert.rejects(value.verify(), { code: 'TRUST_ORIGIN_MISMATCH' });
  value.trustStore.dataOrigin = 'operator_supplied';
  assertGap(await value.verify(), 'TRUST_ORIGIN_MISMATCH');
});

test('one public key cannot claim multiple validator identities', async (t) => {
  const value = await fixture(t);
  value.trustStore.keys.push({ ...value.trustStore.keys[0], keyId: 'key-second', validatorId: 'validator-second' });
  await assert.rejects(value.verify(), { code: 'VALIDATOR_TRUST_INVALID' });
});

test('artifacts cannot be reused across cases or roles', async (t) => {
  const value = await fixture(t);
  value.manifest.artifacts.push({ ...value.manifest.artifacts[0], caseId: 'xss-negative', role: 'negative' });
  await assert.rejects(value.verify(), { code: 'ARTIFACT_REUSED' });
});

test('distinct artifact files cannot duplicate one case role', async (t) => {
  const value = await fixture(t);
  value.manifest.artifacts.push({ ...value.manifest.artifacts[0], artifactId: 'baseline-002',
    file: 'baseline-002.json', sha256: 'f'.repeat(64) });
  await assert.rejects(value.verify(), { code: 'DUPLICATE_CASE_ROLE' });
});

test('traversal and raw paths in the manifest are rejected without echoing paths', async (t) => {
  const value = await fixture(t);
  value.manifest.artifacts[0].file = '../private-password.json';
  await assert.rejects(value.verify(), (error) => {
    assert.ok(error instanceof ArtifactVerificationError);
    assert.equal(error.message, 'ARTIFACT_MANIFEST_INVALID');
    assert.equal(error.message.includes('private-password'), false); return true;
  });
});

test('symlinks escaping the explicit artifact root are rejected where supported', async (t) => {
  const value = await fixture(t);
  const file = path.join(value.artifactRoot, 'baseline-001.json');
  const outside = path.join(value.directory, 'outside.json');
  await writeFile(outside, await readFile(file));
  await rm(file);
  try { await symlink(outside, file, 'file'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Host does not allow file symlinks.'); return; }
    throw error;
  }
  assertGap(await value.verify(), 'ARTIFACT_PATH_UNSAFE');
});

test('missing and oversized artifacts produce coverage gaps without reading unbounded bodies', async (t) => {
  const value = await fixture(t);
  const file = path.join(value.artifactRoot, 'baseline-001.json');
  await rm(file);
  assertGap(await value.verify(), 'ARTIFACT_UNREADABLE');
  await writeFile(file, Buffer.alloc(64 * 1024 + 1, 'x'));
  assertGap(await value.verify(), 'ARTIFACT_TOO_LARGE');
});

test('unknown fields and secret body text cannot enter output or errors', async (t) => {
  const value = await fixture(t);
  const sensitive = 'private-password-and-sensitive-request';
  value.artifact.summary.rawResponse = sensitive;
  await value.write(value.artifact, { signArtifact: false });
  const result = await value.verify();
  assertGap(result, 'ARTIFACT_SCHEMA_INVALID');
  assert.equal(JSON.stringify(result).includes(sensitive), false);
  assert.equal(JSON.stringify(result).includes('rawResponse'), false);
  assert.equal(JSON.stringify(result).includes(value.artifactRoot), false);
  value.trustStore.keys[0].privateKey = sensitive;
  await assert.rejects(value.verify(), (error) => {
    assert.equal(error.message, 'VALIDATOR_TRUST_INVALID'); return true;
  });
});

test('actual CLI verifies fixture bytes while retaining all no-replay limitations', async (t) => {
  const value = await fixture(t);
  const manifestFile = path.join(value.directory, 'manifest.json');
  const trustFile = path.join(value.directory, 'trust.json');
  await writeFile(manifestFile, `\uFEFF${JSON.stringify(value.manifest)}`);
  await writeFile(trustFile, JSON.stringify(value.trustStore));
  const cli = fileURLToPath(new URL('./artifact-verifier.mjs', import.meta.url));
  const result = await execFileAsync(process.execPath, [cli, manifestFile, trustFile, value.artifactRoot, '--as-of', asOf]);
  const verified = JSON.parse(result.stdout);
  assert.equal(result.stderr, '');
  assert.equal(verified.validatorAttestationVerified, true);
  assert.equal(verified.replayVerified, false);
  assert.equal(verified.engineEfficacyVerified, false);
});

test('artifact schemas are strict and forbid vacuous bundles or private-key fields', async () => {
  const schema = JSON.parse(await readFile(new URL('./artifacts.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.definitions.bundle.additionalProperties, false);
  assert.equal(schema.definitions.bundle.properties.artifacts.minItems, 1);
  assert.equal(schema.definitions.summary.additionalProperties, false);
  assert.equal(schema.definitions.trustStore.properties.keys.items.additionalProperties, false);
  assert.equal(Object.hasOwn(schema.definitions.trustStore.properties.keys.items.properties, 'privateKey'), false);
});
