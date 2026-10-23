import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { validateCatalog, runCli } from './harness.mjs';
import { loadRequirementPacks } from './clauses.mjs';
import { summarizeWorldCoverage, validateWorldDirectory, runWorldCoverageCli } from './world-coverage.mjs';

const json = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const [catalog, directory, identifiers] = await Promise.all([
  json('./catalog.json'), json('./global-directory.json'), json('./jurisdiction-identifiers.json')]);
const packs = await loadRequirementPacks(catalog);
const copy = (value) => structuredClone(value);
const report = () => summarizeWorldCoverage(catalog, packs, directory, identifiers);

test('the UN directory supplies research gaps, not supported country counts', () => {
  const result = report();
  assert.equal(result.counts.directoryCountryOrAreaCount, 248);
  assert.ok(result.counts.catalogedCountryOrAreaCount >= 50);
  assert.ok(result.counts.catalogedCountryOrAreaCount < 248);
  assert.equal(result.counts.countriesOrAreasWithClausePacks + result.counts.countriesOrAreasWithReferenceOnly,
    result.counts.catalogedCountryOrAreaCount);
  assert.ok(result.counts.unreviewedDirectoryEntryCount > 0);
  assert.equal(result.conclusion, 'inventory_only');
  assert.equal(result.formalLevelDetermination, false);
  const researchedInsideDirectory = result.jurisdictions.filter((row) => row.m49Code).length;
  assert.equal(result.counts.unreviewedDirectoryEntryCount + researchedInsideDirectory, 248);
  assert.equal(result.counts.curatedRequirementCount, packs.reduce((sum, pack) => sum + pack.requirements.length, 0));
});
test('supranational and international groups are excluded from national counts', async () => {
  const result = report();
  for (const [code, type] of [['EU', 'supranational'], ['ZZ', 'international']]) {
    const row = result.jurisdictions.find((item) => item.countryCode === code);
    assert.equal(row.jurisdictionType, type);
    assert.equal(row.isoAlpha3, undefined);
    assert.equal(row.m49Code, undefined);
  }
  assert.equal(result.jurisdictions.length, result.counts.catalogedCountryOrAreaCount + 2);
  const validated = await runCli(['validate-catalog']);
  assert.equal(validated.countryCount, result.counts.catalogedCountryOrAreaCount);
  assert.equal(validated.jurisdictionCount, result.jurisdictions.length);
});
test('reference-only frameworks have no manufactured clause checks', () => {
  for (const row of report().jurisdictions) {
    assert.ok(row.gaps.includes('PARTIAL_REFERENCE_COVERAGE'));
    for (const framework of row.frameworks) {
      if (framework.depth === 'framework_reference_only') {
        assert.equal(framework.curatedRequirementCount, 0);
        assert.equal(framework.packId, undefined);
        assert.ok(framework.levels.every((level) => level.curatedRequirementCount === 0));
      }
    }
    if (row.depth === 'framework_reference_only') assert.ok(row.gaps.includes('NO_CURATED_CLAUSE_PACK'));
  }
});
test('clause-pack source provenance is retained separately from framework references', () => {
  const result = report();
  for (const pack of packs) {
    const framework = result.jurisdictions.flatMap((row) => row.frameworks)
      .find((row) => row.frameworkId === pack.frameworkId);
    assert.deepEqual(framework.packSources, pack.sources);
    assert.equal(framework.packVersion, pack.version);
  }
});
test('international ASVS clauses preserve the pinned native minimum levels', async () => {
  const standard = await json('./web-assurance.json');
  const pack = packs.find((item) => item.frameworkId === 'int-owasp-asvs');
  assert.equal(pack.requirements.length, 37);
  for (const requirement of pack.requirements) {
    const nativeId = requirement.id.replace(/^asvs\./, '').toUpperCase();
    const native = standard.requirementIndex.find((item) => item.id === nativeId);
    assert.ok(native, nativeId);
    assert.deepEqual(requirement.levels, [1, 2, 3].filter((level) => level >= native.minimumLevel)
      .map((level) => `level-${level}`));
    assert.equal(requirement.check.type, 'manual');
    assert.equal(requirement.levelBasis, 'cumulative_minimum');
  }
  assert.equal(pack.sources[0].url, standard.standard.url);
});
test('directory duplicates and corrupted identity joins are rejected', () => {
  const duplicate = copy(directory); duplicate.entries.push(copy(duplicate.entries[0]));
  assert.throws(() => validateWorldDirectory(duplicate, identifiers), /WORLD_DIRECTORY_INVALID/);
  const badIds = copy(identifiers); badIds.entries[0].countryCode = 'EU';
  assert.throws(() => validateWorldDirectory(directory, badIds), /JURISDICTION_IDENTIFIERS_INVALID/);
  const missing = copy(identifiers); missing.entries = missing.entries.filter((row) => row.countryCode !== 'VN');
  assert.throws(() => summarizeWorldCoverage(catalog, packs, directory, missing), /JURISDICTION_IDENTIFIER_MISSING/);
});
test('group metadata cannot inflate a national count or silently conflict', () => {
  const bad = copy(catalog);
  bad.frameworks.find((item) => item.countryCode === 'ZZ').jurisdictionType = 'country_or_area';
  assert.throws(() => summarizeWorldCoverage(bad, packs, directory, identifiers), /CATALOG_INVALID/);
  const unknownType = copy(catalog); unknownType.frameworks[0].jurisdictionType = 'nation_equivalence';
  assert.throws(() => validateCatalog(unknownType), /CATALOG_INVALID/);
});
test('published curated identity joins preserve primary directory keys', () => {
  const expected = { US: ['USA', '840'], GB: ['GBR', '826'], VN: ['VNM', '704'],
    CN: ['CHN', '156'], HK: ['HKG', '344'], DE: ['DEU', '276'],
    FR: ['FRA', '250'], AU: ['AUS', '036'], LK: ['LKA', '144'], BD: ['BGD', '050'] };
  for (const [code, [iso3, m49]] of Object.entries(expected)) {
    assert.equal(identifiers.entries.find((row) => row.countryCode === code).isoAlpha3, iso3);
    assert.equal(directory.entries.find((row) => row.isoAlpha3 === iso3).m49Code, m49);
  }
  const taiwan = report().jurisdictions.find((row) => row.countryCode === 'TW');
  assert.equal(taiwan.isoAlpha3, 'TWN');
  assert.equal(taiwan.m49Code, undefined);
  assert.ok(taiwan.gaps.includes('OUTSIDE_UN_DIRECTORY_SNAPSHOT'));
});
test('CLI exposes research-pending countries without creating empty assessments', async () => {
  const pending = report().unreviewedDirectoryEntries[0];
  const result = await runWorldCoverageCli(['show', pending.isoAlpha3]);
  assert.equal(result.jurisdiction.depth, 'research_pending');
  assert.deepEqual(result.jurisdiction.gaps, ['NATIONAL_FRAMEWORK_NOT_RESEARCHED']);
  const vn = await runWorldCoverageCli(['show', 'VN']);
  assert.equal(vn.jurisdiction.depth, 'curated_clauses');
  assert.deepEqual((await runWorldCoverageCli(['show', 'VNM'])).jurisdiction, vn.jurisdiction);
  const summary = await runWorldCoverageCli(['summary']);
  assert.equal(summary.jurisdictions, undefined);
  assert.deepEqual(summary.counts, report().counts);
  await assert.rejects(() => runWorldCoverageCli(['show', 'VN', 'extra']), /CLI_ARGUMENTS_INVALID/);
  await assert.rejects(() => runWorldCoverageCli(['show', 'XXX']), /JURISDICTION_UNSUPPORTED/);
});

