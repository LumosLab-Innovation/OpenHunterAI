import { getPrisma } from '@x-hunter/db';
import { sanitizeText } from '@x-hunter/shared';

/**
 * Approval gate for sensitive worker actions. When a scan's validation level is
 * approval_gated_validation, a worker must create an ApprovalRequest and wait
 * for a human ApprovalDecision before performing the action (AGENTS §4.3,
 * SECURITY_GUARDRAILS sensitive-action gate). The worker never performs the
 * action on its own authority.
 */

export interface CreateApprovalInput {
  findingId?: string;
  action: string;
  target: string;
  testAccount?: string;
  willNotPerform?: string[];
  residualRisk?: string;
  /** Minutes until the request auto-expires. Default 60. */
  expiresInMinutes?: number;
}

type ApprovalState = 'pending' | 'approved' | 'denied' | 'expired';

export class ApprovalService {
  private readonly prisma = getPrisma();

  /**
   * Creates a pending approval request for a sensitive action. The action and
   * target are sanitized; raw evidence/credentials must never be passed here.
   */
  async create(scanId: string, input: CreateApprovalInput) {
    const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 60) * 60_000);
    return this.prisma.approvalRequest.create({
      data: {
        scanJobId: scanId,
        findingId: input.findingId ?? null,
        action: sanitizeText(input.action).slice(0, 200),
        target: sanitizeText(input.target).slice(0, 500),
        testAccount: input.testAccount ? sanitizeText(input.testAccount).slice(0, 200) : null,
        willNotPerform: (input.willNotPerform ?? []).map((w) => sanitizeText(w).slice(0, 200)),
        residualRisk: sanitizeText(input.residualRisk ?? 'Not specified').slice(0, 500),
        state: 'pending',
        expiresAt,
      },
    });
  }

  /**
   * Returns the current decision status for an approval request. Auto-expires a
   * pending request whose deadline has passed so a worker never waits forever.
   */
  async status(approvalId: string): Promise<{ state: ApprovalState | null; expired: boolean }> {
    const request = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!request) return { state: null, expired: false };

    if (request.state === 'pending' && request.expiresAt < new Date()) {
      const updated = await this.prisma.approvalRequest.update({
        where: { id: approvalId },
        data: { state: 'expired' },
      });
      return { state: updated.state as ApprovalState, expired: true };
    }
    return { state: request.state as ApprovalState, expired: request.state === 'expired' };
  }
}
