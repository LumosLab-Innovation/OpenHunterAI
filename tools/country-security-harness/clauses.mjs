#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { validateCatalog, isSafeEvidenceReference } from './harness.mjs';

const ID = /^[a-z][a-z0-9._-]{0,63}$/;
const TOKEN = /(?:^|[._:-])(?:sk-|gh[pous]_|xox[abpr]-|eyj[a-z0-9_-]{16}|akia[a-z0-9]{16}|asia[a-z0-9]{16}|aiza[a-z0-9_-]{30})|[a-f0-9]{32,}/i;
const KINDS = ['configuration', 'policy_document', 'independent_review', 'scan_metadata'];
const MAX_BYTES = 1024 * 1024;
export class ClauseError extends Error {
  constructor(code) { super(code); this.name = 'ClauseError'; this.code = code; }
}
function must(condition, code) { if (!condition) throw new ClauseError(code); }
function shape(value, required, optional = [], code = 'PACK_INVALID') {
  must(value && typeof value === 'object' && !Array.isArray(value), code);
  must(required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => [...required, ...optional].includes(key)), code);
}
function id(value) { return typeof value === 'string' && ID.test(value) && !TOKEN.test(value); }
function label(value, max = 4000) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function list(value, max = 1000) { return Array.isArray(value) && value.length <= max; }
function distinct(items, code) { must(new Set(items).size === items.length, code); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export function requirementPackSha256(pack) {
  return createHash('sha256').update(JSON.stringify(canonical(pack))).digest('hex');
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const result = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === value;
}
function safeSource(value) {
  try {
    const url = new URL(value);
    return label(value, 2000) && url.protocol === 'https:' && !url.username && !url.password &&
      ![...url.searchParams.keys()].some((key) => /token|secret|password|credential|api.?key/i.test(key));
  } catch { return false; }
}

/** Curated clauses retain explicit level membership, never infer a country's hierarchy. */
export function validateRequirementPack(catalog, pack) {
  validateCatalog(catalog);
  const code = 'PACK_INVALID';
  shape(pack, ['schemaVersion', 'packId', 'frameworkId', 'version', 'reviewedOn', 'coverage',
    'sources', 'limitations', 'requirements']);
  must(pack.schemaVersion === 'country_security_requirement_pack_v1' && id(pack.packId) &&
    id(pack.frameworkId) && label(pack.version, 400) && date(pack.reviewedOn) && pack.coverage === 'partial', code);
  const framework = catalog.frameworks.find((item) => item.id === pack.frameworkId);
  must(framework, 'PACK_FRAMEWORK_UNSUPPORTED');
  must(list(pack.sources, 50) && pack.sources.length > 0 && list(pack.limitations, 100) &&
    pack.limitations.length > 0 && pack.limitations.every((item) => label(item)), code);
  for (const source of pack.sources) {
    shape(source, ['id', 'title', 'url', 'locator']);
    must(id(source.id) && label(source.title) && safeSource(source.url) && label(source.locator), code);
  }
  distinct(pack.sources.map((item) => item.id), code);
  const sources = new Set(pack.sources.map((item) => item.id));
  const levels = new Set(framework.levels.map((item) => item.id));
  const controls = new Set(framework.controlIds);
  must(list(pack.requirements) && pack.requirements.length > 0, code);
  const factTypes = new Map();
  for (const requirement of pack.requirements) {
    shape(requirement, ['id', 'label', 'controlId', 'levels', 'levelBasis', 'sourceId', 'locator',
      'normativeStrength', 'applicability', 'check', 'evidenceKinds', 'interpretationNotes']);
    must(id(requirement.id) && label(requirement.label) && controls.has(requirement.controlId) &&
      list(requirement.levels, 100) && requirement.levels.length > 0 &&
      requirement.levels.every((item) => levels.has(item)) &&
      ['explicit_clause', 'framework_wide', 'cumulative_minimum'].includes(requirement.levelBasis) &&
      sources.has(requirement.sourceId) && label(requirement.locator) &&
      ['mandatory', 'recommendation'].includes(requirement.normativeStrength) &&
      label(requirement.interpretationNotes), code);
    distinct(requirement.levels, code);
    must(list(requirement.evidenceKinds, KINDS.length) && requirement.evidenceKinds.length > 0 &&
      requirement.evidenceKinds.every((item) => KINDS.includes(item)), code);
    distinct(requirement.evidenceKinds, code);
    must(list(requirement.applicability, 20), code);
    for (const predicate of requirement.applicability) {
      shape(predicate, ['factId', 'equals']);
      must(id(predicate.factId) && (typeof predicate.equals === 'boolean' || id(predicate.equals)), code);
    }
    distinct(requirement.applicability.map((item) => item.factId), code);
    const check = requirement.check;
    must(check && typeof check === 'object' && !Array.isArray(check), code);
    if (check.type === 'boolean') {
      shape(check, ['type', 'factId', 'expected']);
      must(id(check.factId) && typeof check.expected === 'boolean', code);
    } else if (check.type === 'number') {
      shape(check, ['type', 'factId', 'max', 'unit']);
      must(id(check.factId) && Number.isFinite(check.max) && check.max >= 0 &&
        ['days', 'hours', 'months', 'count', 'bits'].includes(check.unit), code);
    } else if (check.type === 'enum') {
      shape(check, ['type', 'factId', 'allowedValues']);
      must(id(check.factId) && list(check.allowedValues, 100) && check.allowedValues.length > 0 &&
        check.allowedValues.every(id), code);
      distinct(check.allowedValues, code);
    } else {
      shape(check, ['type', 'reviewTopic']);
      must(check.type === 'manual' && label(check.reviewTopic), code);
    }
    if (check.type !== 'manual') {
      const previous = factTypes.get(check.factId);
      must(!previous || (previous.type === check.type && previous.unit === check.unit), 'PACK_FACT_TYPE_CONFLICT');
      factTypes.set(check.factId, { type: check.type, unit: check.unit });
    }
  }
  distinct(pack.requirements.map((item) => item.id), code);
  return pack;
}

function selected(catalog, pack, levelId) {
  validateRequirementPack(catalog, pack);
  const framework = catalog.frameworks.find((item) => item.id === pack.frameworkId);
  must(id(levelId) && framework.levels.some((item) => item.id === levelId), 'LEVEL_UNSUPPORTED');
  return pack.requirements.filter((item) => item.levels.includes(levelId));
}

export function createClauseTemplate(catalog, pack, levelId) {
  selected(catalog, pack, levelId);
  return { schemaVersion: 'country_security_clause_evidence_v1', dataOrigin: 'operator_supplied',
    assessmentId: 'assessment-example', packId: pack.packId, packVersion: pack.version,
    packSha256: requirementPackSha256(pack), levelId, applicabilityConfirmed: false,
    context: [], observations: [] };
}

function validateInput(pack, requirements, input) {
  const code = 'CLAUSE_EVIDENCE_INVALID';
  shape(input, ['schemaVersion', 'dataOrigin', 'assessmentId', 'packId', 'packVersion', 'packSha256', 'levelId',
    'applicabilityConfirmed', 'context', 'observations'], [], code);
  must(input.schemaVersion === 'country_security_clause_evidence_v1' &&
    ['synthetic_fixture', 'operator_supplied'].includes(input.dataOrigin) && id(input.assessmentId) &&
    isSafeEvidenceReference(input.assessmentId) &&
    input.packId === pack.packId && typeof input.applicabilityConfirmed === 'boolean' &&
    list(input.context, 200) && list(input.observations), code);
  must(input.packVersion === pack.version && input.packSha256 === requirementPackSha256(pack), 'PACK_SNAPSHOT_MISMATCH');
  const contextTypes = new Map();
  const checks = new Map();
  for (const requirement of requirements) {
    for (const predicate of requirement.applicability) {
      const types = contextTypes.get(predicate.factId) ?? new Set();
      types.add(typeof predicate.equals); contextTypes.set(predicate.factId, types);
    }
    if (requirement.check.type !== 'manual') {
      const items = checks.get(requirement.check.factId) ?? [];
      items.push(requirement.check); checks.set(requirement.check.factId, items);
    }
  }
  for (const item of input.context) {
    shape(item, ['factId', 'value'], [], code);
    const types = contextTypes.get(item.factId);
    must(id(item.factId) && types && types.has(typeof item.value) &&
      (typeof item.value === 'boolean' || id(item.value)), code);
  }
  distinct(input.context.map((item) => item.factId), code);
  for (const item of input.observations) {
    shape(item, ['factId', 'value', 'kind', 'evidenceRefs', 'observedAt', 'expiresAt'], [], code);
    const definitions = checks.get(item.factId);
    must(id(item.factId) && definitions && KINDS.includes(item.kind) &&
      list(item.evidenceRefs, 20) && item.evidenceRefs.length > 0 &&
      item.evidenceRefs.every(isSafeEvidenceReference) && date(item.observedAt) && date(item.expiresAt) &&
      item.observedAt <= item.expiresAt, code);
    const check = definitions[0];
    must(check.type === 'boolean' ? typeof item.value === 'boolean' : check.type === 'number' ?
      Number.isFinite(item.value) && item.value >= 0 && (check.unit !== 'count' || Number.isInteger(item.value)) : id(item.value), code);
    distinct(item.evidenceRefs, code);
  }
  distinct(input.observations.map((item) => item.factId), code);
}

/** Facts are operator declarations. Matching a predicate never verifies artifact content. */
export function assessClauses(catalog, pack, input, { asOf = new Date().toISOString().slice(0, 10) } = {}) {
  must(date(asOf), 'ASSESSMENT_DATE_INVALID');
  const requirements = selected(catalog, pack, input?.levelId);
  validateInput(pack, requirements, input);
  const context = new Map(input.context.map((item) => [item.factId, item.value]));
  const observations = new Map(input.observations.map((item) => [item.factId, item]));
  const clauses = requirements.map((requirement) => {
    const result = { requirementId: requirement.id, label: requirement.label, controlId: requirement.controlId,
      normativeStrength: requirement.normativeStrength, sourceId: requirement.sourceId, locator: requirement.locator,
      state: 'not_assessed', metadataAccepted: false, contentVerified: false, gaps: [] };
    const unknown = requirement.applicability.some((predicate) => !context.has(predicate.factId));
    const excluded = requirement.applicability.some((predicate) => context.has(predicate.factId) &&
      context.get(predicate.factId) !== predicate.equals);
    if (excluded) {
      result.state = 'not_applicable_on_declared_context'; result.gaps.push('EXCLUSION_REQUIRES_REVIEW');
    } else if (unknown) {
      result.state = 'applicability_unknown'; result.gaps.push('APPLICABILITY_CONTEXT_MISSING');
    } else if (requirement.check.type === 'manual') {
      result.state = 'manual_review_required'; result.gaps.push('MANUAL_REVIEW_REQUIRED');
    } else {
      const observation = observations.get(requirement.check.factId);
      if (!observation) result.gaps.push('FACT_MISSING');
      else if (!requirement.evidenceKinds.includes(observation.kind)) result.gaps.push('EVIDENCE_KIND_UNSUITABLE');
      else if (observation.observedAt > asOf) result.gaps.push('EVIDENCE_FROM_FUTURE');
      else if (observation.expiresAt < asOf) result.gaps.push('EVIDENCE_EXPIRED');
      else {
        const check = requirement.check;
        const matches = check.type === 'boolean' ? observation.value === check.expected :
          check.type === 'number' ? observation.value <= check.max : check.allowedValues.includes(observation.value);
        result.state = matches ? 'matches_declared_fact' : 'violates_declared_fact';
        result.metadataAccepted = true; result.evidenceRefs = [...observation.evidenceRefs];
        if (!matches) result.gaps.push('DECLARED_FACT_VIOLATES_REQUIREMENT');
      }
    }
    return result;
  });
  const gaps = clauses.flatMap((item) => item.gaps.map((code) => ({ requirementId: item.requirementId, code })));
  gaps.push({ code: 'PACK_PARTIAL' }, { code: 'ARTIFACT_CONTENT_NOT_VERIFIED' });
  const framework = catalog.frameworks.find((item) => item.id === pack.frameworkId);
  if (framework.currency === 'requires_review') gaps.push({ code: 'FRAMEWORK_REVIEW_REQUIRED' });
  if (!input.applicabilityConfirmed) gaps.push({ code: 'APPLICABILITY_UNCONFIRMED' });
  if (!clauses.length) gaps.push({ code: 'LEVEL_WITHOUT_CURATED_REQUIREMENTS' });
  const count = (state) => clauses.filter((item) => item.state === state).length;
  return {
    schemaVersion: 'country_security_clause_assessment_v1', dataOrigin: input.dataOrigin,
    assessmentId: input.assessmentId, asOf, packId: pack.packId, packVersion: pack.version,
    packSha256: requirementPackSha256(pack),
    frameworkId: pack.frameworkId, frameworkCurrency: framework.currency, frameworkKind: framework.kind,
    jurisdictionType: framework.jurisdictionType ?? 'country_or_area',
    levelId: input.levelId, applicabilityConfirmed: input.applicabilityConfirmed,
    conclusion: 'not_determined', formalLevelDetermination: false, contentVerified: false,
    independentlyValidated: false, coverage: { kind: 'partial', selectedRequirementCount: clauses.length,
      mandatoryCount: clauses.filter((item) => item.normativeStrength === 'mandatory').length,
      recommendationCount: clauses.filter((item) => item.normativeStrength === 'recommendation').length,
      factMatchCount: count('matches_declared_fact'), factViolationCount: count('violates_declared_fact'),
      notAssessedCount: count('not_assessed'), manualReviewCount: count('manual_review_required'),
      excludedCount: count('not_applicable_on_declared_context'), unknownApplicabilityCount: count('applicability_unknown'), gaps },
    clauses, sources: pack.sources, limitations: [
      'A predicate match checks declared scoped facts and metadata only; it is not a certification or legal level decision.',
      'Exclusions need assessor review. Shared evidence references do not prove multiple clauses or increase assurance.',
      'Number values use the source unit; months must be assessed as calendar months, never converted to a fixed day count.',
      ...pack.limitations ],
  };
}

async function loadJson(file) {
  try {
    const info = await stat(file);
    must(info.isFile() && info.size <= MAX_BYTES, 'INPUT_SIZE_LIMIT');
    const bytes = await readFile(file); must(bytes.length <= MAX_BYTES, 'INPUT_SIZE_LIMIT');
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof ClauseError) throw error;
    throw new ClauseError('INPUT_READ_FAILED');
  }
}
export async function runClauseCli(args) {
  const [command, ...rest] = args;
  must((['list', 'validate-packs'].includes(command) && !rest.length) ||
    (['show', 'template'].includes(command) && rest.length === 2) ||
    (command === 'assess' && (rest.length === 1 || (rest.length === 3 && rest[1] === '--as-of'))), 'CLI_ARGUMENTS_INVALID');
  const catalog = await loadJson(new URL('./catalog.json', import.meta.url));
  const packs = await loadRequirementPacks(catalog);
  if (command === 'validate-packs') return { valid: true, packCount: packs.length,
    requirementCount: packs.reduce((sum, pack) => sum + pack.requirements.length, 0) };
  if (command === 'list') return { packs: packs.map((pack) => ({ packId: pack.packId,
    frameworkId: pack.frameworkId, version: pack.version, packSha256: requirementPackSha256(pack), reviewedOn: pack.reviewedOn, coverage: pack.coverage,
    levels: catalog.frameworks.find((item) => item.id === pack.frameworkId).levels.map((level) => ({
      levelId: level.id, requirementCount: pack.requirements.filter((item) => item.levels.includes(level.id)).length })) })) };
  if (command === 'assess') {
    const input = await loadJson(rest[0]);
    const pack = packs.find((item) => item.packId === input.packId);
    must(pack, 'PACK_UNSUPPORTED');
    return assessClauses(catalog, pack, input, rest[2] ? { asOf: rest[2] } : {});
  }
  const pack = packs.find((item) => item.frameworkId === rest[0]);
  must(pack, 'PACK_UNSUPPORTED');
  if (command === 'template') return createClauseTemplate(catalog, pack, rest[1]);
  return { packId: pack.packId, packVersion: pack.version, packSha256: requirementPackSha256(pack), frameworkId: pack.frameworkId, levelId: rest[1], coverage: pack.coverage,
    requirements: selected(catalog, pack, rest[1]), sources: pack.sources, limitations: pack.limitations };
}
export async function loadRequirementPacks(catalog, directory = new URL('./packs/', import.meta.url)) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { throw new ClauseError('PACK_DIRECTORY_READ_FAILED'); }
  const candidates = entries.filter((entry) => entry.name.endsWith('.requirements.json'));
  must(candidates.length > 0 && candidates.length <= 200, 'PACK_DIRECTORY_INVALID');
  for (const entry of candidates) must(entry.isFile() &&
    /^[a-z][a-z0-9._-]{0,63}\.requirements\.json$/.test(entry.name), 'PACK_FILE_INVALID');
  const packs = await Promise.all(candidates.sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => loadJson(new URL(entry.name, directory))));
  packs.forEach((pack) => validateRequirementPack(catalog, pack));
  distinct(packs.map((pack) => pack.packId), 'DUPLICATE_PACK_ID');
  distinct(packs.map((pack) => pack.frameworkId), 'DUPLICATE_PACK_FRAMEWORK');
  for (let index = 0; index < packs.length; index++) must(
    candidates[index].name === `${packs[index].frameworkId}.requirements.json`, 'PACK_FILENAME_MISMATCH');
  return packs;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(`${JSON.stringify(await runClauseCli(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ error: { code: error instanceof ClauseError ? error.code : 'CLAUSE_HARNESS_FAILED' } })}\n`);
    process.exitCode = 2;
  }
}
