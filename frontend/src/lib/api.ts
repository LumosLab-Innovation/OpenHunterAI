export const API_BASE = import.meta.env.VITE_PUBLIC_API_BASE_URL ?? '/api';

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: { code?: string; message?: string } }
> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      credentials: 'include',
      cache: 'no-store',
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'API_UNREACHABLE', message: 'Cannot reach the local API. Start OpenHunterAI, then retry.' } };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    if (res.ok && res.status !== 204) {
      return { ok: false, status: res.status, error: { code: 'INVALID_API_RESPONSE', message: 'The API returned an unexpected response. Check the frontend API proxy and restart.' } };
    }
  }

  if (!res.ok) {
    const err = (data ?? {}) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    };
    return { ok: false, status: res.status, error: err.error ?? err };
  }

  return { ok: true, data: data as T };
}
