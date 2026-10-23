#!/usr/bin/env node
import { constants } from 'node:fs';
import { lstat, open, readFile, realpath, stat } from 'node:fs/promises';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isSafeEvidenceReference } from './harness.mjs';

const ORIGINS = ['synthetic_fixture', 'operator_supplied'];
const ROLES = ['baseline', 'probe', 'impact', 'replay', 'negative'];
const ASSERTIONS = {
  baseline: 'baseline_recorded', probe: 'probe_recorded', impact: 'impact_observed',
  replay: 'replay_attested', negative: 'negative_control_observed',
};
const EVIDENCE_TYPES = ['http_status_comparison', 'browser_marker_comparison', 'ownership_comparison',
  'header_configuration', 'document_review', 'manual_observation'];
const MAX_ARTIFACT_BYTES = 64 * 1024;
const MAX_INPUT_BYTES = 1024 * 1024;
const DOMAIN = 'OpenHunterAI.country-security-artifact.v1\n';

export class ArtifactVerificationError extends Error {
  constructor(code) { super(code); this.name = 'ArtifactVerificationError'; this.code = code; }
}
function requireCondition(condition, code) {
  if (!condition) throw new ArtifactVerificationError(code);
}
function fields(value, required, optional, code) {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), code);
  const accepted = new Set([...required, ...optional]);
  requireCondition(required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => accepted.has(key)), code);
}
function id(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9._-]{0,63}$/.test(value) && isSafeEvidenceReference(value);
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function base64(value, byteLength) {
  return typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    Buffer.from(value, 'base64').length === byteLength && Buffer.from(value, 'base64').toString('base64') === value;
}
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function unique(values, code) { requireCondition(new Set(values).size === values.length, code); }

function validateManifest(manifest) {
  const code = 'ARTIFACT_MANIFEST_INVALID';
  fields(manifest, ['schemaVersion', 'dataOrigin', 'assessmentId', 'runId', 'frameworkId', 'levelId',
    'producerId', 'benchmarkManifestSHA256', 'benchmarkRunSHA256', 'artifacts'], [], code);
  requireCondition(manifest.schemaVersion === 'country_security_artifact_bundle_v1' &&
    ORIGINS.includes(manifest.dataOrigin) && ['assessmentId', 'runId', 'frameworkId', 'levelId', 'producerId']
      .every((key) => id(manifest[key])) && Array.isArray(manifest.artifacts) &&
    manifest.artifacts.length > 0 && manifest.artifacts.length <= 512 &&
    ['benchmarkManifestSHA256', 'benchmarkRunSHA256'].every((key) => typeof manifest[key] === 'string' && /^[a-f0-9]{64}$/.test(manifest[key])), code);
  for (const artifact of manifest.artifacts) {
    fields(artifact, ['artifactId', 'file', 'sha256', 'caseId', 'role'], [], code);
    requireCondition(id(artifact.artifactId) && id(artifact.caseId) && ROLES.includes(artifact.role) &&
      artifact.file === `${artifact.artifactId}.json` &&
      typeof artifact.sha256 === 'string' && /^[a-f0-9]{64}$/.test(artifact.sha256), code);
  }
  unique(manifest.artifacts.map((artifact) => artifact.artifactId), 'ARTIFACT_REUSED');
  unique(manifest.artifacts.map((artifact) => artifact.file), 'ARTIFACT_REUSED');
  unique(manifest.artifacts.map((artifact) => artifact.sha256), 'ARTIFACT_REUSED');
  unique(manifest.artifacts.map((artifact) => `${artifact.caseId}:${artifact.role}`), 'DUPLICATE_CASE_ROLE');
}

