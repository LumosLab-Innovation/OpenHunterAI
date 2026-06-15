import { getPrisma } from '@x-hunter/db';
import type { CreateProjectBody } from './projects.dto.js';

export class ProjectsRepository {
  private readonly prisma = getPrisma();

  list(orgId: string) {
    return this.prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(orgId: string, body: CreateProjectBody) {
    return this.prisma.project.create({
      data: { organizationId: orgId, name: body.name, packageTier: body.packageTier },
    });
  }

  find(projectId: string, orgId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });
  }

  delete(projectId: string) {
    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }
}
