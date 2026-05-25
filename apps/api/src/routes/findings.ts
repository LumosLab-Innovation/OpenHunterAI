import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import { getQueue, QUEUE_RETEST, type RetestJobPayload } from '@x-hunter/worker-runtime';
import { requireUser } from '../auth.js';

const StatusChange = z.object({
  status: z.enum([
    'open',
    'in_progress',
    'ready_for_retest',
    'fixed',
    'still_vulnerable',
    'accepted_risk',
  ]),
  reason: z.string().max(2048).optional(),
});

export function registerFindingRoutes(app: FastifyInstance): void {
  app.get('/v1/projects/:id/findings', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const findings = await prisma.finding.findMany({
      where: { projectId: id, project: { organizationId: user.orgId } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
    reply.send({ findings });
  });

  app.get('/v1/findings/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const finding = await prisma.finding.findFirst({
      where: { id, project: { organizationId: user.orgId } },
      include: { retestRuns: { orderBy: { createdAt: 'desc' } }, approvals: true },
    });
    if (!finding) {
      reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      return;
    }
    reply.send({ finding });
  });

  app.post('/v1/findings/:id/status', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = StatusChange.parse(req.body);
    const prisma = getPrisma();
    const finding = await prisma.finding.findFirst({
      where: { id, project: { organizationId: user.orgId } },
    });
    if (!finding) throw new GuardrailError('INVALID_INPUT', 'Finding not found');

    const updated = await prisma.finding.update({
      where: { id: finding.id },
      data: { status: body.status },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: finding.projectId,
        findingId: finding.id,
        eventType: 'finding.status_changed',
        detail: { from: finding.status, to: body.status, reason: body.reason ?? null },
      },
    });
    reply.send({ finding: updated });
  });

  // Manual retest of a single finding (v1: never scan the whole app).
  app.post('/v1/findings/:id/retest', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const finding = await prisma.finding.findFirst({
      where: { id, project: { organizationId: user.orgId } },
      include: { scanJob: true },
    });
    if (!finding) throw new GuardrailError('INVALID_INPUT', 'Finding not found');
    if (!finding.retestScenario) {
      throw new GuardrailError('INVALID_INPUT', 'Finding has no retest scenario');
    }

    const retest = await prisma.retestRun.create({
      data: {
        findingId: finding.id,
        scanJobId: finding.scanJobId,
        kind: finding.severity === 'critical' || finding.severity === 'high' ? 'ai_assisted' : 'auto',
        scopeSnapshot: finding.scanJob.scopeSnapshot ?? {},
        scenarioRef: finding.retestScenario,
      },
    });
    await getQueue<RetestJobPayload>(QUEUE_RETEST).add(
      'retest',
      { retestRunId: retest.id },
      { jobId: retest.id, attempts: 1 },
    );
    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: finding.projectId,
        findingId: finding.id,
        eventType: 'retest.started',
        detail: { retestRunId: retest.id },
      },
    });
    reply.send({ retestRun: retest });
  });
}
