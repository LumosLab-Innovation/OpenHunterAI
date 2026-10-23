import type { LlmRouteSnapshot } from '@x-hunter/shared';

export type PreflightAuthScope = 'none' | 'one_account' | 'two_accounts';
export type PreflightIntensity = 'safe_discovery' | 'controlled_attack_simulation' | 'aggressive_staging';

export interface AggressivePreflightAuthorization {
  authScope: PreflightAuthScope;
  testIntensityMode: PreflightIntensity;
  aggressiveStagingRiskAccepted: boolean;
}

export interface LlmReadinessInput {
  lowReady: boolean;
  highReady: boolean;
}

/** Deep readiness follows the scan's accepted routes, including coding CLIs. */
export function moduleLlmReadiness(snapshot: LlmRouteSnapshot): LlmReadinessInput {
  const accepted = (useCase: keyof LlmRouteSnapshot['accepted']) =>
    snapshot.accepted[useCase]?.primary === true || snapshot.accepted[useCase]?.fallback === true;
  return {
    lowReady: accepted('signal_summary') && accepted('candidate_dedupe'),
    highReady: accepted('attacker_hypothesis') && accepted('validation_plan') && accepted('report_generation'),
  };
}

export interface SessionReadinessInput {
  testAccountId: string;
  status: string;
  expiresAt: Date;
}

export interface PreflightCheck {
  code: string;
  ok: boolean;
  message: string;
}

export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
  failures: PreflightCheck[];
  profile?: 'quick' | 'standard' | 'deep';
  runtimes?: Array<{ worker: string; installed: boolean; configured: boolean; reachable: boolean; executable: boolean; reason?: string }>;
  coverageGaps?: string[];
  requiresAcknowledgement?: boolean;
  scanPlan?: unknown;
  moduleRoutes?: unknown;
  llmRouteSnapshot?: unknown;
  resolvedScope?: { targetUrl?: string; allowedHosts: string[]; allowedPaths: string[]; excludedPaths: string[] };
}

export function evaluateAggressiveStagingPreflight(input: {
  now?: Date;
  authorization: AggressivePreflightAuthorization;
  llm: LlmReadinessInput;
  browserSessionRuntimeReady: boolean;
  sessions: SessionReadinessInput[];
  requireCanary: boolean;
  canaryReady: boolean;
}): PreflightResult {
  if (input.authorization.testIntensityMode !== 'aggressive_staging') {
    return { ok: true, checks: [], failures: [] };
  }

  const now = input.now ?? new Date();
  const checks: PreflightCheck[] = [];

  checks.push(checkRiskAcceptance(input.authorization.aggressiveStagingRiskAccepted));
  checks.push(checkLlmReadiness(input.llm));
  if (input.authorization.authScope !== 'none') {
    checks.push({
      code: input.browserSessionRuntimeReady ? 'BROWSER_SESSION_READY' : 'BROWSER_SESSION_UNAVAILABLE',
      ok: input.browserSessionRuntimeReady,
      message: input.browserSessionRuntimeReady
        ? 'Browser session runtime is reachable.'
        : 'Browser session runtime is unavailable.',
    });
  }
  checks.push(checkAuthSessions(input.authorization.authScope, input.sessions, now));
  if (input.requireCanary) {
    checks.push({
      code: input.canaryReady ? 'CANARY_READY' : 'CANARY_UNAVAILABLE',
      ok: input.canaryReady,
      message: input.canaryReady
        ? 'The /openhunter-canary contract is reachable in authorized scope.'
        : 'The /openhunter-canary contract is not reachable in authorized scope.',
    });
  }

  const failures = checks.filter((check) => !check.ok);
  return { ok: failures.length === 0, checks, failures };
}

function checkRiskAcceptance(accepted: boolean): PreflightCheck {
  return {
    code: accepted ? 'RISK_ACCEPTED' : 'RISK_ACCEPTANCE_REQUIRED',
    ok: accepted,
    message: accepted
      ? 'Aggressive staging risk acceptance is recorded.'
      : 'Aggressive staging requires explicit staging/dev/test risk acceptance.',
  };
}

function checkLlmReadiness(llm: LlmReadinessInput): PreflightCheck {
  const aliasesReady = llm.lowReady && llm.highReady;
  return {
    code: aliasesReady ? 'LLM_READY' : 'LLM_NOT_CONFIGURED',
    ok: aliasesReady,
    message:
      aliasesReady
        ? 'Both model aliases have at least one configured provider.'
        : 'Deep scanning requires configured providers for both model aliases.',
  };
}

function checkAuthSessions(authScope: PreflightAuthScope, sessions: SessionReadinessInput[], now: Date): PreflightCheck {
  const required = authScope === 'two_accounts' ? 2 : authScope === 'one_account' ? 1 : 0;
  if (required === 0) {
    return { code: 'AUTH_SESSIONS_READY', ok: true, message: 'No saved login session is required.' };
  }
  const freshAccountIds = new Set(
    sessions
      .filter((session) => session.status === 'active' && session.expiresAt.getTime() > now.getTime())
      .map((session) => session.testAccountId),
  );
  const ok = freshAccountIds.size >= required;
  return {
    code: ok ? 'AUTH_SESSIONS_READY' : 'AUTH_SESSION_REQUIRED',
    ok,
    message: ok
      ? `${required} saved login session(s) are active.`
      : `Auth scope ${authScope} requires ${required} fresh saved login session(s).`,
  };
}
