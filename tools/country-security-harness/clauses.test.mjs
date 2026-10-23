import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assessClauses, createClauseTemplate, validateRequirementPack, runClauseCli, loadRequirementPacks } from './clauses.mjs';

const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8'));
const copy = (item) => JSON.parse(JSON.stringify(item));
const asOf = '2026-10-08';
const row = (overrides = {}) => ({ id: 'test.patch', label: 'Declared critical patch interval',
  controlId: 'patch_management', levels: ['essentials', 'essentials-plus'], levelBasis: 'framework_wide',
  sourceId: 'source', locator: 'Test fixture clause, not a normative source', normativeStrength: 'mandatory',
  applicability: [{ factId: 'patch-applicable', equals: true }],
  check: { type: 'number', factId: 'patch-delay-days', max: 14, unit: 'days' },
  evidenceKinds: ['configuration'], interpretationNotes: 'Synthetic rule exercising the evaluator.', ...overrides });
const pack = { schemaVersion: 'country_security_requirement_pack_v1', packId: 'test-pack',
  frameworkId: 'gb-cyber-essentials', version: 'synthetic-fixture', reviewedOn: asOf, coverage: 'partial',
  sources: [{ id: 'source', title: 'Test source', url: 'https://www.ncsc.gov.uk/cyberessentials/resources', locator: 'Test source' }],
  limitations: ['Synthetic fixture only.'], requirements: [row()] };
const fact = (overrides = {}) => ({ factId: 'patch-delay-days', value: 14, kind: 'configuration',
  evidenceRefs: ['proof:patch-review'], observedAt: '2026-10-01', expiresAt: '2026-11-01', ...overrides });
const input = (overrides = {}) => ({ ...createClauseTemplate(catalog, pack, 'essentials'),
  dataOrigin: 'synthetic_fixture', applicabilityConfirmed: true,
  context: [{ factId: 'patch-applicable', value: true }], observations: [fact()], ...overrides });
const assess = (data, selectedPack = pack) => assessClauses(catalog, selectedPack, data, { asOf });

