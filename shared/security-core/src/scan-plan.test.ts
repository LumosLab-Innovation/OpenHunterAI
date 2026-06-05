import { describe, expect, it } from 'vitest';
import { DEFAULT_SURFACE_FLAGS } from './packages.js';
import { buildScanPlan } from './scan-plan.js';

const baseInput = {
  packageTier: 'free_hunter' as const,
  scanMode: 'free_hunter' as const,
  targetType: 'interactive_web_app' as const,
  surfaceFlags: { ...DEFAULT_SURFACE_FLAGS, has_login: true },
  authScope: 'none' as const,
  testIntensityMode: 'safe_discovery' as const,
  allowedHosts: ['example.com'],
  allowedPaths: ['/'],
  excludedPaths: [],
};

describe('buildScanPlan', () => {
  it('enforces Free Hunter quotas without weakening target support', () => {
    const plan = buildScanPlan({
      ...baseInput,
      targetType: 'ai_llm_application',
      testIntensityMode: 'aggressive_staging',
      surfaceFlags: { ...DEFAULT_SURFACE_FLAGS, has_chatbot_or_rag_or_tool_calling: true },
    });

    expect(plan.budgets).toMatchObject({
      maxReturnedFindings: 1,
      maxMonitoredFindings: 1,
      maxRetests: 1,
      cooldownDays: 7,
    });
    expect(plan.enabledHunters).toContain('ai_prompt');
    expect(plan.allowedValidationLevel).toBe('approval_gated_validation');
  });

  it('selects static content workers deterministically', () => {
    const plan = buildScanPlan({ ...baseInput, targetType: 'static_content_website' });

    expect(plan.enabledWorkers).toEqual({
      browser: 'light',
      zap: 'mini',
      nuclei: 'mini',
      openhack: 'light',
      strix: 'candidate_only',
    });
    expect(plan.enabledHunters).toContain('content_exposure');
  });

  it('records skipped hunters with reasons', () => {
    const plan = buildScanPlan({
      ...baseInput,
      targetType: 'api_service',
      surfaceFlags: DEFAULT_SURFACE_FLAGS,
    });

    expect(plan.skippedHunters).toContainEqual({
      hunter: 'api_docs_browser_observation',
      reason: 'surface flag has_api_docs is false',
    });
  });
});
