import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { assessEvidence, createEvidenceTemplate, HarnessError, isSafeEvidenceReference, runCli, validateCatalog } from './harness.mjs';

const execFileAsync = promisify(execFile);
const asOf = '2026-10-08';
const catalog = {
  schemaVersion: 'country_security_catalog_v1', catalogVersion: 'test-v1', reviewedOn: asOf,
  controlAreas: [
    { id: 'governance', label: 'Governance', evidenceKinds: ['policy_document', 'independent_review'] },
    { id: 'technical-testing', label: 'Technical testing', evidenceKinds: ['configuration', 'scan_metadata', 'independent_review'] },
  ],
  frameworks: [{
    id: 'test-framework', countryCode: 'VN', countryName: 'Viet Nam', label: 'Synthetic test framework',
    version: 'fixture-1', kind: 'impact_classification', ordinalLevels: true, currency: 'reviewed_reference',
    applicability: 'Synthetic test applicability', levelSelection: 'owner_or_authority',
    levels: [{ id: 'level-1', label: 'Native first level', summary: 'Synthetic test description' },
      { id: 'level-2', label: 'Native second level', summary: 'Synthetic test description' }],
    controlIds: ['governance', 'technical-testing'], mappingCoverage: 'partial',
    sources: [{ id: 'source-test', title: 'Synthetic source', url: 'https://example.com/test', locator: 'Fixture only' }],
    limitations: ['SYNTHETIC TEST CATALOG'],
  }],
};

function input(observations = []) {
  return {
    schemaVersion: 'country_security_evidence_v1', dataOrigin: 'synthetic_fixture',
    assessmentId: 'assessment-test', countryCode: 'VN', frameworkId: 'test-framework',
    levelId: 'level-1', applicabilityConfirmed: true, observations,
  };
}

function satisfied(controlId = 'governance', extras = {}) {
  return { controlId, status: 'reported_satisfied', kind: 'policy_document',
    evidenceRefs: [`evidence-${controlId}`], observedAt: '2026-10-01', expiresAt: '2026-11-01', ...extras };
}

function rejectWith(fn, code) {
  assert.throws(fn, (error) => error instanceof HarnessError && error.code === code && error.message === code);
}

test('template preserves native selection and starts with unconfirmed applicability and no assessed controls', () => {
  const template = createEvidenceTemplate(catalog, { countryCode: 'VN', frameworkId: 'test-framework', levelId: 'level-2' });
  assert.equal(template.levelId, 'level-2');
  assert.equal(template.applicabilityConfirmed, false);
  assert.equal(template.dataOrigin, 'operator_supplied');
  assert.ok(template.observations.every((item) => item.status === 'not_assessed' && item.reasonCode === 'manual_review_required'));
  const report = assessEvidence(catalog, template, { asOf });
  assert.equal(report.conclusion, 'not_determined');
  assert.equal(report.formalLevelDetermination, false);
  assert.equal(report.levelSource, 'operator_selected');
  assert.ok(report.coverage.gaps.some((gap) => gap.code === 'APPLICABILITY_UNCONFIRMED'));
});

test('missing evidence is a gap for every mapped control and never a pass', () => {
  const report = assessEvidence(catalog, input(), { asOf });
  assert.equal(report.coverage.notAssessedCount, 2);
  assert.equal(report.coverage.mappedControlCount, 2);
  assert.equal(Object.hasOwn(report.coverage, 'requiredControlCount'), false);
  assert.equal(report.coverage.metadataAcceptedCount, 0);
  assert.ok(report.controls.every((control) => control.gaps.includes('MISSING_EVIDENCE')));
  assert.equal(report.conclusion, 'not_determined');
  assert.equal(Object.hasOwn(report, 'passed'), false);
});

