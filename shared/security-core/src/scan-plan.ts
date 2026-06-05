import type {
  AuthScope,
  PackageTier,
  ScanMode,
  SurfaceFlags,
  TargetType,
  TestIntensityMode,
} from './packages.js';

export type WorkerProfile = 'light' | 'medium' | 'deep' | 'mini' | 'standard_safe' | 'hygiene' | 'candidate_only';
export type ValidationLevel = 'observe_only' | 'safe_signal' | 'controlled_validation' | 'approval_gated_validation';

export interface ScanPlanInput {
  packageTier: PackageTier;
  scanMode: ScanMode;
  targetType: TargetType;
  surfaceFlags: SurfaceFlags;
  authScope: AuthScope;
  testIntensityMode: TestIntensityMode;
  allowedHosts: string[];
  allowedPaths: string[];
  excludedPaths: string[];
}

export interface ScanPlan {
  enabledWorkers: Record<string, WorkerProfile>;
  enabledHunters: string[];
  skippedHunters: Array<{ hunter: string; reason: string }>;
  allowedValidationLevel: ValidationLevel;
  budgets: {
    maxReturnedFindings: number;
    maxMonitoredFindings: number;
    maxRetests: number;
    cooldownDays: number;
    maxHypotheses: number;
    maxValidationAttempts: number;
  };
  requiresApprovalForSensitiveActions: boolean;
  notes: string[];
}

const FREE_BUDGET = {
  maxReturnedFindings: 1,
  maxMonitoredFindings: 1,
  maxRetests: 1,
  cooldownDays: 7,
  maxHypotheses: 3,
  maxValidationAttempts: 1,
};

const PAID_BUDGET = {
  maxReturnedFindings: 50,
  maxMonitoredFindings: 50,
  maxRetests: 10,
  cooldownDays: 0,
  maxHypotheses: 20,
  maxValidationAttempts: 8,
};

export function buildScanPlan(input: ScanPlanInput): ScanPlan {
  const isFree = input.scanMode === 'free_hunter';
  const isAggressive = input.testIntensityMode === 'aggressive_staging';
  const budgets = isFree ? FREE_BUDGET : PAID_BUDGET;
  const notes: string[] = [];
  const skippedHunters: Array<{ hunter: string; reason: string }> = [];
  const enabledWorkers: Record<string, WorkerProfile> = {};
  const enabledHunters: string[] = [];

  if (isFree) {
    notes.push('Free Hunter stops after the first valuable finding and exposes one limited monitored finding.');
  }
  if (isAggressive) {
    notes.push('Aggressive Staging requires staging/dev/test risk acceptance and still forbids destructive actions.');
  }

  switch (input.targetType) {
    case 'static_content_website':
      enabledWorkers.browser = 'light';
      enabledWorkers.zap = 'mini';
      enabledWorkers.nuclei = 'mini';
      enabledWorkers.openhack = 'light';
      enabledWorkers.strix = 'candidate_only';
      enabledHunters.push('content_exposure', 'hardening');
      if (input.surfaceFlags.has_login) enabledHunters.push('auth_session_smoke');
      break;
    case 'interactive_web_app':
      enabledWorkers.browser = input.testIntensityMode === 'safe_discovery' ? 'medium' : 'deep';
      enabledWorkers.zap = 'standard_safe';
      enabledWorkers.nuclei = 'standard_safe';
      enabledWorkers.openhack = 'medium';
      enabledWorkers.strix = 'deep';
      enabledHunters.push('api_surface', 'session_auth', 'admin_like_surface');
      if (!input.surfaceFlags.has_login) {
        skippedHunters.push({ hunter: 'authenticated_access_control', reason: 'surface flag has_login is false' });
      }
      break;
    case 'api_service':
      if (input.surfaceFlags.has_api_docs) enabledWorkers.browser = 'light';
      else skippedHunters.push({ hunter: 'api_docs_browser_observation', reason: 'surface flag has_api_docs is false' });
      enabledWorkers.zap = 'standard_safe';
      enabledWorkers.nuclei = 'standard_safe';
      enabledWorkers.openhack = 'medium';
      enabledWorkers.strix = 'deep';
      enabledHunters.push('api_surface', 'api_auth', 'data_exposure');
      break;
    case 'ai_llm_application':
      enabledWorkers.browser = 'medium';
      enabledWorkers.zap = 'hygiene';
      enabledWorkers.nuclei = 'mini';
      enabledWorkers.openhack = 'medium';
      enabledWorkers.strix = 'deep';
      enabledHunters.push('ai_prompt', 'rag_exposure', 'tool_calling');
      if (!input.surfaceFlags.has_chatbot_or_rag_or_tool_calling) {
        skippedHunters.push({ hunter: 'ai_deep_reasoning', reason: 'AI surface flag is not set' });
      }
      break;
  }

  let allowedValidationLevel: ValidationLevel = 'safe_signal';
  if (input.testIntensityMode === 'safe_discovery') allowedValidationLevel = 'safe_signal';
  if (input.testIntensityMode === 'controlled_attack_simulation') allowedValidationLevel = 'controlled_validation';
  if (input.testIntensityMode === 'aggressive_staging') allowedValidationLevel = 'approval_gated_validation';
  if (input.authScope !== 'none' && allowedValidationLevel === 'controlled_validation') {
    allowedValidationLevel = 'approval_gated_validation';
  }

  return {
    enabledWorkers,
    enabledHunters,
    skippedHunters,
    allowedValidationLevel,
    budgets,
    requiresApprovalForSensitiveActions:
      input.authScope !== 'none' || input.testIntensityMode !== 'safe_discovery' || isAggressive,
    notes,
  };
}
