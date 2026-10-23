import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BANNER, normalizeScanTarget, normalizeTarget, parseArgs } from './openhunter.mjs';
import { decodeRgbaPng, renderTerminalArt } from './terminal-art.mjs';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('terminal art is generated from the bundled character, not a generic icon', () => {
  assert.match(BANNER, /OPENHUNTERAI/);
  assert.match(BANNER, /AI ATTACKER-MINDSET PENTEST/);
  assert.doesNotMatch(BANNER, /\x1b\[/);
  assert.ok(BANNER.split('\n').length > 16);
  const portrait = renderTerminalArt({ columns: 64, rows: 27, color: true });
  assert.match(portrait, /\x1b\[38;2;/);
  assert.match(portrait, /\x1b\[48;2;/);
  assert.match(portrait, /▀/);
  const brand = portrait.slice(portrait.lastIndexOf('\n\n'));
  assert.match(brand, /\x1b\[1;38;2;/);
  assert.match(brand.replace(/\x1b\[[0-9;]*m/g, ''), /OPENHUNTERAI/);
  const image = decodeRgbaPng(readFileSync(new URL('./assets/hunter-character.png', import.meta.url)));
  assert.equal(image.width, 1440);
  assert.equal(image.height, 1092);
});

test('accepts one HTTPS public hostname and normalizes case', () => {
  assert.equal(normalizeTarget('HTTPS://EXAMPLE.COM/'), 'example.com');
  assert.equal(normalizeTarget('Example.com'), 'example.com');
});

test('accepts URL paths for a path-scoped scan', () => {
  assert.deepEqual(normalizeScanTarget('https://EXAMPLE.com/vi/trang-chu/'), { host: 'example.com', path: '/vi/trang-chu' });
});

test('rejects credentials, ports, query strings, and plain HTTP', () => {
  for (const input of ['http://example.com', 'https://a:b@example.com', 'https://example.com:443', 'example.com?x=1', 'https://app.localhost/']) {
    assert.throws(() => normalizeTarget(input));
  }
});

test('parses minimal scan flags and rejects unknown options', () => {
  assert.deepEqual(parseArgs(['scan', '--host', 'example.com', '--authorized', '--json']).command, 'scan');
  assert.equal(parseArgs([]).command, 'menu');
  assert.equal(parseArgs(['dashboard']).command, 'dashboard');
  assert.deepEqual(parseArgs(['llm-routes', 'set', 'signal_summary', 'fallback', 'grok', 'cli-default', 'low']).llmArgs, ['set', 'signal_summary', 'fallback', 'grok', 'cli-default', 'low']);
  assert.equal(parseArgs(['--host', 'example.com']).command, 'scan');
  assert.equal(parseArgs(['scan', '--host', 'https://example.com/app', '--scope', 'host']).scope, 'host');
  assert.throws(() => parseArgs(['scan', '--scope', 'all']));
  assert.throws(() => parseArgs(['scan', '--password', 'secret']));
});

test('REA delegates to the optional local runtime without calling the scan API', () => {
  const args = ['rea', 'analyze', 'https://example.test/private?token=synthetic-private-marker', '--authorized'];
  assert.deepEqual(parseArgs(args).reaArgs, args.slice(1));
  assert.equal(parseArgs(['rea', '--help']).help, true);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./openhunter.mjs', import.meta.url)), ...args], {
    encoding: 'utf8', env: { ...process.env, OPENHUNTER_API_BASE: 'invalid-api-must-not-be-used' },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.ok(JSON.parse(result.stdout).error);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-marker|example\.test|invalid-api|OPENHUNTERAI/);
});
