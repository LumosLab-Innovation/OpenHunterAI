import { getPrisma } from '@x-hunter/db';
import { GuardrailError, normalizeUrl } from '@x-hunter/shared';
import type { CreateDomainBody } from './domains.dto.js';

export class DomainsService {
  private readonly prisma = getPrisma();

  list(projectId: string, orgId: string) {
    return this.prisma.domain.findMany({
      where: { projectId, project: { organizationId: orgId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, orgId: string, body: CreateDomainBody) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');
    const hostname = body.hostname.toLowerCase().trim();
    normalizeUrl(`https://${hostname}`);
    return this.prisma.domain.upsert({
      where: { projectId_hostname: { projectId, hostname } },
      update: {},
      create: { projectId, hostname },
    });
  }
}
