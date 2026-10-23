import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { CERTIFIED_CODEX_VERSION, claudeArgs, classifyCliFailure, codexArgs, codexRuntime, completionCapabilities, completionSpec, extractCodexCompletion, extractCompletion, promptHasSecret } from './adapters.mjs';
import { handleBridge, runCompletion, tokenMatches } from './server.mjs';

const token = 'local-e2e-llm-bridge-only';

function request(partial) {
  return {
    method: 'POST',
    url: '/complete',
    headers: { authorization: `Bearer ${token}`, host: '127.0.0.1:4733' },
    rawBody: '{}',
    ...partial,
  };
}

describe('llm bridge', () => {
  it('builds a no-tool Claude command and keeps the prompt out of argv', () => {
    const args = claudeArgs({ model: 'cli-default', reasoningLevel: 'low' });
    deepStrictEqual(args.slice(0, 4), ['-p', '--tools', '', '--strict-mcp-config']);
    ok(!args.some((arg) => arg.includes('candidateCount')));
    const codex = codexArgs({ model: 'cli-default', reasoningLevel: 'low' });
    ok(codex.includes('--ignore-user-config'));
    ok(codex.includes('read-only'));
    ok(codex.includes('shell_tool'));
    ok(codex.includes('code_mode_host'));
    ok(codex.includes('web_search="disabled"'));
    ok(!codex.some((arg) => arg.includes('candidateCount')));
    equal(completionSpec({ cli: 'grok' }).errorCode, 'CLI_TOOLS_NOT_LOCKABLE');
    equal(completionSpec({ cli: 'gemini' }).errorCode, 'CLI_TOOLS_NOT_LOCKABLE');
  });

  it('rejects a missing token, a non-local host, and a secret before spawn', async () => {
    equal(tokenMatches(token, 'Bearer other'), false);
    const denied = await handleBridge(request({ headers: { host: '127.0.0.1:4733' } }), token);
    equal(denied.status, 401);
    const remote = await handleBridge(request({ headers: { authorization: `Bearer ${token}`, host: 'example.com' } }), token);
    equal(remote.status, 403);
    let spawned = false;
    const secret = await handleBridge(request({
      rawBody: JSON.stringify({ cli: 'claude', model: 'cli-default', reasoningLevel: 'low', userPrompt: 'sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
    }), token, { spawnImpl: () => { spawned = true; throw new Error('spawned'); } });
    equal(secret.status, 400);
    equal(secret.body.errorCode, 'EVIDENCE_NOT_SANITIZED');
    equal(spawned, false);
    ok(promptHasSecret('sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
  });

  it('times out, limits output, and reports a tool demand', async () => {
    const timeout = await runCompletion({ cli: 'claude', model: 'cli-default', reasoningLevel: 'low' }, 'ping', {
      timeoutMs: 20,
      spawnImpl: () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stdin = { end() {} };
        child.kill = () => child.emit('close', null);
        return child;
      },
    });
    equal(timeout.errorCode, 'BRIDGE_TIMEOUT');

    const limited = await runCompletion({ cli: 'claude', model: 'cli-default', reasoningLevel: 'low' }, 'ping', {
      timeoutMs: 1000,
      maxOutputChars: 4,
      spawnImpl: () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stdin = { end() { child.stdout.emit('data', '123456789'); } };
        child.kill = () => {};
        return child;
      },
    });
    equal(limited.errorCode, 'OUTPUT_LIMIT');
    equal(limited.outputText, '');

    equal(extractCompletion('{"type":"tool_use","name":"bash"}').errorCode, 'CLI_TOOL_DEMAND');
    deepStrictEqual(extractCompletion('{"result":"pong","total_cost_usd":0.01}'), { outputText: 'pong', cost: 0.01 });
    equal(classifyCliFailure('API Error: 403 No active free usage is available on this account.'), 'CLI_QUOTA_EXHAUSTED');
    const completed = '{"type":"item.completed","item":{"type":"agent_message","text":"READY"}}\n{"type":"turn.completed"}';
    deepStrictEqual(extractCodexCompletion(completed), { outputText: 'READY' });
    equal(extractCodexCompletion(completed, 'ERROR codex_core::tools::router: error=patch rejected').errorCode, 'CLI_TOOL_DEMAND');
    equal(extractCodexCompletion('{"type":"item.completed","item":{"type":"command_execution"}}\n{"type":"turn.completed"}').errorCode, 'CLI_TOOL_DEMAND');
  });

  it('requires the certified Codex version before enabling completion', () => {
    const entry = fileURLToPath(new URL('./adapters.mjs', import.meta.url));
    const env = { OPENHUNTER_CODEX_CLI_ENTRY: entry };
    equal(codexRuntime(env, () => ({ status: 0, stdout: CERTIFIED_CODEX_VERSION })).state, 'locked');
    equal(codexRuntime(env, () => ({ status: 0, stdout: 'codex-cli 9.0.0' })).reason, 'CODEX_VERSION_UNVERIFIED');
  });

  it('returns lock state from capabilities without treating login as completion', async () => {
    const response = await handleBridge({
      method: 'GET',
      url: '/capabilities',
      headers: { authorization: `Bearer ${token}`, host: '127.0.0.1:4733' },
      rawBody: '',
    }, token);
    equal(response.body.completion.claude.state, 'locked');
    equal(response.body.completion.codex.state, completionCapabilities().codex.state);
    const probed = await handleBridge({
      method: 'POST',
      url: '/probe',
      headers: { authorization: `Bearer ${token}`, host: 'host.docker.internal:4733' },
      rawBody: '',
    }, token, {
      runner: {
        async run(argv) {
          const key = argv.join(' ');
          if (key === 'claude --version') return { exitCode: 0, stdout: '2.1.179', stderr: '' };
          if (key === 'claude auth status') return { exitCode: 0, stdout: 'logged in', stderr: '' };
          return { exitCode: 127, stdout: '', stderr: 'ENOENT' };
        },
      },
    });
    equal(probed.body.probes.claude.authenticated, true);
    equal(probed.body.probes.claude.completion, 'locked');
    equal(probed.body.probes.codex.installed, false);
    ok(!JSON.stringify(probed.body).includes('sk-'));
  });
});
