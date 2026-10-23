import { publishEvent } from '@openhunter/event-core';
import { getPrisma } from '@x-hunter/db';
import { assertInScope, buildScanPlan, DEFAULT_SURFACE_FLAGS, evaluateModuleRoutePreflight, GuardrailError, intensityToProfile, normalizeUrl, profileToIntensity, sanitizeText, type ScanProfile, type SurfaceFlags } from '@x-hunter/shared';
import { AuthorizationsService } from '../authorizations/authorizations.service.js';
import { createInitialReportDraft } from '../reports/reports.service.js';
import { recordScanActivity } from './live-scan.service.js';
import { evaluateAggressiveStagingPreflight, moduleLlmReadiness, type PreflightResult } from './preflight.js';
import { ensureScanRuntimeReady, ScanRuntimeUnavailableError } from './scan-runtime.service.js';
import { probePlannedRuntimes } from './runtime-readiness.js';
import { applyBridgeCompletion, readBridgeCapabilities } from '../llm/bridge-remote.js';
import { loadLlmSettings } from '../llm/llm-routes.store.js';
import type { CreateScanBody } from './scans.dto.js';
import { resolveScanRequest, type ScanRequestV2 } from './scan-request-v2.dto.js';

type ScanState = 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface ScanListQuery {
  state?: ScanState;
  profile?: ScanProfile;
  q?: string;
  sort: 'newest' | 'oldest';
  pageToken?: string;
  limit: number;
}

export class ScansService {
  private readonly prisma = getPrisma();
  private readonly authorizations = new AuthorizationsService();

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
      profile: intensityToProfile(scan.testIntensityMode),
      targetType: scan.targetType,
      authScope: scan.authScope,
      testIntensityMode: scan.testIntensityMode,
      scanPlan: scan.scanPlan ?? undefined,
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

  async preflight(projectId: string, orgId: string, body: CreateScanBody): Promise<PreflightResult> {
    const authz = await this.prisma.scanAuthorization.findFirst({
      where: { id: body.authorizationId, projectId, project: { organizationId: orgId } },
    });
    if (!authz) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Scan authorization not found');
    if (authz.expiresAt && authz.expiresAt < new Date()) throw new GuardrailError('AUTHORIZATION_EXPIRED', 'Scan authorization expired');
    return this.evaluatePreflight(authz, projectId, orgId, body.acceptanceProfile);
  }

