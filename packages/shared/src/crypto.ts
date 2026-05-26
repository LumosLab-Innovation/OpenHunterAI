/**
 * AES-256-GCM encryption for at-rest credential storage.
 *
 * SECURITY_GUARDRAILS.md §4.1 forbids plain-text credentials. Test account
 * credentials, provider API keys (when stored), and any "secret" field
 * must pass through encryptString before they touch the database.
 *
 * The key is read from APP_ENCRYPTION_KEY (hex-encoded 32 bytes / 64 chars).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

export interface EncryptedBlob {
  /** "v1:<iv-hex>:<tag-hex>:<ciphertext-base64>" */
  ciphertext: string;
}

export class EncryptionKeyMissingError extends Error {
  constructor() {
    super('APP_ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32');
    this.name = 'EncryptionKeyMissingError';
  }
}

function loadKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new EncryptionKeyMissingError();
  }
  if (!/^[0-9a-f]+$/i.test(raw) || raw.length !== KEY_LEN * 2) {
    throw new Error(
      `APP_ENCRYPTION_KEY must be ${KEY_LEN * 2} hex chars (got ${raw.length}). Generate with: openssl rand -hex 32`,
    );
  }
  return Buffer.from(raw, 'hex');
}

export function encryptString(plaintext: string): EncryptedBlob {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: `v1:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('base64')}`,
  };
}

export function decryptString(blob: EncryptedBlob | string): string {
  const key = loadKey();
  const raw = typeof blob === 'string' ? blob : blob.ciphertext;
  const [version, ivHex, tagHex, ctB64] = raw.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !ctB64) {
    throw new Error('Invalid encrypted blob format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/** Constant-time string compare. Use for verification tokens. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Generate a domain verification token. */
export function generateVerificationToken(prefix = 'xhunter-verify'): string {
  return `${prefix}-${randomBytes(18).toString('base64url')}`;
}
