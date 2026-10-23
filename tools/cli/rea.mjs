import { constants } from 'node:fs';
import { lstat, open, opendir, realpath, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join, relative, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import childProcess from 'node:child_process';

const VERSION = '6.7.0';
const COMMIT = '27dc42d10249f0410904a75c0997842eb03b931c';
const LIMITS = Object.freeze({ files: 2000, entries: 4000, fileBytes: 2 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, depth: 32, inventoryMs: 10000, processMs: 45000, outputBytes: 8 * 1024 * 1024 });
const EXTENSIONS = ['.webmanifest', '.woff2', '.jpeg', '.webp', '.avif', '.html', '.json', '.map', '.mjs', '.cjs', '.jsx', '.tsx', '.css', '.htm', '.png', '.jpg', '.gif', '.ico', '.svg', '.woff', '.ttf', '.otf', '.txt', '.js', '.ts'];
const PRIVATE_NAME = /(?:^\.env(?:\.|$)|^\.(?:git|ssh|aws|azure|codex|claude|grok|config)$|(?:^|[._-])(?:credentials?|secrets?|passwords?|tokens?)(?:[._-]|$)|\.(?:pem|key|p12|pfx|keystore|jks)$)/i;
const COUNT_FIELDS = ['relevant_files', 'nested_asar_containers', 'text_bytes_read', 'invalid_utf8_files', 'parsed_javascript_files', 'visited_ast_nodes', 'modules', 'parse_failures'];
const COVERAGE_STATES = new Set(['complete', 'partial', 'unknown', 'unavailable']);
const LIMITATIONS = [
  'This optional REA operation performs static analysis of an authorized local web artifact directory; it does not start a website scan or execute target code.',
  'Only allowlisted statistics, coverage metadata and hashes leave the adapter; upstream source, paths, names, URLs, diagnostics and raw Evidence are discarded.',
  'Upstream static observations are not independently validated OpenHunter findings.',
  'Use a stable release directory. Filesystem checks detect observed changes but are not an operating-system sandbox against concurrent modification.',
  'The installed third-party runtime is trusted operator software; process isolation and a stripped environment do not enforce network or filesystem isolation.',
  'Forced termination waits for the launcher exit; cleanup of descendant processes is not independently verified.',
  'Native binaries, application archives, credentials and unsupported files block this operation; they are not silently skipped.',
];

class ReaError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const digest = value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value);
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs;

function localPath(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.startsWith('\\\\') || value.startsWith('//') || (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value))) throw new ReaError('LOCAL_DIRECTORY_REQUIRED');
  return resolve(value);
}

async function safeDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(await realpath(path), path)) throw new ReaError('DIRECTORY_UNSAFE');
  return stat;
}

async function canonicalDirectory(value) {
  const path = localPath(value);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ReaError('DIRECTORY_UNSAFE');
  const canonical = await realpath(path);
  await safeDirectory(canonical);
  return canonical;
}

async function safeBytes(path, maximum) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximum || !samePath(await realpath(path), path)) throw new ReaError('FILE_UNSAFE_OR_OVERSIZED');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened)) throw new ReaError('INPUT_CHANGED');
    const bytes = Buffer.alloc(before.size);
    let position = 0;
    while (position < bytes.length) {
      const read = await handle.read(bytes, position, bytes.length - position, position);
      if (!read.bytesRead) break;
      position += read.bytesRead;
    }
    const after = await handle.stat();
    if (position !== before.size || after.nlink !== 1 || !sameFile(opened, after)) throw new ReaError('INPUT_CHANGED');
    return { bytes, stat: after };
  } finally { await handle.close(); }
}

