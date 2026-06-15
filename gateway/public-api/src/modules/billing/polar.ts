import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Polar integration helpers. Polar is the Merchant-of-Record for international
 * subscriptions. Polar signs webhooks with a secret using the Standard Webhooks
 * scheme (base64 HMAC-SHA256 over `<id>.<timestamp>.<body>`), sent in the
 * `webhook-signature` header as `v1,<sig>` (space-separated list possible).
 *
 * OWNER must set POLAR_WEBHOOK_SECRET and the product/price -> package mapping.
 */

export interface PolarWebhookBody {
  type: string;
  data: {
    id: string;
    status?: string;
    current_period_end?: string;
    product_id?: string;
    customer?: { organization_id?: string } | null;
    metadata?: Record<string, unknown> | null;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Verifies a Polar (Standard Webhooks) signature. The signed content is
 * `${id}.${timestamp}.${rawBody}`; the secret may be prefixed `whsec_` and is
 * base64. Compares constant-time against every provided `v1,` signature.
 */
export function verifyPolarSignature(args: {
  rawBody: string;
  webhookId: string | undefined;
  webhookTimestamp: string | undefined;
  webhookSignature: string | undefined;
  secret: string | undefined;
}): boolean {
  const { rawBody, webhookId, webhookTimestamp, webhookSignature, secret } = args;
  if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) return false;

  const secretBytes = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'base64');

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  // Header is a space-separated list of `v1,<sig>` entries.
  for (const part of webhookSignature.split(' ')) {
    const sig = part.includes(',') ? part.split(',')[1]! : part;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Idempotency id for a Polar webhook (uses the webhook delivery id). */
export function polarEventId(webhookId: string): string {
  return `polar-${webhookId}`;
}

/**
 * Maps a Polar product id to an OpenHunter package tier. The mapping is provided
 * via POLAR_PRODUCT_MAP env as `productId:tier,productId:tier`. Returns null when
 * the product is unknown so we never silently grant an unmapped tier.
 */
export function mapPolarProductToTier(productId: string | undefined, mapEnv: string | undefined): string | null {
  if (!productId || !mapEnv) return null;
  for (const pair of mapEnv.split(',')) {
    const [id, tier] = pair.split(':').map((s) => s.trim());
    if (id === productId && tier) return tier;
  }
  return null;
}

const SUBSCRIPTION_STATUS_MAP: Record<string, string> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  canceled: 'canceled',
  revoked: 'canceled',
};

/** Normalizes a Polar subscription status to our SubscriptionStatus enum. */
export function mapPolarStatus(status: string | undefined): string {
  if (!status) return 'active';
  return SUBSCRIPTION_STATUS_MAP[status] ?? 'expired';
}
