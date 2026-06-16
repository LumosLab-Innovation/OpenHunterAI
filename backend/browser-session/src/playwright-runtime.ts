import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { BrowserRuntime, CreateBrowserSessionInput, RuntimeHandle } from './session-manager.js';

interface RuntimeProcess {
  name: string;
  proc: ChildProcess;
}

export class PlaywrightXvfbRuntime implements BrowserRuntime {
  private displayCounter = 90;

  async start(input: CreateBrowserSessionInput): Promise<RuntimeHandle> {
    assertAllowedLoginUrl(input.loginUrl, input.allowedHosts ?? []);
    const sessionDir = await mkdtemp(join(tmpdir(), `openhunter-browser-${input.sessionId}-`));
    const display = `:${this.displayCounter++}`;
    const vncPort = await freePort();
    const webPort = await freePort();
    const env = { ...process.env, DISPLAY: display };
    const processes: RuntimeProcess[] = [];

    try {
      processes.push(spawnRuntime('xvfb', process.env.XVFB_BIN || 'Xvfb', [display, '-screen', '0', '1366x768x24', '-ac'], env));
      await delay(500);
      processes.push(spawnRuntime('fluxbox', process.env.FLUXBOX_BIN || 'fluxbox', [], env));
      processes.push(
        spawnRuntime(
          'x11vnc',
          process.env.X11VNC_BIN || 'x11vnc',
          ['-display', display, '-localhost', '-forever', '-shared', '-nopw', '-rfbport', String(vncPort)],
          env,
        ),
      );
      processes.push(
        spawnRuntime(
          'websockify',
          process.env.WEBSOCKIFY_BIN || 'websockify',
          ['--web', process.env.NOVNC_WEB_ROOT || '/usr/share/novnc', String(webPort), `127.0.0.1:${vncPort}`],
          env,
        ),
      );
      await delay(500);

      const context = await chromium.launchPersistentContext(sessionDir, {
        headless: false,
        viewport: { width: 1366, height: 768 },
        acceptDownloads: false,
        args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
        env,
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(input.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return new PlaywrightSessionHandle(`http://127.0.0.1:${webPort}`, sessionDir, processes, context, page);
    } catch (error) {
      await disposeRuntime(sessionDir, processes);
      throw error;
    }
  }
}

class PlaywrightSessionHandle implements RuntimeHandle {
  constructor(
    readonly streamBaseUrl: string,
    private readonly sessionDir: string,
    private readonly processes: RuntimeProcess[],
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  async finalUrl(): Promise<string> {
    return this.page.url();
  }

  async storageState(): Promise<unknown> {
    return this.context.storageState();
  }

  async dispose(): Promise<void> {
    await this.context.close().catch(() => {});
    await disposeRuntime(this.sessionDir, this.processes);
  }
}

function assertAllowedLoginUrl(rawUrl: string, allowedHosts: string[]) {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  if (allowedHosts.length > 0 && !allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new Error('Login URL is outside allowed hosts');
  }
}

function spawnRuntime(name: string, command: string, args: string[], env: NodeJS.ProcessEnv): RuntimeProcess {
  const proc = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  return { name, proc };
}

async function disposeRuntime(sessionDir: string, processes: RuntimeProcess[]) {
  for (const runtimeProcess of processes.reverse()) {
    if (!runtimeProcess.proc.killed) runtimeProcess.proc.kill('SIGTERM');
  }
  await delay(300);
  for (const runtimeProcess of processes) {
    if (!runtimeProcess.proc.killed) runtimeProcess.proc.kill('SIGKILL');
  }
  await rm(sessionDir, { recursive: true, force: true }).catch(() => {});
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort(): Promise<number> {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