async function inventory(directory) {
  const started = Date.now();
  const assets = [];
  const snapshots = [];
  const gaps = [];
  const manifest = createHash('sha256');
  let entries = 0;
  let totalBytes = 0;
  let javascriptFiles = 0;
  let stopped = false;
  const gap = (code, assetId) => gaps.push(assetId ? { code, assetId } : { code });
  const stop = code => { if (!stopped) gap(code); stopped = true; };
  async function walk(path, depth) {
    if (stopped) return;
    if (Date.now() - started >= LIMITS.inventoryMs) { stop('INVENTORY_TIMEOUT'); return; }
    if (depth > LIMITS.depth) { stop('DIRECTORY_DEPTH_LIMIT'); return; }
    let directoryHandle;
    try {
      const before = await safeDirectory(path);
      snapshots.push({ path, stat: before, directory: true });
      directoryHandle = await opendir(path, { bufferSize: 16 });
      for await (const entry of directoryHandle) {
        if (Date.now() - started >= LIMITS.inventoryMs) { stop('INVENTORY_TIMEOUT'); break; }
        if (++entries > LIMITS.entries) { stop('ENTRY_COUNT_LIMIT'); break; }
        const assetId = `asset-${String(entries).padStart(6, '0')}`;
        const child = join(path, entry.name);
        if (PRIVATE_NAME.test(entry.name)) { gap('PRIVATE_INPUT_NOT_ALLOWED', assetId); continue; }
        const stat = await lstat(child);
        if (stat.isSymbolicLink()) { gap('SYMLINK_NOT_ALLOWED', assetId); continue; }
        if (stat.isDirectory()) {
          if (/\.(?:app|asar|dsym|apk|aab)$/i.test(entry.name)) gap('UNSUPPORTED_INPUT', assetId);
          else await walk(child, depth + 1);
          continue;
        }
        if (!stat.isFile()) { gap('NONREGULAR_INPUT_NOT_ALLOWED', assetId); continue; }
        if (stat.nlink !== 1) { gap('HARDLINK_NOT_ALLOWED', assetId); continue; }
        const deploymentMetadata = entry.name === '_redirects' || entry.name === '_headers';
        const extension = deploymentMetadata ? 'none' : EXTENSIONS.find(value => entry.name.toLowerCase().endsWith(value));
        if (!extension) { gap('UNSUPPORTED_INPUT', assetId); continue; }
        if (assets.length >= LIMITS.files) { stop('FILE_COUNT_LIMIT'); break; }
        if (stat.size > LIMITS.fileBytes) { gap('FILE_SIZE_LIMIT', assetId); continue; }
        if (totalBytes + stat.size > LIMITS.totalBytes) { stop('TOTAL_BYTES_LIMIT'); break; }
        const verified = await safeBytes(child, LIMITS.fileBytes);
        if (totalBytes + verified.bytes.length > LIMITS.totalBytes) { stop('TOTAL_BYTES_LIMIT'); break; }
        const sha256 = createHash('sha256').update(verified.bytes).digest('hex');
        assets.push({ assetId, extension, type: deploymentMetadata ? 'deployment_metadata' : 'web_artifact', sizeBytes: verified.bytes.length, sha256 });
        snapshots.push({ path: child, stat: verified.stat, directory: false });
        manifest.update(relative(directory, child)).update('\0').update(sha256).update('\0');
        totalBytes += verified.bytes.length;
        if (['.js', '.mjs', '.cjs', '.jsx', '.tsx', '.ts'].includes(extension)) javascriptFiles++;
      }
      const after = await lstat(path);
      if (before.dev !== after.dev || before.ino !== after.ino || after.isSymbolicLink()) gap('INPUT_CHANGED');
    } catch { gap('INPUT_UNREADABLE_OR_UNSAFE'); }
    finally { if (directoryHandle) await directoryHandle.close().catch(() => {}); }
  }
  await walk(directory, 0);
  if (!javascriptFiles) gap('NO_JAVASCRIPT_INPUT');
  return { target: { kind: 'local_web_artifact_directory', assetCount: assets.length, totalBytes, manifestSha256: manifest.digest('hex'), assets }, snapshots, gaps };
}

