import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError, normalizeUrl } from '@x-hunter/shared';
import { requireUser } from '../auth.js';

const HostList = z.array(z.string().min(1).max(253));
const PathList = z.array(z.string().min(1).max(2048));

const CreateAuth = z.object({
  domainId: z.string(),
  scanPackage: z.enum(['free', 'light', 'standard', 'auth', 'launch']),
  allowedHosts: HostList,
  allowedPaths: PathList.default([]),
  excludedPaths: PathList.default([]),
  testAccountPermission: z.boolean().default(false),
  sensitiveActionPermission: z.boolean().default(false),
  consentText: z.string().min(10).max(4096),
  expiresAt: z.string().datetime().optional(),
});

export function registerAuthorizationRoutes(app: FastifyInstance): void {
  app.post('/v1/projects/:id/scan-authorizations', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = CreateAuth.parse(req.body);
    const prisma = getPrisma();

    const project = await prisma.project.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');

    const domain = await prisma.domain.findFirst({
      where: { id: body.domainId, projectId: id },
      include: { verifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!domain) throw new GuardrailError('INVALID_INPUT', 'Domain not found');
    const v = domain.verifications[0];
    if (!v || v.status !== 'verified') {
      throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Domain is not verified');
    }
    if (v.expiresAt && v.expiresAt < new Date()) {
      throw new GuardrailError('VERIFICATION_EXPIRED', 'Domain verification has expired');
    }

    // Sanity-check allowed hosts: each must normalize (i.e. not be IP literal or private).
    for (const h of body.allowedHosts) {
      try {
        normalizeUrl(`https://${h.replace(/^\*\./, '')}`);
      } catch (e) {
        throw e;
      }
    }
    if (!body.allowedHosts.some((h) => h.toLowerCase() === domain.hostname)) {
      throw new GuardrailError('INVALID_INPUT', 'allowedHosts must include the verified domain');
    }

    const authz = await prisma.scanAuthorization.create({
      data: {
        projectId: id,
        domainId: domain.id,
        scanPackage: body.scanPackage,
        allowedHosts: body.allowedHosts,
        allowedPaths: body.allowedPaths,
        excludedPaths: body.excludedPaths,
        testAccountPermission: body.testAccountPermission,
        sensitiveActionPermission: body.sensitiveActionPermission,
        consentText: body.consentText,
        acceptedByUserId: user.userId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: id,
        eventType: 'scan_authorization.created',
        detail: { authorizationId: authz.id, package: body.scanPackage },
      },
    });

    reply.send({ authorization: authz });
  });
}
