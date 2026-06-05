import type { AliasRoute, LLMBudget, LLMUseCase, ProviderName } from './types.js';
import type { PackageTier } from '@x-hunter/shared';

export type ModelAlias = 'low_reasoning_model' | 'high_reasoning_model';

const ENV = process.env;

function envProvider(name: string, fallback: ProviderName): ProviderName {
  const value = ENV[name] as ProviderName | undefined;
  return value === 'openai' || value === 'claude' || value === 'deepseek' ? value : fallback;
}

function envModel(name: string, fallback: string): string {
  const value = ENV[name];
  return value && value.length > 0 ? value : fallback;
}

export const ALIAS_ROUTES: Record<ModelAlias, AliasRoute> = {
  low_reasoning_model: {
    primary: {
      provider: envProvider('LLM_LOW_REASONING_PROVIDER', 'deepseek'),
      model: envModel('LLM_LOW_REASONING_MODEL', 'deepseek-v4-flash'),
    },
    fallback: {
      provider: envProvider('LLM_LOW_REASONING_FALLBACK_PROVIDER', 'openai'),
      model: envModel('LLM_LOW_REASONING_FALLBACK_MODEL', 'gpt-4o-mini'),
    },
  },
  high_reasoning_model: {
    primary: {
      provider: envProvider('LLM_HIGH_REASONING_PROVIDER', 'deepseek'),
      model: envModel('LLM_HIGH_REASONING_MODEL', 'deepseek-v4-pro'),
    },
    fallback: {
      provider: envProvider('LLM_HIGH_REASONING_FALLBACK_PROVIDER', 'openai'),
      model: envModel('LLM_HIGH_REASONING_FALLBACK_MODEL', 'gpt-4o'),
    },
  },
};

export const USE_CASE_TO_ALIAS: Record<LLMUseCase, ModelAlias> = {
  signal_summary: 'low_reasoning_model',
  candidate_dedupe: 'low_reasoning_model',
  suspicious_surface_ranking: 'low_reasoning_model',
  first_valuable_finding: 'high_reasoning_model',
  attacker_hypothesis: 'high_reasoning_model',
  validation_plan: 'high_reasoning_model',
  access_control_reasoning: 'high_reasoning_model',
  api_reasoning: 'high_reasoning_model',
  llm_app_reasoning: 'high_reasoning_model',
  report_generation: 'high_reasoning_model',
  fix_prompt: 'high_reasoning_model',
  retest_reasoning: 'high_reasoning_model',
};

export const PACKAGE_BUDGETS: Record<PackageTier, LLMBudget> = {
  free_hunter: {
    maxLLMCallsPerScan: 3,
    maxInputTokensPerCall: 6000,
    maxOutputTokensPerCall: 1200,
    defaultTimeoutMs: 30_000,
    allowedUseCases: [
      'signal_summary',
      'candidate_dedupe',
      'suspicious_surface_ranking',
      'first_valuable_finding',
      'report_generation',
    ],
  },
  ai_blackhat_mindset_check: {
    maxLLMCallsPerScan: 24,
    maxInputTokensPerCall: 22000,
    maxOutputTokensPerCall: 5000,
    defaultTimeoutMs: 75_000,
    allowedUseCases: [
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
    ],
  },
  monitor_workspace: {
    maxLLMCallsPerScan: 4,
    maxInputTokensPerCall: 12000,
    maxOutputTokensPerCall: 2500,
    defaultTimeoutMs: 45_000,
    allowedUseCases: ['report_generation', 'fix_prompt', 'retest_reasoning'],
  },
  enterprise_payg: {
    maxLLMCallsPerScan: 60,
    maxInputTokensPerCall: 30000,
    maxOutputTokensPerCall: 6000,
    defaultTimeoutMs: 90_000,
    allowedUseCases: [
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
    ],
  },
};

export function aliasFor(useCase: LLMUseCase): ModelAlias {
  return USE_CASE_TO_ALIAS[useCase];
}

export function routeFor(alias: ModelAlias): AliasRoute {
  return ALIAS_ROUTES[alias];
}

export function budgetFor(tier: PackageTier): LLMBudget {
  return PACKAGE_BUDGETS[tier];
}

export type { ProviderName };
