import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError, encryptString, normalizeUrl } from '@x-hunter/shared';
import { requireUser } from '../auth.js';

const CreateTestAccount = z.object({
  label: z.string().min(1).max(64),
  loginUrl: z.string().url(),
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
  totpSecret: z.string().optional(),
  identityEmail: z.string().email().optional(),
  notes: z.string().max(512).optional(),
});

export function registerTestAccountRoutes(app: FastifyInstance): void {
  app.post('/v1/projects/:id/test-accounts', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = CreateTestAccount.parse(req.body);
    const prisma = getPrisma();

    const project = await prisma.project.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');

    // login URL must normalize cleanly (not private/local/metadata).
    normalizeUrl(body.loginUrl);

    // Confirm the login_url hostname is verified for this project.
    const loginHost = new URL(body.loginUrl).hostname.toLowerCase();
    const verifiedDomain = await prisma.domain.findFirst({
      where: {
        projectId: id,
        hostname: loginHost,
        verifications: { some: { status: 'verified' } },
      },
    });
    if (!verifiedDomain) {
      throw new GuardrailError(
        'DOMAIN_NOT_VERIFIED',
        'login_url hostname must be a verified domain on this project',
      );
    }

    const cipher = encryptString(
      JSON.stringify({ username: body.username, password: body.password, totpSecret: body.totpSecret }),
    );

    const acct = await prisma.testAccount.create({
      data: {
        projectId: id,
        label: body.label,
        loginUrl: body.loginUrl,
        credentialCipher: cipher.ciphertext,
        identityEmail: body.identityEmail ?? null,
        notes: body.notes ?? null,
      },
      select: {
        id: true,
        label: true,
        loginUrl: true,
        identityEmail: true,
        notes: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: id,
        eventType: 'test_account.created',
        detail: { testAccountId: acct.id, loginUrlHost: loginHost },
      },
    });

    reply.send({ testAccount: acct });
  });

  app.delete('/v1/test-accounts/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const acct = await prisma.testAccount.findFirst({
      where: { id, project: { organizationId: user.orgId } },
    });
    if (!acct) throw new GuardrailError('INVALID_INPUT', 'Test account not found');
    await prisma.testAccount.delete({ where: { id: acct.id } });
    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: acct.projectId,
        eventType: 'test_account.deleted',
        detail: { testAccountId: id },
      },
    });
    reply.send({ ok: true });
  });
}
