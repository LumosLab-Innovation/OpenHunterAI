import { publishEvent } from '@openhunter/event-core';
import { getPrisma } from '@x-hunter/db';
import { buildScanPlan, DEFAULT_SURFACE_FLAGS, GuardrailError, sanitizeText, type SurfaceFlags } from '@x-hunter/shared';
import { createInitialReportDraft } from '../reports/reports.service.js';
import { EntitlementService } from '../billing/entitlement.service.js';
import { recordScanActivity } from './live-scan.service.js';
import type { CreateScanBody } from './scans.dto.js';

type ScanState = 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'timeout';
type ScanMode = 'free_hunter' | 'ai_blackhat_mindset_check';

export interface ScanListQuery {
  state?: ScanState;
  mode?: ScanMode;
  q?: string;
  sort: 'newest' | 'oldest';
  pageToken?: string;
  limit: number;
}

export class ScansService {
  private readonly prisma = getPrisma();
  private readonly entitlements = new EntitlementService();

  async list(orgId: string, rawQuery: Record<string, unknown> = {}) {
    const query = parseScanListQuery(rawQuery);
    const rows = await (this.prisma.scanJob as any).findMany({
      where: buildScanListWhere(orgId, query),
      orderBy: [{ createdAt: query.sort === 'oldest' ? 'asc' : 'desc' }, { id: 'asc' }],
      take: query.q ? Math.max(query.limit + 1, 500) : query.limit + 1,
    });
    const visible = query.q ? rows.filter((scan: any) => scanMatchesQuery(scan, query.q!)) : rows;
    const items = visible.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items,
      nextPageToken: visible.length > query.limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    };
  }

  get(id: string, orgId: string) {
    return (this.prisma.scanJob as any).findFirst({
      where: { id, hiddenAt: null, project: { organizationId: orgId } },
      include: { steps: true, reports: { orderBy: { version: 'desc' } }, reportDraftSections: true },
    });
  }

  toPublicScan(scan: any) {
    const target = targetFromScope(scan.scopeSnapshot);
    return {
      id: scan.id,
      projectId: scan.projectId,
      authorizationId: scan.authorizationId,
      mode: scan.mode,
      targetType: scan.targetType,
      authScope: scan.authScope,
      testIntensityMode: scan.testIntensityMode,
      state: scan.state,
      target,
      scope: publicScopeSummary(scan.scopeSnapshot),
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
      startedAt: scan.startedAt ?? null,
      finishedAt: scan.finishedAt ?? null,
      errorMessage: scan.errorMessage ? publicWorkerText(scan.errorMessage) : null,
      steps: Array.isArray(scan.steps) ? scan.steps.map(publicStep) : undefined,
      reports: Array.isArray(scan.reports)
        ? scan.reports.map((report: any) => ({
            id: report.id,
            state: report.state,
            version: report.version,
            generatedAt: report.generatedAt,
            finalizedAt: report.finalizedAt ?? null,
          }))
        : undefined,
      reportDraftSections: Array.isArray(scan.reportDraftSections)
        ? scan.reportDraftSections.map((section: any) => ({
            id: section.id,
            sectionKey: section.sectionKey,
            state: section.state,
            updatedAt: section.updatedAt,
            errorCode: section.errorCode ?? null,
            errorMsg: section.errorMsg ? sanitizeText(section.errorMsg) : null,
          }))
        : undefined,
    };
  }

  async cancel(id: string, orgId: string, userId: string) {
    const scan = await (this.prisma.scanJob as any).findFirst({
      where: { id, hiddenAt: null, project: { organizationId: orgId } },
      select: { id: true, projectId: true, state: true },
    });
    if (!scan) throw new GuardrailError('INVALID_INPUT', 'Scan not found');
    if (!['queued', 'running', 'awaiting_approval'].includes(scan.state)) {
      throw new GuardrailError('INVALID_INPUT', 'Only queued, running, or approval-waiting scans can be stopped');
    }
    const updated = await (this.prisma as any).$transaction(async (tx: any) => {
      const result = await tx.scanJob.updateMany({
        where: { id, hiddenAt: null, project: { organizationId: orgId }, state: { in: ['queued', 'running', 'awaiting_approval'] } },
        data: { state: 'cancelled', finishedAt: new Date(), errorMessage: 'Stopped by user request.' },
      });
      if (result.count !== 1) {
        throw new GuardrailError('INVALID_INPUT', 'Scan state changed before it could be stopped');
      }
      await recordScanActivity(tx, {
        scanJobId: id,
        eventType: 'scan_cancelled',
        actor: 'scan',
        titleKey: 'activity.scan_cancelled.title',
        bodyKey: 'activity.scan_cancelled.body',
        bodyParams: { summary: 'Scan stopped by user request.' },
        status: 'cancelled',
      });
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          projectId: scan.projectId,
          scanJobId: id,
          eventType: 'scan.cancelled',
          detail: { stateBefore: scan.state, sanitized: true },
        },
      });
      return tx.scanJob.findUnique({ where: { id } });
    });
    return updated;
  }

  async hide(id: string, orgId: string, userId: string) {
    const scan = await (this.prisma.scanJob as any).findFirst({
      where: { id, hiddenAt: null, project: { organizationId: orgId } },
      select: { id: true, projectId: true, state: true },
    });
    if (!scan) throw new GuardrailError('INVALID_INPUT', 'Scan not found');
    const updated = await (this.prisma as any).$transaction(async (tx: any) => {
      const row = await tx.scanJob.update({
        where: { id },
        data: { hiddenAt: new Date(), hiddenByUserId: userId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          projectId: scan.projectId,
          scanJobId: id,
          eventType: 'scan.hidden',
          detail: { stateBefore: scan.state, sanitized: true },
        },
      });
      return row;
    });
    return updated;
  }

  async create(projectId: string, orgId: string, userId: string, body: CreateScanBody) {
    const authz = await this.prisma.scanAuthorization.findFirst({
      where: { id: body.authorizationId, projectId, project: { organizationId: orgId } },
    });
    if (!authz) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Scan authorization not found');
    if (authz.expiresAt && authz.expiresAt < new Date()) {
      throw new GuardrailError('AUTHORIZATION_EXPIRED', 'Scan authorization expired');
    }
    const allowedHosts = authz.allowedHosts as string[];
    const domains = await this.prisma.domain.findMany({
      where: {
        projectId,
        project: { organizationId: orgId },
        hostname: { in: allowedHosts },
        verifications: {
          some: {
            status: 'verified',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, hostname: true },
    });
    const verifiedHosts = new Set(domains.map((domain: { hostname: string }) => domain.hostname.toLowerCase()));
    const unverifiedHosts = allowedHosts.filter((host) => !verifiedHosts.has(host.toLowerCase()));
    if (unverifiedHosts.length > 0) {
      throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Every allowed host must still be verified before scan creation', {
        unverifiedHosts,
      });
    }
    const domain = domains.find((d: { id: string }) => d.id === authz.domainId) ?? domains[0];
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const surfaceFlags = { ...DEFAULT_SURFACE_FLAGS, ...(authz.surfaceFlags as Partial<SurfaceFlags>) };
    const scope = {
      allowedHosts,
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
      testAccountPermission: authz.testAccountPermission,
      sensitiveActionPermission: authz.sensitiveActionPermission,
      packageTier: project?.packageTier ?? 'free_hunter',
      scanMode: authz.scanMode,
      authScope: authz.authScope,
      targetType: authz.targetType,
      testIntensityMode: authz.testIntensityMode,
      surfaceFlags,
      aggressiveStagingRiskAccepted: authz.aggressiveStagingRiskAccepted,
      verifiedDomain: domain?.hostname ?? '',
      capturedAt: new Date().toISOString(),
    };
    const scanPlan = buildScanPlan({
      packageTier: scope.packageTier,
      scanMode: authz.scanMode,
      targetType: authz.targetType,
      surfaceFlags,
      authScope: authz.authScope,
      testIntensityMode: authz.testIntensityMode,
      allowedHosts: scope.allowedHosts,
      allowedPaths: scope.allowedPaths,
      excludedPaths: scope.excludedPaths,
    });

    // Billing entitlement gate: confirm the project may run this tier (and
    // consume a PAYG credit) before any scan job is created.
    await this.entitlements.assertCanScan(projectId, orgId, scope.packageTier);

    const scan = await this.prisma.scanJob.create({
      data: {
        projectId,
        authorizationId: authz.id,
        initiatorUserId: userId,
        mode: authz.scanMode,
        targetType: authz.targetType,
        authScope: authz.authScope,
        testIntensityMode: authz.testIntensityMode,
        surfaceFlags: surfaceFlags as object,
        scanPlan: scanPlan as object,
        state: 'queued',
        scopeSnapshot: scope as object,
      },
    });
    await createInitialReportDraft(this.prisma, scan.id);
    await recordScanActivity(this.prisma, {
      scanJobId: scan.id,
      eventType: 'scan_queued',
      actor: 'scan',
      titleKey: 'activity.scan_queued.title',
      bodyKey: 'activity.scan_queued.body',
      bodyParams: { target: scope.verifiedDomain, mode: authz.scanMode },
      status: 'queued',
    }).catch(() => {});
    try {
      await publishEvent('scan.created', {
        scanId: scan.id,
        projectId,
        authorizationId: authz.id,
        mode: authz.scanMode,
        scope,
        scanPlan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan event queue unavailable';
      await this.prisma.scanJob.update({
        where: { id: scan.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorMessage: `Scan queue unavailable: ${message}`.slice(0, 2000),
        },
      });
      await recordScanActivity(this.prisma, {
        scanJobId: scan.id,
        eventType: 'queue_failed',
        actor: 'scan',
        titleKey: 'activity.queue_failed.title',
        bodyKey: 'activity.queue_failed.body',
        bodyParams: { message },
        status: 'failed',
        severity: 'high',
      }).catch(() => {});
      throw new GuardrailError('TOOL_UNAVAILABLE', 'Scan queue is unavailable; scan was not started', {
        scanId: scan.id,
      });
    }
    return scan;
  }
}

const STATES = new Set<ScanState>(['queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'timeout']);
const MODES = new Set<ScanMode>(['free_hunter', 'ai_blackhat_mindset_check']);

export function parseScanListQuery(raw: Record<string, unknown>): ScanListQuery {
  const state = typeof raw.state === 'string' && STATES.has(raw.state as ScanState) ? (raw.state as ScanState) : undefined;
  const mode = typeof raw.mode === 'string' && MODES.has(raw.mode as ScanMode) ? (raw.mode as ScanMode) : undefined;
  const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim().slice(0, 120) : undefined;
  const sort = raw.sort === 'oldest' ? 'oldest' : 'newest';
  const pageToken = typeof raw.pageToken === 'string' && raw.pageToken.includes('|') ? raw.pageToken.slice(0, 240) : undefined;
  const rawLimit = Number(raw.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 50;
  return {
    ...(state ? { state } : {}),
    ...(mode ? { mode } : {}),
    ...(q ? { q } : {}),
    sort,
    ...(pageToken ? { pageToken } : {}),
    limit,
  };
}

export function buildScanListWhere(orgId: string, query: ScanListQuery): Record<string, unknown> {
  const cursorCreatedAt = createdAtFromPageToken(query.pageToken);
  return {
    project: { organizationId: orgId },
    hiddenAt: null,
    ...(query.state ? { state: query.state } : {}),
    ...(query.mode ? { mode: query.mode } : {}),
    ...(cursorCreatedAt ? { createdAt: query.sort === 'oldest' ? { gt: cursorCreatedAt } : { lt: cursorCreatedAt } } : {}),
  };
}

function createdAtFromPageToken(pageToken: string | undefined): Date | null {
  if (!pageToken) return null;
  const [rawDate] = pageToken.split('|');
  const date = new Date(rawDate ?? '');
  return Number.isNaN(date.getTime()) ? null : date;
}

function scanMatchesQuery(scan: any, q: string): boolean {
  const haystack = JSON.stringify({
    id: scan.id,
    mode: scan.mode,
    state: scan.state,
    targetType: scan.targetType,
    scopeSnapshot: scan.scopeSnapshot,
  }).toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function publicStep(step: any) {
  const output = step.outputRef && typeof step.outputRef === 'object' ? (step.outputRef as Record<string, unknown>) : {};
  return {
    id: step.id,
    kind: displayUnitCode(String(step.kind ?? '')),
    state: step.state,
    startedAt: step.startedAt ?? null,
    finishedAt: step.finishedAt ?? null,
    summary: typeof output.summary === 'string' ? publicWorkerText(output.summary) : null,
    coverageGap: output.coverageGap === true,
    signalCount: typeof output.signalCount === 'number' ? output.signalCount : undefined,
    errorCode: step.errorCode ?? null,
    errorMsg: step.errorMsg ? publicWorkerText(step.errorMsg) : null,
  };
}

function publicScopeSummary(scope: unknown) {
  const obj = scope && typeof scope === 'object' ? (scope as Record<string, unknown>) : {};
  return {
    verifiedDomain: typeof obj.verifiedDomain === 'string' ? sanitizeText(obj.verifiedDomain) : undefined,
    targetUrl: typeof obj.targetUrl === 'string' ? sanitizeText(obj.targetUrl) : undefined,
    allowedHosts: Array.isArray(obj.allowedHosts) ? obj.allowedHosts.map(String).map(sanitizeText) : undefined,
    allowedPaths: Array.isArray(obj.allowedPaths) ? obj.allowedPaths.map(String).map(sanitizeText) : undefined,
    excludedPaths: Array.isArray(obj.excludedPaths) ? obj.excludedPaths.map(String).map(sanitizeText) : undefined,
  };
}

function targetFromScope(scope: unknown): string {
  const obj = scope && typeof scope === 'object' ? (scope as Record<string, unknown>) : {};
  if (typeof obj.targetUrl === 'string' && obj.targetUrl.trim()) return sanitizeText(obj.targetUrl);
  if (typeof obj.verifiedDomain === 'string' && obj.verifiedDomain.trim()) return sanitizeText(obj.verifiedDomain);
  const hosts = Array.isArray(obj.allowedHosts) ? obj.allowedHosts : [];
  return typeof hosts[0] === 'string' ? sanitizeText(hosts[0]) : 'authorized target';
}

function displayUnitCode(key: string): string {
  switch (key.toLowerCase().replace(/[-\s]/g, '_')) {
    case 'browser':
    case 'browser_inspector':
      return 'Browser';
    case 'zap':
    case 'zap_signal':
    case 'z':
      return 'Z';
    case 'nuclei':
    case 'nuclei_signal':
    case 'n':
      return 'N';
    case 'openhack':
    case 'openhack_hunter':
    case 'o':
      return 'O';
    case 'strix':
    case 'strix_core':
    case 's':
      return 'S';
    case 'report':
      return 'RPT';
    case 'retest':
      return 'RT';
    default:
      return sanitizeText(key).slice(0, 40);
  }
}

function publicWorkerText(value: string): string {
  return sanitizeText(value)
    .replace(/\bbrowser[_-]inspector\b/gi, 'Browser')
    .replace(/\bzap[_-]signal\b/gi, 'Z')
    .replace(/\bzap\b/gi, 'Z')
    .replace(/\bnuclei[_-]signal\b/gi, 'N')
    .replace(/\bnuclei\b/gi, 'N')
    .replace(/\bopenhack[_-]hunter\b/gi, 'O')
    .replace(/\bopenhack\b/gi, 'O')
    .replace(/\bstrix[_-]core\b/gi, 'S')
    .replace(/\bstrix\b/gi, 'S')
    .replace(/\bZ_signal\b/g, 'Z')
    .replace(/\bN_signal\b/g, 'N')
    .replace(/\bO_hunter\b/g, 'O')
    .replace(/\bS_core\b/g, 'S');
}
