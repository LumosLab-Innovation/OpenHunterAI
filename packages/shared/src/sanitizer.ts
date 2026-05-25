/**
 * Evidence & prompt sanitizer.
 *
 * Implements SECURITY_GUARDRAILS.md §4, §9 and LLM_PROVIDER_SPEC.md §6.
 *
 * All evidence written to reports, sent to the LLM Gateway, or displayed in
 * the UI MUST be sanitized first. The sanitizer is conservative: it
 * over-masks when in doubt rather than ever letting a raw secret through.
 *
 * Strategy:
 *   - Mask common header/cookie names regardless of value.
 *   - Mask anything that looks like a JWT, OAuth token, API key prefix
 *     (sk-, xoxb-, ghp_, AIza, AKIA, …), bearer token, basic-auth value.
 *   - Mask long base64/hex blobs (>= 24 chars).
 *   - Mask email addresses to first-letter + domain hash.
 *   - Recurse into objects/arrays.
 */

const REDACTED = '[REDACTED]';
const REDACTED_TOKEN = '[REDACTED_TOKEN]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';

/** Header / field names that should always be masked. */
const SENSITIVE_KEYS = new Set<string>(
  [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'x-csrf-token',
    'x-xsrf-token',
    'api-key',
    'apikey',
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'id_token',
    'session',
    'sessionid',
    'session_id',
    'jsessionid',
    'phpsessid',
    'connect.sid',
    'auth',
    'bearer',
    'credentials',
    'private_key',
    'privatekey',
    'client_secret',
  ].map((k) => k.toLowerCase()),
);

/** Regular expressions for token-shaped values inside arbitrary strings. */
const TOKEN_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._\-+/]+=*\b/gi,
  /\bBasic\s+[A-Za-z0-9+/=]+\b/gi,
  /\beyJ[A-Za-z0-9._-]{20,}\b/g, // JWT-ish
  /\bsk-[A-Za-z0-9_-]{16,}\b/gi, // OpenAI-style
  /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/gi, // Slack-style
  /\bghp_[A-Za-z0-9]{36,}\b/g, // GitHub PAT
  /\bgho_[A-Za-z0-9]{36,}\b/g,
  /\bghs_[A-Za-z0-9]{36,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g, // Google API key
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS Access Key ID
  /\bASIA[0-9A-Z]{16}\b/g, // AWS STS
  /\b[a-f0-9]{32,}\b/g, // long hex
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, // long base64 blobs
];

/** Cookie-string masker: `a=1; SESSION=abc; foo=bar` → `a=1; SESSION=[REDACTED]; foo=bar`. */
function maskCookieString(input: string): string {
  return input
    .split(';')
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return part;
      const name = part.slice(0, eq).trim();
      if (SENSITIVE_KEYS.has(name.toLowerCase())) {
        return `${part.slice(0, eq)}=${REDACTED}`;
      }
      // Even non-listed cookies often hold session tokens. Mask values long enough to be one.
      const value = part.slice(eq + 1);
      if (value.length >= 16) {
        return `${part.slice(0, eq)}=${REDACTED}`;
      }
      return part;
    })
    .join(';');
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function maskEmails(input: string): string {
  return input.replace(EMAIL_RE, REDACTED_EMAIL);
}

function maskTokensInString(input: string): string {
  let out = input;
  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, REDACTED_TOKEN);
  }
  return out;
}

/**
 * Sanitize a string of any shape.
 * Apply order: cookie-style header → token patterns → emails.
 */
export function sanitizeString(input: string): string {
  if (!input) return input;
  let out = input;
  // If the string looks like a cookie/header-value, mask cookie parts first.
  if (out.includes('=') && (out.includes(';') || out.length < 4096)) {
    const lowered = out.toLowerCase();
    if (
      lowered.includes('session') ||
      lowered.includes('token') ||
      lowered.includes('cookie') ||
      lowered.includes('auth') ||
      lowered.includes('csrf') ||
      lowered.includes('xsrf')
    ) {
      out = maskCookieString(out);
    }
  }
  out = maskTokensInString(out);
  out = maskEmails(out);
  return out;
}

/** Sanitize an arbitrary value. Recurses into objects/arrays. */
export function sanitizeValue(value: unknown, keyHint?: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (keyHint && SENSITIVE_KEYS.has(keyHint.toLowerCase())) {
      return REDACTED;
    }
    return sanitizeString(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, keyHint));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        result[k] = REDACTED;
        continue;
      }
      result[k] = sanitizeValue(v, k);
    }
    return result;
  }
  return value;
}

/** Wrap an object as sanitized; type-helper for downstream consumers. */
export interface Sanitized<T> {
  readonly value: T;
  readonly sanitized: true;
}

export function sanitize<T>(value: T): Sanitized<T> {
  return { value: sanitizeValue(value) as T, sanitized: true };
}

/**
 * Sanitize a free-form text block. Strips raw tokens, cookies, emails.
 * Useful for console logs, error messages, page content snippets.
 */
export function sanitizeText(text: string): string {
  return sanitizeString(text);
}
