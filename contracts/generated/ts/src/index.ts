export interface EventEnvelope<T = unknown> {
  id: string;
  subject: string;
  occurredAt: string;
  payload: T;
}

export interface ScopeSnapshot {
  allowedHosts: string[];
  allowedPaths: string[];
  excludedPaths: string[];
  testAccountPermission: boolean;
  authScope: 'none' | 'one_account' | 'two_accounts';
  sensitiveActionPermission: boolean;
  scanPackage: 'free_hunter' | 'ai_blackhat_mindset_check';
  verifiedDomain: string;
  capturedAt: string;
}
