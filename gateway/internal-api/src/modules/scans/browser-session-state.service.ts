import { getPrisma } from '@x-hunter/db';
import { decryptString } from '@x-hunter/shared';

export class BrowserSessionStateService {
  private readonly prisma = getPrisma();

  async getForScan(scanId: string) {
    const scan = await this.prisma.scanJob.findUnique({
      where: { id: scanId },
      select: {
        projectId: true,
        authScope: true,
        project: { select: { organizationId: true } },
      },
    });
    if (!scan || scan.authScope === 'none') return null;

    const session = await (this.prisma as any).browserSessionState.findFirst({
      where: {
        organizationId: scan.project.organizationId,
        projectId: scan.projectId,
        status: 'active',
        expiresAt: { gt: new Date() },
        storageStateCipher: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: {
        finalUrl: true,
        expiresAt: true,
        storageStateCipher: true,
      },
    });
    if (!session?.storageStateCipher) return null;

    return {
      finalUrl: session.finalUrl,
      expiresAt: session.expiresAt.toISOString(),
      storageState: JSON.parse(decryptString(session.storageStateCipher)),
    };
  }
}
