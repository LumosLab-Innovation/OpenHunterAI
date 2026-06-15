import { getPrisma } from '@x-hunter/db';

/**
 * Polar checkout client. Creates a hosted checkout session for a package tier
 * and embeds metadata.organizationId / metadata.projectId so the webhook can map
 * the resulting subscription back to the org/project (billing.service handlePolar
 * reads exactly these metadata fields).
 *
 * NOTE: Polar API shape (v1) — verify against the current Polar docs when wiring
 * a real token:
 *   POST {POLAR_API_BASE}/v1/checkouts/
 *   Authorization: Bearer <organization access token>
 *   body: { products: [productId], success_url, metadata }
 *   response: { url, id, ... }
 */

const POLAR_API_BASE = process.env.POLAR_API_BASE || 'https://api.polar.sh';

// Reverse of POLAR_PRODUCT_MAP (productId:tier,...): tier -> productId.
function tierToProductId(tier: string): string | null {
  const mapEnv = process.env.POLAR_PRODUCT_MAP;
  if (!mapEnv) return null;
  for (const pair of mapEnv.split(',')) {
    const [id, t] = pair.split(':').map((s) => s.trim());
    if (t === tier && id) return id;
  }
  return null;
}

export interface CreateCheckoutInput {
  orgId: string;
  projectId?: string;
  tier: string;
  successUrl: string;
}

export interface CheckoutResult {
  url: string;
  id: string;
}

export class PolarService {
  private readonly prisma = getPrisma();

  /** True when a Polar access token is configured (checkout is usable). */
  isConfigured(): boolean {
    return Boolean(process.env.POLAR_ACCESS_TOKEN);
  }

  /**
   * Creates a Polar checkout session for the given tier. Throws a typed error
   * (message) on misconfiguration or API failure so the route can map it to a
   * clean HTTP status.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const token = process.env.POLAR_ACCESS_TOKEN;
    if (!token) throw new PolarError('POLAR_NOT_CONFIGURED', 'Polar access token is not set');

    const productId = tierToProductId(input.tier);
    if (!productId) throw new PolarError('UNMAPPED_TIER', `No Polar product mapped for tier ${input.tier}`);

    const res = await fetch(`${POLAR_API_BASE}/v1/checkouts/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        products: [productId],
        success_url: input.successUrl,
        // The webhook handler reads exactly these keys.
        metadata: {
          organizationId: input.orgId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new PolarError('POLAR_API_ERROR', `Polar checkout failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { url?: string; id?: string };
    if (!data.url || !data.id) {
      throw new PolarError('POLAR_BAD_RESPONSE', 'Polar response missing url/id');
    }
    return { url: data.url, id: data.id };
  }
}

export class PolarError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PolarError';
  }
}
