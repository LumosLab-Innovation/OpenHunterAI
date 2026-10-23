/**
 * OrcaRouter OAuth 2.0 + PKCE (S256) connect flow.
 *
 * Flow A (loopback redirect) is the primary path because OpenHunterAI's API runs
 * on the same machine as the browser and can bind an ephemeral 127.0.0.1 port.
 * Flow B (out-of-band code) is offered for browsers that cannot reach loopback
 * or when the consent screen chooses "show me a code".
 *
 * Security invariants:
 *   - verifier and state are fresh cryptographic randomness for every attempt;
 *   - only the S256 challenge leaves the process; the verifier stays in memory
 *     until the exchange and is never logged or placed in a URL;
 *   - state is compared in constant time before the code is used;
 *   - authorize and exchange use the auth origin; inference uses the API origin;
 *   - auth codes are single-use and expire after 10 minutes;
 *   - the result is a durable API key, not a refreshable OAuth token.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { normalizeOrigin } from '../providers/orcarouter.js';
import { pkceCredential, type CredentialResult } from './credentials.js';

export const PKCE_SCOPE = 'api';
export const PKCE_ATTEMPT_TTL_MS = 10 * 60 * 1000;
export const ORCA_AUTHORIZE_PATH = '/auth';
export const ORCA_EXCHANGE_PATH = '/api/v1/auth/keys';

export interface PkceAttemptView {
  id: string;
  authorizeUrl: string;
  callbackUrl: string;
  createdAt: number;
  status: 'pending' | 'complete' | 'error' | 'cancelled' | 'expired';
  error?: { code: string; message: string };
  maskedKey?: string;
}

interface PkceAttemptInternal {
  view: PkceAttemptView;
  verifier: string;
  state: string;
  generation: number;
  accountId: string;
  timer: NodeJS.Timeout;
  server?: http.Server;
  settled: boolean;
  committing?: boolean;
}

export interface PkceFlowOptions {
  authBaseUrl: string;
  fetchImpl?: typeof fetch;
  appName?: string;
  accountId?: string;
  /** Persist the exchanged key. Called only after scope validation. */
  onCredential: (result: CredentialResult) => Promise<void> | void;
  /** Generate an attempt id (tests inject deterministic values). */
  idFactory?: () => string;
}

