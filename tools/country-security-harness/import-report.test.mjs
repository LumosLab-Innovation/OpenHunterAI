import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { assessEvidence, HarnessError } from './harness.mjs';
import { importReportEvidence, runImportCli } from './import-report.mjs';

const execFileAsync = promisify(execFile);
const asOf = '2026-10-08';
const options = { countryCode: 'VN', frameworkId: 'vn-fixture', levelId: 'level-1',
  observedAt: asOf, expiresAt: '2026-11-08' };
const catalog = {
  schemaVersion: 'country_security_catalog_v1', catalogVersion: 'test-v1', reviewedOn: asOf,
  controlAreas: [
    { id: 'risk_management', label: 'Risk', evidenceKinds: ['policy_document'] },
    { id: 'application_security', label: 'Application', evidenceKinds: ['configuration', 'scan_metadata'] },
    { id: 'identity_access', label: 'Identity', evidenceKinds: ['configuration', 'scan_metadata'] },
    { id: 'patch_applications', label: 'Endpoint updates', evidenceKinds: ['configuration'] },
  ],
  frameworks: [
    { id: 'vn-fixture', countryCode: 'VN', countryName: 'Viet Nam', label: 'Synthetic fixture', version: 'fixture-1',
      kind: 'impact_classification', ordinalLevels: true, currency: 'reviewed_reference', applicability: 'Synthetic',
      levelSelection: 'owner_or_authority', levels: [{ id: 'level-1', label: 'First', summary: 'Synthetic' }],
      controlIds: ['risk_management', 'application_security', 'identity_access'], mappingCoverage: 'partial',
      sources: [{ id: 'source-test', title: 'Fixture', url: 'https://example.com/catalog', locator: 'Fixture' }],
      limitations: ['Synthetic fixture only'] },
    { id: 'au-fixture', countryCode: 'AU', countryName: 'Australia', label: 'Synthetic endpoint fixture', version: 'fixture-1',
      kind: 'maturity', ordinalLevels: true, currency: 'reviewed_reference', applicability: 'Synthetic',
      levelSelection: 'assessment_target', levels: [{ id: 'level-1', label: 'First', summary: 'Synthetic' }],
      controlIds: ['patch_applications'], mappingCoverage: 'partial',
      sources: [{ id: 'source-test', title: 'Fixture', url: 'https://example.com/catalog', locator: 'Fixture' }],
      limitations: ['Synthetic fixture only'] },
  ],
};

function finding(category = 'xss', refs = ['proof-xss-1'], extras = {}) {
  return { category, validationStatus: 'validated', sanitizedProof: { sanitized: true, evidenceRefs: refs }, ...extras };
}

function report(findings = []) { return { formatVersion: 'report_v2', findings }; }
function rejectWith(fn, code) {
  assert.throws(fn, (error) => error instanceof HarnessError && error.code === code && error.message === code);
}

test('mapped findings produce failed metadata claims while remaining an unconfirmed template', () => {
  const evidence = importReportEvidence(catalog, report([
    finding('xss'), finding('sql_injection', ['proof-sqli-1']), finding('web.access.idor', ['proof-idor-1']),
  ]), options);
  assert.equal(evidence.assessmentId, 'imported-report');
  assert.equal(evidence.dataOrigin, 'operator_supplied');
  assert.equal(evidence.applicabilityConfirmed, false);
  assert.deepEqual(evidence.observations.find((item) => item.controlId === 'application_security'), {
    controlId: 'application_security', status: 'reported_failed', kind: 'scan_metadata',
    evidenceRefs: ['proof-sqli-1', 'proof-xss-1'], observedAt: asOf, expiresAt: options.expiresAt,
  });
  const assessment = assessEvidence(catalog, evidence, { asOf });
  assert.equal(assessment.coverage.reportedFailedCount, 2);
  assert.equal(assessment.coverage.reportedSatisfiedCount, 0);
  assert.equal(assessment.formalLevelDetermination, false);
  assert.equal(assessment.conclusion, 'not_determined');
  assert.equal(assessment.controls[0].state, 'not_assessed');
});