function validateTrustStore(store) {
  const code = 'VALIDATOR_TRUST_INVALID';
  fields(store, ['schemaVersion', 'dataOrigin', 'keys'], [], code);
  requireCondition(store.schemaVersion === 'country_security_validator_trust_v1' &&
    ORIGINS.includes(store.dataOrigin) && Array.isArray(store.keys) && store.keys.length > 0 && store.keys.length <= 128, code);
  const result = new Map();
  const fingerprints = [];
  for (const key of store.keys) {
    fields(key, ['keyId', 'validatorId', 'dataOrigin', 'status', 'validFrom', 'validUntil', 'publicKeySpki'], [], code);
    requireCondition(id(key.keyId) && id(key.validatorId) && ORIGINS.includes(key.dataOrigin) &&
      ['active', 'revoked'].includes(key.status) && date(key.validFrom) && date(key.validUntil) &&
      key.validUntil >= key.validFrom && base64(key.publicKeySpki, 44), code);
    let publicKey;
    try { publicKey = createPublicKey({ key: Buffer.from(key.publicKeySpki, 'base64'), format: 'der', type: 'spki' }); }
    catch { throw new ArtifactVerificationError(code); }
    requireCondition(publicKey.asymmetricKeyType === 'ed25519', code);
    requireCondition(!result.has(key.keyId), code);
    const fingerprint = sha256(publicKey.export({ format: 'der', type: 'spki' }));
    fingerprints.push(fingerprint);
    result.set(key.keyId, { ...key, publicKey, fingerprint });
  }
  // One public key cannot impersonate independent validator identities.
  unique(fingerprints, code);
  return result;
}

function validateArtifact(artifact, allowUnsigned = false) {
  const code = 'ARTIFACT_SCHEMA_INVALID';
  fields(artifact, ['schemaVersion', 'dataOrigin', 'artifactId', 'assessmentId', 'runId', 'frameworkId',
    'levelId', 'producerId', 'validatorId', 'keyId', 'caseId', 'role', 'observedAt', 'expiresAt',
    'benchmarkManifestSHA256', 'benchmarkRunSHA256', 'summary', 'signatureAlgorithm', ...(allowUnsigned ? [] : ['signature'])], allowUnsigned ? ['signature'] : [], code);
  requireCondition(artifact.schemaVersion === 'country_security_artifact_v1' && ORIGINS.includes(artifact.dataOrigin) &&
    ['artifactId', 'assessmentId', 'runId', 'frameworkId', 'levelId', 'producerId', 'validatorId', 'keyId', 'caseId']
      .every((key) => id(artifact[key])) && ROLES.includes(artifact.role) && date(artifact.observedAt) &&
    date(artifact.expiresAt) && artifact.expiresAt >= artifact.observedAt && artifact.signatureAlgorithm === 'Ed25519' &&
    ['benchmarkManifestSHA256', 'benchmarkRunSHA256'].every((key) => typeof artifact[key] === 'string' && /^[a-f0-9]{64}$/.test(artifact[key])), code);
  if (Object.hasOwn(artifact, 'signature')) requireCondition(base64(artifact.signature, 64), code);
  fields(artifact.summary, ['sanitized', 'assertionCode', 'outcome', 'comparison', 'evidenceType'], [], code);
  requireCondition(artifact.summary.sanitized === true && artifact.summary.assertionCode === ASSERTIONS[artifact.role] &&
    ['detected', 'clear', 'inconclusive'].includes(artifact.summary.outcome) &&
    ['changed', 'unchanged', 'not_compared'].includes(artifact.summary.comparison) &&
    EVIDENCE_TYPES.includes(artifact.summary.evidenceType), code);
}

function sortedJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${sortedJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Pure sorted UTF-8 JSON for binding full benchmark inputs; no signature fields are removed. */
export function canonicalJsonBytes(value) {
  let nodes = 0;
  let textBudget = 0;
  const ancestors = new Set();
  const visit = (current, depth) => {
    requireCondition(depth <= 32 && ++nodes <= 100000, 'ARTIFACT_CANONICAL_INVALID');
    if (current === null || typeof current === 'boolean') return;
    if (typeof current === 'string') {
      textBudget += current.length;
      requireCondition(textBudget <= MAX_INPUT_BYTES, 'ARTIFACT_CANONICAL_INVALID'); return;
    }
    if (typeof current === 'number') {
      requireCondition(Number.isFinite(current), 'ARTIFACT_CANONICAL_INVALID'); return;
    }
    requireCondition(typeof current === 'object' && !ancestors.has(current) &&
      (Array.isArray(current) || [Object.prototype, null].includes(Object.getPrototypeOf(current))), 'ARTIFACT_CANONICAL_INVALID');
    ancestors.add(current);
    if (Array.isArray(current)) for (const item of current) visit(item, depth + 1);
    else for (const [key, item] of Object.entries(current)) { visit(key, depth + 1); visit(item, depth + 1); }
    ancestors.delete(current);
  };
  visit(value, 0);
  const bytes = Buffer.from(sortedJson(value), 'utf8');
  requireCondition(bytes.length <= MAX_INPUT_BYTES, 'ARTIFACT_CANONICAL_INVALID');
  return bytes;
}

/** Fixed domain prefix + sorted UTF-8 JSON of the strict artifact, excluding signature. */
export function canonicalArtifactBytes(artifact) {
  validateArtifact(artifact, true);
  const { signature, ...unsigned } = artifact;
  return Buffer.concat([Buffer.from(DOMAIN, 'utf8'), canonicalJsonBytes(unsigned)]);
}

async function declaredRoot(root) {
  requireCondition(typeof root === 'string' && isAbsolute(root), 'ARTIFACT_ROOT_INVALID');
  try {
    const info = await lstat(root);
    requireCondition(info.isDirectory() && !info.isSymbolicLink(), 'ARTIFACT_ROOT_INVALID');
    return await realpath(root);
  } catch (error) {
    if (error instanceof ArtifactVerificationError) throw error;
    throw new ArtifactVerificationError('ARTIFACT_ROOT_INVALID');
  }
}

async function readArtifact(root, filename) {
  const file = join(root, filename);
  let handle;
  try {
    const before = await lstat(file);
    requireCondition(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 &&
      await realpath(file) === file, 'ARTIFACT_PATH_UNSAFE');
    requireCondition(before.size <= MAX_ARTIFACT_BYTES, 'ARTIFACT_TOO_LARGE');
    const flags = constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW ?? 0);
    handle = await open(file, flags);
    const opened = await handle.stat();
    requireCondition(opened.isFile() && opened.dev === before.dev && opened.ino === before.ino && opened.nlink === 1,
      'ARTIFACT_PATH_UNSAFE');
    const buffer = Buffer.alloc(MAX_ARTIFACT_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    requireCondition(length <= MAX_ARTIFACT_BYTES, 'ARTIFACT_TOO_LARGE');
    const after = await lstat(file);
    requireCondition(!after.isSymbolicLink() && after.dev === opened.dev && after.ino === opened.ino &&
      after.nlink === 1 && await realpath(file) === file, 'ARTIFACT_PATH_UNSAFE');
    return buffer.subarray(0, length);
  } catch (error) {
    if (error instanceof ArtifactVerificationError) throw error;
    throw new ArtifactVerificationError('ARTIFACT_UNREADABLE');
  } finally { if (handle) await handle.close(); }
}

/** Verify configured trust and signed summaries offline; do not execute or claim a network replay. */
export async function verifyArtifactBundle({ artifactRoot, manifest, trustStore, asOf = new Date().toISOString().slice(0, 10) }) {
  validateManifest(manifest);
  const trustedKeys = validateTrustStore(trustStore);
  requireCondition(date(asOf), 'ARTIFACT_DATE_INVALID');
  requireCondition(trustStore.dataOrigin === manifest.dataOrigin, 'TRUST_ORIGIN_MISMATCH');
  const root = await declaredRoot(artifactRoot);
  const artifacts = [];
  for (const item of manifest.artifacts) {
    const result = { artifactId: item.artifactId, caseId: item.caseId, role: item.role, sha256: item.sha256,
      artifactIntegrityVerified: false, validatorAttestationVerified: false, gaps: [] };
    try {
      const bytes = await readArtifact(root, item.file);
      requireCondition(sha256(bytes) === item.sha256, 'ARTIFACT_HASH_MISMATCH');
      result.artifactIntegrityVerified = true;
      let artifact;
      try { artifact = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); }
      catch { throw new ArtifactVerificationError('ARTIFACT_JSON_INVALID'); }
      validateArtifact(artifact);
      requireCondition(['dataOrigin', 'assessmentId', 'runId', 'frameworkId', 'levelId', 'producerId', 'benchmarkManifestSHA256', 'benchmarkRunSHA256']
        .every((key) => artifact[key] === manifest[key]) && ['artifactId', 'caseId', 'role']
        .every((key) => artifact[key] === item[key]), 'ARTIFACT_BINDING_MISMATCH');
      requireCondition(artifact.validatorId !== manifest.producerId, 'NON_INDEPENDENT_VALIDATOR');
      const key = trustedKeys.get(artifact.keyId);
      requireCondition(Boolean(key) && key.validatorId === artifact.validatorId, 'VALIDATOR_UNTRUSTED');
      requireCondition(key.dataOrigin === manifest.dataOrigin, 'TRUST_ORIGIN_MISMATCH');
      requireCondition(key.status === 'active', 'VALIDATOR_KEY_REVOKED');
      requireCondition(key.validFrom <= asOf && key.validUntil >= asOf &&
        artifact.observedAt >= key.validFrom && artifact.expiresAt <= key.validUntil, 'VALIDATOR_KEY_EXPIRED');
      requireCondition(artifact.observedAt <= asOf, 'ARTIFACT_FROM_FUTURE');
      requireCondition(artifact.expiresAt >= asOf, 'ARTIFACT_EXPIRED');
      requireCondition(verify(null, canonicalArtifactBytes(artifact), key.publicKey, Buffer.from(artifact.signature, 'base64')),
        'ARTIFACT_SIGNATURE_INVALID');
      result.validatorAttestationVerified = true;
      result.validatorId = key.validatorId;
      result.keyId = key.keyId;
      result.keyFingerprintSha256 = key.fingerprint;
      result.assertedOutcome = artifact.summary.outcome;
    } catch (error) {
      result.gaps.push(error instanceof ArtifactVerificationError ? error.code : 'ARTIFACT_VERIFICATION_FAILED');
    }
    artifacts.push(result);
  }
  return {
    schemaVersion: 'country_security_artifact_verification_v1', dataOrigin: manifest.dataOrigin,
    assessmentId: manifest.assessmentId, runId: manifest.runId, frameworkId: manifest.frameworkId,
    levelId: manifest.levelId, benchmarkManifestSHA256: manifest.benchmarkManifestSHA256,
    benchmarkRunSHA256: manifest.benchmarkRunSHA256, asOf, artifactCount: artifacts.length,
    artifactIntegrityVerified: artifacts.every((item) => item.artifactIntegrityVerified),
    validatorAttestationVerified: artifacts.every((item) => item.validatorAttestationVerified),
    replayVerified: false, engineEfficacyVerified: false, conclusion: 'not_determined',
    verificationScope: 'local_bytes_and_configured_validator_attestations',
    artifacts, coverageGaps: artifacts.flatMap((item) => item.gaps.map((code) => ({ artifactId: item.artifactId, code }))),
  };
}

