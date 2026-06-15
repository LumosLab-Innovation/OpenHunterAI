import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * SePay integration helpers. SePay notifies our webhook when a bank transfer /
 * VietQR payment is received. We authenticate the webhook with a shared API key
 * (SePay sends `Authorization: Apikey <key>`), then match the transfer to a
 * pending Payment by the reference embedded in the transfer content.
 *
 * Docs vary by account; the verification is intentionally simple (shared secret)
 * and the matching is by our own payment reference, never by trusting amounts
 * alone. OWNER must set SEPAY_WEBHOOK_APIKEY and the receiving account.
 */

export interface SePayWebhookBody {
  /** SePay transaction id. */
  id: number | string;
  /** Transfer amount in VND. */
  transferAmount: number;
  /** Transfer type: 'in' for incoming. */
  transferType?: string;
  /** Raw transfer content / description (contains our payment ref). */
  content?: string;
  /** Bank reference code. */
  referenceCode?: string;
  [k: string]: unknown;
}

/** Verifies the SePay webhook shared-secret header (constant-time compare). */
export function verifySePayAuth(authHeader: string | undefined, expectedKey: string | undefined): boolean {
  if (!expectedKey) return false;
  if (!authHeader) return false;
  // Header form: "Apikey <key>" (case-insensitive scheme).
  const match = /^apikey\s+(.+)$/i.exec(authHeader.trim());
  const provided = match ? match[1] : authHeader.trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedKey);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extracts our payment reference from the transfer content. We embed a token
 * like `OHAI<paymentId>` in the VietQR description; SePay returns it in
 * `content`. Returns null when no reference is present.
 */
export function extractPaymentRef(content: string | undefined): string | null {
  if (!content) return null;
  const match = /OHAI([A-Za-z0-9]+)/.exec(content);
  return match ? match[1]! : null;
}

/** A stable event id for idempotency from the SePay transaction id. */
export function sepayEventId(body: SePayWebhookBody): string {
  return `sepay-${body.id}`;
}

/**
 * Optional HMAC verification when SEPAY_WEBHOOK_SECRET is configured (some SePay
 * setups sign the raw body). Returns true when no secret is set (auth then falls
 * back to the API key only).
 */
export function verifySePayHmac(rawBody: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
