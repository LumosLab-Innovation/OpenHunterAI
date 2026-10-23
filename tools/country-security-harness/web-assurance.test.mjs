import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createWebAssurancePlan, createExpandedWebManifest, validateWebAssurance } from './web-assurance.mjs';
import { scoreCountryBenchmark } from './benchmark.mjs';
const data = JSON.parse(await readFile(new URL('./web-assurance.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8'));
const copy = (value) => JSON.parse(JSON.stringify(value));

test('pinned ASVS5 minimum levels have cumulative requirement denominators', () => {
  for (const [level, count] of [['level-1', 70], ['level-2', 253], ['level-3', 345]]) {
    const plan = createWebAssurancePlan(data, level);
    assert.equal(plan.requiredRequirementCount, count);
    assert.equal(plan.mappedRequirementCount, 8);
    assert.equal(plan.unmappedRequirementIds.length, count - 8);
    assert.equal(plan.executionAuthorized, false);
    assert.equal(plan.normativeCoverageComplete, false);
    assert.equal(plan.engineEfficacyVerified, false);
  }
});
test('counterevidence crosswalk uses stable native v5 requirement identifiers', () => {
  assert.deepEqual(data.categoryCrosswalk.find((item) => item.category === 'sqli').requirementIds, ['V1.2.4']);
  assert.ok(data.categoryCrosswalk.find((item) => item.category === 'idor').requirementIds.includes('V8.2.2'));
  assert.ok(data.categoryCrosswalk.every((item) => item.relationship === 'test_can_supply_partial_counterevidence'));
});
test('expanded manifest preserves all matched negatives and reports missing cases', () => {
  const manifest = createExpandedWebManifest(data);
  assert.equal(manifest.cases.length, 20);
  assert.equal(manifest.cases.filter((item) => item.expected === 'clear').length, 10);
  const score = scoreCountryBenchmark(catalog, manifest, { schemaVersion: 'country_security_benchmark_run_v1',
    dataOrigin: 'synthetic_fixture', frameworkId: 'vn-system-levels', levelId: 'level-3', producerId: 'fixture-producer',
    results: [], coverageGaps: ['SCOPE_NOT_EXECUTED'] });
  assert.equal(score.metadataGatePassed, false);
  assert.equal(score.engineEfficacyVerified, false);
  assert.equal(score.metrics.overall.recall, 0);
});
test('duplicate scenarios, invented IDs, unpinned source and unknown level are rejected', () => {
  const duplicate = copy(data); duplicate.scenarios.push(copy(duplicate.scenarios[0]));
  assert.throws(() => validateWebAssurance(duplicate), /WEB_ASSURANCE_INVALID/);
  const invented = copy(data); invented.categoryCrosswalk[0].requirementIds = ['V999.1.1'];
  assert.throws(() => validateWebAssurance(invented), /WEB_ASSURANCE_INVALID/);
  const unpinned = copy(data); unpinned.standard.tag = 'master';
  assert.throws(() => validateWebAssurance(unpinned), /WEB_ASSURANCE_INVALID/);
  assert.throws(() => createWebAssurancePlan(data, 'high'), /ASVS_LEVEL_UNSUPPORTED/);
});