test('valid metadata remains a reported claim without establishing classification', () => {
  const report = assessEvidence(catalog, input([
    satisfied(), satisfied('technical-testing', { kind: 'scan_metadata' }),
  ]), { asOf });
  assert.equal(report.coverage.reportedSatisfiedCount, 2);
  assert.equal(report.coverage.metadataAcceptedCount, 2);
  assert.equal(report.controls[0].state, 'reported_satisfied');
  assert.equal(report.formalLevelDetermination, false);
  assert.ok(report.coverage.gaps.some((gap) => gap.code === 'MAPPING_PARTIAL'));
  assert.equal(Object.hasOwn(report, 'findings'), false);
});

test('evidence for one control cannot automatically satisfy another', () => {
  const report = assessEvidence(catalog, input([satisfied()]), { asOf });
  assert.equal(report.controls[0].metadataEvidenceAccepted, true);
  assert.equal(report.controls[1].state, 'not_assessed');
  assert.equal(report.controls[1].metadataEvidenceAccepted, false);
  rejectWith(() => assessEvidence(catalog, input([
    satisfied(), satisfied('technical-testing', { kind: 'configuration', evidenceRefs: ['evidence-governance'] }),
  ]), { asOf }), 'EVIDENCE_REF_REUSED');
});

test('scan metadata cannot support governance controls', () => {
  rejectWith(() => assessEvidence(catalog, input([satisfied('governance', { kind: 'scan_metadata' })]), { asOf }), 'EVIDENCE_KIND_UNSUPPORTED');
});

test('unknown fields containing secrets are rejected without reflecting secret values or field names', () => {
  const secret = 'private-password-that-must-never-appear';
  for (const value of [{ ...input(), password: secret }, input([{ ...satisfied(), authorization: secret }]),
    { ...input(), assessmentId: 'assessment-secret-privatevalue' }]) {
    assert.throws(() => assessEvidence(catalog, value, { asOf }), (error) => {
      assert.equal(error.code, 'EVIDENCE_INVALID');
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes('authorization'), false);
      return true;
    });
  }
});

test('raw URLs, paths, emails, token-shaped references and raw artifacts are not accepted', () => {
  for (const ref of ['https://example.com/private', 'C:\\private\\evidence.json', '../private',
    'https:example.com', 'c:private-file', 'artifact:sk-thisisasecretkeywithlongvalue',
    'person@example.com', 'sk-thisisasecretkeywithlongvalue', 'evidence-0123456789abcdef0123456789abcdef']) {
    rejectWith(() => assessEvidence(catalog, input([satisfied('governance', { evidenceRefs: [ref] })]), { asOf }), 'EVIDENCE_REFS_INVALID');
  }
  rejectWith(() => assessEvidence(catalog, input([{ ...satisfied(), rawResponse: 'sensitive-content' }]), { asOf }), 'EVIDENCE_INVALID');
});

test('colon-delimited opaque artifact references preserve existing evidence provenance', () => {
  const report = assessEvidence(catalog, input([satisfied('governance', {
    evidenceRefs: ['artifact:baseline:idor-pos', 'http_exchange:exploit:replay-001'],
  })]), { asOf });
  assert.deepEqual(report.controls[0].evidenceRefs, ['artifact:baseline:idor-pos', 'http_exchange:exploit:replay-001']);
  assert.equal(report.controls[0].metadataEvidenceAccepted, true);
});

test('shared reference boundary blocks embedded tokens and credential components', async () => {
  const schema = JSON.parse(await readFile(new URL('./evidence.schema.json', import.meta.url), 'utf8'));
  const schemaPattern = new RegExp(schema.definitions.safeReference.pattern);
  for (const reference of ['proof-sk-thisisasecretkeywithlongvalue',
    'artifact:proof-sk-thisisasecretkeywithlongvalue', 'artifact:proof.ghp_privatevalue',
    'artifact:proof_sk-syntheticabcdefghijk', 'artifact:proof_ghp_syntheticvalue', 'artifact:proof_xoxb-syntheticvalue',
    'artifact:baseline:token', 'artifact:password-proof', 'artifact:access_token',
    'artifact:secret', 'artifact:credential:proof', 'artifact:bearer:proof']) {
    assert.equal(isSafeEvidenceReference(reference), false);
    assert.equal(schemaPattern.test(reference), false);
    rejectWith(() => assessEvidence(catalog, input([satisfied('governance', { evidenceRefs: [reference] })]), { asOf }), 'EVIDENCE_REFS_INVALID');
  }
  for (const reference of ['evidence-governance', 'artifact:baseline:idor-pos', 'http_exchange:exploit:replay-001']) {
    assert.equal(isSafeEvidenceReference(reference), true);
    assert.equal(schemaPattern.test(reference), true);
  }
});