  private async evaluatePreflight(
    authz: any,
    projectId: string | null,
    orgId: string,
    acceptanceProfile: 'standard' | 'canary_e2e',
  ): Promise<PreflightResult> {
    const allowedHosts = authz.allowedHosts as string[];
    if (allowedHosts.length === 0) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Authorization has no public host');
    for (const host of allowedHosts) normalizeUrl(`https://${host}`);
    const sessions = projectId && authz.authScope !== 'none' ? await (this.prisma as any).browserSessionState.findMany({
      where: {
        organizationId: orgId,
        projectId,
        status: 'active',
        expiresAt: { gt: new Date() },
        storageStateCipher: { not: null },
      },
      select: { testAccountId: true, status: true, expiresAt: true },
    }) : [];
    const requireCanary = acceptanceProfile === 'canary_e2e';
    const surfaceFlags = { ...DEFAULT_SURFACE_FLAGS, ...(authz.surfaceFlags as Partial<SurfaceFlags>) };
    const scanPlan = buildScanPlan({
      targetType: authz.targetType,
      surfaceFlags,
      authScope: authz.authScope,
      testIntensityMode: authz.testIntensityMode,
      allowedHosts,
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
    });
    const [browserSessionRuntimeReady, canaryReady] = await Promise.all([
      checkBrowserSessionRuntime(),
      requireCanary ? checkCanaryManifest(allowedHosts, authz.allowedPaths as string[], authz.excludedPaths as string[]) : Promise.resolve(false),
    ]);
    const runtimes = await probePlannedRuntimes(Object.keys(scanPlan.enabledWorkers));
    const settings = loadLlmSettings();
    const bridge = await readBridgeCapabilities();
    const modulePreflight = evaluateModuleRoutePreflight({
      config: settings.routes,
      probes: applyBridgeCompletion(settings.probes, bridge),
      bridgeReady: bridge.ready,
      apiReady: {
        openai: Boolean(process.env.OPENAI_API_KEY),
        claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
        deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      },
      profile: intensityToProfile(authz.testIntensityMode),
      targetType: authz.targetType,
      authScope: authz.authScope,
      surfaceFlags,
      capturedAt: new Date().toISOString(),
    });
    const safety = evaluateAggressiveStagingPreflight({
      authorization: {
        authScope: authz.authScope,
        testIntensityMode: authz.testIntensityMode,
        aggressiveStagingRiskAccepted: authz.aggressiveStagingRiskAccepted,
      },
      llm: moduleLlmReadiness(modulePreflight.snapshot),
      browserSessionRuntimeReady,
      sessions,
      requireCanary,
      canaryReady,
    });
    const coverageGaps = [
      ...runtimes.filter((runtime) => !runtime.executable).map((runtime) => `${runtime.worker}:${runtime.reason ?? 'TOOL_UNAVAILABLE'}`),
      ...runtimes.filter((runtime) => runtime.worker === 'strix' && runtime.reasoningOnly).map(() => 'strix:REASONING_ONLY'),
      ...modulePreflight.coverageGaps,
    ];
    const checks = [...safety.checks, ...modulePreflight.checks];
    if (!runtimes.some((runtime) => runtime.executable)) {
      checks.push({ code: 'ALL_WORKERS_UNAVAILABLE', ok: false, message: 'No planned worker runtime is executable.' });
    }
    if (authz.testIntensityMode === 'aggressive_staging' && runtimes.some((runtime) => runtime.worker === 'strix' && (!runtime.executable || !runtime.nativeRuntime))) {
      checks.push({ code: 'STRIX_REQUIRED_FOR_DEEP', ok: false, message: 'Deep scanning requires an executable Strix runtime.' });
    }
    const failures = checks.filter((check) => !check.ok);
    return {
      ok: failures.length === 0,
      checks,
      failures,
      profile: intensityToProfile(authz.testIntensityMode),
      runtimes,
      coverageGaps,
      requiresAcknowledgement: coverageGaps.length > 0 && failures.length === 0,
      scanPlan,
      moduleRoutes: modulePreflight.rows,
      llmRouteSnapshot: modulePreflight.snapshot,
      resolvedScope: {
        allowedHosts,
        allowedPaths: authz.allowedPaths as string[],
        excludedPaths: authz.excludedPaths as string[],
      },
    };
  }

  async preflightRequest(orgId: string, body: ScanRequestV2): Promise<PreflightResult> {
    const scope = resolveScanRequest(body);
    if (body.authScope !== 'none' && !body.projectId) {
      throw new GuardrailError('TEST_ACCOUNT_REQUIRED', 'Authenticated scans must name a project with saved test accounts');
    }
    const intensity = profileToIntensity(body.profile);
    const authorization = {
      ...scope,
      authScope: body.authScope,
      targetType: body.targetType,
      testIntensityMode: intensity,
      surfaceFlags: { ...DEFAULT_SURFACE_FLAGS, ...body.surfaceFlags },
      aggressiveStagingRiskAccepted: body.aggressiveStagingRiskAccepted,
    };
    assertInScope(scope.targetUrl, {
      ...authorization,
      profile: body.profile,
      testAccountPermission: body.authScope !== 'none',
      sensitiveActionPermission: body.profile === 'deep',
    });
    const preflight = await this.evaluatePreflight(authorization, body.projectId ?? null, orgId, body.acceptanceProfile);
    return { ...preflight, resolvedScope: scope };
  }

