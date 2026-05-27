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
  scanPackage: 'free' | 'light' | 'standard' | 'auth' | 'launch';
  verifiedDomain: string;
  capturedAt: string;
}
