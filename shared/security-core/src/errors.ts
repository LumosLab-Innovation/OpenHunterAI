/**
 * Domain errors. These are the failure modes that the Product Policy Gate,
 * workers, and API surface raise. Each carries a stable machine code so the
 * API can map them to HTTP responses and the UI can localize them.
 */

export type GuardrailCode =
  | 'PROJECT_NOT_FOUND'
  | 'DOMAIN_NOT_VERIFIED'
  | 'VERIFICATION_EXPIRED'
  | 'NO_SCAN_AUTHORIZATION'
  | 'AUTHORIZATION_EXPIRED'
  | 'OUT_OF_SCOPE_HOST'
  | 'OUT_OF_SCOPE_PATH'
  | 'PRIVATE_OR_RESERVED_TARGET'
  | 'UNSUPPORTED_SCHEME'
  | 'REDIRECT_OUT_OF_SCOPE'
  | 'PACKAGE_DOES_NOT_PERMIT_ACTION'
  | 'TEST_ACCOUNT_REQUIRED'
  | 'RISK_ACCEPTANCE_REQUIRED'
  | 'SENSITIVE_ACTION_REQUIRES_APPROVAL'
  | 'BUDGET_EXCEEDED'
  | 'TIMEOUT'
  | 'TOOL_UNAVAILABLE'
  | 'EVIDENCE_NOT_SANITIZED'
  | 'INVALID_INPUT'
  | 'INTERNAL';

export class GuardrailError extends Error {
  public readonly code: GuardrailCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: GuardrailCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GuardrailError';
    this.code = code;
    this.details = details;
  }
}

export function isGuardrailError(value: unknown): value is GuardrailError {
  return value instanceof GuardrailError;
}
