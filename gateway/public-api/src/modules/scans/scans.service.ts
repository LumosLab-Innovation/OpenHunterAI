import { publishEvent } from '@openhunter/event-core';
import { getPrisma } from '@x-hunter/db';
import { buildScanPlan, DEFAULT_SURFACE_FLAGS, GuardrailError, type SurfaceFlags } from '@x-hunter/shared';
import { createInitialReportDraft } from '../reports/reports.service.js';
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
      include: { steps: true, reports: { orderBy: { version: 'desc' } }, reportDraftSections: true },
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
    const domain = await this.prisma.domain.findUnique({ where: { id: authz.domainId } });
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const surfaceFlags = { ...DEFAULT_SURFACE_FLAGS, ...(authz.surfaceFlags as Partial<SurfaceFlags>) };
    const scope = {
      allowedHosts: authz.allowedHosts as string[],
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
      testAccountPermission: authz.testAccountPermission,
      sensitiveActionPermission: authz.sensitiveActionPermission,
      packageTier: project?.packageTier ?? 'free_hunter',
      scanMode: authz.scanMode,
      authScope: authz.authScope,
      targetType: authz.targetType,
      testIntensityMode: authz.testIntensityMode,
      surfaceFlags,
      aggressiveStagingRiskAccepted: authz.aggressiveStagingRiskAccepted,
      verifiedDomain: domain?.hostname ?? '',
      capturedAt: new Date().toISOString(),
    };
    const scanPlan = buildScanPlan({
      packageTier: scope.packageTier,
      scanMode: authz.scanMode,
      targetType: authz.targetType,
      surfaceFlags,
      authScope: authz.authScope,
      testIntensityMode: authz.testIntensityMode,
      allowedHosts: scope.allowedHosts,
      allowedPaths: scope.allowedPaths,
      excludedPaths: scope.excludedPaths,
    });

    const scan = await this.prisma.scanJob.create({
      data: {
        projectId,
        authorizationId: authz.id,
        initiatorUserId: userId,
        mode: authz.scanMode,
        targetType: authz.targetType,
        authScope: authz.authScope,
        testIntensityMode: authz.testIntensityMode,
        surfaceFlags,
        scanPlan,
        state: 'queued',
        scopeSnapshot: scope,
      },
    });
    await createInitialReportDraft(this.prisma, scan.id);
    await publishEvent('scan.created', {
      scanId: scan.id,
      projectId,
      authorizationId: authz.id,
      mode: authz.scanMode,
      scope,
      scanPlan,
    });
    return scan;
  }
}
