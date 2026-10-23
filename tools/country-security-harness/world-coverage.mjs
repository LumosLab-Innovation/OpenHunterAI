#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateCatalog } from './harness.mjs';
import { loadRequirementPacks, validateRequirementPack } from './clauses.mjs';

export class WorldCoverageError extends Error {
  constructor(code) { super(code); this.name = 'WorldCoverageError'; this.code = code; }
}
function must(condition, code = 'WORLD_DIRECTORY_INVALID') {
  if (!condition) throw new WorldCoverageError(code);
}
function shape(value, keys, code = 'WORLD_DIRECTORY_INVALID') {
  must(value && typeof value === 'object' && !Array.isArray(value) &&
    keys.length === Object.keys(value).length && keys.every((key) => Object.hasOwn(value, key)), code);
}
function nonempty(value, max = 4000) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateWorldDirectory(directory, identifiers) {
  shape(directory, ['schemaVersion', 'reviewedOn', 'source', 'entries', 'limitations']);
  must(directory.schemaVersion === 'country_security_global_directory_v1' && validDate(directory.reviewedOn));
  shape(directory.source, ['id', 'title', 'url', 'locator']);
  must(directory.source.id === 'un-m49' && directory.source.url === 'https://unstats.un.org/unsd/methodology/M49' &&
    nonempty(directory.source.title) && nonempty(directory.source.locator));
  must(Array.isArray(directory.entries) && directory.entries.length > 0 && directory.entries.length <= 300);
  for (const entry of directory.entries) {
    shape(entry, ['name', 'm49Code', 'isoAlpha3']);
    must(nonempty(entry.name, 300) && /^\d{3}$/.test(entry.m49Code) && /^[A-Z]{3}$/.test(entry.isoAlpha3));
  }
  for (const key of ['m49Code', 'isoAlpha3']) must(new Set(directory.entries.map((row) => row[key])).size === directory.entries.length);
  must(Array.isArray(directory.limitations) && directory.limitations.length > 0 &&
    directory.limitations.length <= 20 && directory.limitations.every((item) => nonempty(item)));
  const code = 'JURISDICTION_IDENTIFIERS_INVALID';
  shape(identifiers, ['schemaVersion', 'reviewedOn', 'method', 'entries', 'limitations'], code);
  must(identifiers.schemaVersion === 'country_security_jurisdiction_identifiers_v1' &&
    validDate(identifiers.reviewedOn) && nonempty(identifiers.method), code);
  must(Array.isArray(identifiers.entries) && identifiers.entries.length > 0 && identifiers.entries.length <= 300, code);
  for (const entry of identifiers.entries) {
    shape(entry, ['countryCode', 'isoAlpha3'], code);
    must(/^[A-Z]{2}$/.test(entry.countryCode) && !['EU', 'ZZ'].includes(entry.countryCode) &&
      /^[A-Z]{3}$/.test(entry.isoAlpha3), code);
  }
  for (const key of ['countryCode', 'isoAlpha3']) must(new Set(identifiers.entries.map((row) => row[key])).size === identifiers.entries.length, code);
  must(Array.isArray(identifiers.limitations) && identifiers.limitations.length > 0 &&
    identifiers.limitations.length <= 20 && identifiers.limitations.every((item) => nonempty(item)), code);
  return directory;
}

