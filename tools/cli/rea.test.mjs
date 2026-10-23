import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath, symlink, link, truncate, access, lstat } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import childProcess from 'node:child_process';
import { runReaCli, summarizeReaEvidence } from './rea.mjs';

async function fixture(t) {
  const temporaryRoot = await realpath(tmpdir());
  const path = await mkdtemp(join(temporaryRoot, 'openhunter-rea-demo-'));
  t.after(async () => {
    const target = resolve(path);
    assert.equal(resolve(target, '..'), temporaryRoot);
    assert.match(basename(target), /^openhunter-rea-demo-[a-z\d]+$/i);
    assert.equal((await lstat(target)).isSymbolicLink(), false);
    assert.equal(await realpath(target), target);
    await rm(target, { recursive: true, force: true });
  });
  return await realpath(path);
}

function environment(t, key, value) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

async function runtime(t) {
  const root = await fixture(t);
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'dist', 'cli-runtime'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'rea-agents', version: '6.7.0' }));
  await writeFile(join(root, 'scripts', 'rea.mjs'), '// MOCK / DEMO DATA: process calls are stubbed, not upstream execution.');
  for (const name of ['cli.js', 'cliOutput.js', 'cliResultOutput.js']) await writeFile(join(root, 'dist', 'cli-runtime', name), '// MOCK / DEMO DATA');
  environment(t, 'OPENHUNTER_REA_ROOT', root);
  return root;
}

function evidence() {
  return {
    operation: 'analyze_javascript_application',
    normalized_result: {
      format: 'directory', root_artifact_sha256: 'a'.repeat(64),
      statistics: { relevant_files: 1, nested_asar_containers: 0, text_bytes_read: 42, invalid_utf8_files: 0, parsed_javascript_files: 1, skipped_javascript_files: 0, visited_ast_nodes: 10, findings: 2, modules: 1, parse_failures: 0 },
      graph: { coverage: { status: 'complete', truncated: false, omitted_count: 0, limits: [] } },
      semantic_graph: { coverage: { status: 'complete', truncated: false, omitted_nodes: 0, omitted_relations: 0, limits: [] } },
      limitations: ['MOCK / DEMO DATA'],
    },
  };
}

function processStub(t, behavior) {
  const calls = [];
  t.mock.method(childProcess, 'spawn', (executable, args, options) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = signal => { child.killedWith = signal; queueMicrotask(() => child.emit('close', null, signal)); return true; };
    calls.push({ executable, args, options, child });
    queueMicrotask(() => behavior(child, calls.at(-1)));
    return child;
  });
  return calls;
}

test('missing authorization is rejected before filesystem or optional-runtime inspection', async t => {
  environment(t, 'OPENHUNTER_REA_ROOT', 'https://SECRET@example.invalid');
  const result = await runReaCli(['analyze', 'https://SECRET@example.invalid']);
  assert.equal(result.exitCode, 2);
  assert.equal(result.output.error.code, 'AUTHORIZATION_REQUIRED');
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
});

test('doctor reports an unavailable optional runtime honestly', async t => {
  environment(t, 'OPENHUNTER_REA_ROOT', undefined);
  const calls = processStub(t, () => assert.fail('must not start a missing runtime'));
  const result = await runReaCli(['doctor']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.runtime.installed, false);
  assert.equal(result.output.executed, false);
  assert.deepEqual(result.output.gaps, [{ code: 'TOOL_UNAVAILABLE' }]);
  assert.equal(calls.length, 0);
});

test('doctor checks fixed runtime version and rejects version drift', async t => {
  const root = await runtime(t);
  const calls = processStub(t, child => { child.stdout.write('6.7.0\n'); child.emit('close', 0, null); });
  const result = await runReaCli(['doctor']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, 'available');
  assert.equal(result.output.runtime.integrityVerified, false);
  assert.deepEqual(calls[0].args, [join(root, 'scripts', 'rea.mjs'), '--version']);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'rea-agents', version: '6.7.1' }));
  const unsupported = await runReaCli(['doctor']);
  assert.equal(unsupported.exitCode, 1);
  assert.deepEqual(unsupported.output.gaps, [{ code: 'RUNTIME_VERSION_UNSUPPORTED' }]);
  assert.equal(calls.length, 1);
});