test('every recognized native category maps only to its relevant control area', () => {
  const mapping = { xss: 'application_security', cross_site_scripting: 'application_security',
    'web.injection.xss': 'application_security', sqli: 'application_security', sql_injection: 'application_security',
    'web.injection.sqli': 'application_security', access_control_object_ownership: 'identity_access',
    idor: 'identity_access', 'web.access.idor': 'identity_access' };
  for (const [category, controlId] of Object.entries(mapping)) {
    const evidence = importReportEvidence(catalog, report([finding(category)]), options);
    assert.deepEqual(evidence.observations.filter((item) => item.status === 'reported_failed').map((item) => item.controlId), [controlId]);
  }
});

test('missing redaction marker, unverified findings and legacy findings cannot become observations', () => {
  const evidence = importReportEvidence(catalog, report([
    finding('xss', [], { sanitizedProof: { sanitized: false, evidenceRefs: ['proof-unsafe'] } }),
    finding('sqli', [], { sanitizedProof: { evidenceRefs: ['proof-unmarked'] } }),
    finding('idor', ['proof-legacy'], { validationStatus: 'legacy_unverified' }),
    finding('xss', ['proof-candidate'], { validationStatus: 'candidate' }),
    finding('xss', ['proof-missing-status'], { validationStatus: undefined }),
  ]), options);
  assert.ok(evidence.observations.every((item) => item.status === 'not_assessed'));
});

test('absence of findings or safe refs never satisfies any control', () => {
  for (const findings of [[], [finding('xss', [])], [finding('xss', ['https://private.example/proof'])]]) {
    const evidence = importReportEvidence(catalog, report(findings), options);
    const assessment = assessEvidence(catalog, evidence, { asOf });
    assert.equal(assessment.coverage.reportedSatisfiedCount, 0);
    assert.equal(assessment.coverage.reportedFailedCount, 0);
    assert.equal(assessment.coverage.notAssessedCount, 3);
    assert.equal(assessment.conclusion, 'not_determined');
  }
});

test('only opaque allowlisted references survive import and no raw fields are emitted', () => {
  const secret = 'private-password-never-echo';
  const refs = ['proof:scan:one', 'proof-xss-2', 'https://private.example/', 'person@example.com',
    'C:\\private\\proof', '../proof', 'sk-privateapikey', 'ghp_privateapikey', 'token:privatecredential',
    'artifact:ghp_privateapikey', 'artifact:sk-privatekey', 'proof-sk-privatekey', 'proof-ghp_privateapikey',
    'https:private.example', 'file:private', 'c:private',
    's3:private', 'proof-eyjabcdefghijklmnopqrstuvwxyz123', 'proof-0123456789abcdef0123456789abcdef', secret];
  const source = report([finding('xss', refs, { title: secret, affectedAsset: `https://${secret}.example/`,
    description: secret, rawResponse: secret,
    sanitizedProof: { sanitized: true, description: secret, evidenceRefs: refs } })]);
  source.ownerSummary = { headline: secret };
  source.coverage = { rawToken: secret };
  const evidence = importReportEvidence(catalog, source, options);
  const output = JSON.stringify(evidence);
  assert.deepEqual(evidence.observations[1].evidenceRefs, ['proof-xss-2', 'proof:scan:one']);
  for (const value of [secret, 'private.example', 'rawResponse', 'description', 'ownerSummary', 'affectedAsset']) {
    assert.equal(output.includes(value), false);
  }
});

test('reference length and per-control count bounds remain accepted by the harness', () => {
  const refs = ['p'.repeat(128), 'p'.repeat(129),
    ...Array.from({ length: 70 }, (_, index) => `proof-${index}`)];
  const evidence = importReportEvidence(catalog, report([finding('xss', refs)]), options);
  assert.equal(evidence.observations[1].evidenceRefs.length, 64);
  assert.ok(evidence.observations[1].evidenceRefs.includes('p'.repeat(128)));
  assert.ok(!evidence.observations[1].evidenceRefs.includes('p'.repeat(129)));
  assert.equal(assessEvidence(catalog, evidence, { asOf }).coverage.reportedFailedCount, 1);
});