/** base64url(sha256(verifier)) with no padding, per RFC 7636 S256. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function createPkceSecrets(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(16).toString('base64url');
  return { verifier, challenge: pkceChallenge(verifier), state };
}

/** Constant-time state comparison; length mismatch is a non-match. */
export function stateMatches(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(opts: {
  authBaseUrl: string;
  callbackUrl: string;
  challenge: string;
  state: string;
  appName: string;
  scope?: string;
}): string {
  const base = normalizeOrigin(opts.authBaseUrl, 'OrcaRouter auth');
  const url = new URL(ORCA_AUTHORIZE_PATH, `${base}/`);
  url.searchParams.set('callback_url', opts.callbackUrl);
  url.searchParams.set('code_challenge', opts.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', opts.state);
  url.searchParams.set('app_name', opts.appName);
  url.searchParams.set('scope', opts.scope ?? PKCE_SCOPE);
  return url.toString();
}

export interface PkceExchangeResult {
  key: string;
  scope: string;
  userId?: string;
}

export type PkceExchangeErrorCode =
  | 'PKCE_CODE_INVALID'
  | 'PKCE_SCOPE_MISMATCH'
  | 'PKCE_RATE_LIMITED'
  | 'PKCE_NETWORK';

/**
 * Exchange an auth code. Only the exact auth origin path is used; the key is
 * never echoed in an error message.
 */
export async function exchangePkceCode(opts: {
  authBaseUrl: string;
  code: string;
  verifier: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requestedScope?: string;
}): Promise<{ ok: true; result: PkceExchangeResult } | { ok: false; code: PkceExchangeErrorCode; message: string }> {
  const base = normalizeOrigin(opts.authBaseUrl, 'OrcaRouter auth');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetchImpl(`${base}${ORCA_EXCHANGE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        code: opts.code,
        code_verifier: opts.verifier,
        code_challenge_method: 'S256',
      }),
      signal: ctrl.signal,
    });
    if (res.status === 429) {
      return {
        ok: false,
        code: 'PKCE_RATE_LIMITED',
        message: 'OrcaRouter rate-limited new sign-ins. Reuse the saved key or try again later.',
      };
    }
    if (res.status === 403 || res.status === 400) {
      return {
        ok: false,
        code: 'PKCE_CODE_INVALID',
        message: 'That authorization code is invalid, expired, or already used. Start again.',
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: 'PKCE_NETWORK',
        message: `OrcaRouter sign-in failed with status ${res.status}. Try again.`,
      };
    }
    const data = (await res.json().catch(() => null)) as
      | { key?: unknown; scope?: unknown; user_id?: unknown }
      | null;
    if (!data || typeof data.key !== 'string' || typeof data.scope !== 'string') {
      return {
        ok: false,
        code: 'PKCE_CODE_INVALID',
        message: 'OrcaRouter returned an unexpected sign-in response.',
      };
    }
    const requested = opts.requestedScope ?? PKCE_SCOPE;
    if (data.scope !== requested) {
      // Read back what was granted; refuse to assume the requested grant.
      return {
        ok: false,
        code: 'PKCE_SCOPE_MISMATCH',
        message: `OrcaRouter granted scope "${data.scope}", which does not cover "${requested}".`,
      };
    }
    return {
      ok: true,
      result: {
        key: data.key,
        scope: data.scope,
        userId: typeof data.user_id === 'string' ? data.user_id : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'PKCE_NETWORK',
      message: 'Could not reach OrcaRouter sign-in. Check your connection and try again.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-user in-memory attempt registry with generation isolation and complete
 * cleanup on every terminal path.
 */
export class OrcaRouterPkceFlow {
  private readonly attempts = new Map<string, PkceAttemptInternal>();
  private readonly generations = new Map<string, number>();
  private readonly opts: PkceFlowOptions;

  constructor(opts: PkceFlowOptions) {
    this.opts = opts;
  }

  /** Start Flow A: bind loopback first, then return the authorize URL. */
  async startLoopback(accountId = this.opts.accountId ?? 'local'): Promise<PkceAttemptView> {
    const { verifier, challenge, state } = createPkceSecrets();
    const generation = (this.generations.get(accountId) ?? 0) + 1;
    this.generations.set(accountId, generation);
    const id = this.opts.idFactory?.() ?? randomBytes(12).toString('base64url');

    const server = http.createServer((req, res) => {
      void this.handleCallback(id, req, res);
    });
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('loopback listener did not return a port'));
      });
    });

    const callbackUrl = `http://127.0.0.1:${port}/cb`;
    const authorizeUrl = buildAuthorizeUrl({
      authBaseUrl: this.opts.authBaseUrl,
      callbackUrl,
      challenge,
      state,
      appName: this.opts.appName ?? 'OpenHunterAI',
    });
    const view: PkceAttemptView = {
      id,
      authorizeUrl,
      callbackUrl,
      createdAt: Date.now(),
      status: 'pending',
    };
    const attempt: PkceAttemptInternal = {
      view,
      verifier,
      state,
      generation,
      accountId,
      settled: false,
      server,
      timer: setTimeout(() => this.finish(id, 'expired', {
        code: 'PKCE_CODE_INVALID',
        message: 'OrcaRouter sign-in timed out. Start again.',
      }), PKCE_ATTEMPT_TTL_MS),
    };
    this.attempts.set(id, attempt);
    return view;
  }

  /** Start Flow B: no listener; the consent screen displays a code. */
  startOutOfBand(accountId = this.opts.accountId ?? 'local'): PkceAttemptView {
    const { verifier, challenge, state } = createPkceSecrets();
    const generation = (this.generations.get(accountId) ?? 0) + 1;
    this.generations.set(accountId, generation);
    const id = this.opts.idFactory?.() ?? randomBytes(12).toString('base64url');
    const authorizeUrl = buildAuthorizeUrl({
      authBaseUrl: this.opts.authBaseUrl,
      callbackUrl: 'oob',
      challenge,
      state,
      appName: this.opts.appName ?? 'OpenHunterAI',
    });
    const view: PkceAttemptView = {
      id,
      authorizeUrl,
      callbackUrl: 'oob',
      createdAt: Date.now(),
      status: 'pending',
    };
    this.attempts.set(id, {
      view,
      verifier,
      state,
      generation,
      accountId,
      settled: false,
      timer: setTimeout(() => this.finish(id, 'expired', {
        code: 'PKCE_CODE_INVALID',
        message: 'OrcaRouter sign-in timed out. Start again.',
      }), PKCE_ATTEMPT_TTL_MS),
    });
    return view;
  }

  get(id: string): PkceAttemptView | undefined {
    return this.attempts.get(id)?.view;
  }

  /** Account-scoped read: another account's attempt id returns undefined. */
  getForAccount(id: string, accountId: string): PkceAttemptView | undefined {
    const attempt = this.attempts.get(id);
    return attempt && attempt.accountId === accountId ? attempt.view : undefined;
  }

  cancelForAccount(id: string, accountId: string): boolean {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.accountId !== accountId) return false;
    return this.cancel(id);
  }

  async submitCodeForAccount(
    id: string,
    code: string,
    accountId: string,
  ): Promise<PkceAttemptView | undefined> {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.accountId !== accountId) return undefined;
    return this.submitCode(id, code);
  }

  /** Flow B: redeem a code the user pasted. */
  async submitCode(id: string, code: string): Promise<PkceAttemptView> {
    const attempt = this.attempts.get(id);
    if (!attempt) {
      return {
        id,
        authorizeUrl: '',
        callbackUrl: 'oob',
        createdAt: Date.now(),
        status: 'error',
        error: { code: 'PKCE_CODE_INVALID', message: 'This sign-in attempt no longer exists.' },
      };
    }
    if (!attempt.settled) await this.complete(attempt, code.trim());
    return attempt.view;
  }

  cancel(id: string): boolean {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.view.status !== 'pending' || attempt.committing) return false;
    this.finish(id, 'cancelled', {
      code: 'PKCE_CODE_INVALID',
      message: 'OrcaRouter sign-in was cancelled.',
    });
    return true;
  }

  private async handleCallback(
    id: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const attempt = this.attempts.get(id);
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!attempt || url.pathname !== '/cb') {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    // Compare state before touching the code.
    if (!stateMatches(attempt.state, url.searchParams.get('state'))) {
      this.respond(res, 'Authorization could not be verified. Close this tab and try again.');
      await this.finish(id, 'error', {
        code: 'PKCE_STATE_MISMATCH',
        message: 'OrcaRouter sign-in state did not match. Start again.',
      });
      return;
    }
    const denied = url.searchParams.get('error');
    if (denied) {
      this.respond(res, 'Authorization was declined. You can close this tab.');
      await this.finish(id, 'error', {
        code: 'PKCE_DENIED',
        message: `OrcaRouter sign-in was declined (${denied}).`,
      });
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      this.respond(res, 'Authorization did not return a code. Close this tab and try again.');
      await this.finish(id, 'error', {
        code: 'PKCE_CODE_INVALID',
        message: 'OrcaRouter sign-in returned no authorization code.',
      });
      return;
    }
    this.respond(res, 'Connected to OrcaRouter. You can close this tab.');
    await this.complete(attempt, code);
  }

  private respond(res: http.ServerResponse, message: string): void {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><html><body style="font-family:system-ui;padding:2rem">${message}</body></html>`,
    );
  }

  private async complete(attempt: PkceAttemptInternal, code: string): Promise<void> {
    if (attempt.settled) {
      // Single-use code: a second callback cannot re-exchange it and must not
      // overwrite the already-terminal result.
      return;
    }
    attempt.settled = true;
    const exchanged = await exchangePkceCode({
      authBaseUrl: this.opts.authBaseUrl,
      code,
      verifier: attempt.verifier,
      fetchImpl: this.opts.fetchImpl,
      requestedScope: PKCE_SCOPE,
    });
    if (attempt.view.status !== 'pending') return;
    if (this.generations.get(attempt.accountId) !== attempt.generation) {
      this.cancel(attempt.view.id);
      return;
    }
    if (!exchanged.ok) {
      this.finish(attempt.view.id, 'error', { code: exchanged.code, message: exchanged.message });
      return;
    }
    const credential = pkceCredential({
      key: exchanged.result.key,
      scope: exchanged.result.scope,
      userId: exchanged.result.userId,
      generation: attempt.generation,
    });
    if (!credential.ok) {
      this.finish(attempt.view.id, 'error', credential.error);
      return;
    }
    // Once saving starts, Cancel must not claim that the credential was discarded.
    attempt.committing = true;
    clearTimeout(attempt.timer);
    try {
      await this.opts.onCredential(credential);
    } catch {
      this.finish(attempt.view.id, 'error', { code: 'STORE_IO', message: 'Could not save the OrcaRouter credential. Try connecting again.' });
      return;
    }
    // Verifier is discarded with the attempt on the terminal path.
    this.finish(attempt.view.id, 'complete', undefined, credential.maskedKey);
  }

  private finish(
    id: string,
    status: PkceAttemptView['status'],
    error?: { code: string; message: string },
    maskedKey?: string,
  ): void {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.view.status !== 'pending') return;
    clearTimeout(attempt.timer);
    attempt.settled = true;
    attempt.view.status = status;
    if (error) attempt.view.error = error;
    if (maskedKey) attempt.view.maskedKey = maskedKey;
    attempt.verifier = '';
    if (attempt.server) {
      const server = attempt.server;
      attempt.server = undefined;
      // Let the terminal browser response flush before releasing the port.
      setTimeout(() => server.close(), 0).unref?.();
    }
    // Keep the terminal view briefly so the UI can read it, then drop secrets.
    setTimeout(() => this.attempts.delete(id), 60_000).unref?.();
  }
}
