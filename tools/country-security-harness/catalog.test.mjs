import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateCatalog, createEvidenceTemplate, assessEvidence } from './harness.mjs';
import { scoreCountryBenchmark } from './benchmark.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = await json('./catalog.json');
const asOf = '2026-10-08';

test('published native-level catalog always leaves blank assessment undetermined', () => {
  validateCatalog(catalog);
  for (const framework of catalog.frameworks) {
    for (const level of framework.levels) {
      const input = createEvidenceTemplate(catalog, {
        countryCode: framework.countryCode, frameworkId: framework.id, levelId: level.id,
      });
      const result = assessEvidence(catalog, input, { asOf });
      assert.equal(result.conclusion, 'not_determined');
      assert.equal(result.formalLevelDetermination, false);
      assert.equal(result.framework.selectedLevel.id, level.id);
      assert.equal(result.coverage.metadataAcceptedCount, 0);
      assert.equal(result.coverage.notAssessedCount, framework.controlIds.length);
      assert.ok(result.coverage.gaps.some(({ code }) => code === 'APPLICABILITY_UNCONFIRMED'));
    }
  }
});

test('current reference packs preserve classification, governance and assurance distinctions', () => {
  const byId = Object.fromEntries(catalog.frameworks.map((framework) => [framework.id, framework]));
  assert.match(byId['vn-system-levels'].version, /331\/2026/);
  assert.equal(byId['vn-system-levels'].levels.length, 5);
  assert.ok(byId['vn-system-levels'].sources.some(({ id, title, locator }) =>
    id === 'vn-decree-85-transition' && title.includes('chuyển tiếp') && locator.includes('Điều 39')));
  assert.equal(byId['us-fips-199'].kind, 'impact_classification');
  assert.equal(byId['us-nist-csf'].kind, 'governance_tier');
  assert.equal(byId['gb-cyber-essentials'].kind, 'certification_assurance');
  assert.match(byId['gb-cyber-essentials'].version, /v3\.3/);
  assert.match(byId['sg-cyber-trust'].version, /2025/);
  assert.equal(byId['de-grundschutz-approaches'].ordinalLevels, false);
  assert.equal(byId['jp-security-action'].kind, 'self_declaration');
});

test('published evidence example stays synthetic, partial and undetermined', async () => {
  const example = await json('./examples/vn-level-3.evidence.json');
  const result = assessEvidence(catalog, example, { asOf });
  assert.equal(result.dataOrigin, 'synthetic_fixture');
  assert.equal(result.conclusion, 'not_determined');
  assert.equal(result.coverage.reportedFailedCount, 1);
  assert.equal(result.coverage.reportedSatisfiedCount, 1);
  assert.ok(result.coverage.notAssessedCount > 0);
  assert.ok(result.coverage.gaps.some(({ code }) => code === 'MAPPING_PARTIAL'));
});

test('published benchmark samples exercise both success and incomplete metadata gates', async () => {
  const manifest = await json('./examples/web-benchmark.manifest.json');
  const fixture = await json('./examples/web-benchmark.synthetic-run.json');
  const incomplete = await json('./examples/web-benchmark.incomplete-run.json');
  const passed = scoreCountryBenchmark(catalog, manifest, fixture);
  const failed = scoreCountryBenchmark(catalog, manifest, incomplete);
  assert.equal(passed.metadataGatePassed, true);
  assert.equal(failed.metadataGatePassed, false);
  for (const score of [passed, failed]) {
    assert.equal(score.dataOrigin, 'synthetic_fixture');
    assert.equal(score.replayVerified, false);
    assert.equal(score.engineEfficacyVerified, false);
    assert.equal(score.assessmentConclusion, 'not_determined');
  }
});

test('web benchmark cannot be relabeled as Essential Eight endpoint coverage', async () => {
  const manifest = await json('./examples/web-benchmark.manifest.json');
  const run = await json('./examples/web-benchmark.synthetic-run.json');
  run.frameworkId = 'au-essential-eight';
  run.levelId = 'level-3';
  assert.throws(() => scoreCountryBenchmark(catalog, manifest, run), /UNMAPPED_CONTROL/);
});

test('entry points locate their catalog when invoked outside the repo', () => {
  const script = fileURLToPath(new URL('./harness.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'validate-catalog'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).valid, true);
});
