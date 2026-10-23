#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const REFERENCE_PATTERN = /^[a-z][a-z0-9._:-]{0,127}$/;
const TOKEN_PATTERN = /(?:^|[._:-])(?:sk-|gh[pous]_|xox[abpr]-|eyj[a-z0-9_-]{16}|akia[a-z0-9]{16}|asia[a-z0-9]{16}|aiza[a-z0-9_-]{30})|[a-f0-9]{32,}/i;
const CREDENTIAL_COMPONENTS = new Set(['token', 'password', 'secret', 'credential', 'bearer']);
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const EVIDENCE_KINDS = ['configuration', 'policy_document', 'independent_review', 'scan_metadata'];
const FRAMEWORK_KINDS = ['impact_classification', 'maturity', 'certification_assurance',
  'preparedness_certification', 'implementation_approach', 'self_declaration', 'governance_tier',
  'control_baseline', 'regulatory_requirements'];
const STATUSES = ['reported_satisfied', 'reported_failed', 'not_assessed', 'not_applicable'];
const REASON_CODES = ['outside_declared_system', 'missing_prerequisite', 'manual_review_required'];
const MAX_FILE_BYTES = 1024 * 1024;

/** Validation errors contain fixed codes, never submitted values or file paths. */
export class HarnessError extends Error {
  constructor(code) { super(code); this.name = 'HarnessError'; this.code = code; }
}

function requireCondition(condition, code) {
  if (!condition) throw new HarnessError(code);
}

function exactObject(value, required, optional, code) {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value), code);
  const keys = Object.keys(value);
  requireCondition(required.every((key) => Object.hasOwn(value, key)), code);
  const allowed = new Set([...required, ...optional]);
  requireCondition(keys.every((key) => allowed.has(key)), code);
}

function safeId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value) && !TOKEN_PATTERN.test(value);
}

export function isSafeEvidenceReference(value) {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value) && !TOKEN_PATTERN.test(value) &&
    !/^(?:https?|file|ftp|s3|gs|data|javascript|wss?):|^[a-z]:/i.test(value) &&
    !value.split(/[._:-]/).some((component) => CREDENTIAL_COMPONENTS.has(component));
}

