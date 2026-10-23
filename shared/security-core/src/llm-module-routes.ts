/**
 * System-wide reasoning-module routes.
 *
 * One config is shared by every project and scan. A scan copies it at creation
 * time; later Settings edits do not change that copy. Coding-CLI routes never
 * fall through to an API-key provider unless that API route was saved explicitly.
 */

import type { AuthScope, ScanProfile, SurfaceFlags, TargetType } from './packages.js';

export const LLM_USE_CASES = [
  'signal_summary',
  'candidate_dedupe',
  'suspicious_surface_ranking',
  'first_valuable_finding',
  'attacker_hypothesis',
  'validation_plan',
  'access_control_reasoning',
  'api_reasoning',
  'llm_app_reasoning',
  'report_generation',
  'fix_prompt',
  'retest_reasoning',
] as const;

export type LlmUseCase = (typeof LLM_USE_CASES)[number];

export const CODING_CLIS = ['codex', 'claude', 'gemini', 'grok'] as const;
export type CodingCliName = (typeof CODING_CLIS)[number];

export const REASONING_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export const API_KEY_PROVIDERS = ['openai', 'claude', 'deepseek'] as const;
export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

/** Levels this product knows how to record. A CLI probe cannot widen the set. */
export const CLI_REASONING_LEVELS: Record<CodingCliName, readonly ReasoningLevel[]> = {
  codex: ['low', 'medium', 'high', 'xhigh'],
  claude: ['low', 'medium', 'high'],
  gemini: ['low', 'medium', 'high'],
  grok: ['low', 'medium', 'high'],
};

/** Sentinel: do not pass a model flag; use the CLI's own default. */
export const CLI_DEFAULT_MODEL = 'cli-default';

export const SUMMARY_USE_CASES = [
  'signal_summary',
  'candidate_dedupe',
  'suspicious_surface_ranking',
] as const satisfies readonly LlmUseCase[];

/** Deep preflight blocks when these invoked modules have no accepted hop. */
export const DEEP_REQUIRED_USE_CASES = [
  'attacker_hypothesis',
  'validation_plan',
  'report_generation',
] as const satisfies readonly LlmUseCase[];

const SCAN_START_USE_CASES = [
  'signal_summary',
  'candidate_dedupe',
  'suspicious_surface_ranking',
  'first_valuable_finding',
  'attacker_hypothesis',
  'validation_plan',
  'report_generation',
  'fix_prompt',
] as const satisfies readonly LlmUseCase[];

export interface CodingCliRoute {
  transport: 'coding_cli';
  cli: CodingCliName;
  model: string;
  reasoningLevel: ReasoningLevel;
}

export interface ApiKeyRoute {
  transport: 'api_key';
  provider: ApiKeyProvider;
  model: string;
}

export type ModuleRoute = CodingCliRoute | ApiKeyRoute;

export interface ModuleRoutePair {
  primary: ModuleRoute;
  fallback: ModuleRoute;
}

export type ModuleRouteConfig = Record<LlmUseCase, ModuleRoutePair>;

export type CliCompletionCapability = 'not_probed' | 'locked' | 'unavailable';

export interface CliProbeResult {
  cli: CodingCliName;
  installed: boolean;
  authenticated: boolean;
  /** Models the probe actually observed. `cli-default` is always allowed once auth passes. */
  supportedModels: string[];
  /** Login is not completion. Only `locked` may be selected for a call. */
  completion?: CliCompletionCapability;
  completionReason?: string;
  version?: string;
  errorCode?: string;
}

export interface RouteAcceptance {
  primary: boolean;
  fallback: boolean;
}

export interface LlmRouteSnapshot {
  capturedAt: string;
  routes: ModuleRouteConfig;
  accepted: Record<LlmUseCase, RouteAcceptance>;
}

export interface ModuleRouteRow {
  useCase: LlmUseCase;
  primary: ModuleRoute & { accepted: boolean; reason?: string };
  fallback: ModuleRoute & { accepted: boolean; reason?: string };
  invoked: boolean;
  blocking: boolean;
  coverageGap?: string;
}

export interface ModuleRoutePreflight {
  rows: ModuleRouteRow[];
  checks: Array<{ code: string; ok: boolean; message: string }>;
  coverageGaps: string[];
  snapshot: LlmRouteSnapshot;
}

export interface LlmCallAudit {
  useCase: LlmUseCase;
  transport: ModuleRoute['transport'];
  cli?: CodingCliName;
  provider?: ApiKeyProvider;
  model: string;
  reasoningLevel?: ReasoningLevel;
  hop: 'primary' | 'fallback';
  fallbackUsed: boolean;
  latencyMs: number;
  cost?: number;
  errorCode?: string;
}

const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,80}$/;

export function isLlmUseCase(value: string): value is LlmUseCase {
  return (LLM_USE_CASES as readonly string[]).includes(value);
}

