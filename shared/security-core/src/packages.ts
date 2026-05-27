export const SCAN_PACKAGES = [
  'free_hunter_snapshot',
  'ai_blackhat_check',
  'authenticated_check',
] as const;

export type PackageTier = (typeof SCAN_PACKAGES)[number];

export type ScanMode = PackageTier;

export const SCAN_PACKAGE_LABELS: Record<PackageTier, string> = {
  free_hunter_snapshot: 'Free Hunter Snapshot',
  ai_blackhat_check: 'AI Black-hat Check',
  authenticated_check: 'Authenticated Check',
};

export function isAuthenticatedScanPackage(value: PackageTier): boolean {
  return value === 'authenticated_check';
}