async function unchanged(snapshots) {
  for (const snapshot of snapshots) {
    try {
      const stat = await lstat(snapshot.path);
      if (stat.isSymbolicLink() || !samePath(await realpath(snapshot.path), snapshot.path)) return false;
      if (snapshot.directory ? !stat.isDirectory() || stat.dev !== snapshot.stat.dev || stat.ino !== snapshot.stat.ino || stat.mtimeMs !== snapshot.stat.mtimeMs : !stat.isFile() || stat.nlink !== 1 || !sameFile(snapshot.stat, stat)) return false;
    } catch { return false; }
  }
  return true;
}

function runtimeMetadata() {
  return { package: 'rea-agents', expectedVersion: VERSION, upstreamCommit: COMMIT, installed: false, executable: false, integrityVerified: false };
}

async function inspectRuntime() {
  const metadata = runtimeMetadata();
  if (!process.env.OPENHUNTER_REA_ROOT) return { metadata, gap: 'TOOL_UNAVAILABLE' };
  try {
    const root = await canonicalDirectory(process.env.OPENHUNTER_REA_ROOT);
    const pkg = JSON.parse((await safeBytes(join(root, 'package.json'), 128 * 1024)).bytes.toString('utf8'));
    if (pkg.name !== 'rea-agents' || pkg.version !== VERSION) return { metadata, gap: 'RUNTIME_VERSION_UNSUPPORTED' };
    metadata.installed = true;
    const script = join(root, 'scripts', 'rea.mjs');
    const verifiedScript = await safeBytes(script, 128 * 1024);
    metadata.launcherSha256 = createHash('sha256').update(verifiedScript.bytes).digest('hex');
    for (const file of ['dist/cli-runtime/cli.js', 'dist/cli-runtime/cliOutput.js', 'dist/cli-runtime/cliResultOutput.js']) {
      const path = join(root, file);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !samePath(await realpath(path), path)) throw new ReaError('RUNTIME_UNSAFE');
    }
    return { metadata, script };
  } catch { return { metadata, gap: 'TOOL_UNAVAILABLE' }; }
}