async function temporaryDirectory(t) {
  const prefix = path.join(tmpdir(), 'country-pack-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(prefix)) && resolved !== path.resolve(tmpdir()));
    await rm(resolved, { recursive: true, force: true });
  });
  return { directory, url: pathToFileURL(`${directory}${path.sep}`) };
}
test('dynamic pack discovery rejects names that do not match framework identities', async (t) => {
  const { directory: temporary, url } = await temporaryDirectory(t);
  await writeFile(path.join(temporary, 'wrong-name.requirements.json'), JSON.stringify(packs[0]));
  await assert.rejects(() => loadRequirementPacks(catalog, url), /PACK_FILENAME_MISMATCH/);
});
test('dynamic discovery rejects duplicate identities and non-file pack entries', async (t) => {
  const { directory: temporary, url } = await temporaryDirectory(t);
  await writeFile(path.join(temporary, 'first.requirements.json'), JSON.stringify(packs[0]));
  await writeFile(path.join(temporary, 'second.requirements.json'), JSON.stringify(packs[0]));
  await assert.rejects(() => loadRequirementPacks(catalog, url), /DUPLICATE_PACK_ID/);
  await mkdir(path.join(temporary, 'third.requirements.json'));
  await assert.rejects(() => loadRequirementPacks(catalog, url), /PACK_FILE_INVALID/);
});
test('unrecognized files cannot silently become clause packs', async (t) => {
  const { directory: temporary, url } = await temporaryDirectory(t);
  await writeFile(path.join(temporary, 'notes.txt'), 'unrelated');
  await assert.rejects(() => loadRequirementPacks(catalog, url), /PACK_DIRECTORY_INVALID/);
});
