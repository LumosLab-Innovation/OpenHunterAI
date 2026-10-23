import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isSafeEvidenceReference } from './harness.mjs';

const SAFE_ID = /^[a-z][a-z0-9_-]{0,79}$/;
const ARTIFACT_REF = /^artifact:(baseline|probe|impact|replay|negative):([a-z][a-z0-9_-]{0,79})$/;
const CATEGORIES = ['xss', 'sqli', 'idor'];
const CONTROL_BY_CATEGORY = { xss: 'application_security', sqli: 'application_security', idor: 'identity_access' };
const DATA_ORIGINS = new Set(['synthetic_fixture', 'operator_supplied']);
const OUTCOMES = new Set(['detected', 'clear', 'inconclusive', 'skipped']);
const LIMIT = 2000;
const MAX_FILE_BYTES = 1024 * 1024;

export const BENCHMARK_COVERAGE_GAP_CODES = Object.freeze([
  'EXECUTION_UNAVAILABLE', 'BUDGET_EXHAUSTED', 'VALIDATOR_UNAVAILABLE',
  'ARTIFACT_UNAVAILABLE', 'SCOPE_NOT_EXECUTED',
]);
const GAP_CODES = new Set(BENCHMARK_COVERAGE_GAP_CODES);

export class BenchmarkInputError extends Error {
  constructor(code) {
    // Codes are fixed constants. Never interpolate an input value or file path.
    super(code);
    this.name = 'BenchmarkInputError';
    this.code = code;
  }
}

function requireCondition(condition, code) {
  if (!condition) throw new BenchmarkInputError(code);
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function fields(value, required, optional, code) {
  requireCondition(record(value), code);
  const accepted = new Set([...required, ...optional]);
  requireCondition(required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => accepted.has(key)), code);
}

function safeId(value) {
  return typeof value === 'string' && SAFE_ID.test(value) && isSafeEvidenceReference(value);
}

function validateManifest(manifest) {
  fields(manifest, ['schemaVersion', 'dataOrigin', 'cases', 'thresholds'], [], 'INVALID_MANIFEST');
  requireCondition(manifest.schemaVersion === 'country_security_benchmark_manifest_v1'
    && manifest.dataOrigin === 'synthetic_fixture', 'INVALID_MANIFEST');
  requireCondition(Array.isArray(manifest.cases) && manifest.cases.length > 0
    && manifest.cases.length <= LIMIT, 'INVALID_MANIFEST_CASES');
  fields(manifest.thresholds,
    ['minRecall', 'maxFalsePositiveRate', 'minEvidenceCompleteness', 'minExecutionCoverage'],
    [], 'INVALID_THRESHOLDS');
  requireCondition(Object.values(manifest.thresholds).every((value) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1),
  'INVALID_THRESHOLDS');

  const casesById = new Map();
  const pairs = new Map();
  const categories = new Set();
  for (const entry of manifest.cases) {
    fields(entry, ['id', 'pairId', 'category', 'controlId', 'expected'], [], 'INVALID_CASE');
    requireCondition(safeId(entry.id) && safeId(entry.pairId)
      && CATEGORIES.includes(entry.category)
      && entry.controlId === CONTROL_BY_CATEGORY[entry.category]
      && ['detected', 'clear'].includes(entry.expected), 'INVALID_CASE');
    requireCondition(!casesById.has(entry.id), 'DUPLICATE_CASE');
    casesById.set(entry.id, entry);
    categories.add(entry.category);
    const pair = pairs.get(entry.pairId) ?? [];
    pair.push(entry);
    pairs.set(entry.pairId, pair);
  }
  for (const pair of pairs.values()) {
    requireCondition(pair.length === 2
      && pair[0].category === pair[1].category
      && pair[0].controlId === pair[1].controlId
      && new Set(pair.map((entry) => entry.expected)).size === 2, 'INVALID_CASE_PAIRS');
  }
  requireCondition(CATEGORIES.every((category) => categories.has(category)), 'MISSING_CATEGORY');
  return casesById;
}

function validateRun(run, casesById) {
  fields(run, ['schemaVersion', 'dataOrigin', 'frameworkId', 'levelId', 'producerId', 'results', 'coverageGaps'],
    [], 'INVALID_RUN');
  requireCondition(run.schemaVersion === 'country_security_benchmark_run_v1'
    && DATA_ORIGINS.has(run.dataOrigin) && safeId(run.frameworkId)
    && safeId(run.levelId) && safeId(run.producerId), 'INVALID_RUN');
  requireCondition(Array.isArray(run.results) && run.results.length <= LIMIT, 'INVALID_RESULTS');
  requireCondition(Array.isArray(run.coverageGaps) && run.coverageGaps.length <= GAP_CODES.size
    && run.coverageGaps.every((code) => GAP_CODES.has(code))
    && new Set(run.coverageGaps).size === run.coverageGaps.length, 'INVALID_COVERAGE_GAPS');
  const resultsById = new Map();
  for (const result of run.results) {
    fields(result, ['caseId', 'outcome'], ['validatorId', 'evidenceRefs'], 'INVALID_RESULT');
    requireCondition(safeId(result.caseId) && OUTCOMES.has(result.outcome), 'INVALID_RESULT');
    requireCondition(!Object.hasOwn(result, 'validatorId') || safeId(result.validatorId), 'INVALID_RESULT');
    requireCondition(!Object.hasOwn(result, 'evidenceRefs')
      || (Array.isArray(result.evidenceRefs) && result.evidenceRefs.length <= 25
        && result.evidenceRefs.every((ref) => typeof ref === 'string' && ARTIFACT_REF.test(ref) && isSafeEvidenceReference(ref))),
    'INVALID_EVIDENCE_REFERENCE');
    requireCondition(casesById.has(result.caseId), 'UNKNOWN_CASE');
    requireCondition(!resultsById.has(result.caseId), 'DUPLICATE_RESULT');
    resultsById.set(result.caseId, result);
  }
  return resultsById;
}

