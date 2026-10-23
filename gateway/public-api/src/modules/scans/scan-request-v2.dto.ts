import { z } from 'zod';
import { AUTH_SCOPES, DEFAULT_SURFACE_FLAGS, GuardrailError, normalizeUrl, SCAN_PROFILES, TARGET_TYPES } from '@x-hunter/shared';

const pathList = z.array(z.string().min(1).max(2048)).max(50);

export const ScanRequestV2 = z.object({
  schemaVersion: z.literal('scan_request_v2'),
  targetUrl: z.string().min(1).max(2048),
  profile: z.enum(SCAN_PROFILES).default('standard'),
  authorityConfirmed: z.literal(true),
  projectId: z.string().min(1).optional(),
  targetType: z.enum(TARGET_TYPES).default('interactive_web_app'),
  authScope: z.enum(AUTH_SCOPES).default('none'),
  surfaceFlags: z.record(z.boolean()).default(DEFAULT_SURFACE_FLAGS),
  scope: z.object({
    /** [] explicitly authorizes the whole exact host; omission uses the URL path subtree. */
    allowedPaths: pathList.optional(),
    excludedPaths: pathList.default([]),
  }).default({}),
  aggressiveStagingRiskAccepted: z.boolean().default(false),
  acceptedCoverageGaps: z.array(z.string().max(160)).max(10).default([]),
  acceptanceProfile: z.enum(['standard', 'canary_e2e']).default('standard'),
});

export type ScanRequestV2 = z.infer<typeof ScanRequestV2>;

export function resolveScanRequest(input: ScanRequestV2) {
  if (/[?#]/.test(input.targetUrl)) {
    throw new GuardrailError('INVALID_INPUT', 'Enter one public HTTPS URL without query or fragment');
  }
  let normalized: ReturnType<typeof normalizeUrl>;
  try {
    normalized = normalizeUrl(input.targetUrl);
  } catch {
    throw new GuardrailError('INVALID_INPUT', 'Enter one public HTTPS URL without port, query, fragment, or credentials');
  }
  const { url, hostname } = normalized;
  if (url.protocol !== 'https:' || url.port || url.search || url.hash ||
      !/^[a-z0-9.-]+$/.test(hostname) || !hostname.includes('.') || hostname.includes('..') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    throw new GuardrailError('INVALID_INPUT', 'Enter one public HTTPS URL without port, query, fragment, or credentials');
  }
  const targetPath = url.pathname.replace(/\/+$/, '') || '/';
  const allowedPaths = input.scope.allowedPaths ?? (targetPath === '/' ? [] : [targetPath]);
  const excludedPaths = input.scope.excludedPaths;
  for (const path of [...allowedPaths, ...excludedPaths]) {
    if (!path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#') ||
        new URL(path, url.origin).pathname !== path) {
      throw new GuardrailError('INVALID_INPUT', 'Scope paths must be normalized absolute URL paths');
    }
  }
  return {
    targetUrl: url.href,
    targetHost: hostname,
    allowedHosts: [hostname],
    allowedPaths,
    excludedPaths,
  };
}
