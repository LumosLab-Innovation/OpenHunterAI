import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { requireUser } from '../auth.js';

const CreateProject = z.object({
  name: z.string().min(1).max(120),
  packageTier: z.enum(['free', 'light', 'standard', 'auth', 'launch']).default('free'),
});

export function registerProjectRoutes(app: FastifyInstance): void {
  app.post('/v1/projects', async (req, reply) => {
    const user = await requireUser(req, reply);
    const body = CreateProject.parse(req.body);
    const prisma = getPrisma();
    const project = await prisma.project.create({
      data: {
        name: body.name,
        organizationId: user.orgId,
        packageTier: body.packageTier,
      },
    });
    reply.send({ project });
  });

  app.get('/v1/projects', async (req, reply) => {
    const user = await requireUser(req, reply);
    const prisma = getPrisma();
    const projects = await prisma.project.findMany({
      where: { organizationId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    reply.send({ projects });
  });

  app.get('/v1/projects/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id, organizationId: user.orgId },
      include: {
        domains: { include: { verifications: { orderBy: { createdAt: 'desc' } } } },
        scanAuthorizations: { orderBy: { createdAt: 'desc' } },
        testAccounts: true,
      },
    });
    if (!project) {
      reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      return;
    }
    reply.send({ project });
  });
}
