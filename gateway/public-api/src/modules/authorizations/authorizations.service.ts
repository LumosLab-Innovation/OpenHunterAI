import { getPrisma } from '@x-hunter/db';
import { authScopeRequiresAccounts, GuardrailError, normalizeUrl, packageAllowsScanMode } from '@x-hunter/shared';
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
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { packageTier: true },
    });
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');
    if (!packageAllowsScanMode(project.packageTier, body.scanMode)) {
      throw new GuardrailError(
        'PACKAGE_DOES_NOT_PERMIT_ACTION',
        `Package ${project.packageTier} does not permit scan mode ${body.scanMode}`,
      );
    }

    const allowedHosts = normalizeAllowedHostsForAuthorization(body.allowedHosts);
    const domains = await this.prisma.domain.findMany({
      where: {
        projectId,
        project: { organizationId: orgId },
        hostname: { in: allowedHosts },
        verifications: {
          some: {
            status: 'verified',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, hostname: true },
    });
    const verifiedHosts = new Set(domains.map((domain: { hostname: string }) => domain.hostname.toLowerCase()));
    const unverifiedHosts = allowedHosts.filter((host) => !verifiedHosts.has(host));
    if (unverifiedHosts.length > 0) {
      throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Every allowed host must be verified before authorization', {
        unverifiedHosts,
      });
    }
    const domain = domains[0];

    const requiredAccounts = authScopeRequiresAccounts(body.authScope);
    if (requiredAccounts > 0) {
      const testAccountCount = await this.prisma.testAccount.count({ where: { projectId } });
      if (testAccountCount < requiredAccounts) {
        throw new GuardrailError(
          'TEST_ACCOUNT_REQUIRED',
          `Auth scope ${body.authScope} requires at least ${requiredAccounts} test account(s)`,
        );
      }
    }
    if (body.testIntensityMode === 'aggressive_staging' && !body.aggressiveStagingRiskAccepted) {
      throw new GuardrailError(
        'RISK_ACCEPTANCE_REQUIRED',
        'Aggressive Staging requires explicit staging/dev/test risk acceptance',
      );
    }

    return this.prisma.scanAuthorization.create({
      data: {
        projectId,
        domainId: domain.id,
        scanMode: body.scanMode,
        authScope: body.authScope,
        targetType: body.targetType,
        testIntensityMode: body.testIntensityMode,
        surfaceFlags: body.surfaceFlags,
        allowedHosts,
        allowedPaths: body.allowedPaths,
        excludedPaths: body.excludedPaths,
        testAccountPermission: body.authScope !== 'none',
        sensitiveActionPermission: body.testIntensityMode === 'aggressive_staging',
        aggressiveStagingRiskAccepted: body.aggressiveStagingRiskAccepted,
        consentText: body.consentText,
        acceptedByUserId: userId,
      },
    });
  }
}

export function normalizeAllowedHostsForAuthorization(hosts: string[]): string[] {
  return [
    ...new Set(
      hosts.map((host) => {
        const trimmed = host.trim().toLowerCase();
        return normalizeUrl(`https://${trimmed}`).hostname;
      }),
    ),
  ];
}
