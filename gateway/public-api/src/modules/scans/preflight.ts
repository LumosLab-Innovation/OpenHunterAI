export type PreflightScanMode = 'free_hunter' | 'ai_blackhat_mindset_check';
export type PreflightAuthScope = 'none' | 'one_account' | 'two_accounts';
export type PreflightIntensity = 'safe_discovery' | 'controlled_attack_simulation' | 'aggressive_staging';

export interface AggressivePreflightAuthorization {
  scanMode: PreflightScanMode;
  authScope: PreflightAuthScope;
  testIntensityMode: PreflightIntensity;
  aggressiveStagingRiskAccepted: boolean;
}

export interface LlmReadinessInput {
  lowPrimaryProvider: string;
  lowFallbackProvider: string;
  highPrimaryProvider: string;
  highFallbackProvider: string;
  openaiConfigured: boolean;
  deepseekConfigured: boolean;
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
  checks.push({
    code: input.browserSessionRuntimeReady ? 'BROWSER_SESSION_READY' : 'BROWSER_SESSION_UNAVAILABLE',
    ok: input.browserSessionRuntimeReady,
    message: input.browserSessionRuntimeReady
      ? 'Browser session runtime is reachable.'
      : 'Browser session runtime is unavailable.',
  });
  checks.push(checkAuthSessions(input.authorization.authScope, input.sessions, now));
  if (input.requireCanary) {
    checks.push({
      code: input.canaryReady ? 'CANARY_READY' : 'CANARY_UNAVAILABLE',
      ok: input.canaryReady,
      message: input.canaryReady
        ? 'The /openhunter-canary contract is reachable in verified scope.'
        : 'The /openhunter-canary contract is not reachable in verified scope.',
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
  const aliasesReady =
    llm.lowPrimaryProvider === 'openai' &&
    llm.highPrimaryProvider === 'openai' &&
    llm.lowFallbackProvider === 'deepseek' &&
    llm.highFallbackProvider === 'deepseek';
  const keysReady = llm.openaiConfigured && llm.deepseekConfigured;
  return {
    code: aliasesReady && keysReady ? 'LLM_READY' : 'LLM_NOT_CONFIGURED',
    ok: aliasesReady && keysReady,
    message:
      aliasesReady && keysReady
        ? 'LLM aliases are configured with OpenAI primary and DeepSeek fallback.'
        : 'Aggressive staging requires OpenAI primary aliases, DeepSeek fallback aliases, and both provider keys configured.',
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
