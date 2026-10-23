#!/usr/bin/env python3
"""Offline QA only: Python >=3.10, jsonschema==4.26.0 and Node >=22."""
import json
from pathlib import Path
import subprocess

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
schemas = {}
for file in sorted(ROOT.glob('*.schema.json')):
    schema = json.loads(file.read_text(encoding='utf-8-sig'))
    Draft202012Validator.check_schema(schema)
    schemas[file.name] = Draft202012Validator(schema, format_checker=FormatChecker())

validated = 0


def validate(schema, document):
    global validated
    schemas[schema].validate(document)
    validated += 1


def file(schema, path):
    validate(schema, json.loads(path.read_text(encoding='utf-8-sig')))


file('catalog.schema.json', ROOT / 'catalog.json')
for path in sorted((ROOT / 'packs').glob('*.requirements.json')):
    file('clauses.schema.json', path)
for path in sorted((ROOT / 'expansion').glob('*.frameworks.json')):
    file('world-coverage.schema.json', path)
for name in ['global-directory.json', 'jurisdiction-identifiers.json']:
    file('world-coverage.schema.json', ROOT / name)
for path in sorted((ROOT / 'examples').glob('*.json')):
    schema = ('clauses.schema.json' if path.name.endswith('.clauses.json') else
              'evidence.schema.json' if path.name.endswith('.evidence.json') else 'benchmark.schema.json')
    file(schema, path)

# One local Node invocation checks generated output contracts for every native target.
script = r"""
import {readFile} from 'node:fs/promises';
import {createEvidenceTemplate,assessEvidence} from './harness.mjs';
import {loadRequirementPacks,createClauseTemplate,assessClauses} from './clauses.mjs';
import {scoreCountryBenchmark} from './benchmark.mjs';
import {runWorldCoverageCli} from './world-coverage.mjs';
const json=async(file)=>JSON.parse(await readFile(file,'utf8'));
const catalog=await json('./catalog.json');
const rows=[];
for(const framework of catalog.frameworks)for(const level of framework.levels){
  const input=createEvidenceTemplate(catalog,{countryCode:framework.countryCode,frameworkId:framework.id,levelId:level.id});
  rows.push(['evidence.schema.json',input],['assessment.schema.json',assessEvidence(catalog,input,{asOf:catalog.reviewedOn})]);
}
for(const pack of await loadRequirementPacks(catalog)){
  const framework=catalog.frameworks.find((item)=>item.id===pack.frameworkId);
  for(const level of framework.levels){
    const input=createClauseTemplate(catalog,pack,level.id);
    rows.push(['clauses.schema.json',input],['clauses.schema.json',assessClauses(catalog,pack,input,{asOf:catalog.reviewedOn})]);
  }
}
const manifest=await json('./examples/web-benchmark.manifest.json');
for(const name of ['synthetic-run','incomplete-run']){
  rows.push(['benchmark.schema.json',scoreCountryBenchmark(catalog,manifest,await json(`./examples/web-benchmark.${name}.json`))]);
}
for(const args of [['summary'],['list'],['directory'],['show','VN'],['show','EU'],['show','ZZ'],['show','AFG']]){
  rows.push(['world-coverage.schema.json',await runWorldCoverageCli(args)]);
}
process.stdout.write(JSON.stringify(rows));
"""
result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT,
                        check=True, capture_output=True, encoding='utf-8')
for schema, document in json.loads(result.stdout):
    validate(schema, document)
print(json.dumps({'valid': True, 'schemaCount': len(schemas), 'validatedDocumentsAndOutputs': validated}))
