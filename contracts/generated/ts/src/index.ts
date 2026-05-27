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
  sensitiveActionPermission: boolean;
  scanPackage: 'free_hunter_snapshot' | 'ai_blackhat_check' | 'authenticated_check';
  verifiedDomain: string;
  capturedAt: string;
}
