/**
 * Lightweight Result helper. Workers return Result so callers don't have to
 * catch thrown errors for expected failure modes (timeout, out-of-scope, ...).
 */

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
