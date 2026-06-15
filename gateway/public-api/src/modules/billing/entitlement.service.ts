import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';

/**
 * Entitlement check applied before a scan is created. Enforces that the project
 * is allowed to run the requested package tier:
 *   - free_hunter: always allowed (quota is enforced by the scan plan / cooldown).
 *   - enterprise_payg: requires a positive credit balance; one credit is consumed
 *     per scan (recorded as a negative CreditEntry).
 *   - ai_blackhat_mindset_check / monitor_workspace: require an active subscription
 *     for the org (or project) covering that tier.
 *
 * The check + credit deduction run inside the caller's flow so a scan is never
 * created without a corresponding entitlement.
 */
export class EntitlementService {
  private readonly prisma = getPrisma();

  /** Sum of the project's credit ledger. */
  async creditBalance(projectId: string): Promise<number> {
    const rows = await this.prisma.creditEntry.findMany({ where: { projectId }, select: { delta: true } });
    return rows.reduce((sum: number, r: { delta: number }) => sum + r.delta, 0);
  }

  /**
   * Asserts the project may run a scan at the given tier and consumes a credit
   * for PAYG. Throws GuardrailError when not entitled. Returns nothing on success.
   */
  async assertCanScan(projectId: string, orgId: string, packageTier: string): Promise<void> {
    if (packageTier === 'free_hunter') return;

    if (packageTier === 'enterprise_payg') {
      const balance = await this.creditBalance(projectId);
      if (balance <= 0) {
        throw new GuardrailError('INSUFFICIENT_CREDITS', 'Top up credits to run a PAYG scan');
      }
      // Consume one credit per scan.
      await this.prisma.creditEntry.create({
        data: { projectId, delta: -1, reason: 'scan_payg', refType: 'scan', refId: null },
      });
      return;
    }

    // Subscription tiers: require an active subscription covering this tier.
    const sub = await this.prisma.subscription.findFirst({
      where: {
        organizationId: orgId,
        status: 'active',
        packageTier: packageTier as never,
        OR: [{ projectId: null }, { projectId }],
      },
    });
    if (!sub) {
      throw new GuardrailError('NO_ACTIVE_SUBSCRIPTION', `No active subscription for ${packageTier}`);
    }
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
      throw new GuardrailError('SUBSCRIPTION_EXPIRED', 'Subscription period has ended');
    }
  }
}
