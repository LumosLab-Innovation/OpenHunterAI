#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { assessEvidence, createEvidenceTemplate, HarnessError, isSafeEvidenceReference, validateCatalog } from './harness.mjs';

const MAX_FILE_BYTES = 1024 * 1024;
const CATEGORY_CONTROLS = new Map([
  ['xss', 'application_security'], ['cross_site_scripting', 'application_security'],
  ['web.injection.xss', 'application_security'], ['sqli', 'application_security'],
  ['sql_injection', 'application_security'], ['web.injection.sqli', 'application_security'],
  ['access_control_object_ownership', 'identity_access'], ['idor', 'identity_access'],
  ['web.access.idor', 'identity_access'],
]);

function requireCondition(condition, code) {
  if (!condition) throw new HarnessError(code);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function reportContent(report) {
  let current = report;
  let syntheticFixture = false;
  // Handle only known envelopes, with a bound even for cyclic programmatic input.
  for (let depth = 0; depth < 6 && object(current); depth += 1) {
    syntheticFixture ||= current.dataOrigin === 'synthetic_fixture';
    if (Object.hasOwn(current, 'formatVersion')) {
      requireCondition(current.formatVersion === 'report_v2' && Array.isArray(current.findings) &&
        current.findings.length <= 10000, 'REPORT_FORMAT_INVALID');
      return { content: current, syntheticFixture };
    }
    if (current.sanitized === true && object(current.value)) current = current.value;
    else if (object(current.report)) current = current.report;
    else if (object(current.snapshot) && object(current.snapshot.content)) {
      syntheticFixture ||= current.snapshot.dataOrigin === 'synthetic_fixture';
      if (Object.hasOwn(current.snapshot, 'formatVersion')) {
        requireCondition(current.snapshot.formatVersion === 'report_v2', 'REPORT_FORMAT_INVALID');
      }
      current = current.snapshot.content;
    }
    else break;
  }
  throw new HarnessError('REPORT_FORMAT_INVALID');
}

function validateDates(catalog, template, observedAt, expiresAt) {
  // Reuse the evidence validator even when the report has no importable findings.
  // This temporary validation input is never returned or applied to the assessment.
  const control = catalog.controlAreas[0];
  const dateCatalog = { ...catalog, frameworks: catalog.frameworks.map((framework) =>
    framework.id === template.frameworkId ? { ...framework, controlIds: [control.id] } : framework) };
  assessEvidence(dateCatalog, { ...template, observations: [{
    controlId: control.id, status: 'reported_failed', kind: control.evidenceKinds[0],
    evidenceRefs: ['import-date-check'], observedAt, expiresAt,
  }] }, { asOf: catalog.reviewedOn });
}

/** Import submitted report metadata without making a compliance or benchmark decision. */
export function importReportEvidence(catalog, report, {
  countryCode, frameworkId, levelId, observedAt, expiresAt,
} = {}) {
  validateCatalog(catalog);
  const template = createEvidenceTemplate(catalog, {
    countryCode, frameworkId, levelId, assessmentId: 'imported-report',
  });
  validateDates(catalog, template, observedAt, expiresAt);
  const { content, syntheticFixture } = reportContent(report);
  if (syntheticFixture) template.dataOrigin = 'synthetic_fixture';
  const eligible = new Set(template.observations.map((observation) => observation.controlId));
  const controls = new Map(catalog.controlAreas.map((control) => [control.id, control]));
  const refsByControl = new Map();
  for (const finding of content.findings) {
    if (!object(finding) || finding.validationStatus !== 'validated' ||
      !object(finding.sanitizedProof) || finding.sanitizedProof.sanitized !== true) continue;
    const controlId = CATEGORY_CONTROLS.get(finding.category);
    if (!eligible.has(controlId) || !controls.get(controlId)?.evidenceKinds.includes('scan_metadata')) continue;
    if (!Array.isArray(finding.sanitizedProof.evidenceRefs)) continue;
    const references = finding.sanitizedProof.evidenceRefs.filter(isSafeEvidenceReference);
    if (references.length === 0) continue;
    const existing = refsByControl.get(controlId) ?? new Set();
    for (const reference of references) existing.add(reference);
    refsByControl.set(controlId, existing);
  }
  // An ambiguous reference cannot prove two unrelated control areas.
  const referenceOwners = new Map();
  for (const [controlId, references] of refsByControl) {
    for (const reference of references) {
      const owners = referenceOwners.get(reference) ?? new Set();
      owners.add(controlId); referenceOwners.set(reference, owners);
    }
  }
  template.observations = template.observations.map((observation) => {
    const evidenceRefs = [...(refsByControl.get(observation.controlId) ?? [])]
      .filter((reference) => referenceOwners.get(reference).size === 1).sort().slice(0, 64);
    return evidenceRefs.length === 0 ? observation : {
      controlId: observation.controlId, status: 'reported_failed', kind: 'scan_metadata',
      evidenceRefs, observedAt, expiresAt,
    };
  });
  // Return only a template accepted by the same validator used for assessment.
  assessEvidence(catalog, template, { asOf: catalog.reviewedOn });
  return template;
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

export async function runImportCli(args, { catalog, readReport } = {}) {
  requireCondition(Array.isArray(args) && args.length === 8 &&
    args.slice(0, 4).every((argument) => typeof argument === 'string' && argument.length > 0 && !argument.startsWith('--')) &&
    args[4] === '--observed-on' && args[6] === '--expires-on', 'CLI_ARGUMENTS_INVALID');
  const [file, countryCode, frameworkId, levelId, , observedAt, , expiresAt] = args;
  const selectedCatalog = catalog ?? await loadJson(new URL('./catalog.json', import.meta.url), 'CATALOG_READ_FAILED');
  const report = readReport ? await readReport(file) : await loadJson(file, 'REPORT_READ_FAILED');
  return importReportEvidence(selectedCatalog, report, { countryCode, frameworkId, levelId, observedAt, expiresAt });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(await runImportCli(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    const code = error instanceof HarnessError ? error.code : 'REPORT_IMPORT_FAILED';
    process.stdout.write(`${JSON.stringify({ error: { code } })}\n`);
    process.exitCode = 2;
  }
}