export function codingCliRoute(cli: CodingCliName, reasoningLevel: ReasoningLevel, model = CLI_DEFAULT_MODEL): CodingCliRoute {
  return { transport: 'coding_cli', cli, model, reasoningLevel };
}

export function defaultModuleRouteConfig(): ModuleRouteConfig {
  const summary: ModuleRoutePair = {
    primary: codingCliRoute('codex', 'low'),
    fallback: codingCliRoute('codex', 'medium'),
  };
  const deep: ModuleRoutePair = {
    primary: codingCliRoute('codex', 'high'),
    fallback: codingCliRoute('codex', 'medium'),
  };
  return {
    signal_summary: summary,
    candidate_dedupe: summary,
    suspicious_surface_ranking: summary,
    first_valuable_finding: deep,
    attacker_hypothesis: deep,
    validation_plan: deep,
    access_control_reasoning: deep,
    api_reasoning: deep,
    llm_app_reasoning: deep,
    report_generation: deep,
    fix_prompt: deep,
    retest_reasoning: deep,
  };
}

export function invokedUseCases(input: {
  targetType: TargetType;
  authScope: AuthScope;
  surfaceFlags?: Partial<SurfaceFlags>;
}): LlmUseCase[] {
  const flags = input.surfaceFlags ?? {};
  const invoked = new Set<LlmUseCase>(SCAN_START_USE_CASES);
  if (input.authScope !== 'none' || flags.has_login || flags.has_admin_dashboard) {
    invoked.add('access_control_reasoning');
  }
  if (input.targetType === 'api_service' || flags.has_api_docs) invoked.add('api_reasoning');
  if (input.targetType === 'ai_llm_application' || flags.has_chatbot_or_rag_or_tool_calling) {
    invoked.add('llm_app_reasoning');
  }
  return LLM_USE_CASES.filter((useCase) => invoked.has(useCase));
}

export function validateModuleRoute(route: ModuleRoute, label: string): string[] {
  const problems: string[] = [];
  if (route.transport === 'coding_cli') {
    if (!CODING_CLIS.includes(route.cli)) problems.push(`${label} cli is not supported`);
    if (!CLI_REASONING_LEVELS[route.cli]?.includes(route.reasoningLevel)) {
      problems.push(`${label} reasoning level is not supported for ${route.cli}`);
    }
  } else if (route.transport === 'api_key') {
    if (!API_KEY_PROVIDERS.includes(route.provider)) problems.push(`${label} API provider is not supported`);
  } else {
    problems.push(`${label} transport is not supported`);
  }
  if (!MODEL_PATTERN.test(route.model)) problems.push(`${label} model is empty or contains unsupported characters`);
  return problems;
}

export function validateModuleRouteConfig(config: ModuleRouteConfig): string[] {
  const problems: string[] = [];
  for (const useCase of LLM_USE_CASES) {
    const pair = config[useCase];
    if (!pair?.primary || !pair?.fallback) {
      problems.push(`${useCase} needs a primary and a fallback`);
      continue;
    }
    problems.push(...validateModuleRoute(pair.primary, `${useCase} primary`));
    problems.push(...validateModuleRoute(pair.fallback, `${useCase} fallback`));
    if (JSON.stringify(pair.primary) === JSON.stringify(pair.fallback)) {
      problems.push(`${useCase} fallback must differ from primary`);
    }
  }
  return problems;
}

export function routeHopAccepted(
  route: ModuleRoute,
  probes: Partial<Record<CodingCliName, CliProbeResult>>,
  apiReady: Partial<Record<ApiKeyProvider, boolean>> = {},
  bridgeReady = false,
): { accepted: boolean; reason?: string } {
  if (route.transport === 'api_key') {
    return { accepted: false, reason: apiReady[route.provider] ? 'API_ROUTE_NOT_IMPLEMENTED' : 'API_KEY_NOT_CONFIGURED' };
  }
  const levelOk = CLI_REASONING_LEVELS[route.cli].includes(route.reasoningLevel);
  if (!levelOk) return { accepted: false, reason: 'REASONING_LEVEL_UNSUPPORTED' };
  if (!bridgeReady) return { accepted: false, reason: 'BRIDGE_UNAVAILABLE' };
  const probe = probes[route.cli];
  if (!probe) return { accepted: false, reason: 'CLI_NOT_PROBED' };
  if (!probe.installed) return { accepted: false, reason: probe.errorCode ?? 'CLI_NOT_INSTALLED' };
  if (!probe.authenticated) return { accepted: false, reason: probe.errorCode ?? 'CLI_NOT_AUTHENTICATED' };
  if (route.model !== CLI_DEFAULT_MODEL && !probe.supportedModels.includes(route.model)) {
    return { accepted: false, reason: 'MODEL_UNSUPPORTED' };
  }
  if (probe.completion !== 'locked') {
    return { accepted: false, reason: probe.completionReason ?? 'CLI_COMPLETION_UNAVAILABLE' };
  }
  return { accepted: true };
}

