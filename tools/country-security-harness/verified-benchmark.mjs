#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scoreCountryBenchmark } from './benchmark.mjs';
import { ArtifactVerificationError, canonicalJsonBytes, verifyArtifactBundle } from './artifact-verifier.mjs';

const digest = (value) => createHash('sha256').update(canonicalJsonBytes(value)).digest('hex');
/** Join syntax scoring to trusted artifact attestations without upgrading them to actual replay. */
export async function scoreVerifiedBenchmark({ catalog, benchmarkManifest, run, bundle, trustStore, artifactRoot,
  asOf = new Date().toISOString().slice(0, 10) }) {
  const metadataScore = scoreCountryBenchmark(catalog, benchmarkManifest, run);
  const coverageGaps = [];
  const add = (code, caseId) => coverageGaps.push(caseId ? { code, caseId } : { code });
  const identityBound = ['frameworkId', 'levelId', 'producerId', 'dataOrigin'].every((key) => bundle?.[key] === run[key]);
  const digestBound = bundle?.benchmarkManifestSHA256 === digest(benchmarkManifest) &&
    bundle?.benchmarkRunSHA256 === digest(run);
  if (!identityBound) add('BENCHMARK_BUNDLE_BINDING_MISMATCH');
  if (!digestBound) add('BENCHMARK_INPUT_DIGEST_MISMATCH');
  const artifacts = await verifyArtifactBundle({ artifactRoot, manifest: bundle, trustStore, asOf });
  const byId = new Map(artifacts.artifacts.map((item) => [item.artifactId, item]));
  const referencedIds = new Set();
  for (const result of run.results) {
    for (const reference of result.evidenceRefs ?? []) {
      const [, role, artifactId] = /^artifact:(baseline|probe|impact|replay|negative):([a-z][a-z0-9_-]{0,79})$/.exec(reference);
      referencedIds.add(artifactId);
      const artifact = byId.get(artifactId);
      if (!artifact) add('BENCHMARK_ARTIFACT_MISSING', result.caseId);
      else if (artifact.caseId !== result.caseId || artifact.role !== role ||
        artifact.validatorId !== result.validatorId || artifact.assertedOutcome !== result.outcome)
        add('BENCHMARK_ATTESTATION_BINDING_MISMATCH', result.caseId);
      else if (!artifact.validatorAttestationVerified || !artifact.artifactIntegrityVerified)
        add('BENCHMARK_ARTIFACT_UNVERIFIED', result.caseId);
    }
  }
  if (artifacts.artifacts.some((item) => !referencedIds.has(item.artifactId))) add('UNREFERENCED_BUNDLE_ARTIFACT');
  for (const gap of artifacts.coverageGaps) coverageGaps.push({ ...gap });
  const attestationGatePassed = metadataScore.metadataGatePassed && identityBound && digestBound &&
    artifacts.artifactIntegrityVerified && artifacts.validatorAttestationVerified && !coverageGaps.length;
  return { schemaVersion: 'country_security_verified_benchmark_score_v1', dataOrigin: run.dataOrigin,
    asOf, assessmentId: bundle.assessmentId, runId: bundle.runId, frameworkId: run.frameworkId, levelId: run.levelId,
    benchmarkManifestSHA256: digest(benchmarkManifest), benchmarkRunSHA256: digest(run),
    metadataGatePassed: metadataScore.metadataGatePassed, attestationGatePassed,
    artifactIntegrityVerified: artifacts.artifactIntegrityVerified,
    validatorAttestationVerified: artifacts.validatorAttestationVerified,
    replayVerified: false, engineEfficacyVerified: false, assessmentConclusion: 'not_determined',
    evidenceVerification: 'local_bytes_configured_validator_signatures_and_bound_benchmark_inputs',
    metadataScore, artifactVerification: artifacts, coverageGaps,
    limitations: [
      'An attestation gate authenticates configured validator statements and local bytes; the harness executes no probe or replay.',
      'Trusted key enrollment is a separate operator responsibility; a signature does not establish the correctness of the asserted outcome.',
      'Neither the metadata gate nor the attestation gate determines certification, national system levels or engine efficacy.',
    ] };
}

async function load(file) {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > 1024 * 1024) throw new ArtifactVerificationError('BENCHMARK_INPUT_TOO_LARGE');
    const bytes = await readFile(file);
    if (bytes.length > 1024 * 1024) throw new ArtifactVerificationError('BENCHMARK_INPUT_TOO_LARGE');
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof ArtifactVerificationError) throw error;
    throw new ArtifactVerificationError('BENCHMARK_INPUT_READ_FAILED');
  }
}
export async function runVerifiedBenchmarkCli(args) {
  if (!((args.length === 5 || (args.length === 7 && args[5] === '--as-of')) &&
    args.slice(0, 5).every((item) => typeof item === 'string' && item.length > 0 && !item.startsWith('--'))))
    throw new ArtifactVerificationError('CLI_ARGUMENTS_INVALID');
  const [catalog, benchmarkManifest, run, bundle, trustStore] = await Promise.all([
    load(new URL('./catalog.json', import.meta.url)), ...args.slice(0, 4).map(load) ]);
  return scoreVerifiedBenchmark({ catalog, benchmarkManifest, run, bundle, trustStore,
    artifactRoot: resolve(args[4]), ...(args[6] ? { asOf: args[6] } : {}) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runVerifiedBenchmarkCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.attestationGatePassed ? 0 : 1;
  } catch (error) {
    const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code) ? error.code : 'VERIFIED_BENCHMARK_FAILED';
    process.stderr.write(`${JSON.stringify({ error: { code } })}\n`); process.exitCode = 2;
  }
}