test('duplicate and unknown controls are rejected', () => {
  rejectWith(() => assessEvidence(catalog, input([satisfied(), satisfied()]), { asOf }), 'DUPLICATE_CONTROL');
  rejectWith(() => assessEvidence(catalog, input([satisfied('unknown-control')]), { asOf }), 'CONTROL_UNSUPPORTED');
});

test('expired evidence is excluded from accepted metadata with an explicit gap', () => {
  const report = assessEvidence(catalog, input([satisfied('governance', { expiresAt: '2026-10-07' })]), { asOf });
  assert.equal(report.controls[0].state, 'not_assessed');
  assert.equal(report.controls[0].reportedStatus, 'reported_satisfied');
  assert.equal(report.controls[0].metadataEvidenceAccepted, false);
  assert.ok(report.controls[0].gaps.includes('EXPIRED_EVIDENCE'));
  assert.equal(Object.hasOwn(report.controls[0], 'evidenceRefs'), false);
});

test('future evidence cannot satisfy a current control', () => {
  const report = assessEvidence(catalog, input([satisfied('governance', { observedAt: '2026-10-09' })]), { asOf });
  assert.equal(report.controls[0].state, 'not_assessed');
  assert.ok(report.controls[0].gaps.includes('FUTURE_EVIDENCE'));
});

test('expiry is inclusive and impossible dates or reversed intervals are rejected', () => {
  const report = assessEvidence(catalog, input([satisfied('governance', { expiresAt: asOf })]), { asOf });
  assert.equal(report.controls[0].metadataEvidenceAccepted, true);
  rejectWith(() => assessEvidence(catalog, input([satisfied('governance', { observedAt: '2026-02-30' })]), { asOf }), 'EVIDENCE_DATE_INVALID');
  rejectWith(() => assessEvidence(catalog, input([satisfied('governance', { expiresAt: '2026-09-30' })]), { asOf }), 'EVIDENCE_DATE_INVALID');
  rejectWith(() => assessEvidence(catalog, input(), { asOf: 'not-a-date' }), 'ASSESSMENT_DATE_INVALID');
});

test('reported statuses require kind, refs and both timestamps', () => {
  for (const field of ['kind', 'evidenceRefs', 'observedAt', 'expiresAt']) {
    const observation = satisfied();
    delete observation[field];
    rejectWith(() => assessEvidence(catalog, input([observation]), { asOf }), 'EVIDENCE_METADATA_REQUIRED');
  }
});

test('reported failed controls remain failed claims and coverage gaps', () => {
  const report = assessEvidence(catalog, input([satisfied('governance', { status: 'reported_failed' })]), { asOf });
  assert.equal(report.coverage.reportedFailedCount, 1);
  assert.equal(report.controls[0].metadataEvidenceAccepted, true);
  assert.ok(report.controls[0].gaps.includes('CONTROL_REPORTED_FAILED'));
  assert.equal(report.conclusion, 'not_determined');
});

test('not applicable requires a reason and remains an explicit exclusion', () => {
  rejectWith(() => assessEvidence(catalog, input([{ controlId: 'governance', status: 'not_applicable' }]), { asOf }), 'EXCLUSION_REASON_REQUIRED');
  const report = assessEvidence(catalog, input([
    { controlId: 'governance', status: 'not_applicable', reasonCode: 'outside_declared_system' },
  ]), { asOf });
  assert.equal(report.coverage.notApplicableCount, 1);
  assert.equal(report.controls[0].metadataEvidenceAccepted, false);
  assert.ok(report.controls[0].gaps.includes('CONTROL_EXCLUDED'));
});

