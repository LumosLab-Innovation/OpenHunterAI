import { publishEvent } from '@openhunter/event-core';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import type { CreateScanBody } from './scans.dto.js';

export class ScansService {
  private readonly prisma = getPrisma();

  list(orgId: string) {
    return this.prisma.scanJob.findMany({
      where: { project: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  get(id: string, orgId: string) {
    return this.prisma.scanJob.findFirst({
      where: { id, project: { organizationId: orgId } },
      include: { steps: true },
    });
  }

  async create(projectId: string, orgId: string, userId: string, body: CreateScanBody) {
    const authz = await this.prisma.scanAuthorization.findFirst({
      where: { id: body.authorizationId, projectId, project: { organizationId: orgId } },
    });
    if (!authz) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Scan authorization not found');
    if (authz.expiresAt && authz.expiresAt < new Date()) {
      throw new GuardrailError('AUTHORIZATION_EXPIRED', 'Scan authorization expired');
    }
    if (body.mode !== authz.scanPackage) {
      throw new GuardrailError(
        'PACKAGE_DOES_NOT_PERMIT_ACTION',
        `Scan mode ${body.mode} requires matching authorization package ${authz.scanPackage}`,
      );
    }

    const domain = await this.prisma.domain.findUnique({ where: { id: authz.domainId } });
    const scope = {
      allowedHosts: authz.allowedHosts as string[],
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
      testAccountPermission: authz.testAccountPermission,
      sensitiveActionPermission: authz.sensitiveActionPermission,
      scanPackage: authz.scanPackage,
      verifiedDomain: domain?.hostname ?? '',
      capturedAt: new Date().toISOString(),
    };

    const scan = await this.prisma.scanJob.create({
      data: {
        projectId,
        authorizationId: authz.id,
        initiatorUserId: userId,
        mode: body.mode,
        state: 'queued',
        scopeSnapshot: scope,
      },
    });
    await publishEvent('scan.created', {
      scanId: scan.id,
      projectId,
      authorizationId: authz.id,
      mode: body.mode,
      scope,
    });
    return scan;
  }
}
