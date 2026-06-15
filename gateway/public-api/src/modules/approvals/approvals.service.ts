import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';

/**
 * Human-facing approval decisions. A user (owner/admin) approves or denies a
 * pending ApprovalRequest created by a worker for a sensitive action. The worker
 * polls internal-api and only proceeds once the decision is 'approved'.
 */
export class ApprovalsService {
  private readonly prisma = getPrisma();

  /** Lists approval requests for the org, newest first, optionally pending-only. */
  list(orgId: string, pendingOnly: boolean) {
    return this.prisma.approvalRequest.findMany({
      where: {
        scanJob: { project: { organizationId: orgId } },
        ...(pendingOnly ? { state: 'pending' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { decision: true },
      take: 100,
    });
  }

  /**
   * Records a decision on a pending approval request. Validates org ownership,
   * that the request is still pending, and that it has not expired. Writes the
   * decision and flips the request state in a single transaction.
   */
  async decide(approvalId: string, orgId: string, userId: string, decision: 'approved' | 'denied', reason?: string) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, scanJob: { project: { organizationId: orgId } } },
      include: { scanJob: true },
    });
    if (!request) throw new GuardrailError('INVALID_INPUT', 'Approval request not found');
    if (request.state !== 'pending') {
      throw new GuardrailError('INVALID_INPUT', `Approval request is already ${request.state}`);
    }
    if (request.expiresAt < new Date()) {
      await this.prisma.approvalRequest.update({ where: { id: approvalId }, data: { state: 'expired' } });
      throw new GuardrailError('INVALID_INPUT', 'Approval request has expired');
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.approvalDecision.create({
        data: {
          approvalRequestId: approvalId,
          decidedByUserId: userId,
          decision,
          reason: reason ?? null,
        },
      }),
      this.prisma.approvalRequest.update({ where: { id: approvalId }, data: { state: decision } }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        scanJobId: request.scanJobId,
        findingId: request.findingId,
        eventType: 'approval.decided',
        detail: { approvalId, decision, reason: reason ?? null },
      },
    });
    return updated;
  }
}
