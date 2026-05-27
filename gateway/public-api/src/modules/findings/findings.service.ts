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
      include: { scanJob: true },
    });
    if (!finding) throw new GuardrailError('INVALID_INPUT', 'Finding not found');
    if (!finding.retestScenario) throw new GuardrailError('INVALID_INPUT', 'Finding has no retest scenario');
    const retestRun = await this.prisma.retestRun.create({
      data: {
        findingId: finding.id,
        scanJobId: finding.scanJobId,
        kind: finding.severity === 'critical' || finding.severity === 'high' ? 'ai_assisted' : 'auto',
        scopeSnapshot: finding.scanJob.scopeSnapshot ?? {},
        scenarioRef: finding.retestScenario,
      },
    });
    await publishEvent('retest.requested', { retestRunId: retestRun.id, findingId: finding.id });
    return retestRun;
  }
}