test('unsupported jurisdiction, framework and native level fail clearly', () => {
  for (const [field, value, code] of [['countryCode', 'ZZ', 'COUNTRY_UNSUPPORTED'],
    ['frameworkId', 'unsupported', 'FRAMEWORK_UNSUPPORTED'], ['levelId', 'unknown-level', 'LEVEL_UNSUPPORTED']]) {
    rejectWith(() => assessEvidence(catalog, { ...input(), [field]: value }, { asOf }), code);
  }
});

test('unordered native levels are preserved without generating a numeric ranking', () => {
  const changed = structuredClone(catalog);
  changed.frameworks[0].ordinalLevels = false;
  changed.frameworks[0].levels = [{ id: 'basis', label: 'Basis', summary: 'Native approach' },
    { id: 'core', label: 'Core', summary: 'Different native approach' }];
  const report = assessEvidence(changed, { ...input(), levelId: 'core' }, { asOf });
  assert.equal(report.framework.ordinalLevels, false);
  assert.equal(report.framework.selectedLevel.id, 'core');
  assert.equal(Object.hasOwn(report.framework.selectedLevel, 'rank'), false);
  assert.equal(Object.hasOwn(report, 'securityLevel'), false);
});

test('requiring source review and overview-only mapping produce framework gaps', () => {
  const changed = structuredClone(catalog);
  changed.frameworks[0].currency = 'requires_review';
  changed.frameworks[0].mappingCoverage = 'overview_only';
  const report = assessEvidence(changed, input(), { asOf });
  assert.ok(report.coverage.gaps.some((gap) => gap.code === 'FRAMEWORK_REVIEW_REQUIRED'));
  assert.ok(report.coverage.gaps.some((gap) => gap.code === 'MAPPING_OVERVIEW_ONLY'));
  assert.equal(report.formalLevelDetermination, false);
});

test('catalog rejects duplicate ids, unknown control mapping and credential-bearing source URLs', () => {
  for (const mutate of [
    (value) => value.frameworks.push(structuredClone(value.frameworks[0])),
    (value) => value.frameworks[0].controlIds.push('unknown-control'),
    (value) => { value.frameworks[0].sources[0].url = 'https://username:password@example.com/'; },
    (value) => { value.frameworks[0].sources[0].url = 'https://example.com/?token=secret'; },
  ]) {
    const changed = structuredClone(catalog); mutate(changed);
    rejectWith(() => validateCatalog(changed), 'CATALOG_INVALID');
  }
});

test('catalog rejects vacuous control maps and missing framework limitations', () => {
  for (const field of ['controlIds', 'limitations']) {
    const changed = structuredClone(catalog);
    changed.frameworks[0][field] = [];
    rejectWith(() => validateCatalog(changed), 'CATALOG_INVALID');
  }
});

test('bounded evidence arrays and safe unique references constrain resource use', () => {
  rejectWith(() => assessEvidence(catalog, input(Array.from({ length: 201 }, () => satisfied())), { asOf }), 'EVIDENCE_INVALID');
  rejectWith(() => assessEvidence(catalog, input([satisfied('governance', {
    evidenceRefs: Array.from({ length: 65 }, (_, index) => `evidence-${index}`),
  })]), { asOf }), 'EVIDENCE_REFS_INVALID');
});

test('CLI uses identical framework selection and assessment behavior', async () => {
  const listing = await runCli(['list', 'VN'], { catalog });
  assert.equal(listing.frameworks.length, 1);
  assert.equal(listing.frameworks[0].kind, 'impact_classification');
  assert.equal(listing.frameworks[0].applicability, 'Synthetic test applicability');
  assert.equal(listing.frameworks[0].mappingCoverage, 'partial');
  assert.equal(listing.frameworks[0].levelSelection, 'owner_or_authority');
  const template = await runCli(['template', 'VN', 'test-framework', 'level-1'], { catalog });
  assert.equal(template.applicabilityConfirmed, false);
  const report = await runCli(['assess', 'opaque-file', '--as-of', asOf], { catalog, readEvidence: async () => input() });
  assert.deepEqual(report, assessEvidence(catalog, input(), { asOf }));
  await assert.rejects(runCli(['assess', 'private-file', '--unknown', 'private-password'], { catalog }), { code: 'CLI_ARGUMENTS_INVALID' });
});