async function readInput(file, code) {
  try {
    const info = await stat(file);
    requireCondition(info.isFile() && info.size <= MAX_INPUT_BYTES, 'ARTIFACT_INPUT_TOO_LARGE');
    const bytes = await readFile(file);
    requireCondition(bytes.length <= MAX_INPUT_BYTES, 'ARTIFACT_INPUT_TOO_LARGE');
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof ArtifactVerificationError) throw error;
    throw new ArtifactVerificationError(code);
  }
}

export async function runArtifactCli(args) {
  requireCondition(Array.isArray(args) && (args.length === 3 || (args.length === 5 && args[3] === '--as-of')) &&
    args.slice(0, 3).every((arg) => typeof arg === 'string' && arg.length > 0 && !arg.startsWith('--')),
  'ARTIFACT_CLI_INVALID');
  const [manifest, trustStore] = await Promise.all([
    readInput(args[0], 'ARTIFACT_MANIFEST_UNREADABLE'), readInput(args[1], 'VALIDATOR_TRUST_UNREADABLE'),
  ]);
  return verifyArtifactBundle({ manifest, trustStore, artifactRoot: resolve(args[2]), ...(args[4] ? { asOf: args[4] } : {}) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runArtifactCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.validatorAttestationVerified ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: { code: error instanceof ArtifactVerificationError ? error.code : 'ARTIFACT_VERIFICATION_FAILED' } })}\n`);
    process.exitCode = 2;
  }
}