  async createRequest(orgId: string, userId: string, body: ScanRequestV2) {
    const preflight = await this.preflightRequest(orgId, body);
    if (!preflight.ok) {
      const first = preflight.failures[0];
      throw new GuardrailError((first?.code ?? 'INVALID_INPUT') as any, first?.message ?? 'Scan preflight failed', { checks: preflight.checks });
    }
    const unacknowledged = (preflight.coverageGaps ?? []).filter((gap) => !body.acceptedCoverageGaps.includes(gap));
    if (unacknowledged.length > 0) {
      throw new GuardrailError('INVALID_INPUT', 'Acknowledge unavailable workers before starting this profile', { coverageGaps: unacknowledged });
    }
    const scope = resolveScanRequest(body);
    const project = body.projectId
      ? await this.prisma.project.findFirst({ where: { id: body.projectId, organizationId: orgId } })
      : await this.prisma.project.findFirst({ where: { organizationId: orgId, name: scope.targetHost } })
        ?? await this.prisma.project.create({ data: { organizationId: orgId, name: scope.targetHost } });
    if (!project) throw new GuardrailError('PROJECT_NOT_FOUND', 'Project not found');
    const consentScope = scope.allowedPaths.length > 0
      ? `${scope.targetHost}${scope.allowedPaths.join(', ')} and descendants`
      : `the entire ${scope.targetHost} host`;
    const authorization = await this.authorizations.create(project.id, orgId, userId, {
      targetUrl: scope.targetUrl,
      authScope: body.authScope,
      targetType: body.targetType,
      testIntensityMode: profileToIntensity(body.profile),
      surfaceFlags: { ...DEFAULT_SURFACE_FLAGS, ...body.surfaceFlags } as SurfaceFlags,
      allowedHosts: scope.allowedHosts,
      allowedPaths: scope.allowedPaths,
      excludedPaths: scope.excludedPaths,
      authorityConfirmed: true,
      aggressiveStagingRiskAccepted: body.aggressiveStagingRiskAccepted,
      consentText: `I confirm I am authorized to run an OpenHunterAI ${body.profile} assessment within ${consentScope}.`,
    });
    return this.create(project.id, orgId, userId, {
      authorizationId: authorization.id,
      acceptanceProfile: body.acceptanceProfile,
      acceptedCoverageGaps: body.acceptedCoverageGaps,
    });
  }

