import { getPrisma } from '@x-hunter/db';
import { assertInScope, authScopeRequiresAccounts, DEFAULT_SURFACE_FLAGS, GuardrailError, intensityToProfile, normalizeUrl } from '@x-hunter/shared';
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
      select: { id: true },
    });
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');

    const allowedHosts = normalizeAllowedHostsForAuthorization(body.allowedHosts);
    if (body.targetUrl) {
      if (/[?#]/.test(body.targetUrl)) {
        throw new GuardrailError('INVALID_INPUT', 'The target URL must not contain a query or fragment');
      }
      const target = normalizeUrl(body.targetUrl);
      if (target.url.protocol !== 'https:' || target.url.port || target.url.search || target.url.hash) {
        throw new GuardrailError('INVALID_INPUT', 'The target URL must be public HTTPS without port, query, or fragment');
      }
      assertInScope(target.url.href, {
        allowedHosts,
        allowedPaths: body.allowedPaths,
        excludedPaths: body.excludedPaths,
        testAccountPermission: body.authScope !== 'none',
        sensitiveActionPermission: body.testIntensityMode === 'aggressive_staging',
        profile: intensityToProfile(body.testIntensityMode),
        authScope: body.authScope,
        targetType: body.targetType,
        testIntensityMode: body.testIntensityMode,
        surfaceFlags: { ...DEFAULT_SURFACE_FLAGS, ...body.surfaceFlags },
        aggressiveStagingRiskAccepted: body.aggressiveStagingRiskAccepted,
      });
    }
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

    // The domain row remains as a compatibility anchor for existing scans and
    // reports. Ownership proof is no longer a self-host prerequisite; the user
    // explicitly accepts responsibility for this exact scope instead.
    const domain = await this.prisma.domain.upsert({
      where: { projectId_hostname: { projectId, hostname: allowedHosts[0]! } },
      create: { projectId, hostname: allowedHosts[0]! },
      update: {},
      select: { id: true },
    });

    return this.prisma.scanAuthorization.create({
      data: {
        projectId,
        domainId: domain.id,
        targetUrl: body.targetUrl ?? null,
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
        const normalized = normalizeUrl(`https://${trimmed}`);
        if (trimmed !== normalized.hostname || !/^[a-z0-9.-]+$/.test(trimmed)) {
          throw new GuardrailError('INVALID_INPUT', 'Allowed hosts must be bare public hostnames without scheme, path, port, or credentials');
        }
        return normalized.hostname;
      }),
    ),
  ];
}
