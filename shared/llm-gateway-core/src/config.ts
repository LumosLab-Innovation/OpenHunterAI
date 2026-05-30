/**
 * Alias config + budget config for the LLM Gateway.
 *
 * Aliases and budgets are read from environment variables (see
 * shared/llm-gateway-core/env/llm.env.example and LLM_PROVIDER_SPEC.md §4 / §7).
 * Business logic only ever references
 * an alias (e.g. `llm.blackhat.hypothesis.pro`) — never a provider or model id.
 */

import type { AliasRoute, LLMBudget, LLMUseCase, ProviderName } from './types.js';
import type { PackageTier } from '@x-hunter/shared';

export type ModelAlias =
  | 'llm.free.triage.flash'
  | 'llm.free.first_finding.pro'
  | 'llm.blackhat.hypothesis.pro'
  | 'llm.blackhat.validation.pro'
  | 'llm.auth_scope.access_control.pro'
  | 'llm.report.human.pro'
  | 'llm.report.ai_dev.pro'
  | 'llm.fix_prompt.pro'
  | 'llm.monitor.retest.pro'
  | 'llm.enterprise.escalation.optional';

const ENV = process.env;

function envModel(name: string, fallback: string): string {
  const v = ENV[name];
  return v && v.length > 0 ? v : fallback;
}

export const ALIAS_ROUTES: Record<ModelAlias, AliasRoute> = {
  'llm.free.triage.flash': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_FLASH_MODEL', 'deepseek-v4-flash') },
  },
  'llm.free.first_finding.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.blackhat.hypothesis.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.blackhat.validation.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.auth_scope.access_control.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.report.human.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.report.ai_dev.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.fix_prompt.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.monitor.retest.pro': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
  'llm.enterprise.escalation.optional': {
    primary: { provider: 'deepseek', model: envModel('DEEPSEEK_V4_PRO_MODEL', 'deepseek-v4-pro') },
  },
};

/**
 * Mapping from use case → alias.
 * One alias may cover several use cases.
 */
export const USE_CASE_TO_ALIAS: Record<LLMUseCase, ModelAlias> = {
  free_triage_flash: 'llm.free.triage.flash',
  first_valuable_finding_reasoning_pro: 'llm.free.first_finding.pro',
  hunter_report_for_first_finding: 'llm.report.human.pro',
  openhack_hunter_summary: 'llm.free.triage.flash',
  blackhat_hypothesis: 'llm.blackhat.hypothesis.pro',
  blackhat_validation: 'llm.blackhat.validation.pro',
  auth_scope_access_control: 'llm.auth_scope.access_control.pro',
  finding_classification: 'llm.blackhat.validation.pro',
  severity_confidence: 'llm.blackhat.validation.pro',
  human_report: 'llm.report.human.pro',
  ai_dev_report: 'llm.report.ai_dev.pro',
  fix_prompt: 'llm.fix_prompt.pro',
  monitor_retest_reasoning: 'llm.monitor.retest.pro',
  enterprise_escalation_optional: 'llm.enterprise.escalation.optional',
};

/** Package → budget. See LLM_PROVIDER_SPEC.md §7.1. */
export const PACKAGE_BUDGETS: Record<PackageTier, LLMBudget> = {
  free_hunter: {
    maxLLMCallsPerScan: 2,
    maxInputTokensPerCall: 6000,
    maxOutputTokensPerCall: 1200,
    defaultTimeoutMs: 30_000,
    allowedUseCases: [
      'free_triage_flash',
      'first_valuable_finding_reasoning_pro',
      'hunter_report_for_first_finding',
    ],
  },
  ai_blackhat_mindset_check: {
    maxLLMCallsPerScan: 12,
    maxInputTokensPerCall: 20000,
    maxOutputTokensPerCall: 4000,
    defaultTimeoutMs: 60_000,
    allowedUseCases: [
      'blackhat_hypothesis',
      'blackhat_validation',
      'auth_scope_access_control',
      'finding_classification',
      'severity_confidence',
      'human_report',
      'ai_dev_report',
      'fix_prompt',
      'monitor_retest_reasoning',
      'openhack_hunter_summary',
    ],
  },
  monitor_workspace: {
    maxLLMCallsPerScan: 2,
    maxInputTokensPerCall: 10000,
    maxOutputTokensPerCall: 2000,
    defaultTimeoutMs: 60_000,
    allowedUseCases: ['monitor_retest_reasoning', 'fix_prompt'],
  },
  enterprise_payg: {
    maxLLMCallsPerScan: 100,
    maxInputTokensPerCall: 24000,
    maxOutputTokensPerCall: 5000,
    defaultTimeoutMs: 90_000,
    allowedUseCases: [
      'blackhat_hypothesis',
      'blackhat_validation',
      'auth_scope_access_control',
      'finding_classification',
      'severity_confidence',
      'human_report',
      'ai_dev_report',
      'fix_prompt',
      'monitor_retest_reasoning',
      'openhack_hunter_summary',
      'enterprise_escalation_optional',
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
