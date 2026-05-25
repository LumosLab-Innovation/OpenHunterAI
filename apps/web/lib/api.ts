export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: { code?: string; message?: string } }
> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
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
