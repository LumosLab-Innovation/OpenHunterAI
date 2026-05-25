import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import { GuardrailError } from '@x-hunter/shared';
import { getQueue, QUEUE_SCAN, type ScanJobPayload } from '@x-hunter/worker-runtime';
import { requireUser } from '../auth.js';

const CreateScan = z.object({
  authorizationId: z.string(),
  mode: z.enum(['free', 'light', 'standard', 'auth']),
});

export function registerScanRoutes(app: FastifyInstance): void {
  app.post('/v1/projects/:id/scans', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = CreateScan.parse(req.body);
    const prisma = getPrisma();

    const project = await prisma.project.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');

    const authz = await prisma.scanAuthorization.findFirst({
      where: { id: body.authorizationId, projectId: id },
      include: { project: true },
    });
    if (!authz) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Scan authorization not found');
    if (authz.expiresAt && authz.expiresAt < new Date()) {
      throw new GuardrailError('AUTHORIZATION_EXPIRED', 'Scan authorization expired');
    }

    // Confirm at least one verified domain still exists for this authorization.
    const verified = await prisma.domainVerification.findFirst({
      where: { domainId: authz.domainId, status: 'verified' },
    });
    if (!verified) throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Domain no longer verified');

    // Mode compatibility with package.
    if (body.mode === 'auth' && authz.scanPackage !== 'auth' && authz.scanPackage !== 'launch') {
      throw new GuardrailError(
        'PACKAGE_DOES_NOT_PERMIT_ACTION',
        'auth mode requires an auth or launch package',
      );
    }

    const scope = {
      allowedHosts: authz.allowedHosts as string[],
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
      testAccountPermission: authz.testAccountPermission,
      sensitiveActionPermission: authz.sensitiveActionPermission,
      scanPackage: authz.scanPackage,
      verifiedDomain:
        (await prisma.domain.findUnique({ where: { id: authz.domainId } }))?.hostname ?? '',
      capturedAt: new Date().toISOString(),
    };

    const scan = await prisma.scanJob.create({
      data: {
        projectId: id,
        authorizationId: authz.id,
        initiatorUserId: user.userId,
        mode: body.mode,
        state: 'queued',
        scopeSnapshot: scope,
      },
    });

    await getQueue<ScanJobPayload>(QUEUE_SCAN).add(
      'scan',
      { scanJobId: scan.id },
      { jobId: scan.id, attempts: 1, removeOnComplete: 500, removeOnFail: 1000 },
    );

    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: id,
        scanJobId: scan.id,
        eventType: 'scan.started',
        detail: { mode: body.mode, authorizationId: authz.id },
      },
    });

    reply.send({ scan });
  });

  app.get('/v1/scans/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const scan = await prisma.scanJob.findFirst({
      where: { id, project: { organizationId: user.orgId } },
      include: { steps: true },
    });
    if (!scan) {
      reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      return;
    }
    reply.send({ scan });
  });

  app.get('/v1/scans/:id/progress', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const scan = await prisma.scanJob.findFirst({
      where: { id, project: { organizationId: user.orgId } },
      include: { steps: true },
    });
    if (!scan) {
      reply.code(404).send({ error: { code: 'NOT_FOUND' } });
      return;
    }
    const milestones = projectMilestones(scan.steps);
    reply.send({ state: scan.state, milestones });
  });
}

interface MinimalStep {
  kind: string;
  state: string;
}

function projectMilestones(steps: MinimalStep[]): Array<{ label: string; state: string }> {
  // Map worker steps → user-facing milestones (PLAN_V3 §14)
  const order: Array<[string, string]> = [
    ['browser_inspector', 'Đang mở website bằng browser thật'],
    ['zap_signal', 'Đang kiểm tra cấu hình bảo mật phổ biến'],
    ['nuclei_signal', 'Đang kiểm tra exposure & misconfig đã biết'],
    ['openhack_hunter', 'Đang chạy Hunter Snapshot'],
    ['strix_core', 'Đang phân tích các bề mặt rủi ro đáng chú ý'],
    ['report', 'Đang tạo report'],
  ];
  return order.map(([kind, label]) => {
    const step = steps.find((s) => s.kind === kind);
    return { label, state: step?.state ?? 'pending' };
  });
}
