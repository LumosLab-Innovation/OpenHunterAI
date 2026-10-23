import { apiFetch } from './api';

export interface OrcaRouterModel {
  id: string;
  name?: string;
  contextLength?: number;
  inputModalities: string[];
  reasoningEfforts?: string[];
  fromSeed?: boolean;
}

export interface OrcaRouterStatus {
  provider: {
    id: string;
    displayName: string;
    apiBase: string;
    authBase: string;
    homeUrl: string;
    cyberUrl: string;
    cyberModelsUrl: string;
    defaultModel: string;
    recommendedCyberModels: string[];
    generalFallbackModel: string;
  };
  auth: {
    apiKey: { configured: boolean; maskedKey?: string };
    pkce: { available: boolean; flow: 'loopback'; pendingAttempts: number };
  };
  catalog: {
    capability: string;
    source: 'live' | 'fallback';
    degraded: boolean;
    catalogSource: string;
    modelCount: number;
    models: OrcaRouterModel[];
    error?: string;
  };
}

export interface OrcaRouterAttempt {
  id: string;
  authorizeUrl: string;
  callbackUrl: string;
  createdAt: number;
  status: 'pending' | 'complete' | 'error' | 'cancelled' | 'expired';
  error?: { code: string; message: string };
  maskedKey?: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: { code?: string; message?: string } };

export function fetchStatus(): Promise<ApiResult<OrcaRouterStatus>> {
  return apiFetch<OrcaRouterStatus>('/v1/providers/orcarouter');
}

export function fetchModels(
  capability: 'chat' | 'embedding' | 'image' | 'video' | 'rerank',
  input: string[] = [],
  refresh = false,
): Promise<ApiResult<{ models: OrcaRouterModel[]; source: string; degraded: boolean; catalogSource: string; error?: string }>> {
  const params = new URLSearchParams({ capability });
  if (input.length) params.set('input', input.join(','));
  if (refresh) params.set('refresh', '1');
  return apiFetch(`/v1/providers/orcarouter/models?${params.toString()}`);
}

export function saveApiKey(apiKey: string): Promise<ApiResult<{ maskedKey: string; authenticated: boolean }>> {
  return apiFetch('/v1/providers/orcarouter/credentials/api-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export function clearApiKey(): Promise<ApiResult<null>> {
  return apiFetch('/v1/providers/orcarouter/credentials', { method: 'DELETE' });
}

export function startPkce(mode: 'loopback' | 'oob'): Promise<ApiResult<OrcaRouterAttempt>> {
  return apiFetch('/v1/providers/orcarouter/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export function pollPkce(attemptId: string): Promise<ApiResult<OrcaRouterAttempt>> {
  return apiFetch(`/v1/providers/orcarouter/oauth/${encodeURIComponent(attemptId)}`);
}

export function submitPkceCode(
  attemptId: string,
  code: string,
): Promise<ApiResult<OrcaRouterAttempt>> {
  return apiFetch(`/v1/providers/orcarouter/oauth/${encodeURIComponent(attemptId)}/code`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function cancelPkce(attemptId: string, keepalive = false): Promise<ApiResult<null>> {
  return apiFetch(`/v1/providers/orcarouter/oauth/${encodeURIComponent(attemptId)}/cancel`, {
    method: 'POST',
    keepalive,
  });
}
