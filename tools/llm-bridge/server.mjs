/**
 * Loopback host bridge. Containers call it with a bearer token.
 * The prompt arrives in the JSON body and is written only to the CLI stdin,
 * inside an empty temp directory. It is not logged and not put on the command line.
 */

import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_NAMES, PROBE_ARGV, classifyCliFailure, completionCapabilities, completionSpec, extractCodexCompletion, extractCompletion, promptHasSecret } from './adapters.mjs';

export const MAX_BODY_BYTES = 32_000;

export function tokenMatches(expected, header) {
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const got = Buffer.from(header.slice('Bearer '.length));
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export async function runCompletion(route, prompt, options) {
  const spec = completionSpec(route);
  if (spec.errorCode) return { outputText: '', errorCode: spec.errorCode, latencyMs: 0 };
  if (promptHasSecret(prompt)) return { outputText: '', errorCode: 'EVIDENCE_NOT_SANITIZED', latencyMs: 0 };
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputChars = options.maxOutputChars ?? 8_000;
  const maxRawChars = spec.format === 'codex_json' ? Math.max(128_000, maxOutputChars * 8) : maxOutputChars;
  const started = Date.now();
  const dir = await mkdtemp(join(tmpdir(), 'openhunter-llm-'));
  try {
    const result = await new Promise((resolve) => {
      const child = (options.spawnImpl ?? spawn)(spec.command, spec.args, {
        cwd: dir,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(spec.format === 'codex_json' ? { env: codexChildEnv() } : {}),
      });
      let stdout = '';
      let stderr = '';
      let toolDemand = false;
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => {
        finish({ outputText: '', errorCode: 'BRIDGE_TIMEOUT', latencyMs: Date.now() - started });
        child.kill();
      }, timeoutMs);
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
        if (stdout.length > maxRawChars) {
          clearTimeout(timer);
          child.kill();
          finish({ outputText: '', errorCode: 'OUTPUT_LIMIT', latencyMs: Date.now() - started });
        }
      });
      child.stderr?.on('data', (chunk) => {
        const part = String(chunk);
        const combined = stderr + part;
        toolDemand ||= /tools::router: error|patch rejected|code-mode host is disabled/i.test(combined);
        stderr = combined.slice(-8_000);
      });
      child.on('error', () => {
        clearTimeout(timer);
        finish({ outputText: '', errorCode: 'CLI_NOT_INSTALLED', latencyMs: Date.now() - started });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (settled) return;
        const extracted = spec.format === 'codex_json'
          ? extractCodexCompletion(stdout, toolDemand ? 'tools::router: error' : stderr)
          : extractCompletion(stdout.slice(0, maxOutputChars));
        const tooLong = !extracted.errorCode && extracted.outputText.length > maxOutputChars;
        finish({
          ...(tooLong ? { outputText: '', errorCode: 'OUTPUT_LIMIT' } : extracted),
          ...(code && !extracted.errorCode && !tooLong ? { errorCode: classifyCliFailure(`${stderr}\n${extracted.outputText}`) } : {}),
          latencyMs: Date.now() - started,
        });
      });
      child.stdin.end(prompt);
    });
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function codexChildEnv() {
  const allowed = [
    'PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'APPDATA',
    'LOCALAPPDATA', 'TEMP', 'TMP', 'CODEX_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  ];
  return Object.fromEntries(allowed.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
}

export function commandRunner() {
  return {
    run(argv) {
      const line = argv.map((arg) => {
        if (!/^[A-Za-z0-9_./:-]+$/.test(arg)) throw new Error('unsafe argv');
        return arg;
      }).join(' ');
      return new Promise((resolve) => {
        const child = process.platform === 'win32'
          ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
          : spawn(argv[0], argv.slice(1), { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
          child.kill();
          resolve({ exitCode: 124, stdout: stdout.slice(0, 400), stderr: 'TIMEOUT' });
        }, 8000);
        child.stdout?.on('data', (chunk) => { stdout = (stdout + String(chunk)).slice(0, 400); });
        child.stderr?.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(0, 400); });
        child.on('error', () => {
          clearTimeout(timer);
          resolve({ exitCode: 127, stdout: '', stderr: 'ENOENT' });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ exitCode: code ?? 1, stdout, stderr });
        });
      });
    },
  };
}

