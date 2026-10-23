/**
 * Credential seam for OrcaRouter.
 *
 * Two acquisition adapters — a pasted API key and an OAuth 2.0 + PKCE exchange —
 * both end in the same durable `sk-orca-…` key. Downstream provider and catalog
 * code only ever sees `OrcaCredential.apiKey` and the generation counter; it
 * never branches on where the credential came from.
 *
 * Storage follows the repository's existing provider-secret mechanism: the
 * private, git-ignored `.env.local` that already holds OPENAI_API_KEY and
 * DEEPSEEK_API_KEY. No new keychain is introduced. Values are never logged.
 */

import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ORCAROUTER_KEY_PREFIX, maskOrcaRouterKey } from '../providers/orcarouter.js';

export type OrcaCredentialSource = 'api_key' | 'pkce';

export interface OrcaCredential {
  apiKey: string;
  source: OrcaCredentialSource;
  scope?: string;
  userId?: string;
  /** Monotonic generation for this credential. Used for 401 isolation. */
  generation: number;
}

export type CredentialErrorCode =
  | 'INVALID_KEY'
  | 'STORE_IO'
  | 'PKCE_DENIED'
  | 'PKCE_STATE_MISMATCH'
  | 'PKCE_CODE_INVALID'
  | 'PKCE_SCOPE_MISMATCH'
  | 'PKCE_RATE_LIMITED'
  | 'PKCE_NETWORK';

export interface CredentialError {
  code: CredentialErrorCode;
  message: string;
}

export type CredentialResult =
  | { ok: true; credential: OrcaCredential; maskedKey: string }
  | { ok: false; error: CredentialError };

export interface OrcaRouterCredentialStore {
  read(): Promise<string | undefined>;
  save(apiKey: string): Promise<void>;
  clear(): Promise<void>;
}

/** Lightweight shape check only; an `sk-orca-` prefix is not proof of validity. */
export function looksLikeOrcaRouterKey(value: string): boolean {
  return typeof value === 'string' && value.startsWith(ORCAROUTER_KEY_PREFIX) && value.length >= 20;
}

/**
 * Credential state tracker. A durable OrcaRouter key cannot be refreshed, so a
 * relay 401 flips the exact account generation to `needsReauth`. A late failure
 * from an older generation must not poison a newly reconnected credential.
 */
export class CredentialGenerationTracker {
  private readonly generation = new Map<string, number>();
  private readonly rejected = new Map<string, number>();

  begin(accountId: string): number {
    const next = (this.generation.get(accountId) ?? 0) + 1;
    this.generation.set(accountId, next);
    this.rejected.delete(accountId);
    return next;
  }

  current(accountId: string): number {
    return this.generation.get(accountId) ?? 0;
  }

  /** Returns true when the rejected generation was still the current one. */
  markRejected(accountId: string, generation: number): boolean {
    if ((this.generation.get(accountId) ?? 0) !== generation) return false;
    this.rejected.set(accountId, generation);
    return true;
  }

  needsReauth(accountId: string): boolean {
    return this.rejected.has(accountId);
  }

  snapshot(): Record<string, { generation: number; needsReauth: boolean }> {
    const out: Record<string, { generation: number; needsReauth: boolean }> = {};
    for (const [id, generation] of this.generation) {
      out[id] = { generation, needsReauth: this.rejected.has(id) };
    }
    return out;
  }
}

/**
 * `.env.local` credential store using the repository's existing provider-secret
 * convention. Writes are atomic and the file is kept owner-only.
 */
export class EnvFileCredentialStore implements OrcaRouterCredentialStore {
  private readonly filePath: string;
  private readonly envVar: string;

  constructor(filePath: string, envVar = 'ORCAROUTER_API_KEY') {
    this.filePath = filePath;
    this.envVar = envVar;
  }

  async read(): Promise<string | undefined> {
    const fromEnv = process.env[this.envVar];
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    try {
      const contents = await readFile(this.filePath, 'utf8');
      return parseEnvValue(contents, this.envVar);
    } catch {
      return undefined;
    }
  }

