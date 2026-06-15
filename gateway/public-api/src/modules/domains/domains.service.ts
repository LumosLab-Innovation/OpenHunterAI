import { getPrisma } from '@x-hunter/db';
import { generateVerificationToken, GuardrailError, normalizeUrl } from '@x-hunter/shared';
import { resolveTxt } from 'node:dns/promises';
import { dnsTxtContainsToken, verificationRecordName } from './domain-verification.js';
import type { CreateDomainBody } from './domains.dto.js';

interface DomainWithLatestVerification {
  id: string;
  projectId: string;
  hostname: string;
  createdAt: Date;
  updatedAt: Date;
  verifications: Array<{
    id: string;
    method: string;
    status: string;
    verifiedAt: Date | null;
    expiresAt: Date | null;
    lastError: string | null;
  }>;
}

export class DomainsService {
  private readonly prisma = getPrisma();

  async list(projectId: string, orgId: string) {
    const domains = await this.prisma.domain.findMany({
      where: { projectId, project: { organizationId: orgId } },
      include: { verifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return domains.map((domain: DomainWithLatestVerification) => this.toPublicDomain(domain));
  }

  async create(projectId: string, orgId: string, body: CreateDomainBody) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!project) throw new GuardrailError('INVALID_INPUT', 'Project not found');
    const hostname = body.hostname.toLowerCase().trim();
    normalizeUrl(`https://${hostname}`);
    const domain = await this.prisma.domain.upsert({
      where: { projectId_hostname: { projectId, hostname } },
      update: {},
      create: { projectId, hostname },
      include: { verifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return this.toPublicDomain(domain);
  }

  async requestVerification(projectId: string, domainId: string, orgId: string) {
    const domain = await this.findOwnedDomain(projectId, domainId, orgId);
    const token = generateVerificationToken(process.env.VERIFICATION_TOKEN_PREFIX || 'xhunter-verify');
    const verification = await this.prisma.domainVerification.create({
      data: {
        domainId: domain.id,
        method: 'dns_txt',
        token,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return {
      id: verification.id,
      status: verification.status,
      method: verification.method,
      recordName: verificationRecordName(domain.hostname),
      recordValue: token,
      expiresAt: verification.expiresAt,
    };
  }

  async checkVerification(projectId: string, domainId: string, orgId: string) {
    const domain = await this.findOwnedDomain(projectId, domainId, orgId);
    const verification = await this.prisma.domainVerification.findFirst({
      where: { domainId: domain.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) {
      throw new GuardrailError('INVALID_INPUT', 'Request domain verification first');
    }
    if (verification.expiresAt && verification.expiresAt <= new Date()) {
      await this.prisma.domainVerification.update({
        where: { id: verification.id },
        data: { status: 'expired', lastError: 'Verification token expired' },
      });
      throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Verification token expired; request a new token');
    }

    const recordName = verificationRecordName(domain.hostname);
    let records: string[][];
    try {
      records = await resolveTxt(recordName);
    } catch (error) {
      const message = `TXT record not found at ${recordName}`;
      await this.prisma.domainVerification.update({
        where: { id: verification.id },
        data: { status: 'pending', lastError: message },
      });
      return { verified: false, status: 'pending', recordName, message };
    }

    if (!dnsTxtContainsToken(records, verification.token)) {
      const message = `TXT record at ${recordName} does not match the active verification token`;
      await this.prisma.domainVerification.update({
        where: { id: verification.id },
        data: { status: 'pending', lastError: message },
      });
      return { verified: false, status: 'pending', recordName, message };
    }

    const updated = await this.prisma.domainVerification.update({
      where: { id: verification.id },
      data: { status: 'verified', verifiedAt: new Date(), lastError: null },
    });
    return {
      verified: true,
      status: updated.status,
      recordName,
      verifiedAt: updated.verifiedAt,
      expiresAt: updated.expiresAt,
    };
  }

  private async findOwnedDomain(projectId: string, domainId: string, orgId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: { id: domainId, projectId, project: { organizationId: orgId } },
    });
    if (!domain) throw new GuardrailError('INVALID_INPUT', 'Domain not found');
    return domain;
  }

  private toPublicDomain(domain: DomainWithLatestVerification) {
    const verification = domain.verifications[0] ?? null;
    return {
      id: domain.id,
      projectId: domain.projectId,
      hostname: domain.hostname,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      verified: verification?.status === 'verified' &&
        (!verification.expiresAt || verification.expiresAt > new Date()),
      verification,
    };
  }
}