test('actual invocation uses fixed static argv, no shell, isolated temporary home and no inherited secrets', async t => {
  const root = await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '/* MOCK / DEMO DATA */ throw new Error("TARGET_MUST_NOT_EXECUTE");');
  await writeFile(join(target, 'image.png'), Buffer.from([137, 80, 78, 71, 0]));
  await writeFile(join(target, '_redirects'), '/* /index.html 200\n');
  await writeFile(join(target, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n');
  environment(t, 'OPENAI_API_KEY', 'DO_NOT_INHERIT');
  environment(t, 'NODE_OPTIONS', '--require=PRIVATE_AGENT_CONFIG');
  environment(t, 'REA_CONFIG', 'DO_NOT_INHERIT');
  const calls = processStub(t, child => { child.stdout.write(JSON.stringify(evidence())); child.stderr.write('SECRET/path/diagnostic'); child.emit('close', 0, null); });
  const result = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.executed, true);
  assert.equal(result.output.target.assetCount, 4);
  assert.equal(result.output.target.assets.filter(asset => asset.type === 'deployment_metadata').length, 2);
  assert.equal(result.output.analysis.statistics.staticObservationCount, 2);
  assert.equal(result.output.independentValidation, false);
  assert.equal(result.output.isFinding, false);
  const call = calls[0];
  assert.equal(call.executable, process.execPath);
  assert.deepEqual(call.args.slice(0, 4), [join(root, 'scripts', 'rea.mjs'), 'analyze-javascript-application', target, '--json']);
  assert.equal(call.args[call.args.indexOf('--analysis-timeout-ms') + 1], '20000');
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, true);
  assert.equal(call.options.env.OPENAI_API_KEY, undefined);
  assert.equal(call.options.env.NODE_OPTIONS, undefined);
  assert.equal(call.options.env.REA_CONFIG, undefined);
  assert.equal(call.options.env.HOME, call.options.env.USERPROFILE);
  assert.notEqual(call.options.cwd, target);
  await assert.rejects(access(call.options.cwd));
  const serialized = JSON.stringify(result);
  for (const secret of [target, root, 'TARGET_MUST_NOT_EXECUTE', 'SECRET/path/diagnostic', 'main.js', 'image.png', '_redirects', '_headers', 'DO_NOT_INHERIT']) assert.equal(serialized.includes(secret), false);
});

test('summary drops all free-text graph values, sources, credentials, paths, endpoints and diagnostics', () => {
  const input = evidence();
  const secret = 'SECRET_PRIVATE_PASSWORD';
  input.raw_result = secret;
  input.subject = { local_path: secret, name: secret };
  Object.assign(input.normalized_result, { input_path: secret, source_selection: { requested_paths: [secret] } });
  input.normalized_result.limitations = [secret];
  input.normalized_result.graph.nodes = [{ properties: { endpoint: `https://${secret}.invalid`, source: secret } }];
  input.normalized_result.graph.coverage.limits = [{ name: secret, value: 1, unit: secret }];
  input.normalized_result.statistics[secret] = secret;
  const output = summarizeReaEvidence(input);
  assert.equal(JSON.stringify(output).includes(secret), false);
  assert.equal(output.upstreamLimitationCount, 1);
  assert.equal(output.statistics.staticObservationCount, 2);
});

