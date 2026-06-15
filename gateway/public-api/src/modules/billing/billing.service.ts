import { getPrisma } from '@x-hunter/db';
import { sanitize } from '@x-hunter/shared';
import { extractPaymentRef, sepayEventId, type SePayWebhookBody } from './sepay.js';
import { mapPolarProductToTier, mapPolarStatus, polarEventId, type PolarWebhookBody } from './polar.js';

/**
 * Billing service: processes payment provider webhooks idempotently and applies
 * their effects (credit grant for SePay top-ups, subscription + package tier for
 * Polar). Every webhook is recorded in webhook_events keyed by (provider,
 * eventId); a duplicate delivery is a no-op so credits are never double-granted.
 */
export class BillingService {
  private readonly prisma = getPrisma();

  /** Records a webhook event for idempotency. Returns false if already seen. */
  private async claimEvent(provider: 'sepay' | 'polar', eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({ data: { provider, eventId, eventType } });
      return true;
    } catch {
      // Unique violation => already processed.
      return false;
    }
  }

  /**
   * Processes a verified SePay webhook. Matches the incoming transfer to a
   * pending Payment by our embedded reference, marks it paid, and grants credits
   * in a single transaction. Ignores non-incoming transfers.
   */
  async handleSePay(body: SePayWebhookBody): Promise<{ processed: boolean; reason?: string }> {
    if (body.transferType && body.transferType !== 'in') {
      return { processed: false, reason: 'NOT_INCOMING' };
    }
    const eventId = sepayEventId(body);
    if (!(await this.claimEvent('sepay', eventId, 'transfer'))) {
      return { processed: false, reason: 'DUPLICATE' };
    }
    const ref = extractPaymentRef(body.content);
    if (!ref) return { processed: false, reason: 'NO_REFERENCE' };

    const payment = await this.prisma.payment.findUnique({ where: { id: ref } });
    if (!payment || payment.provider !== 'sepay') return { processed: false, reason: 'PAYMENT_NOT_FOUND' };
    if (payment.status === 'paid') return { processed: false, reason: 'ALREADY_PAID' };
    // Defense: the received amount must cover the expected amount.
    if (Number(body.transferAmount) < payment.amount) {
      return { processed: false, reason: 'AMOUNT_MISMATCH' };
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'paid', providerRef: String(body.id), metadata: sanitize({ referenceCode: body.referenceCode }) as object },
      });
      if (payment.creditDelta && payment.projectId) {
        await tx.creditEntry.create({
          data: { projectId: payment.projectId, delta: payment.creditDelta, reason: 'sepay_topup', refType: 'payment', refId: payment.id },
        });
      }
    });
    return { processed: true };
  }

  /**
   * Processes a verified Polar webhook. Handles order.paid (one-time) and
   * subscription lifecycle events, upserting the subscription and syncing the
   * project package tier when a subscription is active.
   */
  async handlePolar(body: PolarWebhookBody, webhookId: string): Promise<{ processed: boolean; reason?: string }> {
    const eventId = polarEventId(webhookId);
    if (!(await this.claimEvent('polar', eventId, body.type))) {
      return { processed: false, reason: 'DUPLICATE' };
    }

    const orgId = body.data.metadata?.organizationId as string | undefined;
    if (!orgId) return { processed: false, reason: 'NO_ORG' };

    if (body.type.startsWith('subscription')) {
      const tier = mapPolarProductToTier(body.data.product_id, process.env.POLAR_PRODUCT_MAP);
      if (!tier) return { processed: false, reason: 'UNMAPPED_PRODUCT' };
      const status = mapPolarStatus(body.data.status);
      const projectId = body.data.metadata?.projectId as string | undefined;

      await this.prisma.$transaction(async (tx: any) => {
        await tx.subscription.upsert({
          where: { provider_externalId: { provider: 'polar', externalId: body.data.id } },
          create: {
            organizationId: orgId,
            projectId: projectId ?? null,
            provider: 'polar',
            externalId: body.data.id,
            status: status as never,
            packageTier: tier as never,
            currentPeriodEnd: body.data.current_period_end ? new Date(body.data.current_period_end) : null,
          },
          update: {
            status: status as never,
            packageTier: tier as never,
            currentPeriodEnd: body.data.current_period_end ? new Date(body.data.current_period_end) : null,
          },
        });
        // Sync the package tier onto the project while the subscription is active.
        if (projectId && status === 'active') {
          await tx.project.update({ where: { id: projectId }, data: { packageTier: tier as never } });
        }
      });
      return { processed: true };
    }

    if (body.type === 'order.paid' || body.type === 'order.created') {
      await this.prisma.payment.upsert({
        where: { provider_providerRef: { provider: 'polar', providerRef: body.data.id } },
        create: {
          organizationId: orgId,
          provider: 'polar',
          providerRef: body.data.id,
          amount: 0,
          currency: 'USD',
          status: 'paid',
        },
        update: { status: 'paid' },
      });
      return { processed: true };
    }
    return { processed: false, reason: 'UNHANDLED_TYPE' };
  }
}
