import { describe, expect, it } from 'vitest';
import {
  CLI_DEFAULT_MODEL,
  codingCliRoute,
  defaultModuleRouteConfig,
  evaluateModuleRoutePreflight,
  llmCallAudit,
  selectHop,
  validateModuleRouteConfig,
  type CliProbeResult,
  type ModuleRouteConfig,
} from './llm-module-routes.js';

const capturedAt = '2026-09-27T00:00:00.000Z';

function ready(cli: CliProbeResult['cli']): CliProbeResult {
  return { cli, installed: true, authenticated: true, supportedModels: [CLI_DEFAULT_MODEL, 'known-model'], completion: 'locked' };
}

describe('module route config', () => {
  it('defaults all local modules to Codex with optional future fallbacks', () => {
    const config = defaultModuleRouteConfig();
    expect(config.signal_summary).toEqual({
      primary: { transport: 'coding_cli', cli: 'codex', model: CLI_DEFAULT_MODEL, reasoningLevel: 'low' },
      fallback: { transport: 'coding_cli', cli: 'codex', model: CLI_DEFAULT_MODEL, reasoningLevel: 'medium' },
    });
    expect(config.attacker_hypothesis.primary).toMatchObject({ cli: 'codex', reasoningLevel: 'high' });
    expect(config.attacker_hypothesis.fallback).toMatchObject({ cli: 'codex', reasoningLevel: 'medium' });
    expect(Object.values(config).every((pair) => pair.primary.transport === 'coding_cli' && pair.primary.cli === 'codex')).toBe(true);
    expect(Object.values(config).every((pair) => pair.fallback.transport === 'coding_cli' && pair.fallback.cli === 'codex')).toBe(true);
    expect(validateModuleRouteConfig(config)).toEqual([]);
  });

  it('rejects an unsupported reasoning level before a scan starts', () => {
    const config = defaultModuleRouteConfig();
    config.report_generation = {
      ...config.report_generation,
      primary: { transport: 'coding_cli', cli: 'grok', model: CLI_DEFAULT_MODEL, reasoningLevel: 'xhigh' },
    };
    expect(validateModuleRouteConfig(config).join(' ')).toContain('reasoning level is not supported');
  });

  it('keeps the Codex fallback when API keys are configured', () => {
    const evaluation = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: { codex: ready('codex') },
      apiReady: { openai: true, claude: true, deepseek: true },
      profile: 'deep',
      targetType: 'interactive_web_app',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    const hypothesis = evaluation.rows.find((row) => row.useCase === 'attacker_hypothesis');
    expect(hypothesis?.primary.accepted).toBe(true);
    expect(hypothesis?.fallback.accepted).toBe(true);
    expect(hypothesis?.fallback).toMatchObject({ cli: 'codex', reasoningLevel: 'medium' });
  });

  it('does not accept a configured API route until module execution supports it', () => {
    const config = defaultModuleRouteConfig();
    config.signal_summary.primary = { transport: 'api_key', provider: 'openai', model: 'gpt-4o' };
    const evaluation = evaluateModuleRoutePreflight({
      config,
      probes: {},
      apiReady: { openai: true },
      profile: 'standard',
      targetType: 'static_content_website',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    const route = evaluation.rows.find((row) => row.useCase === 'signal_summary')?.primary;
    expect(route).toMatchObject({ accepted: false, reason: 'API_ROUTE_NOT_IMPLEMENTED' });
    expect(evaluation.snapshot.accepted.signal_summary.primary).toBe(false);
  });

  it('blocks Deep when a required module has no accepted route and records a gap otherwise', () => {
    const deep = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: {},
      profile: 'deep',
      targetType: 'static_content_website',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    expect(deep.checks).toEqual([
      expect.objectContaining({ code: 'LLM_MODULE_UNAVAILABLE', ok: false }),
    ]);
    expect(deep.coverageGaps).toContain('llm:attacker_hypothesis:unavailable');
    expect(deep.coverageGaps).not.toContain('llm:retest_reasoning:unavailable');

    const standard = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: {},
      profile: 'standard',
      targetType: 'static_content_website',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    expect(standard.checks.every((check) => check.ok)).toBe(true);
    expect(standard.coverageGaps).toContain('llm:signal_summary:unavailable');
  });

  it('uses only the preflight-accepted fallback after the primary fails', () => {
    const evaluation = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: { codex: ready('codex'), claude: ready('claude'), gemini: ready('gemini'), grok: ready('grok') },
      profile: 'standard',
      targetType: 'interactive_web_app',
      authScope: 'two_accounts',
      bridgeReady: true,
      capturedAt,
    });
    const selected = selectHop(evaluation.snapshot, 'attacker_hypothesis', { primaryFailed: true });
    expect(selected).toMatchObject({ kind: 'route', hop: 'fallback', fallbackUsed: true, route: { cli: 'codex', reasoningLevel: 'medium' } });
  });

  it('keeps the scan snapshot after Settings change and gaps when both hops are down', () => {
    const live = defaultModuleRouteConfig();
    live.attacker_hypothesis.fallback = codingCliRoute('claude', 'high');
    const evaluation = evaluateModuleRoutePreflight({
      config: live,
      probes: { codex: ready('codex'), claude: { cli: 'claude', installed: true, authenticated: false, supportedModels: [], errorCode: 'CLI_NOT_AUTHENTICATED' } },
      profile: 'deep',
      targetType: 'interactive_web_app',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    const edited = defaultModuleRouteConfig();
    edited.attacker_hypothesis = {
      primary: { transport: 'coding_cli', cli: 'grok', model: 'known-model', reasoningLevel: 'high' },
      fallback: { transport: 'api_key', provider: 'openai', model: 'gpt-4o' },
    };
    expect(evaluation.snapshot.routes.attacker_hypothesis.primary).toMatchObject({ cli: 'codex' });
    expect(edited.attacker_hypothesis.primary).toMatchObject({ cli: 'grok' });

    const afterFailure = selectHop(evaluation.snapshot, 'attacker_hypothesis', { primaryFailed: true });
    expect(afterFailure).toEqual({ kind: 'coverage_gap', useCase: 'attacker_hypothesis', reason: 'NO_ACCEPTED_ROUTE' });
  });

  it('rejects a model the probe did not list', () => {
    const config: ModuleRouteConfig = defaultModuleRouteConfig();
    config.signal_summary = {
      primary: { transport: 'coding_cli', cli: 'grok', model: 'not-listed', reasoningLevel: 'low' },
      fallback: { transport: 'coding_cli', cli: 'gemini', model: CLI_DEFAULT_MODEL, reasoningLevel: 'low' },
    };
    const evaluation = evaluateModuleRoutePreflight({
      config,
      probes: { grok: ready('grok'), gemini: ready('gemini') },
      profile: 'quick',
      targetType: 'static_content_website',
      authScope: 'none',
      bridgeReady: true,
      capturedAt,
    });
    const row = evaluation.rows.find((item) => item.useCase === 'signal_summary');
    expect(row?.primary).toMatchObject({ accepted: false, reason: 'MODEL_UNSUPPORTED' });
    expect(row?.fallback.accepted).toBe(true);
  });

  it('does not treat a login probe as completion when the bridge or tool lock is missing', () => {
    const loggedIn = { cli: 'codex' as const, installed: true, authenticated: true, supportedModels: [CLI_DEFAULT_MODEL] };
    const unlocked = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: { codex: loggedIn, claude: { ...loggedIn, cli: 'claude' } },
      bridgeReady: true,
      profile: 'deep',
      targetType: 'interactive_web_app',
      authScope: 'none',
      capturedAt,
    });
    expect(unlocked.rows.find((row) => row.useCase === 'attacker_hypothesis')?.primary.reason).toBe('CLI_COMPLETION_UNAVAILABLE');
    const offline = evaluateModuleRoutePreflight({
      config: defaultModuleRouteConfig(),
      probes: { codex: ready('codex'), claude: ready('claude') },
      bridgeReady: false,
      profile: 'deep',
      targetType: 'interactive_web_app',
      authScope: 'none',
      capturedAt,
    });
    expect(offline.checks[0]?.code).toBe('LLM_MODULE_UNAVAILABLE');
    expect(offline.rows.find((row) => row.useCase === 'attacker_hypothesis')?.primary.reason).toBe('BRIDGE_UNAVAILABLE');
  });

  it('records the hop that ran without the prompt', () => {
    const audit = llmCallAudit({
      useCase: 'report_generation',
      hop: 'fallback',
      route: { transport: 'coding_cli', cli: 'claude', model: CLI_DEFAULT_MODEL, reasoningLevel: 'high' },
      fallbackUsed: true,
      latencyMs: 12,
      errorCode: 'CLI_COMPLETION_NOT_ENABLED',
    });
    expect(audit).toEqual({
      useCase: 'report_generation',
      transport: 'coding_cli',
      cli: 'claude',
      model: CLI_DEFAULT_MODEL,
      reasoningLevel: 'high',
      hop: 'fallback',
      fallbackUsed: true,
      latencyMs: 12,
      errorCode: 'CLI_COMPLETION_NOT_ENABLED',
    });
    expect(JSON.stringify(audit)).not.toContain('prompt');
  });
});