function textValue(value, max = 4000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function arrayValue(value, max = 200) {
  return Array.isArray(value) && value.length <= max;
}

function unique(values, code) {
  requireCondition(new Set(values).size === values.length, code);
}

function sourceUrl(value) {
  if (!textValue(value, 2000)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      ![...url.searchParams.keys()].some((key) => /token|secret|password|key|credential/i.test(key));
  } catch { return false; }
}

/** Validate source metadata and keep native levels exactly as catalogued. */
export function validateCatalog(catalog) {
  const code = 'CATALOG_INVALID';
  exactObject(catalog, ['schemaVersion', 'catalogVersion', 'reviewedOn', 'controlAreas', 'frameworks'], [], code);
  requireCondition(catalog.schemaVersion === 'country_security_catalog_v1' &&
    textValue(catalog.catalogVersion, 100) && dateValue(catalog.reviewedOn), code);
  requireCondition(arrayValue(catalog.controlAreas) && catalog.controlAreas.length > 0, code);
  for (const control of catalog.controlAreas) {
    exactObject(control, ['id', 'label', 'evidenceKinds'], [], code);
    requireCondition(safeId(control.id) && textValue(control.label) &&
      arrayValue(control.evidenceKinds, EVIDENCE_KINDS.length) && control.evidenceKinds.length > 0 &&
      control.evidenceKinds.every((kind) => EVIDENCE_KINDS.includes(kind)), code);
    unique(control.evidenceKinds, code);
  }
  unique(catalog.controlAreas.map((control) => control.id), code);
  requireCondition(arrayValue(catalog.frameworks) && catalog.frameworks.length > 0, code);
  const controlIds = new Set(catalog.controlAreas.map((control) => control.id));
  for (const framework of catalog.frameworks) {
    exactObject(framework, ['id', 'countryCode', 'countryName', 'label', 'version', 'kind',
      'ordinalLevels', 'currency', 'applicability', 'levelSelection', 'levels', 'controlIds',
      'mappingCoverage', 'sources', 'limitations'], ['jurisdictionType'], code);
    requireCondition(!Object.hasOwn(framework, 'jurisdictionType') ||
      ['country_or_area', 'supranational', 'international'].includes(framework.jurisdictionType), code);
    const jurisdictionType = framework.jurisdictionType ?? 'country_or_area';
    requireCondition(framework.countryCode === 'EU' ? jurisdictionType === 'supranational' :
      framework.countryCode === 'ZZ' ? jurisdictionType === 'international' : jurisdictionType === 'country_or_area', code);
    requireCondition(safeId(framework.id) && COUNTRY_PATTERN.test(framework.countryCode) &&
      textValue(framework.countryName) && textValue(framework.label) && textValue(framework.version, 200) &&
      FRAMEWORK_KINDS.includes(framework.kind) && typeof framework.ordinalLevels === 'boolean' &&
      ['reviewed_reference', 'requires_review'].includes(framework.currency) &&
      textValue(framework.applicability) &&
      ['owner_or_authority', 'assessment_target'].includes(framework.levelSelection) &&
      ['partial', 'overview_only'].includes(framework.mappingCoverage), code);
    requireCondition(arrayValue(framework.levels, 100) && framework.levels.length > 0, code);
    for (const level of framework.levels) {
      exactObject(level, ['id', 'label', 'summary'], [], code);
      requireCondition(safeId(level.id) && textValue(level.label) && textValue(level.summary), code);
    }
    unique(framework.levels.map((level) => level.id), code);
    requireCondition(arrayValue(framework.controlIds) && framework.controlIds.length > 0 &&
      framework.controlIds.every((id) => safeId(id) && controlIds.has(id)), code);
    unique(framework.controlIds, code);
    requireCondition(arrayValue(framework.sources, 50) && framework.sources.length > 0, code);
    for (const source of framework.sources) {
      exactObject(source, ['id', 'title', 'url', 'locator'], [], code);
      requireCondition(safeId(source.id) && textValue(source.title) && sourceUrl(source.url) &&
        textValue(source.locator), code);
    }
    unique(framework.sources.map((source) => source.id), code);
    requireCondition(arrayValue(framework.limitations, 100) && framework.limitations.length > 0 &&
      framework.limitations.every((item) => textValue(item)), code);
  }
  unique(catalog.frameworks.map((framework) => framework.id), code);
  return catalog;
}

function selectFramework(catalog, countryCode, frameworkId, levelId) {
  requireCondition(typeof countryCode === 'string' && COUNTRY_PATTERN.test(countryCode), 'COUNTRY_INVALID');
  const frameworks = catalog.frameworks.filter((framework) => framework.countryCode === countryCode);
  requireCondition(frameworks.length > 0, 'COUNTRY_UNSUPPORTED');
  requireCondition(safeId(frameworkId), 'FRAMEWORK_INVALID');
  const framework = frameworks.find((item) => item.id === frameworkId);
  requireCondition(Boolean(framework), 'FRAMEWORK_UNSUPPORTED');
  requireCondition(safeId(levelId), 'LEVEL_INVALID');
  const level = framework.levels.find((item) => item.id === levelId);
  requireCondition(Boolean(level), 'LEVEL_UNSUPPORTED');
  return { framework, level };
}

export function createEvidenceTemplate(catalog, { countryCode, frameworkId, levelId, assessmentId = 'assessment-example' }) {
  validateCatalog(catalog);
  const { framework } = selectFramework(catalog, countryCode, frameworkId, levelId);
  requireCondition(safeId(assessmentId), 'ASSESSMENT_ID_INVALID');
  return {
    schemaVersion: 'country_security_evidence_v1',
    dataOrigin: 'operator_supplied',
    assessmentId,
    countryCode,
    frameworkId,
    levelId,
    applicabilityConfirmed: false,
    observations: framework.controlIds.map((controlId) => ({
      controlId, status: 'not_assessed', reasonCode: 'manual_review_required',
    })),
  };
}

function validateEvidence(catalog, input) {
  const code = 'EVIDENCE_INVALID';
  exactObject(input, ['schemaVersion', 'dataOrigin', 'assessmentId', 'countryCode', 'frameworkId',
    'levelId', 'applicabilityConfirmed', 'observations'], [], code);
  requireCondition(input.schemaVersion === 'country_security_evidence_v1' &&
    ['synthetic_fixture', 'operator_supplied'].includes(input.dataOrigin) &&
    safeId(input.assessmentId) && isSafeEvidenceReference(input.assessmentId) && typeof input.applicabilityConfirmed === 'boolean' &&
    arrayValue(input.observations), code);
  const selection = selectFramework(catalog, input.countryCode, input.frameworkId, input.levelId);
  const requiredControls = new Set(selection.framework.controlIds);
  const controls = new Map(catalog.controlAreas.map((control) => [control.id, control]));
  for (const observation of input.observations) {
    exactObject(observation, ['controlId', 'status'],
      ['kind', 'evidenceRefs', 'observedAt', 'expiresAt', 'reasonCode'], code);
    requireCondition(safeId(observation.controlId) && requiredControls.has(observation.controlId), 'CONTROL_UNSUPPORTED');
    requireCondition(STATUSES.includes(observation.status), code);
    if (Object.hasOwn(observation, 'kind')) {
      requireCondition(EVIDENCE_KINDS.includes(observation.kind) &&
        controls.get(observation.controlId).evidenceKinds.includes(observation.kind), 'EVIDENCE_KIND_UNSUPPORTED');
    }
    if (Object.hasOwn(observation, 'evidenceRefs')) {
      requireCondition(arrayValue(observation.evidenceRefs, 64) && observation.evidenceRefs.every(isSafeEvidenceReference), 'EVIDENCE_REFS_INVALID');
      unique(observation.evidenceRefs, 'EVIDENCE_REFS_INVALID');
    }
    for (const field of ['observedAt', 'expiresAt']) {
      if (Object.hasOwn(observation, field)) requireCondition(dateValue(observation[field]), 'EVIDENCE_DATE_INVALID');
    }
    if (observation.observedAt && observation.expiresAt) {
      requireCondition(observation.expiresAt >= observation.observedAt, 'EVIDENCE_DATE_INVALID');
    }
    if (Object.hasOwn(observation, 'reasonCode')) {
      requireCondition(REASON_CODES.includes(observation.reasonCode), code);
    }
    if (['reported_satisfied', 'reported_failed'].includes(observation.status)) {
      requireCondition(observation.kind && observation.evidenceRefs?.length > 0 &&
        observation.observedAt && observation.expiresAt, 'EVIDENCE_METADATA_REQUIRED');
    } else {
      requireCondition(!['kind', 'evidenceRefs', 'observedAt', 'expiresAt'].some((field) => Object.hasOwn(observation, field)), code);
      if (observation.status === 'not_applicable') requireCondition(observation.reasonCode, 'EXCLUSION_REASON_REQUIRED');
    }
  }
  unique(input.observations.map((observation) => observation.controlId), 'DUPLICATE_CONTROL');
  // A reference identifies one control's submitted metadata, never a reusable proof for unrelated controls.
  unique(input.observations.flatMap((observation) => observation.evidenceRefs ?? []), 'EVIDENCE_REF_REUSED');
  return selection;
}

/** Project allowlisted metadata only. No artifact body or free-form user text is emitted. */
function controlAssessment(control, observation, asOf) {
  const output = { controlId: control.id, label: control.label, state: 'not_assessed', metadataEvidenceAccepted: false, gaps: [] };
  if (!observation) { output.gaps.push('MISSING_EVIDENCE'); return output; }
  output.state = observation.status;
  if (observation.reasonCode) output.reasonCode = observation.reasonCode;
  if (observation.status === 'not_assessed') { output.gaps.push('NOT_ASSESSED'); return output; }
  if (observation.status === 'not_applicable') { output.gaps.push('CONTROL_EXCLUDED'); return output; }
  if (observation.observedAt > asOf) output.gaps.push('FUTURE_EVIDENCE');
  if (observation.expiresAt < asOf) output.gaps.push('EXPIRED_EVIDENCE');
  if (output.gaps.length > 0) {
    output.state = 'not_assessed';
    output.reportedStatus = observation.status;
    return output;
  }
  output.metadataEvidenceAccepted = true;
  output.evidenceKind = observation.kind;
  output.evidenceRefs = [...observation.evidenceRefs];
  output.observedAt = observation.observedAt;
  output.expiresAt = observation.expiresAt;
  if (observation.status === 'reported_failed') output.gaps.push('CONTROL_REPORTED_FAILED');
  return output;
}

export function assessEvidence(catalog, input, { asOf = new Date().toISOString().slice(0, 10) } = {}) {
  validateCatalog(catalog);
  requireCondition(dateValue(asOf), 'ASSESSMENT_DATE_INVALID');
  const { framework, level } = validateEvidence(catalog, input);
  const observations = new Map(input.observations.map((observation) => [observation.controlId, observation]));
  const areas = new Map(catalog.controlAreas.map((control) => [control.id, control]));
  const controls = framework.controlIds.map((id) => controlAssessment(areas.get(id), observations.get(id), asOf));
  const gaps = controls.flatMap((control) => control.gaps.map((code) => ({ controlId: control.controlId, code })));
  if (!input.applicabilityConfirmed) gaps.unshift({ code: 'APPLICABILITY_UNCONFIRMED' });
  if (framework.currency === 'requires_review') gaps.push({ code: 'FRAMEWORK_REVIEW_REQUIRED' });
  gaps.push({ code: framework.mappingCoverage === 'overview_only' ? 'MAPPING_OVERVIEW_ONLY' : 'MAPPING_PARTIAL' });
  return {
    schemaVersion: 'country_security_assessment_v1',
    catalogVersion: catalog.catalogVersion,
    catalogReviewedOn: catalog.reviewedOn,
    asOf,
    dataOrigin: input.dataOrigin,
    assessmentId: input.assessmentId,
    countryCode: framework.countryCode,
    countryName: framework.countryName,
    applicabilityConfirmed: input.applicabilityConfirmed,
    conclusion: 'not_determined',
    formalLevelDetermination: false,
    levelSource: 'operator_selected',
    framework: {
      id: framework.id, label: framework.label, version: framework.version, kind: framework.kind,
      ordinalLevels: framework.ordinalLevels, currency: framework.currency,
      jurisdictionType: framework.jurisdictionType ?? 'country_or_area',
      applicability: framework.applicability, levelSelection: framework.levelSelection,
      mappingCoverage: framework.mappingCoverage,
      selectedLevel: { id: level.id, label: level.label, summary: level.summary },
      sources: framework.sources.map((source) => ({ id: source.id, title: source.title, url: source.url, locator: source.locator })),
    },
    controls,
    coverage: {
      mappedControlCount: controls.length,
      reportedSatisfiedCount: controls.filter((control) => control.state === 'reported_satisfied').length,
      reportedFailedCount: controls.filter((control) => control.state === 'reported_failed').length,
      notAssessedCount: controls.filter((control) => control.state === 'not_assessed').length,
      notApplicableCount: controls.filter((control) => control.state === 'not_applicable').length,
      metadataAcceptedCount: controls.filter((control) => control.metadataEvidenceAccepted).length,
      gaps,
    },
    limitations: [
      'Operator-supplied metadata is not independently verified evidence or a certification decision.',
      'Applicability confirmation records an operator assertion; other applicable sector rules may remain outside this catalog.',
      'The selected native level is declared by the operator and does not authorize scanning or change pentest findings.',
      ...framework.limitations,
    ],
  };
}

function parseCli(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { command: 'help' };
  const [command, ...rest] = args;
  if (command === 'list' && rest.length <= 1) return { command, countryCode: rest[0] };
  if (command === 'template' && rest.length === 3) return { command, countryCode: rest[0], frameworkId: rest[1], levelId: rest[2] };
  if (command === 'validate-catalog' && rest.length === 0) return { command };
  if (command === 'assess' && (rest.length === 1 || (rest.length === 3 && rest[1] === '--as-of'))) {
    requireCondition(rest[0].length > 0 && !rest[0].startsWith('--'), 'CLI_ARGUMENTS_INVALID');
    if (rest.length === 3) requireCondition(dateValue(rest[2]), 'ASSESSMENT_DATE_INVALID');
    return { command, file: rest[0], asOf: rest[2] };
  }
  throw new HarnessError('CLI_ARGUMENTS_INVALID');
}

async function loadJson(file, code) {
  try {
    const info = await stat(file);
    requireCondition(info.isFile() && info.size <= MAX_FILE_BYTES, 'INPUT_SIZE_LIMIT');
    const content = await readFile(file, 'utf8');
    requireCondition(Buffer.byteLength(content, 'utf8') <= MAX_FILE_BYTES, 'INPUT_SIZE_LIMIT');
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    throw new HarnessError(code);
  }
}

/** Same parser and dispatcher serve the CLI and isolated tests. */
export async function runCli(args, { catalog, readEvidence } = {}) {
  const options = parseCli(args);
  if (options.command === 'help') return { usage: [
    'node harness.mjs list [COUNTRY]',
    'node harness.mjs template COUNTRY FRAMEWORK LEVEL',
    'node harness.mjs assess FILE [--as-of YYYY-MM-DD]',
    'node harness.mjs validate-catalog',
  ] };
  const selectedCatalog = catalog ?? await loadJson(new URL('./catalog.json', import.meta.url), 'CATALOG_READ_FAILED');
  validateCatalog(selectedCatalog);
  if (options.command === 'validate-catalog') return {
    valid: true, catalogVersion: selectedCatalog.catalogVersion,
    frameworkCount: selectedCatalog.frameworks.length,
    countryCount: new Set(selectedCatalog.frameworks.filter((framework) =>
      !['supranational', 'international'].includes(framework.jurisdictionType)).map((framework) => framework.countryCode)).size,
    jurisdictionCount: new Set(selectedCatalog.frameworks.map((framework) => framework.countryCode)).size,
  };
  if (options.command === 'list') {
    if (options.countryCode !== undefined) {
      requireCondition(COUNTRY_PATTERN.test(options.countryCode), 'COUNTRY_INVALID');
      requireCondition(selectedCatalog.frameworks.some((item) => item.countryCode === options.countryCode), 'COUNTRY_UNSUPPORTED');
    }
    return {
      schemaVersion: selectedCatalog.schemaVersion, catalogVersion: selectedCatalog.catalogVersion,
      frameworks: selectedCatalog.frameworks.filter((item) => !options.countryCode || item.countryCode === options.countryCode)
        .map((framework) => ({ id: framework.id, countryCode: framework.countryCode, countryName: framework.countryName,
          label: framework.label, version: framework.version, ordinalLevels: framework.ordinalLevels,
          jurisdictionType: framework.jurisdictionType ?? 'country_or_area',
          currency: framework.currency, kind: framework.kind, applicability: framework.applicability,
          mappingCoverage: framework.mappingCoverage, levelSelection: framework.levelSelection,
          levels: framework.levels.map((level) => ({ id: level.id, label: level.label })) })),
    };
  }
  if (options.command === 'template') return createEvidenceTemplate(selectedCatalog, options);
  const input = readEvidence ? await readEvidence(options.file) : await loadJson(options.file, 'EVIDENCE_READ_FAILED');
  return assessEvidence(selectedCatalog, input, options.asOf ? { asOf: options.asOf } : {});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(await runCli(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    const code = error instanceof HarnessError ? error.code : 'HARNESS_FAILED';
    process.stderr.write(`${JSON.stringify({ error: { code } })}\n`);
    process.exitCode = 1;
  }
}