/** Inventory counts never turn directory metadata into a supported national checklist. */
export function summarizeWorldCoverage(catalog, packs, directory, identifiers) {
  validateCatalog(catalog); validateWorldDirectory(directory, identifiers);
  must(Array.isArray(packs) && packs.length <= 200, 'WORLD_PACKS_INVALID');
  packs.forEach((pack) => validateRequirementPack(catalog, pack));
  must(new Set(packs.map((pack) => pack.packId)).size === packs.length &&
    new Set(packs.map((pack) => pack.frameworkId)).size === packs.length, 'WORLD_PACKS_DUPLICATE');
  const byFramework = new Map(packs.map((pack) => [pack.frameworkId, pack]));
  const identities = new Map(identifiers.entries.map((item) => [item.countryCode, item.isoAlpha3]));
  const directoryByIso3 = new Map(directory.entries.map((item) => [item.isoAlpha3, item]));
  const codes = [...new Set(catalog.frameworks.map((framework) => framework.countryCode))].sort();
  const jurisdictions = codes.map((countryCode) => {
    const frameworks = catalog.frameworks.filter((framework) => framework.countryCode === countryCode);
    const types = new Set(frameworks.map((framework) => framework.jurisdictionType ?? 'country_or_area'));
    must(types.size === 1, 'JURISDICTION_TYPE_CONFLICT');
    const jurisdictionType = [...types][0];
    must((countryCode === 'EU' ? jurisdictionType === 'supranational' : countryCode === 'ZZ' ?
      jurisdictionType === 'international' : jurisdictionType === 'country_or_area'), 'JURISDICTION_TYPE_INVALID');
    const isoAlpha3 = jurisdictionType === 'country_or_area' ? identities.get(countryCode) : undefined;
    must(jurisdictionType !== 'country_or_area' || isoAlpha3, 'JURISDICTION_IDENTIFIER_MISSING');
    const directoryRow = directoryByIso3.get(isoAlpha3);
    const clausePacks = frameworks.map((framework) => byFramework.get(framework.id)).filter(Boolean);
    const requirementCount = clausePacks.reduce((sum, pack) => sum + pack.requirements.length, 0);
    const gaps = ['PARTIAL_REFERENCE_COVERAGE', 'NO_CERTIFICATION_OR_LEVEL_DETERMINATION'];
    if (!clausePacks.length) gaps.push('NO_CURATED_CLAUSE_PACK');
    if (frameworks.some((framework) => framework.currency === 'requires_review')) gaps.push('FRAMEWORK_REVIEW_REQUIRED');
    if (jurisdictionType === 'country_or_area' && !directoryRow) gaps.push('OUTSIDE_UN_DIRECTORY_SNAPSHOT');
    return { countryCode, name: frameworks[0].countryName, jurisdictionType,
      ...(isoAlpha3 ? { isoAlpha3 } : {}), ...(directoryRow ? { m49Code: directoryRow.m49Code } : {}),
      depth: clausePacks.length ? 'curated_clauses' : 'framework_reference_only', frameworkCount: frameworks.length,
      clausePackCount: clausePacks.length, curatedRequirementCount: requirementCount, gaps,
      frameworks: frameworks.map((framework) => {
        const pack = byFramework.get(framework.id);
        return { frameworkId: framework.id, label: framework.label, version: framework.version,
          kind: framework.kind, currency: framework.currency, applicability: framework.applicability,
          levels: framework.levels.map((level) => ({ levelId: level.id, label: level.label,
            curatedRequirementCount: pack?.requirements.filter((clause) => clause.levels.includes(level.id)).length ?? 0 })),
          depth: pack ? 'curated_clauses' : 'framework_reference_only',
          ...(pack ? { packId: pack.packId, packVersion: pack.version, packSources: pack.sources } : {}),
          curatedRequirementCount: pack?.requirements.length ?? 0, sources: framework.sources,
          limitations: [...framework.limitations, ...(pack?.limitations ?? [])] };
      }) };
  });
  const mapped = new Map(jurisdictions.filter((item) => item.isoAlpha3).map((item) => [item.isoAlpha3, item]));
  const unreviewedDirectoryEntries = directory.entries.filter((entry) => !mapped.has(entry.isoAlpha3))
    .map((entry) => ({ ...entry, depth: 'research_pending', gaps: ['NATIONAL_FRAMEWORK_NOT_RESEARCHED'] }));
  const countryRows = jurisdictions.filter((item) => item.jurisdictionType === 'country_or_area');
  const scopedCount = (type) => jurisdictions.filter((item) => item.jurisdictionType === type).length;
  return { schemaVersion: 'country_security_world_coverage_v1', reviewedOn: catalog.reviewedOn,
    catalogVersion: catalog.catalogVersion, conclusion: 'inventory_only', formalLevelDetermination: false,
    counts: { directoryCountryOrAreaCount: directory.entries.length,
      catalogedCountryOrAreaCount: countryRows.length,
      countriesOrAreasWithClausePacks: countryRows.filter((item) => item.clausePackCount > 0).length,
      countriesOrAreasWithReferenceOnly: countryRows.filter((item) => !item.clausePackCount).length,
      catalogedSupranationalGroups: scopedCount('supranational'), catalogedInternationalGroups: scopedCount('international'),
      frameworkCount: catalog.frameworks.length, clausePackCount: packs.length,
      curatedRequirementCount: packs.reduce((sum, pack) => sum + pack.requirements.length, 0),
      unreviewedDirectoryEntryCount: unreviewedDirectoryEntries.length },
    jurisdictions, unreviewedDirectoryEntries, directorySource: directory.source,
    limitations: ['Directory entries count statistical countries or areas, not sovereign countries or supported compliance packs.',
      'A country can have several sector frameworks. A reviewed source is not proof of legal applicability or current consolidated law.',
      'Curated packs are partial. Reference-only and research-pending entries cannot produce clause assessments.',
      'National readiness rankings, impact classifications, organizational maturity and application verification are distinct. No global grade conversion is performed.',
      ...directory.limitations] };
}

async function json(name) {
  try {
    const bytes = await readFile(new URL(name, import.meta.url));
    must(bytes.length <= 2 * 1024 * 1024, 'WORLD_INPUT_SIZE_LIMIT');
    return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof WorldCoverageError) throw error;
    throw new WorldCoverageError('WORLD_INPUT_READ_FAILED');
  }
}
export async function runWorldCoverageCli(args) {
  must((args.length === 1 && ['summary', 'list', 'directory'].includes(args[0])) ||
    (args.length === 2 && args[0] === 'show' && /^(?:[A-Z]{2}|[A-Z]{3})$/.test(args[1])), 'CLI_ARGUMENTS_INVALID');
  const [catalog, directory, identifiers] = await Promise.all([
    json('./catalog.json'), json('./global-directory.json'), json('./jurisdiction-identifiers.json')]);
  const packs = await loadRequirementPacks(catalog);
  const report = summarizeWorldCoverage(catalog, packs, directory, identifiers);
  if (args[0] === 'summary') { const { jurisdictions, unreviewedDirectoryEntries, ...summary } = report; return summary; }
  if (args[0] === 'list') { const { unreviewedDirectoryEntries, ...list } = report; return list; }
  if (args[0] === 'directory') return report;
  const row = report.jurisdictions.find((item) => item.countryCode === args[1] || item.isoAlpha3 === args[1]) ??
    report.unreviewedDirectoryEntries.find((item) => item.isoAlpha3 === args[1]);
  must(row, 'JURISDICTION_UNSUPPORTED');
  return { schemaVersion: 'country_security_jurisdiction_coverage_v1', reviewedOn: report.reviewedOn,
    conclusion: 'inventory_only', jurisdiction: row };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.stdout.write(`${JSON.stringify(await runWorldCoverageCli(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) {
    process.stderr.write(`${JSON.stringify({ error: { code: error?.code ?? 'WORLD_COVERAGE_FAILED' } })}\n`);
    process.exitCode = 2;
  }
}
