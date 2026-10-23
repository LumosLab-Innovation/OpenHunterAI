import { describe, expect, it } from 'vitest';
import { codingCliRoute, defaultModuleRouteConfig, evaluateModuleRoutePreflight, type CliProbeResult } from '@x-hunter/shared';
import { createBridgeClient, outputDemandsTools, runModuleReasoning, type CodingCliBridge } from './coding-cli.js';

const capturedAt = '2026-09-27T00:00:00.000Z';

function ready(cli: CliProbeResult['cli']): CliProbeResult {
  return { cli, installed: true, authenticated: true, supportedModels: ['cli-default'], completion: 'locked' };
}

function snapshotFor(clis: CliProbeResult[]) {
  const probes = Object.fromEntries(clis.map((probe) => [probe.cli, probe]));
  const config = defaultModuleRouteConfig();
  config.signal_summary.fallback = codingCliRoute('grok', 'low');
  config.attacker_hypothesis.fallback = codingCliRoute('claude', 'high');
  return evaluateModuleRoutePreflight({
    config,
    probes,
    bridgeReady: true,
    profile: 'standard',
    targetType: 'static_content_website',
    authScope: 'none',
    capturedAt,
  }).snapshot;
}

describe('coding CLI bridge', () => {
  it('sends the sanitized prompt to the bridge and keeps it out of the audit', async () => {
    const calls: Array<{ userPrompt: string }> = [];
    const bridge: CodingCliBridge = {
      async complete(request) {
        calls.push({ userPrompt: request.userPrompt });
        return { outputText: 'pong', latencyMs: 4 };
      },
    };
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('grok')]),
      useCase: 'signal_summary',
      bridge,
      systemPrompt: 'Summarize metadata only.',
      userPrompt: 'candidateCount=0',
    });
    expect(result.outputText).toBe('pong');
    expect(calls[0]?.userPrompt).toContain('candidateCount=0');
    expect(JSON.stringify(result.audits)).not.toContain('candidateCount');
    expect(JSON.stringify(result.audits)).not.toContain('Summarize');
  });

  it('does not send a raw token to the bridge', async () => {
    let seen = '';
    const bridge: CodingCliBridge = {
      async complete(request) {
        seen = request.userPrompt;
        return { outputText: 'redacted', latencyMs: 1 };
      },
    };
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('grok')]),
      useCase: 'signal_summary',
      bridge,
      systemPrompt: 'sys',
      userPrompt: 'token sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(seen).not.toContain('sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(JSON.stringify(result)).not.toContain('sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('uses the accepted fallback when the primary bridge call fails', async () => {
    const bridge: CodingCliBridge = {
      async complete(request) {
        if (request.route.cli === 'codex') return { outputText: '', errorCode: 'BRIDGE_UNAVAILABLE', latencyMs: 2 };
        return { outputText: 'fallback-ok', latencyMs: 3 };
      },
    };
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('claude')]),
      useCase: 'attacker_hypothesis',
      bridge,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(result.outputText).toBe('fallback-ok');
    expect(result.audits.map((audit) => [audit.cli, audit.fallbackUsed, audit.errorCode])).toEqual([
      ['codex', false, 'BRIDGE_UNAVAILABLE'],
      ['claude', true, undefined],
    ]);
  });

  it('reports the actual CLI failure when no accepted fallback remains', async () => {
    const config = defaultModuleRouteConfig();
    config.signal_summary.primary = codingCliRoute('claude', 'low');
    const snapshot = evaluateModuleRoutePreflight({
      config,
      probes: { claude: ready('claude') },
      bridgeReady: true,
      profile: 'standard',
      targetType: 'static_content_website',
      authScope: 'none',
      capturedAt,
    }).snapshot;
    const result = await runModuleReasoning({
      snapshot,
      useCase: 'signal_summary',
      bridge: { async complete() { return { outputText: '', errorCode: 'CLI_FAILED', latencyMs: 4 }; } },
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(result.audits.map((audit) => audit.errorCode)).toEqual(['CLI_FAILED']);
    expect(result.coverageGap).toBe('llm:signal_summary:CLI_FAILED');
  });

  it('does not switch to an API provider when the bridge is missing', async () => {
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('grok')]),
      useCase: 'signal_summary',
      bridge: null,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(result.audits.map((audit) => audit.errorCode)).toEqual(['BRIDGE_UNAVAILABLE', 'BRIDGE_UNAVAILABLE']);
    expect(result.audits.every((audit) => audit.transport === 'coding_cli')).toBe(true);
    expect(result.coverageGap).toBe('llm:signal_summary:unavailable');
  });

  it('fails closed for an API route in a legacy accepted snapshot', async () => {
    const snapshot = snapshotFor([]);
    snapshot.routes.signal_summary.primary = { transport: 'api_key', provider: 'openai', model: 'gpt-4o' };
    snapshot.accepted.signal_summary = { primary: true, fallback: false };
    const result = await runModuleReasoning({
      snapshot,
      useCase: 'signal_summary',
      bridge: null,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(result.audits[0]?.errorCode).toBe('API_ROUTE_NOT_IMPLEMENTED');
    expect(result.coverageGap).toBe('llm:signal_summary:API_ROUTE_NOT_IMPLEMENTED');
  });

  it('treats a tool demand as a failure and tries the accepted fallback', async () => {
    const bridge: CodingCliBridge = {
      async complete(request) {
        if (request.route.cli === 'codex') return { outputText: '{"type":"tool_use","name":"bash"}', latencyMs: 2 };
        return { outputText: 'no tools', latencyMs: 2 };
      },
    };
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('grok')]),
      useCase: 'signal_summary',
      bridge,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(result.outputText).toBe('no tools');
    expect(result.audits[0]?.errorCode).toBe('CLI_TOOL_DEMAND');
    expect(outputDemandsTools('{"type":"tool_use"}')).toBe(true);
  });

  it('rejects output over the configured limit', async () => {
    const bridge: CodingCliBridge = {
      async complete() {
        return { outputText: 'x'.repeat(50), latencyMs: 1 };
      },
    };
    const result = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex'), ready('grok')]),
      useCase: 'signal_summary',
      bridge,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
      maxOutputChars: 8,
    });
    expect(result.outputText).toBe('');
    expect(result.audits[0]?.errorCode).toBe('OUTPUT_LIMIT');
    expect(result.coverageGap).toContain('unavailable');
  });

  it('maps an aborted bridge request to timeout and a connection error to unavailable', async () => {
    const timeoutClient = createBridgeClient({
      baseUrl: 'http://127.0.0.1:9',
      token: 'local-token',
      fetchImpl: () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    });
    const downClient = createBridgeClient({
      baseUrl: 'http://127.0.0.1:9',
      token: 'local-token',
      fetchImpl: () => Promise.reject(new Error('connect ECONNREFUSED')),
    });
    const timeout = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex')]),
      useCase: 'attacker_hypothesis',
      bridge: timeoutClient,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    const down = await runModuleReasoning({
      snapshot: snapshotFor([ready('codex')]),
      useCase: 'attacker_hypothesis',
      bridge: downClient,
      systemPrompt: 'sys',
      userPrompt: 'metadata only',
    });
    expect(timeout.audits[0]?.errorCode).toBe('BRIDGE_TIMEOUT');
    expect(down.audits[0]?.errorCode).toBe('BRIDGE_UNAVAILABLE');
    expect(JSON.stringify(timeout.audits)).not.toContain('local-token');
  });
});
