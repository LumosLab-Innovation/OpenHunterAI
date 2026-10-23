import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
test('public build replaces stale dashboard output and works independently of cwd and frontend dependencies', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'openhunter-public-build-'));
  try {
    mkdirSync(join(fixture, 'tools'));
    mkdirSync(join(fixture, 'frontend', 'dist'), { recursive: true });
    cpSync(join(root, 'tools', 'build-public-site.mjs'), join(fixture, 'tools', 'build-public-site.mjs'));
    cpSync(join(root, 'site'), join(fixture, 'site'), { recursive: true });
    writeFileSync(join(fixture, 'frontend', 'index.html'), 'LOCAL_DASHBOARD_SOURCE');
    writeFileSync(join(fixture, 'frontend', 'dist', 'old-dashboard.js'), 'STALE_APP_BUNDLE');
    const result = spawnSync(process.execPath, [join(fixture, 'tools', 'build-public-site.mjs')], { cwd: tmpdir(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(fixture, 'frontend', 'dist', 'index.html'), 'utf8'), readFileSync(join(root, 'site', 'index.html'), 'utf8'));
    assert.equal(existsSync(join(fixture, 'frontend', 'dist', 'old-dashboard.js')), false);
    assert.equal(readFileSync(join(fixture, 'frontend', 'index.html'), 'utf8'), 'LOCAL_DASHBOARD_SOURCE');
    assert.equal(existsSync(join(fixture, 'frontend', 'node_modules')), false);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
