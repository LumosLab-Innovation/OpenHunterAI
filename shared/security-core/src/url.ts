/**
 * URL normalization & private/reserved target detection.
 *
 * The rules below implement SECURITY_GUARDRAILS.md §2.2 and §2.3:
 *  - normalize scheme / host (lower-case)
 *  - strip user-info (no `user:pass@host`)
 *  - strip fragment
 *  - reject non-http(s) schemes
 *  - reject IPv4 / IPv6 / hostnames that resolve to private, loopback,
 *    link-local, broadcast, multicast or cloud-metadata addresses
 *
 * The functions intentionally avoid DNS resolution — we forbid IP literals
 * here and require the resolved IP check at request time inside workers
 * (so a host that was safe at scan-config time can still be blocked if it
 * starts resolving to a private IP).
 */

import { GuardrailError } from './errors.js';

/** Cloud metadata endpoints to always block. */
const METADATA_HOSTS = new Set<string>([
  '169.254.169.254',
  '100.100.100.200', // Alibaba
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
]);

/** Schemes we allow at scan boundaries. */
const ALLOWED_SCHEMES = new Set<string>(['http:', 'https:']);

export interface NormalizedUrl {
  raw: string;
  url: URL;
  hostname: string;
  origin: string;
}

/**
 * Normalize a URL string.
 *
 * Throws {@link GuardrailError} when the URL is invalid, uses an unsupported
 * scheme, contains user-info, or targets a private/reserved/metadata host.
 */
export function normalizeUrl(input: string): NormalizedUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new GuardrailError('INVALID_INPUT', `URL is not parseable: ${input}`);
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new GuardrailError('UNSUPPORTED_SCHEME', `Scheme not allowed: ${url.protocol}`, {
      input,
    });
  }

  if (url.username !== '' || url.password !== '') {
    throw new GuardrailError('INVALID_INPUT', 'URLs with userinfo are not allowed', { input });
  }

  // Strip fragment (never sent over the wire anyway, but normalize for storage).
  url.hash = '';

  // Lower-case hostname (per RFC 3986 §6.2.2.1).
  const hostname = url.hostname.toLowerCase();
  url.hostname = hostname;

  assertNotReservedTarget(hostname);

  return {
    raw: input,
    url,
    hostname,
    origin: url.origin,
  };
}

/** Throws {@link GuardrailError} if the hostname targets a forbidden range. */
export function assertNotReservedTarget(hostname: string): void {
  if (hostname === '' || hostname === 'localhost') {
    throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'Localhost is not allowed', {
      hostname,
    });
  }

  if (METADATA_HOSTS.has(hostname)) {
    throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'Cloud metadata endpoint is blocked', {
      hostname,
    });
  }

  // IPv4 literal?
  if (isIPv4Literal(hostname)) {
    if (isPrivateIPv4(hostname)) {
      throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'Private/reserved IPv4 is blocked', {
        hostname,
      });
    }
    return;
  }

  // IPv6 literal (with or without brackets)?
  const stripped =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (isIPv6Literal(stripped)) {
    if (isPrivateIPv6(stripped)) {
      throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'Private/reserved IPv6 is blocked', {
        hostname,
      });
    }
    return;
  }

  // Numeric-only hostnames that aren't valid IPs are rejected to avoid
  // smuggling (e.g. `2130706433` which equals 127.0.0.1 in some parsers).
  if (/^\d+$/.test(hostname)) {
    throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'Numeric hostname is blocked', {
      hostname,
    });
  }

  // .local mDNS hostnames are link-local and not scannable in our model.
  if (hostname.endsWith('.local')) {
    throw new GuardrailError('PRIVATE_OR_RESERVED_TARGET', 'mDNS .local hostnames are blocked', {
      hostname,
    });
  }
}

function isIPv4Literal(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^(0|[1-9]\d{0,2})$/.test(p) && Number(p) <= 255);
}

function isIPv6Literal(value: string): boolean {
  // Cheap check; defers to URL parser for full validation upstream.
  return value.includes(':');
}

/**
 * Block private, loopback, link-local, broadcast, multicast and reserved ranges.
 *
 *  10.0.0.0/8
 *  127.0.0.0/8
 *  169.254.0.0/16 (link-local)
 *  172.16.0.0/12
 *  192.168.0.0/16
 *  224.0.0.0/4 (multicast)
 *  240.0.0.0/4 (reserved)
 *  0.0.0.0/8 (this network)
 *  100.64.0.0/10 (CGNAT)
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224 && a <= 239) return true;
  if (a >= 240) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Block ::1, fc00::/7, fe80::/10, ::/128, ::ffff:* (IPv4-mapped),
 * multicast ff00::/8, and metadata link-local.
 */
export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  if (lower === '0:0:0:0:0:0:0:1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true; // fe80::/10
  }
  if (lower.startsWith('ff')) return true; // multicast ff00::/8
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (isIPv4Literal(mapped)) return isPrivateIPv4(mapped);
    return true;
  }
  return false;
}
