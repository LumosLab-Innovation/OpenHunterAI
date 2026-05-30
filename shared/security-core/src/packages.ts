export const COMMERCIAL_PACKAGES = [
  'free_hunter',
  'ai_blackhat_mindset_check',
  'monitor_workspace',
  'enterprise_payg',
] as const;

export const SCAN_MODES = [
  'free_hunter',
  'ai_blackhat_mindset_check',
] as const;

export type CommercialPackage = (typeof COMMERCIAL_PACKAGES)[number];
export type PackageTier = CommercialPackage;
export type ScanMode = (typeof SCAN_MODES)[number];
export type AuthenticatedScopeMode = 'none' | 'one_account' | 'two_accounts';

export const COMMERCIAL_PACKAGE_LABELS: Record<CommercialPackage, string> = {
  free_hunter: 'Free Hunter',
  ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
  monitor_workspace: 'Monitor Workspace',
  enterprise_payg: 'Enterprise / PAYG',
};

export const SCAN_MODE_LABELS: Record<ScanMode, string> = {
  free_hunter: 'Free Hunter',
  ai_blackhat_mindset_check: 'AI Black-hat Mindset Check',
};

export function isAuthenticatedScopeEnabled(value: AuthenticatedScopeMode): boolean {
  return value !== 'none';
}
