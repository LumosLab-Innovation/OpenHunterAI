import { spawn } from 'node:child_process';
import type { CliProbeResult, CodingCliName } from '@x-hunter/shared';
import { CODING_CLIS } from '@x-hunter/shared';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(argv: readonly string[], timeoutMs: number): Promise<CommandResult>;
}

/** Fixed argv. User-controlled model strings are never interpolated here. */
export const PROBE_ARGV: Record<CodingCliName, { version: readonly string[]; auth?: readonly string[] }> = {
  codex: { version: ['codex', '--version'], auth: ['codex', 'login', 'status'] },
  claude: { version: ['claude', '--version'], auth: ['claude', 'auth', 'status'] },
  gemini: { version: ['gemini', '--version'] },
  grok: { version: ['grok', '--version'], auth: ['grok', 'models'] },
};

/** Probe argv is fixed. Reject anything that would need shell quoting. */
export function probeCommandLine(argv: readonly string[]): string {
  return argv.map((arg) => {
    if (!/^[A-Za-z0-9_./:-]+$/.test(arg)) throw new Error('CLI probe argv contains unsupported characters');
    return arg;
  }).join(' ');
}

export function spawnCommandRunner(): CommandRunner {
  return {
    run(argv, timeoutMs) {
      const [command, ...args] = argv;
      if (!command) return Promise.resolve({ exitCode: 127, stdout: '', stderr: 'ENOENT' });
      let line = '';
      try {
        line = probeCommandLine(argv);
      } catch {
        return Promise.resolve({ exitCode: 127, stdout: '', stderr: 'UNSAFE_ARGV' });
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (result: CommandResult) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        // Windows npm shims are .cmd files. cmd.exe launches that shim only; the
        // coding CLI still does not receive a shell or a credential path.
        const child = process.platform === 'win32'
          ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
          : spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill();
          finish({ exitCode: 124, stdout: clip(stdout), stderr: 'TIMEOUT' });
        }, timeoutMs);
        child.stdout.on('data', (chunk: Buffer | string) => {
          stdout = clip(stdout + String(chunk));
        });
        child.stderr.on('data', (chunk: Buffer | string) => {
          stderr = clip(stderr + String(chunk));
        });
        child.on('error', () => {
          clearTimeout(timer);
          finish({ exitCode: 127, stdout: '', stderr: 'ENOENT' });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          finish({ exitCode: code ?? 1, stdout: clip(stdout), stderr: clip(stderr) });
        });
      });
    },
  };
}

export async function probeCodingCli(cli: CodingCliName, runner: CommandRunner, timeoutMs = 4000): Promise<CliProbeResult> {
  const spec = PROBE_ARGV[cli];
  const version = await runner.run(spec.version, timeoutMs);
  if (version.exitCode !== 0) {
    return {
      cli,
      installed: false,
      authenticated: false,
      supportedModels: [],
      errorCode: version.stderr === 'TIMEOUT' ? 'CLI_PROBE_TIMEOUT' : 'CLI_NOT_INSTALLED',
    };
  }
  if (!spec.auth) {
    return {
      cli,
      installed: true,
      authenticated: false,
      supportedModels: [],
      version: publicVersion(version.stdout),
      errorCode: 'CLI_AUTH_UNVERIFIED',
    };
  }
  const auth = await runner.run(spec.auth, timeoutMs);
  const authText = `${auth.stdout}\n${auth.stderr}`;
  const loggedOut = /not logged|not authenticated|sign in|login required|please log/i.test(authText);
  const authenticated = auth.exitCode === 0 && !loggedOut;
  return {
    cli,
    installed: true,
    authenticated,
    supportedModels: authenticated && /available models/i.test(auth.stdout) ? modelsFromProbeOutput(auth.stdout) : authenticated ? ['cli-default'] : [],
    version: publicVersion(version.stdout),
    ...(authenticated ? {} : { errorCode: auth.stderr === 'TIMEOUT' ? 'CLI_PROBE_TIMEOUT' : 'CLI_NOT_AUTHENTICATED' }),
  };
}

export function modelsFromProbeOutput(stdout: string): string[] {
  const models = new Set<string>(['cli-default']);
  for (const match of stdout.matchAll(/\b[a-z0-9]+(?:-[a-z0-9._:-]+){1,8}\b/gi)) {
    const id = match[0].toLowerCase();
    if (id.startsWith('cli-') || id.length > 80) continue;
    models.add(id);
  }
  return [...models];
}

export async function probeCodingClis(runner: CommandRunner = spawnCommandRunner(), timeoutMs = 4000): Promise<CliProbeResult[]> {
  return Promise.all(CODING_CLIS.map((cli) => probeCodingCli(cli, runner, timeoutMs)));
}

function clip(value: string): string {
  return value.slice(0, 400);
}

function publicVersion(stdout: string): string | undefined {
  const line = stdout.split(/\r?\n/).map((item) => item.trim()).find(Boolean) ?? '';
  if (!line || /sk-|api[_-]?key|@|https?:\/\//i.test(line)) return undefined;
  return line.slice(0, 80);
}