test('inclusive exact deadline matches declared facts without certification or verified content', () => {
  const result = assess(input());
  assert.equal(result.coverage.factMatchCount, 1);
  assert.equal(result.clauses[0].metadataAccepted, true);
  assert.equal(result.clauses[0].contentVerified, false);
  assert.equal(result.formalLevelDetermination, false);
  assert.equal(result.independentlyValidated, false);
  assert.equal(result.conclusion, 'not_determined');
  assert.ok(result.coverage.gaps.some((gap) => gap.code === 'PACK_PARTIAL'));
});
test('deadline violation stays a violation on positive or negative benchmark findings', () => {
  const result = assess(input({ observations: [fact({ value: 14.01 })] }));
  assert.equal(result.coverage.factViolationCount, 1);
  assert.equal(result.clauses[0].state, 'violates_declared_fact');
});
test('missing scope context never evaluates a scoped check', () => {
  const result = assess(input({ context: [] }));
  assert.equal(result.coverage.unknownApplicabilityCount, 1);
  assert.equal(result.coverage.factMatchCount, 0);
});
test('a scope exclusion remains reviewable and is not counted as satisfied', () => {
  const result = assess(input({ context: [{ factId: 'patch-applicable', value: false }] }));
  assert.equal(result.coverage.excludedCount, 1);
  assert.equal(result.coverage.factMatchCount, 0);
  assert.deepEqual(result.clauses[0].gaps, ['EXCLUSION_REQUIRES_REVIEW']);
});
test('missing observations are explicit gaps', () => {
  const result = assess(input({ observations: [] }));
  assert.equal(result.coverage.notAssessedCount, 1);
  assert.deepEqual(result.clauses[0].gaps, ['FACT_MISSING']);
});
for (const [name, overrides, gap] of [
  ['expired', { expiresAt: '2026-10-07' }, 'EVIDENCE_EXPIRED'],
  ['future', { observedAt: '2026-10-09' }, 'EVIDENCE_FROM_FUTURE'],
  ['unsuitable kind', { kind: 'scan_metadata' }, 'EVIDENCE_KIND_UNSUITABLE'],
]) test(`${name} metadata cannot satisfy a requirement`, () => {
  const result = assess(input({ observations: [fact(overrides)] }));
  assert.equal(result.coverage.factMatchCount, 0);
  assert.equal(result.clauses[0].metadataAccepted, false);
  assert.deepEqual(result.clauses[0].gaps, [gap]);
});
test('manual review is pending even when the operator confirms applicability', () => {
  const manual = copy(pack); manual.requirements = [row({ applicability: [],
    check: { type: 'manual', reviewTopic: 'Independent assessor decision' } })];
  const result = assess({ ...createClauseTemplate(catalog, manual, 'essentials'), applicabilityConfirmed: true }, manual);
  assert.equal(result.coverage.manualReviewCount, 1);
  assert.equal(result.coverage.factMatchCount, 0);
});
test('booleans and enum choices respect the selected native level', () => {
  const levels = copy(pack); levels.requirements = [row({ id: 'test.l1', applicability: [],
    levels: ['essentials'], check: { type: 'enum', factId: 'admin-profile', allowedValues: ['mfa', 'allowlist-and-password'] } }),
  row({ id: 'test.l2', applicability: [], levels: ['essentials-plus'],
    check: { type: 'enum', factId: 'admin-profile', allowedValues: ['mfa'] } })];
  const data = { ...createClauseTemplate(catalog, levels, 'essentials'), observations: [fact({
    factId: 'admin-profile', value: 'allowlist-and-password' })] };
  assert.equal(assess(data, levels).coverage.factMatchCount, 1);
  assert.equal(assess({ ...data, levelId: 'essentials-plus' }, levels).coverage.factViolationCount, 1);
  levels.requirements = [row({ applicability: [], check: { type: 'boolean', factId: 'enabled', expected: true } })];
  assert.equal(assess({ ...createClauseTemplate(catalog, levels, 'essentials'),
    observations: [fact({ factId: 'enabled', value: false })] }, levels).coverage.factViolationCount, 1);
});
test('calendar month values stay distinct from hours/days', () => {
  const monthly = copy(pack); monthly.requirements[0].check = {
    type: 'number', factId: 'revalidation-calendar-months', max: 12, unit: 'months' };
  const data = { ...createClauseTemplate(catalog, monthly, 'essentials'), context: input().context,
    observations: [fact({ factId: 'revalidation-calendar-months', value: 12 })] };
  assert.equal(assess(data, monthly).coverage.factMatchCount, 1);
  assert.equal(assess({ ...data, observations: [fact({ factId: 'revalidation-calendar-months', value: 12.1 })] }, monthly)
    .coverage.factViolationCount, 1);
});
test('empty native level has an explicit gap instead of a vacuous pass', () => {
  const emptyLevel = copy(pack); emptyLevel.requirements[0].levels = ['essentials-plus'];
  const result = assess(createClauseTemplate(catalog, emptyLevel, 'essentials'), emptyLevel);
  assert.equal(result.coverage.selectedRequirementCount, 0);
  assert.ok(result.coverage.gaps.some((gap) => gap.code === 'LEVEL_WITHOUT_CURATED_REQUIREMENTS'));
});
for (const [name, mutate] of [
  ['raw body', (data) => { data.observations[0].body = 'discard-this'; }],
  ['credential-like assessment ID', (data) => { data.assessmentId = 'sk-example-private-value'; }],
  ['underscore-prefixed credential ID', (data) => { data.assessmentId = 'review_sk-syntheticabcdefghijk'; }],
  ['credential-component assessment ID', (data) => { data.assessmentId = 'assessment-secret-privatevalue'; }],
  ['raw evidence URL', (data) => { data.observations[0].evidenceRefs = ['https://example.test/secret']; }],
  ['credential-like reference', (data) => { data.observations[0].evidenceRefs = ['proof:password:value']; }],
  ['duplicate observation', (data) => { data.observations.push(copy(data.observations[0])); }],
  ['unknown fact', (data) => { data.observations[0].factId = 'arbitrary-fact'; }],
  ['numeric string', (data) => { data.observations[0].value = '14'; }],
  ['negative duration', (data) => { data.observations[0].value = -1; }],
  ['invalid calendar date', (data) => { data.observations[0].observedAt = '2026-02-30'; }],
  ['duplicate context', (data) => { data.context.push(copy(data.context[0])); }],
  ['unknown context', (data) => { data.context[0].factId = 'arbitrary-context'; }],
  ['wrong context type', (data) => { data.context[0].value = 'true'; }],
]) test(`${name} is rejected with a fixed error code`, () => {
  const data = input(); mutate(data);
  assert.throws(() => assess(data), /^ClauseError: CLAUSE_EVIDENCE_INVALID$/);
});
test('ambiguous fact definitions cannot be assigned conflicting units', () => {
  const bad = copy(pack); bad.requirements.push(row({ id: 'test.other', check: {
    type: 'number', factId: 'patch-delay-days', max: 48, unit: 'hours' } }));
  assert.throws(() => validateRequirementPack(catalog, bad), /PACK_FACT_TYPE_CONFLICT/);
});
test('count facts cannot use fractional measurements', () => {
  const counted = copy(pack); counted.requirements[0].check = { type: 'number', factId: 'guess-count', max: 10, unit: 'count' };
  assert.throws(() => assess({ ...createClauseTemplate(catalog, counted, 'essentials'), context: input().context,
    observations: [fact({ factId: 'guess-count', value: 2.5 })] }, counted), /CLAUSE_EVIDENCE_INVALID/);
});
test('unknown levels and untraceable clauses are rejected', () => {
  const bad = copy(pack); bad.requirements[0].levels = ['level-3'];
  assert.throws(() => validateRequirementPack(catalog, bad), /PACK_INVALID/);
  bad.requirements[0].levels = ['essentials']; bad.requirements[0].sourceId = 'missing';
  assert.throws(() => validateRequirementPack(catalog, bad), /PACK_INVALID/);
});
test('a changed pack cannot silently reinterpret previously captured evidence', () => {
  const changed = copy(pack); changed.requirements[0].check.max = 10;
  assert.throws(() => assess(input(), changed), /PACK_SNAPSHOT_MISMATCH/);
  const wrongVersion = input(); wrongVersion.packVersion = 'other-version';
  assert.throws(() => assess(wrongVersion), /PACK_SNAPSHOT_MISMATCH/);
});
test('published packs retain partial coverage and all blank levels remain undetermined', async () => {
  for (const sourcePack of await loadRequirementPacks(catalog)) {
    assert.ok(sourcePack.requirements.length > 0);
    for (const level of catalog.frameworks.find((item) => item.id === sourcePack.frameworkId).levels) {
      const result = assess(createClauseTemplate(catalog, sourcePack, level.id), sourcePack);
      assert.equal(result.conclusion, 'not_determined'); assert.equal(result.coverage.factMatchCount, 0);
      assert.ok(result.coverage.gaps.length > 0);
    }
  }
});
test('an unresolved source edition stays a review gap even with matching declared facts', () => {
  const reviewCatalog = copy(catalog);
  reviewCatalog.frameworks.find((framework) => framework.id === pack.frameworkId).currency = 'requires_review';
  const result = assessClauses(reviewCatalog, pack, input(), { asOf });
  assert.equal(result.coverage.factMatchCount, 1);
  assert.equal(result.frameworkCurrency, 'requires_review');
  assert.ok(result.coverage.gaps.some((gap) => gap.code === 'FRAMEWORK_REVIEW_REQUIRED'));
  assert.equal(result.conclusion, 'not_determined');
});
test('CLI lists only researched packs and rejects unsupported country mappings', async () => {
  const result = await runClauseCli(['validate-packs']);
    assert.ok(result.packCount >= 3); assert.ok(result.requirementCount >= 168);
  await assert.rejects(() => runClauseCli(['show', 'unresearched-framework', 'baseline']), /PACK_UNSUPPORTED/);
});
test('published clause fixtures preserve failed facts, captured pack digests and manual gaps', async () => {
  for (const [frameworkId, file] of [['vn-system-levels', 'vn-level-3'],
    ['au-essential-eight', 'au-level-3'], ['gb-cyber-essentials', 'gb-plus']]) {
    const sourcePack = JSON.parse(await readFile(new URL(`./packs/${frameworkId}.requirements.json`, import.meta.url), 'utf8'));
    const data = JSON.parse(await readFile(new URL(`./examples/${file}.clauses.json`, import.meta.url), 'utf8'));
    const result = assess(data, sourcePack);
    assert.equal(result.dataOrigin, 'synthetic_fixture');
    assert.ok(result.coverage.factViolationCount >= 1);
    assert.ok(result.coverage.notAssessedCount + result.coverage.unknownApplicabilityCount > 0);
    assert.equal(result.conclusion, 'not_determined');
  }
});