function validateMapping(catalog, manifest, run) {
  requireCondition(record(catalog) && Array.isArray(catalog.frameworks), 'INVALID_CATALOG');
  const frameworksById = new Map();
  for (const framework of catalog.frameworks) {
    requireCondition(record(framework) && safeId(framework.id)
      && !frameworksById.has(framework.id), 'INVALID_CATALOG');
    frameworksById.set(framework.id, framework);
  }
  const framework = frameworksById.get(run.frameworkId);
  requireCondition(Boolean(framework), 'UNKNOWN_FRAMEWORK');
  requireCondition(Array.isArray(framework.levels)
    && framework.levels.every((level) => record(level) && safeId(level.id))
    && new Set(framework.levels.map((level) => level.id)).size === framework.levels.length
    && Array.isArray(framework.controlIds)
    && framework.controlIds.every(safeId)
    && new Set(framework.controlIds).size === framework.controlIds.length, 'INVALID_CATALOG');
  requireCondition(framework.levels.some((level) => level.id === run.levelId), 'UNKNOWN_LEVEL');
  requireCondition(manifest.cases.every((entry) => framework.controlIds.includes(entry.controlId)),
    'UNMAPPED_CONTROL');
}

function evidenceMetadata(result, producerId) {
  const independent = safeId(result.validatorId) && result.validatorId !== producerId;
  const required = result.outcome === 'detected'
    ? ['baseline', 'probe', 'impact', 'replay']
    : ['baseline', 'probe', 'negative', 'replay'];
  const refs = result.evidenceRefs ?? [];
  const roles = new Set();
  const artifactIds = new Set();
  let unique = new Set(refs).size === refs.length;
  for (const ref of refs) {
    const [, role, artifactId] = ARTIFACT_REF.exec(ref);
    roles.add(role);
    if (artifactIds.has(artifactId)) unique = false;
    artifactIds.add(artifactId);
  }
  return { independent, complete: independent && unique && required.every((role) => roles.has(role)) };
}

function casesWithReusedEvidence(resultsById) {
  const firstCaseByArtifact = new Map();
  const reusedCases = new Set();
  for (const result of resultsById.values()) {
    if (!['detected', 'clear'].includes(result.outcome)) continue;
    for (const ref of result.evidenceRefs ?? []) {
      const artifactId = ARTIFACT_REF.exec(ref)[2];
      const firstCase = firstCaseByArtifact.get(artifactId);
      if (firstCase !== undefined && firstCase !== result.caseId) {
        reusedCases.add(firstCase);
        reusedCases.add(result.caseId);
      } else {
        firstCaseByArtifact.set(artifactId, result.caseId);
      }
    }
  }
  return reusedCases;
}

function counters() {
  return {
    cases: 0, positives: 0, negatives: 0, truePositives: 0, falsePositives: 0, trueNegatives: 0,
    evidenceComplete: 0, executionsComplete: 0, missing: 0, skipped: 0, inconclusive: 0,
  };
}

function metrics(count, thresholds) {
  const values = {
    ...count,
    // Ground truth is the denominator, including missing and inconclusive cases.
    falseNegatives: count.positives - count.truePositives,
    recall: count.truePositives / count.positives,
    falsePositiveRate: count.falsePositives / count.negatives,
    evidenceCompleteness: count.evidenceComplete / count.cases,
    executionCoverage: count.executionsComplete / count.cases,
  };
  return {
    ...values,
    gates: {
      recall: values.recall >= thresholds.minRecall,
      falsePositiveRate: values.falsePositiveRate <= thresholds.maxFalsePositiveRate,
      evidenceCompleteness: values.evidenceCompleteness >= thresholds.minEvidenceCompleteness,
      executionCoverage: values.executionCoverage >= thresholds.minExecutionCoverage,
    },
  };
}

/**
 * Scores declared case results against paired synthetic ground truth, offline.
 * Artifact reference syntax and distinct validator IDs are metadata only: this
 * function never fetches artifacts, authenticates validators, or replays a probe.
 * A passing metadata gate cannot determine security or qualify engine efficacy.
 */
