import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrisma } from '@x-hunter/db';
import {
  GuardrailError,
  generateVerificationToken,
  normalizeUrl,
  constantTimeEqual,
} from '@x-hunter/shared';
import { promises as dns } from 'node:dns';
import { requireUser } from '../auth.js';

const TXT_RECORD_NAME = process.env.VERIFICATION_TXT_RECORD_NAME || '_xhunter-verification';
const WELL_KNOWN_PATH = process.env.VERIFICATION_WELL_KNOWN_PATH || '.well-known/xhunter-verification.txt';
const TOKEN_PREFIX = process.env.VERIFICATION_TOKEN_PREFIX || 'xhunter-verify';

const CreateDomain = z.object({
  projectId: z.string(),
  hostname: z.string().min(3).max(253),
});

export function registerDomainRoutes(app: FastifyInstance): void {
  app.post('/v1/projects/:id/domains', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = CreateDomain.parse({ ...(req.body as object), projectId: id });
    const prisma = getPrisma();
    const project = await prisma.project.findFirst({
      where: { id, organizationId: user.orgId },
    });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');

    const hostname = body.hostname.toLowerCase().trim();
    // Reject IP literals and reserved targets.
    try {
      normalizeUrl(`https://${hostname}`);
    } catch (e) {
      throw e;
    }

    const domain = await prisma.domain.upsert({
      where: { projectId_hostname: { projectId: id, hostname } },
      update: {},
      create: { projectId: id, hostname },
    });
    reply.send({ domain });
  });

  // Create or rotate a DNS TXT verification token.
  app.post('/v1/domains/:id/verify/dns', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const domain = await prisma.domain.findFirst({
      where: { id, project: { organizationId: user.orgId } },
    });
    if (!domain) throw new GuardrailError('INVALID_INPUT', 'Domain not found');

    const token = generateVerificationToken(TOKEN_PREFIX);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // 90d
    const v = await prisma.domainVerification.create({
      data: {
        domainId: domain.id,
        method: 'dns_txt',
        token,
        status: 'pending',
        expiresAt,
      },
    });
    reply.send({
      verification: v,
      instructions: {
        recordType: 'TXT',
        recordName: `${TXT_RECORD_NAME}.${domain.hostname}`,
        recordValue: token,
        ttlSecondsRecommended: 300,
      },
    });
  });

  app.post('/v1/domains/:id/verify/file', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const domain = await prisma.domain.findFirst({
      where: { id, project: { organizationId: user.orgId } },
    });
    if (!domain) throw new GuardrailError('INVALID_INPUT', 'Domain not found');
    const token = generateVerificationToken(TOKEN_PREFIX);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
    const v = await prisma.domainVerification.create({
      data: {
        domainId: domain.id,
        method: 'well_known',
        token,
        status: 'pending',
        expiresAt,
      },
    });
    reply.send({
      verification: v,
      instructions: {
        url: `https://${domain.hostname}/${WELL_KNOWN_PATH}`,
        contentType: 'text/plain',
        body: token,
      },
    });
  });

  // Trigger verification check.
  app.post('/v1/verifications/:id/check', async (req, reply) => {
    const user = await requireUser(req, reply);
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const prisma = getPrisma();
    const v = await prisma.domainVerification.findFirst({
      where: { id, domain: { project: { organizationId: user.orgId } } },
      include: { domain: true },
    });
    if (!v) throw new GuardrailError('INVALID_INPUT', 'Verification not found');

    let success = false;
    let lastError: string | null = null;
    try {
      if (v.method === 'dns_txt') {
        success = await checkDnsTxt(v.domain.hostname, v.token);
      } else {
        success = await checkWellKnown(v.domain.hostname, v.token);
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    const updated = await prisma.domainVerification.update({
      where: { id: v.id },
      data: success
        ? { status: 'verified', verifiedAt: new Date(), lastError: null }
        : { status: 'failed', lastError: lastError ?? 'token not found' },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: user.orgId,
        userId: user.userId,
        projectId: v.domain.projectId,
        eventType: success ? 'domain.verification.success' : 'domain.verification.failed',
        detail: { method: v.method, hostname: v.domain.hostname },
      },
    });

    reply.send({ verification: updated });
  });
}

async function checkDnsTxt(hostname: string, token: string): Promise<boolean> {
  const name = `${TXT_RECORD_NAME}.${hostname}`;
  let records: string[][];
  try {
    records = await dns.resolveTxt(name);
  } catch {
    return false;
  }
  for (const chunks of records) {
    const value = chunks.join('').trim();
    if (constantTimeEqual(value, token)) return true;
  }
  return false;
}

async function checkWellKnown(hostname: string, token: string): Promise<boolean> {
  const url = `https://${hostname}/${WELL_KNOWN_PATH}`;
  // Hard-cap fetch timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'manual' });
    if (res.status !== 200) return false;
    const text = (await res.text()).trim();
    return constantTimeEqual(text, token);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
