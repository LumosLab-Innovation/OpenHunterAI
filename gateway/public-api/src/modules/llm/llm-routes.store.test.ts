import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultModuleRouteConfig } from '@x-hunter/shared';
import { applyRouteUpdate, loadLlmSettings, resolveRoutesPath, saveLlmSettings } from './llm-routes.store.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'openhunter-llm-'));
  dirs.push(dir);
  return join(dir, 'routes.json');
}

describe('LLM route settings', () => {
  it('does not use the host home directory when running in a container', () => {
    expect(resolveRoutesPath({ OPENHUNTER_IN_CONTAINER: '1' })).toBeNull();
    expect(resolveRoutesPath({ OPENHUNTER_LLM_ROUTES_PATH: 'C:\\explicit\\routes.json', OPENHUNTER_IN_CONTAINER: '1' }))
      .toBe('C:\\explicit\\routes.json');
  });

  it('rejects an unsupported level and keeps the previous file unchanged', () => {
    const path = tempPath();
    saveLlmSettings({ routes: defaultModuleRouteConfig() }, path);
    const routes = defaultModuleRouteConfig();
    const next = applyRouteUpdate(routes, {
      useCase: 'signal_summary',
      slot: 'primary',
      route: { transport: 'coding_cli', cli: 'gemini', model: 'cli-default', reasoningLevel: 'xhigh' },
    });
    expect(() => saveLlmSettings({ routes: next }, path)).toThrow(/reasoning level/);
    expect(loadLlmSettings(path).routes.signal_summary.primary).toMatchObject({ cli: 'codex', reasoningLevel: 'low' });
  });

  it('ignores a corrupt file instead of treating it as ready custom routes', () => {
    const path = tempPath();
    writeFileSync(path, '{', 'utf8');
    const loaded = loadLlmSettings(path);
    expect(loaded.source).toBe('default');
    expect(loaded.configError).toBe('LLM_ROUTES_CONFIG_INVALID');
    expect(loaded.routes.attacker_hypothesis.primary).toMatchObject({ cli: 'codex' });
  });
});