export function scoreCountryBenchmark(catalog, manifest, run) {
  const casesById = validateManifest(manifest);
  const resultsById = validateRun(run, casesById);
  validateMapping(catalog, manifest, run);
  const reusedEvidenceCases = casesWithReusedEvidence(resultsById);
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, counters()]));
  const coverageGaps = new Set(run.coverageGaps);
  for (const entry of casesById.values()) {
    const count = byCategory[entry.category];
    count.cases += 1;
    count[entry.expected === 'detected' ? 'positives' : 'negatives'] += 1;
    const result = resultsById.get(entry.id);
    if (!result) {
      count.missing += 1;
      coverageGaps.add('MISSING_CASE_RESULTS');
      continue;
    }
    if (entry.expected === 'clear' && result.outcome === 'detected') count.falsePositives += 1;
    if (result.outcome === 'skipped' || result.outcome === 'inconclusive') {
      count[result.outcome] += 1;
      coverageGaps.add(result.outcome === 'skipped' ? 'SKIPPED_CASE_RESULTS' : 'INCONCLUSIVE_CASE_RESULTS');
      continue;
    }
    const evidence = evidenceMetadata(result, run.producerId);
    if (!evidence.complete || reusedEvidenceCases.has(entry.id)) {
      count.inconclusive += 1;
      coverageGaps.add('INCOMPLETE_EVIDENCE_METADATA');
      if (!evidence.independent) coverageGaps.add('NON_INDEPENDENT_VALIDATOR');
      if (reusedEvidenceCases.has(entry.id)) coverageGaps.add('REUSED_CASE_EVIDENCE_METADATA');
      continue;
    }
    count.evidenceComplete += 1;
    count.executionsComplete += 1;
    if (entry.expected === 'detected' && result.outcome === 'detected') count.truePositives += 1;
    if (entry.expected === 'clear' && result.outcome === 'clear') count.trueNegatives += 1;
  }
  const overall = counters();
  for (const count of Object.values(byCategory)) {
    for (const key of Object.keys(overall)) overall[key] += count[key];
  }
  const scoredCategories = Object.fromEntries(CATEGORIES.map((category) =>
    [category, metrics(byCategory[category], manifest.thresholds)]));
  const overallMetrics = metrics(overall, manifest.thresholds);
  const gateFailures = new Set();
  for (const score of Object.values(scoredCategories)) {
    for (const [gate, passed] of Object.entries(score.gates)) {
      if (!passed) gateFailures.add({
        recall: 'RECALL_BELOW_THRESHOLD', falsePositiveRate: 'FALSE_POSITIVE_RATE_ABOVE_THRESHOLD',
        evidenceCompleteness: 'EVIDENCE_COMPLETENESS_BELOW_THRESHOLD',
        executionCoverage: 'EXECUTION_COVERAGE_BELOW_THRESHOLD',
      }[gate]);
    }
  }
  if (coverageGaps.size > 0) gateFailures.add('COVERAGE_GAPS_PRESENT');
  return {
    schemaVersion: 'country_security_benchmark_score_v1',
    dataOrigin: run.dataOrigin,
    groundTruthOrigin: manifest.dataOrigin,
    frameworkId: run.frameworkId,
    levelId: run.levelId,
    gateScope: 'declared_benchmark_metadata',
    metadataGatePassed: gateFailures.size === 0,
    assessmentConclusion: 'not_determined',
    replayVerified: false,
    engineEfficacyVerified: false,
    evidenceVerification: 'reference_syntax_and_declared_validator_only',
    thresholds: { ...manifest.thresholds },
    metrics: { overall: overallMetrics, byCategory: scoredCategories },
    coverageGaps: [...coverageGaps].sort(),
    gateFailures: [...gateFailures].sort(),
  };
}

async function readJson(path) {
  let information;
  try {
    information = await stat(path);
  } catch {
    throw new BenchmarkInputError('INPUT_FILE_UNREADABLE');
  }
  requireCondition(information.isFile(), 'INPUT_FILE_UNREADABLE');
  requireCondition(information.size <= MAX_FILE_BYTES, 'INPUT_FILE_TOO_LARGE');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new BenchmarkInputError('INPUT_FILE_UNREADABLE');
  }
  requireCondition(Buffer.byteLength(raw, 'utf8') <= MAX_FILE_BYTES, 'INPUT_FILE_TOO_LARGE');
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new BenchmarkInputError('INPUT_JSON_INVALID');
  }
}

async function main(args) {
  let catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), 'catalog.json');
  const positional = [];
  let hasCatalog = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--catalog') {
      requireCondition(!hasCatalog && typeof args[index + 1] === 'string'
        && !args[index + 1].startsWith('--'), 'INVALID_CLI_ARGUMENTS');
      catalogPath = args[++index];
      hasCatalog = true;
    } else {
      requireCondition(!arg.startsWith('--'), 'INVALID_CLI_ARGUMENTS');
      positional.push(arg);
    }
  }
  requireCondition(positional.length === 2, 'INVALID_CLI_ARGUMENTS');
  const inputs = await Promise.all([readJson(catalogPath), readJson(positional[0]), readJson(positional[1])]);
  const result = scoreCountryBenchmark(...inputs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.metadataGatePassed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    const code = error instanceof BenchmarkInputError ? error.code : 'BENCHMARK_INPUT_ERROR';
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = 2;
  });
}
