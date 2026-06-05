export const COMMERCIAL_PACKAGES = [
  'free_hunter',
  'ai_blackhat_mindset_check',
  'monitor_workspace',
  'enterprise_payg',
] as const;

export const SCAN_MODES = ['free_hunter', 'ai_blackhat_mindset_check'] as const;

export const AUTH_SCOPES = ['none', 'one_account', 'two_accounts'] as const;

export const TARGET_TYPES = [
  'static_content_website',
  'interactive_web_app',
  'api_service',
  'ai_llm_application',
] as const;

export const TEST_INTENSITY_MODES = [
  'safe_discovery',
  'controlled_attack_simulation',
  'aggressive_staging',
] as const;

export const SURFACE_FLAG_KEYS = [
  'has_login',
  'has_test_account',
  'has_api_docs',
  'has_file_upload',
  'has_payment',
  'has_admin_dashboard',
  'has_webhook',
  'has_chatbot_or_rag_or_tool_calling',
] as const;

export type CommercialPackage = (typeof COMMERCIAL_PACKAGES)[number];
export type PackageTier = CommercialPackage;
export type ScanMode = (typeof SCAN_MODES)[number];
export type AuthScope = (typeof AUTH_SCOPES)[number];
export type TargetType = (typeof TARGET_TYPES)[number];
export type TestIntensityMode = (typeof TEST_INTENSITY_MODES)[number];
export type SurfaceFlagKey = (typeof SURFACE_FLAG_KEYS)[number];
export type SurfaceFlags = Record<SurfaceFlagKey, boolean>;

export const DEFAULT_SURFACE_FLAGS: SurfaceFlags = {
  has_login: false,
  has_test_account: false,
  has_api_docs: false,
  has_file_upload: false,
  has_payment: false,
  has_admin_dashboard: false,
  has_webhook: false,
  has_chatbot_or_rag_or_tool_calling: false,
};

export const PACKAGE_LABELS: Record<CommercialPackage, string> = {
  free_hunter: 'Free Hunter',
  ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
  monitor_workspace: 'Monitor Workspace',
  enterprise_payg: 'Enterprise / PAYG',
};

export const SCAN_MODE_LABELS: Record<ScanMode, string> = {
  free_hunter: 'Free Hunter',
  ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
};

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  static_content_website: 'Static / Content Website',
  interactive_web_app: 'Interactive Web App',
  api_service: 'API Service',
  ai_llm_application: 'AI / LLM Application',
};

export const TEST_INTENSITY_LABELS: Record<TestIntensityMode, string> = {
  safe_discovery: 'Safe Discovery',
  controlled_attack_simulation: 'Controlled Attack Simulation',
  aggressive_staging: 'Aggressive Staging',
};

export const SCAN_PACKAGES = SCAN_MODES;
export const SCAN_PACKAGE_LABELS = SCAN_MODE_LABELS;

export function packageAllowsScanMode(tier: CommercialPackage, mode: ScanMode): boolean {
  if (tier === 'free_hunter') return mode === 'free_hunter';
  if (tier === 'ai_blackhat_mindset_check') return mode === 'ai_blackhat_mindset_check';
  if (tier === 'enterprise_payg') return true;
  return false;
}

export function authScopeRequiresAccounts(value: AuthScope): number {
  if (value === 'two_accounts') return 2;
  if (value === 'one_account') return 1;
  return 0;
}
