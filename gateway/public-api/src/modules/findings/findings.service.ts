import { publishEvent } from '@openhunter/event-core';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import type { StatusChangeBody } from './findings.dto.js';

export class FindingsService {
  private readonly prisma = getPrisma();

  list(orgId: string) {
    return this.prisma.finding.findMany({
      where: { project: { organizationId: orgId } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  get(id: string, orgId: string) {
    return this.prisma.finding.findFirst({
      where: { id, project: { organizationId: orgId } },
      include: { retestRuns: { orderBy: { createdAt: 'desc' } }, approvals: true },
    });
  }

  async updateStatus(id: string, orgId: string, userId: string, body: StatusChangeBody) {
    const finding = await this.prisma.finding.findFirst({ where: { id, project: { organizationId: orgId } } });
    if (!finding) throw new GuardrailError('INVALID_INPUT', 'Finding not found');
    const updated = await this.prisma.finding.update({ where: { id }, data: { status: body.status } });
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        projectId: finding.projectId,
        findingId: finding.id,
        eventType: 'finding.status_changed',
        detail: { from: finding.status, to: body.status, reason: body.reason ?? null },
      },
    });
    return updated;
  }

  async requestRetest(id: string, orgId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id, project: { organizationId: orgId } },
      include: { scanJob: true, retestRuns: true },
    });
    if (!finding) throw new GuardrailError('INVALID_INPUT', 'Finding not found');
    if (!finding.retestScenario) throw new GuardrailError('INVALID_INPUT', 'Finding has no retest scenario');
    if (finding.scanJob.mode === 'free_hunter' && finding.retestRuns.length >= 1) {
      throw new GuardrailError('PACKAGE_DOES_NOT_PERMIT_ACTION', 'Free Hunter includes one manual retest for the monitored finding');
    }
    const retestRun = await this.prisma.retestRun.create({
      data: {
        findingId: finding.id,
        scanJobId: finding.scanJobId,
        kind: finding.severity === 'critical' || finding.severity === 'high' ? 'ai_assisted' : 'manual',
        scopeSnapshot: finding.scanJob.scopeSnapshot ?? {},
        scenarioRef: finding.retestScenario,
      },
    });
    await publishEvent('retest.requested', buildRetestRequestedPayload(retestRun.id, finding));
    return retestRun;
  }
}

export function buildRetestRequestedPayload(retestRunId: string, finding: {
  id: string;
  scanJobId: string;
  projectId: string;
  retestScenario: unknown;
  scanJob: { id: string; projectId: string; scopeSnapshot: unknown };
}) {
  const scope = (finding.scanJob.scopeSnapshot ?? {}) as {
    scanMode?: unknown;
    targetType?: unknown;
    authScope?: unknown;
    testIntensityMode?: unknown;
    surfaceFlags?: unknown;
    verifiedDomain?: unknown;
    allowedHosts?: unknown;
    allowedPaths?: unknown;
    excludedPaths?: unknown;
  };
  return {
    retestRunId,
    findingId: finding.id,
    scanId: finding.scanJob.id,
    projectId: finding.scanJob.projectId,
    scanMode: typeof scope.scanMode === 'string' ? scope.scanMode : '',
    targetType: typeof scope.targetType === 'string' ? scope.targetType : '',
    authScope: typeof scope.authScope === 'string' ? scope.authScope : '',
    testIntensityMode: typeof scope.testIntensityMode === 'string' ? scope.testIntensityMode : '',
    surfaceFlags: isRecord(scope.surfaceFlags)
      ? Object.fromEntries(Object.entries(scope.surfaceFlags).map(([key, value]) => [key, Boolean(value)]))
      : {},
    verifiedDomain: typeof scope.verifiedDomain === 'string' ? scope.verifiedDomain : '',
    allowedHosts: Array.isArray(scope.allowedHosts) ? scope.allowedHosts.map(String) : [],
    allowedPaths: Array.isArray(scope.allowedPaths) ? scope.allowedPaths.map(String) : [],
    excludedPaths: Array.isArray(scope.excludedPaths) ? scope.excludedPaths.map(String) : [],
    retestScenario: finding.retestScenario,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