  async create(projectId: string, orgId: string, userId: string, body: CreateScanBody) {
    const authz = await this.prisma.scanAuthorization.findFirst({
      where: { id: body.authorizationId, projectId, project: { organizationId: orgId } },
    });
    if (!authz) throw new GuardrailError('NO_SCAN_AUTHORIZATION', 'Scan authorization not found');
    if (authz.expiresAt && authz.expiresAt < new Date()) {
      throw new GuardrailError('AUTHORIZATION_EXPIRED', 'Scan authorization expired');
    }
    const preflight = await this.preflight(projectId, orgId, body);
    if (!preflight.ok) {
      const first = preflight.failures[0];
      throw new GuardrailError((first?.code ?? 'INVALID_INPUT') as any, first?.message ?? 'Scan preflight failed', {
        checks: preflight.checks,
        acceptanceProfile: body.acceptanceProfile,
      });
    }
    const unacknowledged = (preflight.coverageGaps ?? []).filter((gap) => !body.acceptedCoverageGaps.includes(gap));
    if (unacknowledged.length > 0) {
      throw new GuardrailError('INVALID_INPUT', 'Acknowledge unavailable workers before starting this profile', { coverageGaps: unacknowledged });
    }
    const allowedHosts = authz.allowedHosts as string[];
    for (const host of allowedHosts) normalizeUrl(`https://${host}`);
    const declaredPaths = authz.allowedPaths as string[];
    const firstPath = declaredPaths[0] ?? '';
    const targetUrl = authz.targetUrl ?? `https://${allowedHosts[0]}${firstPath ? (firstPath.startsWith('/') ? firstPath : `/${firstPath}`) : ''}`;
    const surfaceFlags = { ...DEFAULT_SURFACE_FLAGS, ...(authz.surfaceFlags as Partial<SurfaceFlags>) };
    const scope = {
      allowedHosts,
      allowedPaths: authz.allowedPaths as string[],
      excludedPaths: authz.excludedPaths as string[],
      testAccountPermission: authz.testAccountPermission,
      sensitiveActionPermission: authz.sensitiveActionPermission,
      profile: intensityToProfile(authz.testIntensityMode),
      authScope: authz.authScope,
      targetType: authz.targetType,
      testIntensityMode: authz.testIntensityMode,
      surfaceFlags,
      aggressiveStagingRiskAccepted: authz.aggressiveStagingRiskAccepted,
      acceptanceProfile: body.acceptanceProfile,
      targetHost: allowedHosts[0] ?? '',
      targetUrl,
      // Legacy worker envelope key; this value is declared scope, not DNS-verified.
      verifiedDomain: allowedHosts[0] ?? '',
      capturedAt: new Date().toISOString(),
    };
    assertInScope(targetUrl, scope);
    const scanPlan = {
      ...buildScanPlan({
        targetType: authz.targetType,
        surfaceFlags,
        authScope: authz.authScope,
        testIntensityMode: authz.testIntensityMode,
        allowedHosts: scope.allowedHosts,
        allowedPaths: scope.allowedPaths,
        excludedPaths: scope.excludedPaths,
      }),
      llmRouteSnapshot: preflight.llmRouteSnapshot,
    };

    const scan = await this.prisma.scanJob.create({
      data: {
        projectId,
        authorizationId: authz.id,
        initiatorUserId: userId,
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
      bodyParams: { target: scope.targetHost, profile: scope.profile },
      status: 'queued',
    }).catch(() => {});
    try {
      await ensureScanRuntimeReady((activity) =>
        recordScanActivity(this.prisma, {
          scanJobId: scan.id,
          actor: 'scan',
          ...activity,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan runtime unavailable';
      await this.prisma.scanJob.update({
        where: { id: scan.id },
        data: {
          state: 'failed',
          finishedAt: new Date(),
          errorMessage: `Scan runtime unavailable: ${message}`.slice(0, 2000),
        },
      });
      if (!(error instanceof ScanRuntimeUnavailableError)) {
        await recordScanActivity(this.prisma, {
          scanJobId: scan.id,
          eventType: 'runtime_unavailable',
          actor: 'scan',
          titleKey: 'activity.runtime_unavailable.title',
          bodyKey: 'activity.runtime_unavailable.body',
          bodyParams: { message },
          status: 'failed',
          severity: 'high',
        }).catch(() => {});
      }
      throw new GuardrailError('TOOL_UNAVAILABLE', 'Scan runtime is unavailable; scan was not started', {
        scanId: scan.id,
      });
    }
    try {
      await publishEvent('scan.created', {
        scanId: scan.id,
        projectId,
        authorizationId: authz.id,
        profile: scope.profile,
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

async function checkBrowserSessionRuntime(): Promise<boolean> {
  const baseUrl = process.env.BROWSER_SESSION_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) return false;
  const health = await fetchJson<{ ok?: boolean }>(`${baseUrl}/health`).catch(() => null);
  return health?.ok === true;
}

async function checkCanaryManifest(allowedHosts: string[], allowedPaths: string[], excludedPaths: string[]): Promise<boolean> {
  const host = allowedHosts[0];
  if (!host) return false;
  const manifestUrl = normalizeUrl(`https://${host}/openhunter-canary/manifest.json`).url.href;
  try {
    const scope: Parameters<typeof assertInScope>[1] = {
      allowedHosts,
      allowedPaths,
      excludedPaths,
      testAccountPermission: true,
      sensitiveActionPermission: true,
      profile: 'deep',
      authScope: 'two_accounts',
      targetType: 'interactive_web_app',
      testIntensityMode: 'aggressive_staging',
      surfaceFlags: DEFAULT_SURFACE_FLAGS,
      aggressiveStagingRiskAccepted: true,
    };
    assertInScope(manifestUrl, scope);
    const manifest = await fetchJson<Record<string, unknown>>(manifestUrl);
    return canaryManifestInScope(manifest, manifestUrl, scope);
  } catch {
    return false;
  }
}

export function canaryManifestInScope(manifest: Record<string, unknown>, manifestUrl: string, scope: Parameters<typeof assertInScope>[1]): boolean {
  if (manifest.scenario !== 'object_ownership') return false;
  for (const key of ['vulnerablePath', 'fixedPath', 'userAOwnPath', 'userBOwnPath']) {
    const path = manifest[key];
    if (typeof path !== 'string' || !path.startsWith('/openhunter-canary/')) return false;
    try {
      assertInScope(new URL(path, manifestUrl).href, scope);
    } catch {
      return false;
    }
  }
  return true;
}

async function fetchJson<T>(url: string, timeoutMs = 2000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

const STATES = new Set<ScanState>(['queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'timeout']);
const PROFILES = new Set<ScanProfile>(['quick', 'standard', 'deep']);

export function parseScanListQuery(raw: Record<string, unknown>): ScanListQuery {
  const state = typeof raw.state === 'string' && STATES.has(raw.state as ScanState) ? (raw.state as ScanState) : undefined;
  const profile = typeof raw.profile === 'string' && PROFILES.has(raw.profile as ScanProfile) ? (raw.profile as ScanProfile) : undefined;
  const q = typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim().slice(0, 120) : undefined;
  const sort = raw.sort === 'oldest' ? 'oldest' : 'newest';
  const pageToken = typeof raw.pageToken === 'string' && raw.pageToken.includes('|') ? raw.pageToken.slice(0, 240) : undefined;
  const rawLimit = Number(raw.limit ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 50;
  return {
    ...(state ? { state } : {}),
    ...(profile ? { profile } : {}),
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
    ...(query.profile ? { testIntensityMode: profileToIntensity(query.profile) } : {}),
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
    profile: intensityToProfile(scan.testIntensityMode),
    state: scan.state,
    targetType: scan.targetType,
    scopeSnapshot: scan.scopeSnapshot,
  }).toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function publicStep(step: any) {
  const envelope = step.outputRef && typeof step.outputRef === 'object' ? (step.outputRef as Record<string, unknown>) : {};
  const output = envelope.sanitized === true && envelope.value && typeof envelope.value === 'object'
    ? envelope.value as Record<string, unknown> : envelope;
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
    targetHost: typeof obj.targetHost === 'string'
      ? sanitizeText(obj.targetHost)
      : typeof obj.verifiedDomain === 'string' ? sanitizeText(obj.verifiedDomain) : undefined,
    targetUrl: typeof obj.targetUrl === 'string' ? sanitizeText(obj.targetUrl) : undefined,
    allowedHosts: Array.isArray(obj.allowedHosts) ? obj.allowedHosts.map(String).map(sanitizeText) : undefined,
    allowedPaths: Array.isArray(obj.allowedPaths) ? obj.allowedPaths.map(String).map(sanitizeText) : undefined,
    excludedPaths: Array.isArray(obj.excludedPaths) ? obj.excludedPaths.map(String).map(sanitizeText) : undefined,
  };
}

function targetFromScope(scope: unknown): string {
  const obj = scope && typeof scope === 'object' ? (scope as Record<string, unknown>) : {};
  if (typeof obj.targetUrl === 'string' && obj.targetUrl.trim()) return sanitizeText(obj.targetUrl);
  if (typeof obj.targetHost === 'string' && obj.targetHost.trim()) return sanitizeText(obj.targetHost);
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
