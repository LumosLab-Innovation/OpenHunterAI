import { getPrisma } from '@x-hunter/db';

export class ReportsService {
  private readonly prisma = getPrisma();

  get(id: string, orgId: string) {
    return this.prisma.report.findFirst({ where: { id, project: { organizationId: orgId } } });
  }
}
