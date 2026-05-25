/**
 * Product Policy Gate (PLAN_V3 §3.2.B + ARCHITECTURE §7.1).
 *
 * Every action that touches the network from a worker, Strix tool call, or
 * retest scenario must pass through this gate. The gate makes decisions
 * deterministically from the scan's frozen ScopeSnapshot — never from a
 * mutable project setting — and never depends on the LLM.
 */

import {
  GuardrailError,
  assertInScope,
  normalizeUrl,
  type PackageTier,
  type ScopeAuthorization,
  type ScopeSnapshot,
} from '@x-hunter/shared';

export type SensitiveAction =
  | 'use_test_account'
  | 'access_control_check'
  | 'mutating_http_method'
  | 'billing_or_payment'
  | 'file_upload_or_delete'
  | 'email_or_webhook'
  | 'retest_high_or_critical'
  | 'destructive_strix_action';

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: SensitiveAction[];
}

export interface PolicyInput {
  scope: ScopeSnapshot | ScopeAuthorization;
  url: string;
  method?: string;
  /** Sensitive action context, if any. */
  sensitive?: SensitiveAction[];
  /** Approvals already granted (matching action keys). */
  grantedApprovals?: SensitiveAction[];
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Decide if a worker may proceed.
 *
 * Throws GuardrailError when the action is outright forbidden (e.g. host
 * out of scope, scheme banned). Returns a decision when the action is in
 * scope but needs approvals.
 */
export function decide(input: PolicyInput): PolicyDecision {
  // 1. URL must normalize cleanly and live inside the verified scope.
  const norm = normalizeUrl(input.url);
  assertInScope(norm.url.toString(), input.scope);

  // 2. Compute sensitive actions implied by the method.
  const sensitive = new Set<SensitiveAction>(input.sensitive ?? []);
  if (input.method && MUTATING.has(input.method.toUpperCase())) {
    sensitive.add('mutating_http_method');
  }

  // 3. Package-level test-account permission check.
  if (sensitive.has('use_test_account') && !input.scope.testAccountPermission) {
    throw new GuardrailError(
      'PACKAGE_DOES_NOT_PERMIT_ACTION',
      'Authorization does not permit test account use',
    );
  }
  // 4. Mutating methods require sensitive_action_permission OR explicit approval.
  if (sensitive.has('mutating_http_method') && !input.scope.sensitiveActionPermission) {
    sensitive.add('mutating_http_method');
  }

  const grants = new Set<SensitiveAction>(input.grantedApprovals ?? []);
  const needs = Array.from(sensitive).filter((s) => !grants.has(s));
  if (needs.length > 0) {
    return { allowed: false, requiresApproval: needs };
  }
  return { allowed: true, requiresApproval: [] };
}

/** Static gate for package-level capability checks (does this tier allow X?). */
export function packageAllows(
  tier: PackageTier,
  capability:
    | 'authenticated_scan'
    | 'strix_full_reasoning'
    | 'ai_dev_report'
    | 'access_control_check',
): boolean {
  switch (capability) {
    case 'authenticated_scan':
      return tier === 'auth' || tier === 'standard' || tier === 'launch';
    case 'strix_full_reasoning':
      return tier === 'standard' || tier === 'auth' || tier === 'launch';
    case 'ai_dev_report':
      return tier !== 'free';
    case 'access_control_check':
      return tier === 'auth' || tier === 'launch';
    default:
      return false;
  }
}
