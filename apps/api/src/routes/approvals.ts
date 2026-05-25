import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import { requireUser } from '../auth.js';

const DecideBody = z.object({
  decision: z.enum(['approved', 'denied']),
  reason: z.string().max(2048).optional(),
});

export function registerApprovalRoutes(app: FastifyInstance): void {
  app.get('/v1/scans/:id/approvals', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const list = await prisma.approvalRequest.findMany({
      where: { scanJobId: id, scanJob: { project: { organizationId: user.orgId } } },
      orderBy: { createdAt: 'desc' },
    });
    reply.send({ approvals: list });
  });

  app.post('/v1/approvals/:id/decision', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = DecideBody.parse(req.body);
    const prisma = getPrisma();
    const ar = await prisma.approvalRequest.findFirst({
      where: { id, scanJob: { project: { organizationId: user.orgId } } },
    });
    if (!ar) throw new GuardrailError('INVALID_INPUT', 'Approval not found');
    if (ar.state !== 'pending') {
      throw new GuardrailError('INVALID_INPUT', `Approval already ${ar.state}`);
    }
    if (ar.expiresAt < new Date()) {
      throw new GuardrailError('INVALID_INPUT', 'Approval expired');
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: ar.id },
      data: { state: body.decision },
    });
    await prisma.approvalDecision.create({
      data: {
        approvalRequestId: ar.id,
        decidedByUserId: user.userId,
        decision: body.decision,
        reason: body.reason ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        scanJobId: ar.scanJobId,
        findingId: ar.findingId ?? null,
        eventType: body.decision === 'approved' ? 'approval.accepted' : 'approval.denied',
        detail: { approvalId: ar.id, action: ar.action },
      },
    });
    reply.send({ approval: updated });
  });
}
