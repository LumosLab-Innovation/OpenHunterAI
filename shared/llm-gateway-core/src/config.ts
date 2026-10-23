import type { AliasRoute, LLMBudget, LLMUseCase, ProviderName } from './types.js';
import type { ScanProfile } from '@x-hunter/shared';

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

function ceiling(name: string, fallback: number): number {
  const value = Number(ENV[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export const PROFILE_BUDGETS: Record<ScanProfile, LLMBudget> = {
  quick: {
    maxLLMCallsPerScan: ceiling('OPENHUNTER_QUICK_LLM_CALLS', 12),
    maxInputTokensPerCall: 22000,
    maxOutputTokensPerCall: 5000,
    defaultTimeoutMs: 75000,
  },
  standard: {
    maxLLMCallsPerScan: ceiling('OPENHUNTER_STANDARD_LLM_CALLS', 24),
    maxInputTokensPerCall: 22000,
    maxOutputTokensPerCall: 5000,
    defaultTimeoutMs: 75000,
  },
  deep: {
    maxLLMCallsPerScan: ceiling('OPENHUNTER_DEEP_LLM_CALLS', 60),
    maxInputTokensPerCall: 30000,
    maxOutputTokensPerCall: 6000,
    defaultTimeoutMs: 90000,
  },
};

export function aliasFor(useCase: LLMUseCase): ModelAlias {
  return USE_CASE_TO_ALIAS[useCase];
}

export function routeFor(alias: ModelAlias): AliasRoute {
  return ALIAS_ROUTES[alias];
}

export function budgetFor(profile: ScanProfile): LLMBudget {
  return PROFILE_BUDGETS[profile];
}

export type { ProviderName };