test('known API and sanitizer envelopes import identically to canonical content', () => {
  const content = report([finding()]);
  const expected = importReportEvidence(catalog, content, options);
  for (const wrapped of [
    { sanitized: true, value: content },
    { report: { snapshot: { content } } },
    { report: { snapshot: { content: { sanitized: true, value: content } } } },
    { sanitized: true, value: { report: { snapshot: { content } } } },
  ]) assert.deepEqual(importReportEvidence(catalog, wrapped, options), expected);
});

test('synthetic fixture provenance from any known envelope or content remains synthetic', () => {
  const content = report([finding()]);
  for (const wrapped of [
    { ...content, dataOrigin: 'synthetic_fixture' },
    { dataOrigin: 'synthetic_fixture', report: { snapshot: { content } } },
    { report: { dataOrigin: 'synthetic_fixture', snapshot: { content } } },
    { report: { snapshot: { dataOrigin: 'synthetic_fixture', content } } },
    { sanitized: true, dataOrigin: 'synthetic_fixture', value: content },
    { dataOrigin: 'operator_supplied', report: { snapshot: { content: { ...content, dataOrigin: 'synthetic_fixture' } } } },
  ]) {
    const evidence = importReportEvidence(catalog, wrapped, options);
    assert.equal(evidence.dataOrigin, 'synthetic_fixture');
    assert.equal(assessEvidence(catalog, evidence, { asOf }).dataOrigin, 'synthetic_fixture');
  }
  const unknown = importReportEvidence(catalog, { ...content, dataOrigin: 'private-secret' }, options);
  assert.equal(unknown.dataOrigin, 'operator_supplied');
  assert.equal(JSON.stringify(unknown).includes('private-secret'), false);
});

test('wrong report versions, malformed findings and arbitrary envelopes reject without reflecting input', () => {
  for (const source of [null, [], { formatVersion: 'private-secret-report' },
    { formatVersion: 'report_v2', findings: {} }, { arbitrary: report() },
    { sanitized: false, value: report() }, { report: { snapshot: { content: report(), formatVersion: 'report_v1' } } }]) {
    rejectWith(() => importReportEvidence(catalog, source, options), 'REPORT_FORMAT_INVALID');
  }
});

test('unknown categories and profiles cannot introduce assessment metadata', () => {
  const source = { ...report([finding('unknown-private-category')]), profile: 'unknown-private-profile',
    historicalFindings: [finding('xss', ['proof-historical'])] };
  const evidence = importReportEvidence(catalog, source, options);
  assert.ok(evidence.observations.every((item) => item.status === 'not_assessed'));
  assert.equal(JSON.stringify(evidence).includes('private'), false);
});

test('unsupported native selections and absent/invalid dates reject before producing a template', () => {
  for (const [field, value, code] of [['countryCode', 'ZZ', 'COUNTRY_UNSUPPORTED'],
    ['frameworkId', 'missing-framework', 'FRAMEWORK_UNSUPPORTED'], ['levelId', 'missing-level', 'LEVEL_UNSUPPORTED'],
    ['observedAt', undefined, 'EVIDENCE_DATE_INVALID'], ['expiresAt', undefined, 'EVIDENCE_DATE_INVALID'],
    ['observedAt', '2026-02-30', 'EVIDENCE_DATE_INVALID'], ['expiresAt', '2026-10-07', 'EVIDENCE_DATE_INVALID']]) {
    rejectWith(() => importReportEvidence(catalog, report(), { ...options, [field]: value }), code);
  }
});

test('AU endpoint controls and control areas forbidding scan_metadata remain not assessed', () => {
  const evidence = importReportEvidence(catalog, report([finding(), finding('idor', ['proof-idor'])]), {
    ...options, countryCode: 'AU', frameworkId: 'au-fixture',
  });
  assert.ok(evidence.observations.every((item) => item.status === 'not_assessed'));
  const changed = structuredClone(catalog);
  changed.controlAreas[1].evidenceKinds = ['configuration'];
  const result = importReportEvidence(changed, report([finding()]), options);
  assert.ok(result.observations.every((item) => item.status === 'not_assessed'));
});