export async function handleBridge(request, token, options = {}) {
  if (!tokenMatches(token, request.headers.authorization)) {
    return { status: 401, body: { errorCode: 'BRIDGE_UNAUTHORIZED' } };
  }
  const host = String(request.headers.host ?? '');
  if (!/^(127\.0\.0\.1|localhost|\[::1\]|host\.docker\.internal)(:\d+)?$/i.test(host)) {
    return { status: 403, body: { errorCode: 'BRIDGE_HOST_NOT_LOCAL' } };
  }
  if (request.method === 'GET' && request.url === '/health') {
    return { status: 200, body: { ok: true, service: 'llm-bridge' } };
  }
  if (request.method === 'GET' && request.url === '/capabilities') {
    return { status: 200, body: { ok: true, completion: completionCapabilities() } };
  }
  if (request.method === 'POST' && request.url === '/probe') {
    const probes = {};
    for (const cli of CLI_NAMES) {
      probes[cli] = await probeCli(cli, options.runner);
    }
    return { status: 200, body: { probes } };
  }
  if (request.method !== 'POST' || request.url !== '/complete') {
    return { status: 404, body: { errorCode: 'NOT_FOUND' } };
  }
  if (Buffer.byteLength(request.rawBody ?? '') > MAX_BODY_BYTES) {
    return { status: 413, body: { errorCode: 'OUTPUT_LIMIT' } };
  }
  let body;
  try {
    body = JSON.parse(request.rawBody || '{}');
  } catch {
    return { status: 400, body: { errorCode: 'INVALID_INPUT' } };
  }
  const prompt = `System:\n${body.systemPrompt ?? ''}\n\nUser:\n${body.userPrompt ?? ''}`;
  if (promptHasSecret(prompt)) return { status: 400, body: { errorCode: 'EVIDENCE_NOT_SANITIZED' } };
  const result = await runCompletion(
    { cli: body.cli, model: body.model, reasoningLevel: body.reasoningLevel },
    prompt,
    { timeoutMs: body.timeoutMs, maxOutputChars: body.maxOutputChars, spawnImpl: options.spawnImpl },
  );
  return { status: 200, body: result };
}

async function probeCli(cli, runner) {
  const capability = completionCapabilities()[cli];
  const spec = PROBE_ARGV[cli];
  if (!runner || !spec) {
    return {
      cli,
      installed: false,
      authenticated: false,
      supportedModels: [],
      completion: capability?.state ?? 'unavailable',
      ...(capability?.reason ? { completionReason: capability.reason } : {}),
      errorCode: 'CLI_NOT_PROBED',
    };
  }
  const version = await runner.run(spec.version);
  if (version.exitCode !== 0) {
    return {
      cli,
      installed: false,
      authenticated: false,
      supportedModels: [],
      completion: capability?.state ?? 'unavailable',
      ...(capability?.reason ? { completionReason: capability.reason } : {}),
      errorCode: 'CLI_NOT_INSTALLED',
    };
  }
  let authenticated = false;
  let supportedModels = [];
  if (spec.auth) {
    const auth = await runner.run(spec.auth);
    const text = `${auth.stdout}\n${auth.stderr}`;
    authenticated = auth.exitCode === 0 && !/not logged|not authenticated|sign in|login required/i.test(text);
    if (authenticated && /available models/i.test(auth.stdout)) {
      supportedModels = ['cli-default', ...new Set([...auth.stdout.matchAll(/\b[a-z0-9]+(?:-[a-z0-9._:-]+){1,8}\b/gi)].map((match) => match[0].toLowerCase()))];
    } else if (authenticated) supportedModels = ['cli-default'];
  }
  return {
    cli,
    installed: true,
    authenticated,
    supportedModels,
    completion: capability?.state ?? 'unavailable',
    ...(capability?.state === 'locked' ? {} : { completionReason: capability?.reason ?? 'CLI_COMPLETION_UNAVAILABLE' }),
    ...(authenticated ? {} : { errorCode: spec.auth ? 'CLI_NOT_AUTHENTICATED' : 'CLI_AUTH_UNVERIFIED' }),
    version: version.stdout.split(/\r?\n/).find(Boolean)?.slice(0, 80),
  };
}

function listen() {
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!token) {
    console.error('OPENHUNTER_LLM_BRIDGE_TOKEN is required');
    process.exit(1);
  }
  const port = Number(process.env.OPENHUNTER_LLM_BRIDGE_PORT || 4733);
  const server = createServer((req, res) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ errorCode: 'OUTPUT_LIMIT' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      handleBridge({
        method: req.method,
        url: req.url,
        headers: req.headers,
        rawBody: Buffer.concat(chunks).toString('utf8'),
      }, token, { runner: commandRunner() }).then((result) => {
        if (res.writableEnded) return;
        res.writeHead(result.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(result.body));
      }).catch(() => {
        if (res.writableEnded) return;
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ errorCode: 'BRIDGE_FAILED' }));
      });
    });
  });
  server.listen(port, '127.0.0.1', () => {
    console.error(`llm-bridge listening on 127.0.0.1:${port}`);
  });
}

if (process.argv[1] && /server\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) listen();
