import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { requireUser } from '../auth.js';

export function registerReportRoutes(app: FastifyInstance): void {
  app.get('/v1/reports/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const report = await prisma.report.findFirst({
      where: { id, project: { organizationId: user.orgId } },
    });
    if (!report) {
      reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      return;
    }
    reply.send({ report });
  });

  app.get('/v1/scans/:id/reports', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const reports = await prisma.report.findMany({
      where: { scanJobId: id, project: { organizationId: user.orgId } },
      orderBy: { generatedAt: 'desc' },
    });
    reply.send({ reports });
  });
}