test('missing optional historic count remains unknown and malformed counts/coverage are rejected', () => {
  const input = evidence();
  delete input.normalized_result.statistics.skipped_javascript_files;
  assert.equal(summarizeReaEvidence(input).statistics.skipped_javascript_files, null);
  input.normalized_result.statistics.modules = -1;
  assert.throws(() => summarizeReaEvidence(input), { message: 'RUNTIME_OUTPUT_INVALID' });
  const invalid = evidence();
  invalid.normalized_result.graph.coverage.omitted_count = null;
  assert.throws(() => summarizeReaEvidence(invalid), { message: 'RUNTIME_OUTPUT_INVALID' });
  invalid.normalized_result.graph.coverage.status = 'SECRET';
  assert.throws(() => summarizeReaEvidence(invalid), { message: 'RUNTIME_OUTPUT_INVALID' });
});

test('partial or invalid runtime output cannot become successful analysis', async t => {
  await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  const input = evidence();
  input.normalized_result.semantic_graph.coverage = { status: 'partial', truncated: true, omitted_nodes: null, omitted_relations: null };
  let output = JSON.stringify(input);
  processStub(t, child => { child.stdout.write(output); child.emit('close', 0, null); });
  const partial = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(partial.exitCode, 1);
  assert.equal(partial.output.status, 'partial');
  assert.ok(partial.output.gaps.some(gap => gap.code === 'STATIC_ANALYSIS_PARTIAL'));
  output = 'SECRET INVALID JSON';
  const invalid = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.output.executed, false);
  assert.deepEqual(invalid.output.gaps, [{ code: 'RUNTIME_OUTPUT_INVALID' }]);
  assert.equal(JSON.stringify(invalid).includes('SECRET'), false);
});

test('the known upstream source timeout becomes an explicit budget gap without forwarding diagnostics', async t => {
  await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  processStub(t, child => { child.stdout.write(JSON.stringify({ code: 'provider_timeout', message: 'SECRET_SOURCE_PATH', details: { captured_output: 'SECRET_SOURCE' } })); child.emit('close', 1, null); });
  const result = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.status, 'blocked');
  assert.deepEqual(result.output.gaps, [{ code: 'STATIC_ANALYSIS_BUDGET_LIMIT' }]);
  assert.equal(result.output.independentValidation, false);
  assert.equal(JSON.stringify(result).includes('SECRET_SOURCE'), false);
});

test('private credentials and unsupported native/application files block the whole invocation', async t => {
  await runtime(t);
  const calls = processStub(t, () => assert.fail('must not invoke REA on blocked input'));
  for (const name of ['.env.production', 'credentials.json', 'native.node', 'app.apk', 'weights.onnx', '_anything_else']) {
    const target = await fixture(t);
    await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
    await writeFile(join(target, name), 'SECRET_DO_NOT_ECHO');
    const result = await runReaCli(['analyze', target, '--authorized']);
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.status, 'blocked');
    assert.equal(result.output.executed, false);
    assert.equal(JSON.stringify(result).includes(name), false);
    assert.equal(JSON.stringify(result).includes('SECRET_DO_NOT_ECHO'), false);
  }
  assert.equal(calls.length, 0);
});

