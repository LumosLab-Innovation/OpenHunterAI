import { describe, expect, it } from 'vitest';
import { probeCodingCli, probeCommandLine, type CommandRunner } from './coding-cli-probe.js';

function runner(results: Record<string, { exitCode: number; stdout?: string; stderr?: string }>): CommandRunner {
  return {
    async run(argv) {
      const key = argv.join(' ');
      const result = results[key] ?? { exitCode: 127, stderr: 'ENOENT' };
      return { exitCode: result.exitCode, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    },
  };
}

describe('coding CLI probe', () => {
  it('rejects probe argv that would need shell quoting', () => {
    expect(probeCommandLine(['codex', '--version'])).toBe('codex --version');
    expect(() => probeCommandLine(['codex', 'model name'])).toThrow(/unsupported characters/);
  });

  it('treats a successful grok model list as login and records those model ids', async () => {
    const result = await probeCodingCli('grok', runner({
      'grok --version': { exitCode: 0, stdout: 'grok 1.0.41' },
      'grok models': { exitCode: 0, stdout: 'You are logged in.\nAvailable models:\n  * grok-4.7 (default)\n  - grok-4.6\n' },
    }));
    expect(result).toMatchObject({
      installed: true,
      authenticated: true,
      supportedModels: ['cli-default', 'grok-4.7', 'grok-4.6'],
    });
  });

  it('accepts codex only when version and login status both succeed', async () => {
    const result = await probeCodingCli('codex', runner({
      'codex --version': { exitCode: 0, stdout: 'codex 0.9.0' },
      'codex login status': { exitCode: 0, stdout: 'Logged in' },
    }));
    expect(result).toMatchObject({ installed: true, authenticated: true, supportedModels: ['cli-default'], version: 'codex 0.9.0' });
  });

  it('drops version text that looks like a credential or URL', async () => {
    const result = await probeCodingCli('claude', runner({
      'claude --version': { exitCode: 0, stdout: 'claude https://example.invalid/sk-secret' },
      'claude auth status': { exitCode: 1, stderr: 'not logged in' },
    }));
    expect(result.version).toBeUndefined();
    expect(result.authenticated).toBe(false);
    expect(JSON.stringify(result)).not.toContain('sk-secret');
  });
});
