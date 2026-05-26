/**
 * Scope authorization checks. Used by every worker before issuing requests.
 *
 * Implements SECURITY_GUARDRAILS.md §1.2 + §2 + §3:
 *  - hostname must be in allowedHosts (exact or registrable-suffix match
 *    when an allowedHost is declared as a wildcard with a leading dot)
 *  - path must not match any excludedPath prefix
 *  - if allowedPaths is non-empty, path must match at least one allowed prefix
 */

import { GuardrailError } from './errors.js';
import type { ScopeAuthorization } from './types.js';
import { normalizeUrl } from './url.js';

export interface ScopeCheckOptions {
  /** When true, treat the URL as a redirect target and bias errors accordingly. */
  asRedirect?: boolean;
}

export function assertInScope(
  rawUrl: string,
  scope: ScopeAuthorization,
  opts: ScopeCheckOptions = {},
): void {
  const { hostname, url } = normalizeUrl(rawUrl);

  if (!isHostAllowed(hostname, scope.allowedHosts)) {
    throw new GuardrailError(
      opts.asRedirect ? 'REDIRECT_OUT_OF_SCOPE' : 'OUT_OF_SCOPE_HOST',
      `Host not in allowed scope: ${hostname}`,
      { hostname, allowedHosts: scope.allowedHosts },
    );
  }

  const path = url.pathname || '/';

  for (const ex of scope.excludedPaths) {
    if (matchesPathPrefix(path, ex)) {
      throw new GuardrailError('OUT_OF_SCOPE_PATH', `Path matches excluded prefix: ${ex}`, {
        path,
        excluded: ex,
      });
    }
  }

  if (scope.allowedPaths.length > 0) {
    const anyAllowed = scope.allowedPaths.some((p) => matchesPathPrefix(path, p));
    if (!anyAllowed) {
      throw new GuardrailError('OUT_OF_SCOPE_PATH', `Path not within allowed prefixes`, {
        path,
        allowed: scope.allowedPaths,
      });
    }
  }
}

export function isHostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase();
  for (const a of allowed) {
    const cand = a.toLowerCase();
    if (cand.startsWith('*.')) {
      const suffix = cand.slice(1); // ".example.com"
      if (h.endsWith(suffix) && h.length > suffix.length) return true;
      if (h === suffix.slice(1)) return true; // bare apex matches *.example.com
    } else if (cand === h) {
      return true;
    }
  }
  return false;
}

function matchesPathPrefix(path: string, prefix: string): boolean {
  const p = path.startsWith('/') ? path : `/${path}`;
  const q = prefix.startsWith('/') ? prefix : `/${prefix}`;
  if (q === '/') return true;
  return p === q || p.startsWith(`${q}/`) || p === `${q}`;
}