async function execute(script, args) {
  let workspace;
  let temporaryRoot;
  let result;
  try {
    temporaryRoot = await canonicalDirectory(tmpdir());
    workspace = await mkdtemp(join(temporaryRoot, 'openhunter-rea-'));
    const cwd = join(workspace, 'cwd');
    const home = join(workspace, 'home');
    await mkdir(cwd);
    await mkdir(home);
    const env = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { TEMP: workspace, TMP: workspace, TMPDIR: workspace, USERPROFILE: home, HOME: home });
    result = await new Promise(resolveResult => {
      let child;
      let completed = false;
      let timer;
      let killTimer;
      let terminationCode;
      let bytes = 0;
      const chunks = [];
      const finish = value => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        clearTimeout(killTimer);
        resolveResult(value);
      };
      const terminate = code => {
        if (completed || terminationCode) return;
        terminationCode = code;
        clearTimeout(timer);
        try { child?.kill('SIGKILL'); }
        catch { finish({ gap: 'RUNTIME_TERMINATION_UNVERIFIED' }); return; }
        if (!completed) killTimer = setTimeout(() => finish({ gap: 'RUNTIME_TERMINATION_UNVERIFIED' }), 2000);
      };
      try {
        child = childProcess.spawn(process.execPath, [script, ...args], { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const receive = (chunk, stdout) => {
          if (completed) return;
          bytes += Buffer.byteLength(chunk);
          if (bytes > LIMITS.outputBytes) { terminate('RUNTIME_OUTPUT_LIMIT'); return; }
          if (stdout) chunks.push(Buffer.from(chunk));
        };
        child.stdout.on('data', chunk => receive(chunk, true));
        child.stderr.on('data', chunk => receive(chunk, false));
        child.on('error', () => finish({ gap: terminationCode || (Number.isInteger(child.pid) && child.pid > 0) ? 'RUNTIME_TERMINATION_UNVERIFIED' : 'TOOL_UNAVAILABLE' }));
        child.once('close', (code, signal) => finish(terminationCode ? { gap: terminationCode } : signal ? { gap: 'RUNTIME_FAILED' } : { exitCode: code, stdout: Buffer.concat(chunks).toString('utf8') }));
        timer = setTimeout(() => terminate('RUNTIME_TIMEOUT'), LIMITS.processMs);
      } catch { finish({ gap: 'TOOL_UNAVAILABLE' }); }
    });
  } catch { result = { gap: 'RUNTIME_FAILED' }; }
  finally {
    if (workspace) {
      try {
        const target = resolve(workspace);
        if (!samePath(resolve(target, '..'), temporaryRoot) || !/^openhunter-rea-[a-z\d]+$/i.test(basename(target))) throw new ReaError('TEMP_CLEANUP_FAILED');
        await safeDirectory(target);
        if (result?.gap !== 'RUNTIME_TERMINATION_UNVERIFIED') await rm(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      }
      catch { result = { gap: 'TEMP_CLEANUP_FAILED' }; }
    }
  }
  return result;
}

function coverage(value, semantic = false) {
  if (!object(value) || !COVERAGE_STATES.has(value.status) || typeof value.truncated !== 'boolean') throw new ReaError('RUNTIME_OUTPUT_INVALID');
  const output = { status: value.status, truncated: value.truncated };
  for (const key of semantic ? ['omitted_nodes', 'omitted_relations'] : ['omitted_count']) {
    if (value[key] !== null && !count(value[key])) throw new ReaError('RUNTIME_OUTPUT_INVALID');
    output[key] = value[key];
  }
  if (value.status === 'complete' && (value.truncated || (semantic ? ['omitted_nodes', 'omitted_relations'] : ['omitted_count']).some(key => output[key] !== 0))) throw new ReaError('RUNTIME_OUTPUT_INVALID');
  return output;
}

export function summarizeReaEvidence(value) {
  if (!object(value) || value.operation !== 'analyze_javascript_application' || !object(value.normalized_result)) throw new ReaError('RUNTIME_OUTPUT_INVALID');
  const normalized = value.normalized_result;
  if (normalized.format !== 'directory' || !digest(normalized.root_artifact_sha256) || !object(normalized.statistics) || !object(normalized.graph) || !object(normalized.semantic_graph) || !Array.isArray(normalized.limitations)) throw new ReaError('RUNTIME_OUTPUT_INVALID');
  const statistics = {};
  for (const key of COUNT_FIELDS) {
    if (!count(normalized.statistics[key])) throw new ReaError('RUNTIME_OUTPUT_INVALID');
    statistics[key] = normalized.statistics[key];
  }
  if (!count(normalized.statistics.findings)) throw new ReaError('RUNTIME_OUTPUT_INVALID');
  statistics.staticObservationCount = normalized.statistics.findings;
  if (normalized.statistics.skipped_javascript_files !== undefined && !count(normalized.statistics.skipped_javascript_files)) throw new ReaError('RUNTIME_OUTPUT_INVALID');
  statistics.skipped_javascript_files = normalized.statistics.skipped_javascript_files ?? null;
  return { artifactSha256: normalized.root_artifact_sha256, statistics, applicationCoverage: coverage(normalized.graph.coverage), semanticCoverage: coverage(normalized.semantic_graph.coverage, true), upstreamLimitationCount: normalized.limitations.length };
}

export async function runReaCli(args) {
  let operation;
  try {
    if (!Array.isArray(args) || !((args.length === 1 && args[0] === 'doctor') || (args.length === 3 && args[0] === 'analyze' && typeof args[1] === 'string' && args[2] === '--authorized'))) throw new ReaError(args?.[0] === 'analyze' && !args.includes('--authorized') ? 'AUTHORIZATION_REQUIRED' : 'USAGE_ERROR');
    operation = args[0];
    const output = { schemaVersion: 'rea_local_analysis_v1', operation, status: 'unavailable', executed: false, runtime: runtimeMetadata(), limits: LIMITS, gaps: [], independentValidation: false, isFinding: false, targetCodeExecuted: false, networkIsolationEnforced: false, limitations: LIMITATIONS };
    let inspected;
    if (operation === 'analyze') {
      let directory;
      try { directory = await canonicalDirectory(args[1]); } catch { throw new ReaError('DIRECTORY_UNAVAILABLE_OR_UNSAFE'); }
      inspected = await inventory(directory);
      inspected.directory = directory;
      output.target = inspected.target;
      output.gaps.push(...inspected.gaps);
      if (output.gaps.length) { output.status = 'blocked'; return { exitCode: 1, output }; }
    }
    const runtime = await inspectRuntime();
    output.runtime = runtime.metadata;
    if (runtime.gap) { output.gaps.push({ code: runtime.gap }); return { exitCode: 1, output }; }
    if (operation === 'doctor') {
      const probe = await execute(runtime.script, ['--version']);
      if (probe.gap || probe.exitCode !== 0 || !/^(?:rea(?:-agents)?\s+)?v?6\.7\.0\s*$/i.test(probe.stdout ?? '')) {
        output.gaps.push({ code: probe.gap ?? 'RUNTIME_VERSION_PROBE_FAILED' });
        return { exitCode: 1, output };
      }
      output.runtime.executable = true;
      output.status = 'available';
      return { exitCode: 0, output };
    }
    if (!await unchanged(inspected.snapshots)) { output.status = 'blocked'; output.gaps.push({ code: 'INPUT_CHANGED' }); return { exitCode: 1, output }; }
    const execution = await execute(runtime.script, ['analyze-javascript-application', inspected.directory, '--json', '--artifact-format', 'directory', '--integrity-policy', 'fail', '--max-heap-mb', '256', '--analysis-timeout-ms', '20000', '--max-semantic-nodes', '10000', '--max-semantic-nodes-per-file', '5000', '--max-semantic-unknowns', '10000', '--max-semantic-unknowns-per-file', '5000', '--filter-output', 'operation,code,normalized_result.format,normalized_result.root_artifact_sha256,normalized_result.statistics,normalized_result.graph.coverage.status,normalized_result.graph.coverage.truncated,normalized_result.graph.coverage.omitted_count,normalized_result.semantic_graph.coverage.status,normalized_result.semantic_graph.coverage.truncated,normalized_result.semantic_graph.coverage.omitted_nodes,normalized_result.semantic_graph.coverage.omitted_relations,normalized_result.limitations']);
    if (execution.gap) { output.status = 'blocked'; output.gaps.push({ code: execution.gap }); return { exitCode: 1, output }; }
    output.runtime.executable = true;
    let evidence;
    try {
      evidence = JSON.parse(execution.stdout);
      if (object(evidence) && evidence.code === 'provider_timeout') {
        output.status = 'blocked';
        output.gaps.push({ code: 'STATIC_ANALYSIS_BUDGET_LIMIT' });
        return { exitCode: 1, output };
      }
      output.analysis = summarizeReaEvidence(evidence);
    }
    catch { output.status = 'blocked'; output.gaps.push({ code: 'RUNTIME_OUTPUT_INVALID' }); return { exitCode: 1, output }; }
    output.executed = true;
    if (execution.exitCode !== 0) output.gaps.push({ code: 'RUNTIME_FAILED' });
    if (!await unchanged(inspected.snapshots)) output.gaps.push({ code: 'INPUT_CHANGED' });
    if (output.analysis.applicationCoverage.status !== 'complete' || output.analysis.semanticCoverage.status !== 'complete' || output.analysis.statistics.parse_failures || output.analysis.statistics.invalid_utf8_files || output.analysis.statistics.skipped_javascript_files === null || output.analysis.statistics.skipped_javascript_files > 0) output.gaps.push({ code: 'STATIC_ANALYSIS_PARTIAL' });
    output.status = output.gaps.length ? 'partial' : 'executed';
    return { exitCode: output.gaps.length ? 1 : 0, output };
  } catch (error) {
    return { exitCode: 2, output: { schemaVersion: 'rea_local_analysis_v1', operation: operation ?? 'unknown', status: 'input_error', executed: false, error: { code: error instanceof ReaError ? error.code : 'INPUT_ERROR' }, independentValidation: false, isFinding: false } };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exitCode, output } = await runReaCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = exitCode;
}