  async save(apiKey: string): Promise<void> {
    const contents = await this.readFileOrDefault();
    const next = upsertEnvValue(contents, this.envVar, apiKey);
    await this.writeAtomic(next);
    process.env[this.envVar] = apiKey;
  }

  async clear(): Promise<void> {
    const contents = await this.readFileOrDefault();
    const next = removeEnvValue(contents, this.envVar);
    await this.writeAtomic(next);
    delete process.env[this.envVar];
  }

  private async readFileOrDefault(): Promise<string> {
    try {
      return await readFile(this.filePath, 'utf8');
    } catch {
      return '';
    }
  }

  private async writeAtomic(contents: string): Promise<void> {
    const tmp = join(dirname(this.filePath), `.${this.envVar}.${process.pid}.tmp`);
    await writeFile(tmp, contents, { encoding: 'utf8', mode: 0o600 });
    await chmod(tmp, 0o600);
    await rename(tmp, this.filePath);
  }
}

function parseEnvValue(contents: string, key: string): string | undefined {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== key) continue;
    return unquote(match[2]);
  }
  return undefined;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function upsertEnvValue(contents: string, key: string, value: string): string {
  const lines = contents.length ? contents.replace(/\n$/, '').split(/\r?\n/) : [];
  const entry = `${key}=${value}`;
  let replaced = false;
  const next = lines.map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (match && match[1] === key) {
      replaced = true;
      return entry;
    }
    return line;
  });
  if (!replaced) next.push(entry);
  return `${next.join('\n')}\n`;
}

function removeEnvValue(contents: string, key: string): string {
  const lines = contents.length ? contents.replace(/\n$/, '').split(/\r?\n/) : [];
  const next = lines.filter((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    return !(match && match[1] === key);
  });
  return next.length ? `${next.join('\n')}\n` : '';
}

/**
 * API-key adapter. The credential result shape is identical to the PKCE
 * adapter's, so provider/model-discovery code cannot tell them apart.
 */
export function apiKeyCredential(
  rawKey: string,
  generation = 1,
): CredentialResult {
  const apiKey = rawKey.trim();
  if (!looksLikeOrcaRouterKey(apiKey)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_KEY',
        message: 'OrcaRouter keys start with sk-orca-. Paste a key from your OrcaRouter console.',
      },
    };
  }
  return {
    ok: true,
    credential: { apiKey, source: 'api_key', generation },
    maskedKey: maskOrcaRouterKey(apiKey),
  };
}

/** PKCE adapter result → same credential shape (source differs only for audit). */
export function pkceCredential(result: {
  key: string;
  scope: string;
  userId?: string;
  generation?: number;
}): CredentialResult {
  if (!looksLikeOrcaRouterKey(result.key)) {
    return {
      ok: false,
      error: { code: 'PKCE_CODE_INVALID', message: 'OrcaRouter returned an unusable credential.' },
    };
  }
  return {
    ok: true,
    credential: {
      apiKey: result.key,
      source: 'pkce',
      scope: result.scope,
      userId: result.userId,
      generation: result.generation ?? 1,
    },
    maskedKey: maskOrcaRouterKey(result.key),
  };
}

export async function persistCredential(
  store: OrcaRouterCredentialStore,
  result: CredentialResult,
): Promise<CredentialResult> {
  if (!result.ok) return result;
  try {
    await store.save(result.credential.apiKey);
    return result;
  } catch {
    return {
      ok: false,
      error: {
        code: 'STORE_IO',
        message: 'Could not save the OrcaRouter credential to the local workspace.',
      },
    };
  }
}

/** Read the active key for inference/model discovery. */
export async function activeOrcaRouterKey(
  store: OrcaRouterCredentialStore,
): Promise<string | undefined> {
  const value = await store.read();
  return value && looksLikeOrcaRouterKey(value) ? value : undefined;
}
