/**
 * Alias config + budget config for the LLM Gateway.
 *
 * Aliases and budgets are read from environment variables (see
 * shared/llm-gateway-core/env/llm.env.example and LLM_PROVIDER_SPEC.md §4 / §7).
 * Business logic only ever references
 * an alias (e.g. `llm.blackhat.reasoning`) — never a provider or model id.
 */

import type { AliasRoute, LLMBudget, LLMUseCase, ProviderName } from './types.js';
import type { PackageTier } from '@x-hunter/shared';

export type ModelAlias =
  | 'llm.free.summary'
  | 'llm.hunter.summary'
  | 'llm.blackhat.reasoning'
  | 'llm.auth.reasoning'
  | 'llm.report.writer'
  | 'llm.fix_prompt.writer'
  | 'llm.retest.reasoning';

const ENV = process.env;

function envModel(name: string, fallback: string): string {
  const v = ENV[name];
  return v && v.length > 0 ? v : fallback;
}

export const ALIAS_ROUTES: Record<ModelAlias, AliasRoute> = {
  'llm.free.summary': {
    primary: {
      provider: 'deepseek',
      model: envModel('DEEPSEEK_FREE_SUMMARY_MODEL', 'deepseek-chat'),
    },
    fallback: { provider: 'openai', model: envModel('OPENAI_FREE_SUMMARY_MODEL', 'gpt-4o-mini') },
  },
  'llm.hunter.summary': {
    primary: { provider: 'openai', model: envModel('OPENAI_FREE_SUMMARY_MODEL', 'gpt-4o-mini') },
    fallback: {
      provider: 'deepseek',
      model: envModel('DEEPSEEK_FREE_SUMMARY_MODEL', 'deepseek-chat'),
    },
  },
  'llm.blackhat.reasoning': {
    primary: {
      provider: 'claude',
      model: envModel('CLAUDE_BLACKHAT_REASONING_MODEL', 'claude-3-5-sonnet-latest'),
    },
    fallback: { provider: 'openai', model: envModel('OPENAI_BLACKHAT_REASONING_MODEL', 'gpt-4o') },
  },
  'llm.auth.reasoning': {
    primary: {
      provider: 'claude',
      model: envModel('CLAUDE_AUTH_REASONING_MODEL', 'claude-3-5-sonnet-latest'),
    },
    fallback: { provider: 'openai', model: envModel('OPENAI_AUTH_REASONING_MODEL', 'gpt-4o') },
  },
  'llm.report.writer': {
    primary: { provider: 'openai', model: envModel('OPENAI_REPORT_MODEL', 'gpt-4o-mini') },
    fallback: { provider: 'deepseek', model: envModel('DEEPSEEK_REPORT_MODEL', 'deepseek-chat') },
  },
  'llm.fix_prompt.writer': {
    primary: { provider: 'openai', model: envModel('OPENAI_REPORT_MODEL', 'gpt-4o-mini') },
    fallback: { provider: 'deepseek', model: envModel('DEEPSEEK_REPORT_MODEL', 'deepseek-chat') },
  },
  'llm.retest.reasoning': {
    primary: {
      provider: 'claude',
      model: envModel('CLAUDE_RETEST_REASONING_MODEL', 'claude-3-5-sonnet-latest'),
    },
    fallback: { provider: 'openai', model: envModel('OPENAI_RETEST_REASONING_MODEL', 'gpt-4o') },
  },
};

/**
 * Mapping from use case → alias.
 * One alias may cover several use cases.
 */
export const USE_CASE_TO_ALIAS: Record<LLMUseCase, ModelAlias> = {
  free_hunter_summary: 'llm.free.summary',
  openhack_hunter_summary: 'llm.hunter.summary',
  strix_reasoning: 'llm.blackhat.reasoning',
  finding_classification: 'llm.blackhat.reasoning',
  severity_confidence: 'llm.blackhat.reasoning',
  human_report: 'llm.report.writer',
  ai_dev_report: 'llm.report.writer',
  fix_prompt: 'llm.fix_prompt.writer',
  retest_reasoning: 'llm.retest.reasoning',
};

/** Package → budget. See LLM_PROVIDER_SPEC.md §7.1. */
export const PACKAGE_BUDGETS: Record<PackageTier, LLMBudget> = {
  free_hunter_snapshot: {
    maxLLMCallsPerScan: 1,
    maxInputTokensPerCall: 6000,
    maxOutputTokensPerCall: 1200,
    defaultTimeoutMs: 30_000,
    allowedUseCases: ['free_hunter_summary', 'openhack_hunter_summary'],
  },
  ai_blackhat_check: {
    maxLLMCallsPerScan: 20,
    maxInputTokensPerCall: 20000,
    maxOutputTokensPerCall: 4000,
    defaultTimeoutMs: 60_000,
    allowedUseCases: [
      'strix_reasoning',
      'finding_classification',
      'severity_confidence',
      'human_report',
      'ai_dev_report',
      'fix_prompt',
      'retest_reasoning',
      'openhack_hunter_summary',
    ],
  },
  authenticated_check: {
    maxLLMCallsPerScan: 35,
    maxInputTokensPerCall: 24000,
    maxOutputTokensPerCall: 5000,
    defaultTimeoutMs: 90_000,
    allowedUseCases: [
      'strix_reasoning',
      'finding_classification',
      'severity_confidence',
      'human_report',
      'ai_dev_report',
      'fix_prompt',
      'retest_reasoning',
      'openhack_hunter_summary',
    ],
  },
};

/** Resolve which alias to use for a given use case. */
export function aliasFor(useCase: LLMUseCase): ModelAlias {
  return USE_CASE_TO_ALIAS[useCase];
}

/** Resolve the AliasRoute for an alias. */
export function routeFor(alias: ModelAlias): AliasRoute {
  return ALIAS_ROUTES[alias];
}

export function budgetFor(tier: PackageTier): LLMBudget {
  return PACKAGE_BUDGETS[tier];
}

export type { ProviderName };