test('symlink roots and nested linked directories are not followed', async t => {
  await runtime(t);
  const target = await fixture(t);
  const outside = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  try { await symlink(outside, join(target, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Symlink creation unavailable.'); return; } throw error; }
  const nested = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(nested.output.status, 'blocked');
  assert.ok(nested.output.gaps.some(gap => gap.code === 'SYMLINK_NOT_ALLOWED'));
  const root = await runReaCli(['analyze', join(target, 'linked'), '--authorized']);
  assert.equal(root.exitCode, 2);
});

test('hardlinks and oversized files block before subprocess execution', async t => {
  await runtime(t);
  const target = await fixture(t);
  const source = join(target, 'main.js');
  await writeFile(source, '// MOCK / DEMO DATA');
  await link(source, join(target, 'copy.js'));
  const hardlink = await runReaCli(['analyze', target, '--authorized']);
  assert.ok(hardlink.output.gaps.some(gap => gap.code === 'HARDLINK_NOT_ALLOWED'));
  const large = await fixture(t);
  await writeFile(join(large, 'large.js'), '// MOCK / DEMO DATA');
  await truncate(join(large, 'large.js'), 2 * 1024 * 1024 + 1);
  const oversized = await runReaCli(['analyze', large, '--authorized']);
  assert.ok(oversized.output.gaps.some(gap => gap.code === 'FILE_SIZE_LIMIT'));
  assert.equal(oversized.output.executed, false);
});

test('combined stdout/stderr output cap terminates the process and never forwards the payload', async t => {
  await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  const calls = processStub(t, child => child.stderr.write(Buffer.alloc(8 * 1024 * 1024 + 1, 65)));
  const result = await runReaCli(['analyze', target, '--authorized']);
  assert.equal(calls[0].child.killedWith, 'SIGKILL');
  assert.deepEqual(result.output.gaps, [{ code: 'RUNTIME_OUTPUT_LIMIT' }]);
  assert.equal(result.output.executed, false);
});

test('45-second deadline terminates the runtime and removes its isolated directory', async t => {
  await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  const calls = processStub(t, () => {});
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = runReaCli(['analyze', target, '--authorized']);
  while (!calls.length) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(45000);
  const result = await pending;
  assert.equal(calls[0].child.killedWith, 'SIGKILL');
  assert.deepEqual(result.output.gaps, [{ code: 'RUNTIME_TIMEOUT' }]);
  await assert.rejects(access(calls[0].options.cwd));
});

test('failed termination without a close event preserves the workspace instead of reporting unavailable', async t => {
  await runtime(t);
  const target = await fixture(t);
  await writeFile(join(target, 'main.js'), '// MOCK / DEMO DATA');
  const calls = processStub(t, child => {
    child.pid = 12345;
    child.kill = () => { queueMicrotask(() => child.emit('error', new Error('SECRET_KILL_DIAGNOSTIC'))); return false; };
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = runReaCli(['analyze', target, '--authorized']);
  while (!calls.length) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(45000);
  const result = await pending;
  const retained = resolve(calls[0].options.cwd, '..');
  t.after(async () => {
    assert.equal(resolve(retained, '..'), await realpath(tmpdir()));
    assert.match(basename(retained), /^openhunter-rea-[a-z\d]+$/i);
    assert.equal((await lstat(retained)).isSymbolicLink(), false);
    assert.equal(await realpath(retained), retained);
    await rm(retained, { recursive: true, force: true });
  });
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.output.gaps, [{ code: 'RUNTIME_TERMINATION_UNVERIFIED' }]);
  await access(calls[0].options.cwd);
  assert.equal(JSON.stringify(result).includes('SECRET_KILL_DIAGNOSTIC'), false);
});

test('a failure before process creation is unavailable and safely cleans the unused workspace', async t => {
  await runtime(t);
  const calls = processStub(t, child => child.emit('error', new Error('SECRET_SPAWN_DIAGNOSTIC')));
  const result = await runReaCli(['doctor']);
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.output.gaps, [{ code: 'TOOL_UNAVAILABLE' }]);
  await assert.rejects(access(calls[0].options.cwd));
  assert.equal(JSON.stringify(result).includes('SECRET_SPAWN_DIAGNOSTIC'), false);
});

test('URLs, nonexistent paths, extra flags and command injection remain generic input errors', async t => {
  environment(t, 'OPENHUNTER_REA_ROOT', undefined);
  for (const args of [[], ['setup'], ['analyze', 'https://SECRET.invalid/private', '--authorized'], ['analyze', '\\\\SECRET-host\\share', '--authorized'], ['analyze', join(tmpdir(), 'DOES_NOT_EXIST_SECRET'), '--authorized'], ['doctor', '--run'], ['analyze', 'target; DO_NOT_EXECUTE', '--authorized', '--extra']]) {
    const result = await runReaCli(args);
    assert.equal(result.exitCode, 2);
    assert.equal(JSON.stringify(result).includes('SECRET'), false);
    assert.equal(JSON.stringify(result).includes('DO_NOT_EXECUTE'), false);
  }
});
