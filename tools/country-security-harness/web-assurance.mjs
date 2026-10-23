#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ClauseError } from './clauses.mjs';

function requireValid(condition) { if (!condition) throw new ClauseError('WEB_ASSURANCE_INVALID'); }
const keys = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const identifier = (value) => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const categories = ['xss', 'sqli', 'idor'];
export function validateWebAssurance(data) {
  requireValid(keys(data, ['schemaVersion', 'reviewedOn', 'standard', 'requirementIndex', 'categoryCrosswalk', 'scenarios', 'limitations']) &&
    data.schemaVersion === 'country_security_web_assurance_v1');
  const standard = data.standard;
  requireValid(keys(standard, ['name', 'version', 'tag', 'commit', 'url', 'sha256', 'license', 'attribution']) &&
    standard.name === 'OWASP ASVS' && standard.version === '5.0.0' && standard.tag === 'v5.0.0_release' &&
    standard.commit === '5cf9b032440be53ce345ab3c130fda46ba1ce7a2' &&
    standard.sha256 === 'bcdbec214d70abcfad9284a31d4f9e5134305831d628aad3aa85d7e26626cb35' &&
    standard.url === `https://raw.githubusercontent.com/OWASP/ASVS/${standard.commit}/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json` &&
    standard.license === 'CC-BY-SA-4.0' && typeof standard.attribution === 'string');
  requireValid(Array.isArray(data.requirementIndex) && data.requirementIndex.length === 345);
  for (const requirement of data.requirementIndex) requireValid(keys(requirement, ['id', 'minimumLevel', 'chapter']) &&
    /^V\d+\.\d+\.\d+$/.test(requirement.id) && [1, 2, 3].includes(requirement.minimumLevel) &&
    requirement.chapter === requirement.id.split('.')[0]);
  const index = new Map(data.requirementIndex.map((item) => [item.id, item]));
  requireValid(index.size === data.requirementIndex.length && Array.isArray(data.categoryCrosswalk) && data.categoryCrosswalk.length === 3);
  for (const mapping of data.categoryCrosswalk) requireValid(keys(mapping, ['category', 'controlId', 'requirementIds', 'relationship']) &&
    categories.includes(mapping.category) && mapping.controlId === (mapping.category === 'idor' ? 'identity_access' : 'application_security') &&
    Array.isArray(mapping.requirementIds) && mapping.requirementIds.length > 0 && mapping.requirementIds.every((id) => index.has(id)) &&
    new Set(mapping.requirementIds).size === mapping.requirementIds.length && mapping.relationship === 'test_can_supply_partial_counterevidence');
  requireValid(new Set(data.categoryCrosswalk.map((item) => item.category)).size === 3 &&
    Array.isArray(data.scenarios) && data.scenarios.length > 0 && data.scenarios.length <= 100);
  for (const scenario of data.scenarios) requireValid(keys(scenario, ['id', 'category', 'reviewGoal', 'requiredRoles', 'retestStates']) &&
    identifier(scenario.id) && categories.includes(scenario.category) && typeof scenario.reviewGoal === 'string' &&
    JSON.stringify(scenario.requiredRoles) === JSON.stringify(['baseline', 'probe', 'impact', 'negative', 'replay']) &&
    JSON.stringify(scenario.retestStates) === JSON.stringify(['fixed', 'still_reproducible', 'inconclusive']));
  requireValid(new Set(data.scenarios.map((item) => item.id)).size === data.scenarios.length &&
    categories.every((category) => data.scenarios.some((item) => item.category === category)) &&
    Array.isArray(data.limitations) && data.limitations.length > 0 && data.limitations.every((item) => typeof item === 'string'));
  return data;
}

export function createExpandedWebManifest(data) {
  validateWebAssurance(data);
  return { schemaVersion: 'country_security_benchmark_manifest_v1', dataOrigin: 'synthetic_fixture',
    cases: data.scenarios.flatMap((scenario) => ['detected', 'clear'].map((expected) => ({
      id: `${scenario.id}-${expected === 'detected' ? 'positive' : 'negative'}`, pairId: scenario.id,
      category: scenario.category, controlId: scenario.category === 'idor' ? 'identity_access' : 'application_security', expected }))),
    thresholds: { minRecall: 1, maxFalsePositiveRate: 0, minEvidenceCompleteness: 1, minExecutionCoverage: 1 } };
}

export function createWebAssurancePlan(data, nativeLevel) {
  validateWebAssurance(data);
  if (!['level-1', 'level-2', 'level-3'].includes(nativeLevel)) throw new ClauseError('ASVS_LEVEL_UNSUPPORTED');
  const level = Number(nativeLevel.slice(-1));
  const required = data.requirementIndex.filter((item) => item.minimumLevel <= level);
  const mapped = new Set(data.categoryCrosswalk.flatMap((item) => item.requirementIds));
  const unmapped = required.filter((item) => !mapped.has(item.id));
  return { schemaVersion: 'country_security_web_assurance_plan_v1', standard: data.standard,
    nativeLevel, levelMeaning: 'application_verification_target', assessmentConclusion: 'not_determined',
    normativeCoverageComplete: false, engineEfficacyVerified: false, executionAuthorized: false,
    requiredRequirementCount: required.length, mappedRequirementCount: required.length - unmapped.length,
    unmappedRequirementIds: unmapped.map((item) => item.id), categoryCrosswalk: data.categoryCrosswalk,
    scenarios: data.scenarios, benchmarkManifest: createExpandedWebManifest(data),
    coverageGaps: ['PARTIAL_ASVS_CROSSWALK', 'SCENARIOS_NOT_EXECUTED', 'CLEAN_SCAN_IS_NOT_REQUIREMENT_SATISFACTION'],
    limitations: data.limitations };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (!((command === 'plan' && args.length === 1) || (command === 'manifest' && args.length === 0)))
      throw new ClauseError('CLI_ARGUMENTS_INVALID');
    const data = JSON.parse(await readFile(new URL('./web-assurance.json', import.meta.url), 'utf8'));
    const result = command === 'plan' ? createWebAssurancePlan(data, args[0]) : createExpandedWebManifest(data);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: { code: error instanceof ClauseError ? error.code : 'WEB_ASSURANCE_FAILED' } })}\n`);
    process.exitCode = 2;
  }
}
