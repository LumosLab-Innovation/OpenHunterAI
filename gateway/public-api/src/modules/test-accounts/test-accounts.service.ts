import { getPrisma } from '@x-hunter/db';
import { encryptString, GuardrailError, sanitizeText } from '@x-hunter/shared';
import type { CreateTestAccountBody } from './test-accounts.dto.js';

export class TestAccountsService {
  private readonly prisma = getPrisma();

  async list(projectId: string, orgId: string) {
    await this.assertProject(projectId, orgId);
    const accounts = await this.prisma.testAccount.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        projectId: true,
        label: true,
        loginUrl: true,
        identityEmail: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        browserSessionStates: {
          where: { status: 'active' },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { id: true, status: true, expiresAt: true, completedAt: true },
        },
      },
    });
    return accounts.map((account) => {
      const session = (account as any).browserSessionStates?.[0];
      const { browserSessionStates: _browserSessionStates, ...rest } = account as any;
      return {
        ...rest,
        loginSession: session
          ? {
              id: session.id,
              status: session.expiresAt.getTime() > Date.now() ? session.status : 'expired',
              expiresAt: session.expiresAt.toISOString(),
              completedAt: session.completedAt?.toISOString() ?? null,
            }
          : null,
      };
    });
  }

  async create(projectId: string, orgId: string, body: CreateTestAccountBody) {
    await this.assertProject(projectId, orgId);
    const credentialCipher = encryptString(
      JSON.stringify({
        username: body.username?.trim() || null,
        ...(body.password ? { password: body.password } : {}),
      }),
    ).ciphertext;

    const account = await this.prisma.testAccount.create({
      data: {
        projectId,
        label: sanitizeText(body.label).slice(0, 80),
        loginUrl: body.loginUrl,
        credentialCipher,
        identityEmail: body.username?.trim() ? body.username.trim().slice(0, 256) : null,
        notes: body.notes ? sanitizeText(body.notes).slice(0, 1024) : null,
      },
      select: {
        id: true,
        projectId: true,
        label: true,
        loginUrl: true,
        identityEmail: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return account;
  }

  async delete(projectId: string, accountId: string, orgId: string) {
    await this.assertProject(projectId, orgId);
    const account = await this.prisma.testAccount.findFirst({
      where: { id: accountId, projectId },
      select: { id: true },
    });
    if (!account) throw new GuardrailError('INVALID_INPUT', 'Test account not found');
    await this.prisma.testAccount.delete({ where: { id: account.id } });
    return { ok: true };
  }

  private async assertProject(projectId: string, orgId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');
  }
}
