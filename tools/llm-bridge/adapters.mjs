/**
 * Coding CLI completion adapters.
 *
 * Codex is certified here only for the pinned CLI version and a read-only,
 * no-shell/no-code-mode invocation. Recheck the boundary before upgrading it.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const CLI_NAMES = ['codex', 'claude', 'gemini', 'grok'];

export const COMPLETION = {
  claude: { state: 'locked' },
  codex: { state: 'locked' },
  gemini: { state: 'unavailable', reason: 'CLI_TOOLS_NOT_LOCKABLE' },
  grok: { state: 'unavailable', reason: 'CLI_TOOLS_NOT_LOCKABLE' },
};

export const CERTIFIED_CODEX_VERSION = 'codex-cli 0.154.0';

export function codexEntry(env = process.env) {
  if (env.OPENHUNTER_CODEX_CLI_ENTRY) return env.OPENHUNTER_CODEX_CLI_ENTRY;
  if (process.platform === 'win32' && env.APPDATA) {
    return join(env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  }
  return null;
}

export function codexRuntime(env = process.env, runVersion = spawnSync) {
  const entry = codexEntry(env);
  if (!entry || !existsSync(entry)) return { state: 'unavailable', reason: 'CODEX_ENTRY_NOT_FOUND' };
  const result = runVersion(process.execPath, [entry, '--version'], {
    encoding: 'utf8', timeout: 5_000, windowsHide: true,
  });
  return result.status === 0 && result.stdout?.trim() === CERTIFIED_CODEX_VERSION
    ? { state: 'locked', entry }
    : { state: 'unavailable', reason: 'CODEX_VERSION_UNVERIFIED' };
}

export function completionCapabilities() {
  const { entry: _entry, ...codex } = codexRuntime();
  return { ...COMPLETION, codex };
}

const ARG_PATTERN = /^[A-Za-z0-9_./:-]+$/;

export function assertSafeArgs(args) {
  for (const arg of args) {
    if (arg !== '' && !ARG_PATTERN.test(arg)) throw new Error('CLI argument contains unsupported characters');
  }
  return args;
}

/** Prompt is never placed in argv. Empty --tools is Claude's documented no-tool mode. */
export function claudeArgs(route) {
  const args = [
    '-p',
    '--tools',
    '',
    '--strict-mcp-config',
    '--no-chrome',
    '--no-session-persistence',
    '--output-format',
    'json',
  ];
  if (route.model && route.model !== 'cli-default') args.push('--model', route.model);
  if (route.reasoningLevel) args.push('--effort', route.reasoningLevel);
  return assertSafeArgs(args);
}

const CODEX_DISABLED_FEATURES = [
  'shell_tool', 'unified_exec', 'apps', 'remote_plugin', 'multi_agent',
  'hooks', 'plugins', 'browser_use', 'computer_use', 'image_generation',
  'view_image', 'code_mode_host', 'skill_search', 'shell_snapshot',
];

export function codexArgs(route) {
  const args = [
    'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules',
    '--sandbox', 'read-only', '--skip-git-repo-check',
    ...CODEX_DISABLED_FEATURES.flatMap((feature) => ['--disable', feature]),
    '-c', 'web_search="disabled"',
    '-c', `model_reasoning_effort="${route.reasoningLevel}"`,
  ];
  if (route.model && route.model !== 'cli-default') {
    assertSafeArgs([route.model]);
    args.push('--model', route.model);
  }
  args.push('--json', '-');
  return args;
}

export function completionSpec(route) {
  if (route.cli === 'codex' && !['low', 'medium', 'high', 'xhigh'].includes(route.reasoningLevel)) {
    return { errorCode: 'REASONING_LEVEL_UNSUPPORTED' };
  }
  const capability = route.cli === 'codex' ? codexRuntime() : COMPLETION[route.cli];
  if (!capability || capability.state !== 'locked') {
    return { errorCode: capability?.reason ?? 'CLI_COMPLETION_UNAVAILABLE' };
  }
  if (route.cli === 'claude') return { command: 'claude', args: claudeArgs(route) };
  if (route.cli === 'codex') {
    return { command: process.execPath, args: [capability.entry, ...codexArgs(route)], format: 'codex_json' };
  }
  return { errorCode: 'CLI_COMPLETION_UNAVAILABLE' };
}

export function extractCodexCompletion(stdout, stderr = '') {
  if (/tools::router: error|patch rejected|code-mode host is disabled/i.test(stderr)) {
    return { outputText: '', errorCode: 'CLI_TOOL_DEMAND' };
  }
  let finalText = '';
  let completed = false;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { return { outputText: '', errorCode: 'CLI_OUTPUT_INVALID' }; }
    const item = event.item;
    if (item && !['agent_message', 'reasoning', 'error'].includes(item.type)) {
      return { outputText: '', errorCode: 'CLI_TOOL_DEMAND' };
    }
    if (event.type === 'item.completed' && item?.type === 'agent_message') finalText = item.text ?? '';
    if (event.type === 'turn.completed') completed = true;
    if (event.type === 'turn.failed') return { outputText: '', errorCode: 'CLI_FAILED' };
  }
  if (!completed || !finalText.trim()) return { outputText: '', errorCode: 'CLI_OUTPUT_INVALID' };
  return { outputText: finalText.trim() };
}

export function promptHasSecret(text) {
  return /\bsk-[A-Za-z0-9_-]{16,}\b/i.test(text)
    || /\bBearer\s+[A-Za-z0-9._\-+/]+=*/.test(text)
    || /\beyJ[A-Za-z0-9._-]{20,}\b/.test(text);
}

export function extractCompletion(stdout) {
  const trimmed = stdout.trim();
  if (/"type"\s*:\s*"tool_use"|\btool_use\b/i.test(trimmed)) {
    return { outputText: '', errorCode: 'CLI_TOOL_DEMAND' };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const text = typeof parsed.result === 'string' ? parsed.result : '';
    const cost = typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : undefined;
    return { outputText: text, ...(cost === undefined ? {} : { cost }) };
  } catch {
    return { outputText: trimmed };
  }
}

export function classifyCliFailure(text) {
  if (/no active free usage|add balance|buy a plan|quota (?:exhausted|exceeded)|usage limit/i.test(text)) {
    return 'CLI_QUOTA_EXHAUSTED';
  }
  if (/failed to authenticate|not logged in|not authenticated/i.test(text)) {
    return 'CLI_NOT_AUTHENTICATED';
  }
  return 'CLI_FAILED';
}

export const PROBE_ARGV = {
  codex: { version: ['codex', '--version'], auth: ['codex', 'login', 'status'] },
  claude: { version: ['claude', '--version'], auth: ['claude', 'auth', 'status'] },
  gemini: { version: ['gemini', '--version'] },
  grok: { version: ['grok', '--version'], auth: ['grok', 'models'] },
};