test('duplicate refs aggregate within a control but ambiguous refs across controls are discarded', () => {
  const evidence = importReportEvidence(catalog, report([
    finding('xss', ['proof-same', 'proof-shared']), finding('sqli', ['proof-same']),
    finding('idor', ['proof-shared']),
  ]), options);
  assert.deepEqual(evidence.observations[1].evidenceRefs, ['proof-same']);
  assert.equal(evidence.observations[2].status, 'not_assessed');
  assert.equal(assessEvidence(catalog, evidence, { asOf }).coverage.reportedFailedCount, 1);
});

test('published catalog imports findings without applying web evidence to Essential Eight', async () => {
  const published = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8'));
  const evidence = importReportEvidence(published, report([finding('web.injection.xss', ['proof:scan:one'])]), {
    ...options, frameworkId: 'vn-system-levels',
  });
  assert.equal(assessEvidence(published, evidence, { asOf }).coverage.reportedFailedCount, 1);
  const endpoint = importReportEvidence(published, report([finding()]), {
    ...options, countryCode: 'AU', frameworkId: 'au-essential-eight',
  });
  assert.ok(endpoint.observations.every((item) => item.status === 'not_assessed'));
});

test('CLI dispatcher requires explicit dates and uses the same import contract', async () => {
  const args = ['opaque-file', 'VN', 'vn-fixture', 'level-1', '--observed-on', asOf, '--expires-on', options.expiresAt];
  const result = await runImportCli(args, { catalog, readReport: async () => report([finding()]) });
  assert.deepEqual(result, importReportEvidence(catalog, report([finding()]), options));
  await assert.rejects(runImportCli(args.slice(0, 4), { catalog }), { code: 'CLI_ARGUMENTS_INVALID' });
  await assert.rejects(runImportCli([...args.slice(0, 6), '--private-secret', options.expiresAt], { catalog }), { code: 'CLI_ARGUMENTS_INVALID' });
});

async function isolatedCli(t) {
  const prefix = path.join(tmpdir(), 'openhunter-country-report-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)));
    await rm(directory, { recursive: true, force: true });
  });
  for (const name of ['harness.mjs', 'import-report.mjs']) {
    await copyFile(new URL(`./${name}`, import.meta.url), path.join(directory, name));
  }
  await writeFile(path.join(directory, 'catalog.json'), `\uFEFF${JSON.stringify(catalog)}`);
  return { directory, cli: path.join(directory, 'import-report.mjs'), file: path.join(directory, 'report.json') };
}

function cliArgs(file) {
  return [file, 'VN', 'vn-fixture', 'level-1', '--observed-on', asOf, '--expires-on', options.expiresAt];
}

test('actual CLI reads BOM JSON offline and emits an accepted evidence template only', async (t) => {
  const { cli, file } = await isolatedCli(t);
  await writeFile(file, `\uFEFF${JSON.stringify(report([finding()]))}`);
  const result = await execFileAsync(process.execPath, [cli, ...cliArgs(file)]);
  assert.equal(result.stderr, '');
  const evidence = JSON.parse(result.stdout);
  assert.equal(assessEvidence(catalog, evidence, { asOf }).coverage.reportedFailedCount, 1);
});

test('actual CLI emits generic JSON errors on stdout, exit2, without submitted text or paths', async (t) => {
  const { directory, cli, file } = await isolatedCli(t);
  for (const [contents, code] of [['{"password":"private-secret"', 'REPORT_READ_FAILED'],
    [JSON.stringify({ formatVersion: 'private-secret', findings: [] }), 'REPORT_FORMAT_INVALID'],
    [Buffer.alloc(1024 * 1024 + 1, 'x'), 'INPUT_SIZE_LIMIT']]) {
    await writeFile(file, contents);
    await assert.rejects(execFileAsync(process.execPath, [cli, ...cliArgs(file)]), (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stderr, '');
      assert.deepEqual(JSON.parse(error.stdout), { error: { code } });
      assert.equal(error.stdout.includes('private-secret'), false);
      assert.equal(error.stdout.includes(directory), false);
      return true;
    });
  }
});