export function evaluateModuleRoutePreflight(input: {
  config: ModuleRouteConfig;
  probes?: Partial<Record<CodingCliName, CliProbeResult>>;
  apiReady?: Partial<Record<ApiKeyProvider, boolean>>;
  profile: ScanProfile;
  targetType: TargetType;
  authScope: AuthScope;
  surfaceFlags?: Partial<SurfaceFlags>;
  capturedAt: string;
  /** Host bridge reachable. A stored login probe is not enough. */
  bridgeReady?: boolean;
}): ModuleRoutePreflight {
  const problems = validateModuleRouteConfig(input.config);
  if (problems.length > 0) {
    throw new Error(`Invalid module route config: ${problems.join('; ')}`);
  }
  const probes = input.probes ?? {};
  const invoked = new Set(invokedUseCases(input));
  const accepted = {} as Record<LlmUseCase, RouteAcceptance>;
  const rows: ModuleRouteRow[] = [];
  const coverageGaps: string[] = [];
  const blocked: string[] = [];

  for (const useCase of LLM_USE_CASES) {
    const pair = input.config[useCase];
    const primary = { ...pair.primary, ...routeHopAccepted(pair.primary, probes, input.apiReady, input.bridgeReady === true) };
    const fallback = { ...pair.fallback, ...routeHopAccepted(pair.fallback, probes, input.apiReady, input.bridgeReady === true) };
    accepted[useCase] = { primary: primary.accepted, fallback: fallback.accepted };
    const isInvoked = invoked.has(useCase);
    const gap = isInvoked && !primary.accepted && !fallback.accepted ? `llm:${useCase}:unavailable` : undefined;
    const blocking = input.profile === 'deep'
      && isInvoked
      && (DEEP_REQUIRED_USE_CASES as readonly string[]).includes(useCase)
      && Boolean(gap);
    if (gap) coverageGaps.push(gap);
    if (blocking) blocked.push(useCase);
    rows.push({ useCase, primary, fallback, invoked: isInvoked, blocking, ...(gap ? { coverageGap: gap } : {}) });
  }

  const checks = blocked.length === 0
    ? [{ code: 'LLM_MODULES_READY', ok: true, message: 'Required Deep reasoning modules are not blocked.' }]
    : [{
        code: 'LLM_MODULE_UNAVAILABLE',
        ok: false,
        message: `Deep preflight blocked. No accepted route for: ${blocked.join(', ')}.`,
      }];

  return {
    rows,
    checks,
    coverageGaps,
    snapshot: {
      capturedAt: input.capturedAt,
      routes: structuredClone(input.config),
      accepted,
    },
  };
}

/** Runtime selection uses the scan snapshot, never the live Settings object. */
export function selectHop(
  snapshot: LlmRouteSnapshot,
  useCase: LlmUseCase,
  options: { primaryFailed?: boolean } = {},
): { kind: 'route'; hop: 'primary' | 'fallback'; route: ModuleRoute; fallbackUsed: boolean }
  | { kind: 'coverage_gap'; useCase: LlmUseCase; reason: string } {
  const pair = snapshot.routes[useCase];
  const acceptance = snapshot.accepted[useCase];
  if (!pair || !acceptance) {
    return { kind: 'coverage_gap', useCase, reason: 'SNAPSHOT_MISSING_MODULE' };
  }
  if (!options.primaryFailed && acceptance.primary) {
    return { kind: 'route', hop: 'primary', route: structuredClone(pair.primary), fallbackUsed: false };
  }
  if (acceptance.fallback) {
    return { kind: 'route', hop: 'fallback', route: structuredClone(pair.fallback), fallbackUsed: true };
  }
  return { kind: 'coverage_gap', useCase, reason: 'NO_ACCEPTED_ROUTE' };
}

export function llmCallAudit(input: {
  useCase: LlmUseCase;
  hop: 'primary' | 'fallback';
  route: ModuleRoute;
  fallbackUsed: boolean;
  latencyMs: number;
  cost?: number;
  errorCode?: string;
}): LlmCallAudit {
  return {
    useCase: input.useCase,
    transport: input.route.transport,
    ...(input.route.transport === 'coding_cli'
      ? { cli: input.route.cli, reasoningLevel: input.route.reasoningLevel }
      : { provider: input.route.provider }),
    model: input.route.model,
    hop: input.hop,
    fallbackUsed: input.fallbackUsed,
    latencyMs: input.latencyMs,
    ...(typeof input.cost === 'number' ? { cost: input.cost } : {}),
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  };
}

export function isLlmRouteSnapshot(value: unknown): value is LlmRouteSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as LlmRouteSnapshot;
  return typeof snapshot.capturedAt === 'string' && Boolean(snapshot.routes) && Boolean(snapshot.accepted);
}
