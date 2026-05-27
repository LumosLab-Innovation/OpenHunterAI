import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import type { CreateAuthorizationBody } from './authorizations.dto.js';

export class AuthorizationsService {
  private readonly prisma = getPrisma();

  list(projectId: string, orgId: string) {
    return this.prisma.scanAuthorization.findMany({
      where: { projectId, project: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, orgId: string, userId: string, body: CreateAuthorizationBody) {
    const domain = await this.prisma.domain.findFirst({
      where: { projectId, project: { organizationId: orgId }, hostname: { in: body.allowedHosts } },
    });
    if (!domain) throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Allowed host must be added as a project domain first');
    return this.prisma.scanAuthorization.create({
      data: {
        projectId,
        domainId: domain.id,
        scanPackage: body.scanPackage,
        allowedHosts: body.allowedHosts,
        allowedPaths: body.allowedPaths,
        excludedPaths: body.excludedPaths,
        testAccountPermission: body.testAccountPermission,
        sensitiveActionPermission: body.sensitiveActionPermission,
        consentText: body.consentText,
        acceptedByUserId: userId,
      },
    });
  }
}