async function isolatedCli(t) {
  const prefix = path.join(tmpdir(), 'openhunter-country-harness-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(path.resolve(prefix)), 'Cleanup stays within the test temp directory.');
    await rm(directory, { recursive: true, force: true });
  });
  await copyFile(new URL('./harness.mjs', import.meta.url), path.join(directory, 'harness.mjs'));
  await writeFile(path.join(directory, 'catalog.json'), JSON.stringify(catalog));
  return { directory, cli: path.join(directory, 'harness.mjs') };
}

test('actual CLI outputs JSON only and creates a safe native-level template', async (t) => {
  const { cli } = await isolatedCli(t);
  const result = await execFileAsync(process.execPath, [cli, 'template', 'VN', 'test-framework', 'level-2']);
  const template = JSON.parse(result.stdout);
  assert.equal(template.levelId, 'level-2');
  assert.equal(template.applicabilityConfirmed, false);
  assert.equal(result.stderr, '');
});

test('actual CLI accepts UTF-8 BOM in Windows-generated catalog and evidence files', async (t) => {
  const { directory, cli } = await isolatedCli(t);
  const file = path.join(directory, 'evidence.json');
  await writeFile(path.join(directory, 'catalog.json'), `\uFEFF${JSON.stringify(catalog)}`);
  await writeFile(file, `\uFEFF${JSON.stringify(input())}`);
  const result = await execFileAsync(process.execPath, [cli, 'assess', file, '--as-of', asOf]);
  assert.equal(JSON.parse(result.stdout).conclusion, 'not_determined');
  assert.equal(result.stderr, '');
});

test('actual CLI safely handles malformed JSON and enforces the file size ceiling', async (t) => {
  const { directory, cli } = await isolatedCli(t);
  const file = path.join(directory, 'evidence.json');
  await writeFile(file, '{"password":"private-password"');
  await assert.rejects(execFileAsync(process.execPath, [cli, 'assess', file, '--as-of', asOf]), (error) => {
    assert.equal(error.stdout, '');
    assert.deepEqual(JSON.parse(error.stderr), { error: { code: 'EVIDENCE_READ_FAILED' } });
    assert.equal(error.stderr.includes('private-password'), false);
    assert.equal(error.stderr.includes(directory), false);
    return true;
  });
  await writeFile(file, Buffer.alloc(1024 * 1024 + 1, 'x'));
  await assert.rejects(execFileAsync(process.execPath, [cli, 'assess', file]), (error) => {
    assert.deepEqual(JSON.parse(error.stderr), { error: { code: 'INPUT_SIZE_LIMIT' } }); return true;
  });
});

test('actual CLI rejects secret-bearing input without emitting secrets or paths', async (t) => {
  const { directory, cli } = await isolatedCli(t);
  const file = path.join(directory, 'evidence.json');
  await writeFile(file, JSON.stringify({ ...input(), password: 'private-password' }));
  await assert.rejects(execFileAsync(process.execPath, [cli, 'assess', file, '--as-of', asOf]), (error) => {
    assert.equal(error.stdout, '');
    assert.deepEqual(JSON.parse(error.stderr), { error: { code: 'EVIDENCE_INVALID' } });
    assert.equal(error.stderr.includes('private-password'), false);
    return true;
  });
});

test('published evidence schema declares strict applicability, metadata and array bounds', async () => {
  const schema = JSON.parse(await readFile(new URL('./evidence.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes('applicabilityConfirmed'));
  assert.equal(schema.properties.observations.maxItems, 200);
  assert.equal(schema.definitions.observation.additionalProperties, false);
  assert.equal(schema.definitions.observation.properties.evidenceRefs.maxItems, 64);
});
