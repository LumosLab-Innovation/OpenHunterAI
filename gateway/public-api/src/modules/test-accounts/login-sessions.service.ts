import { getPrisma } from '@x-hunter/db';
import {
  assertInScope,
  decryptString,
  DEFAULT_SURFACE_FLAGS,
  encryptString,
  GuardrailError,
  normalizeUrl,
  sanitizeText,
} from '@x-hunter/shared';

const INTERACTIVE_SESSION_TTL_MS = 15 * 60_000;
const SAVED_SESSION_TTL_MS = 24 * 60 * 60_000;
const STREAM_PREFIX = '/v1/login-sessions';

type BrowserSessionStatus = 'pending' | 'active' | 'cancelled' | 'expired';

interface FreshSessionLike {
  status: string;
  expiresAt: Date;
}

interface RuntimeSessionResponse {
  streamUrl?: string;
}

interface RuntimeStorageResponse {
  finalUrl?: string;
  storageState?: unknown;
}

export class LoginSessionsService {
  private readonly prisma = getPrisma();

  async create(projectId: string, accountId: string, orgId: string, userId: string) {
    const account = await this.prisma.testAccount.findFirst({
      where: { id: accountId, projectId, project: { organizationId: orgId } },
      select: { id: true, projectId: true, loginUrl: true },
    });
    if (!account) throw new GuardrailError('INVALID_INPUT', 'Test account not found');
    const verifiedHosts = await this.verifiedHosts(projectId, orgId);
    const loginUrl = validateLoginUrlInVerifiedScope(account.loginUrl, verifiedHosts);
    await this.cancelPendingInteractiveSessions(account.id, orgId);
    const expiresAt = new Date(Date.now() + INTERACTIVE_SESSION_TTL_MS);

    const session = await (this.prisma as any).browserSessionState.create({
      data: {
        organizationId: orgId,
        projectId,
        testAccountId: account.id,
        createdByUserId: userId,
        status: 'pending',
        loginUrl: loginUrl.href,
        expiresAt,
      },
      select: publicSessionSelect,
    });

    await createRuntimeSession(session.id, loginUrl.href, verifiedHosts);
    const streamUrl = publicLoginSessionStreamUrl(session.id);
    await (this.prisma as any).browserSessionState.update({
      where: { id: session.id },
      data: { streamUrl },
    });
    session.streamUrl = streamUrl;

    return toPublicLoginSession(session, 'ready');
  }

  async get(sessionId: string, orgId: string, userId: string) {
    const session = await this.findSession(sessionId, orgId, userId);
    return toPublicLoginSession(session, runtimeStatus(session.streamUrl));
  }

  async complete(sessionId: string, orgId: string, userId: string, body: { finalUrl?: string; storageState?: unknown } = {}) {
    const session = await this.findSession(sessionId, orgId, userId);
    if (session.status === 'cancelled') throw new GuardrailError('INVALID_INPUT', 'Login session was cancelled');
    if (session.expiresAt.getTime() <= Date.now()) throw new GuardrailError('INVALID_INPUT', 'Login session expired');

    const verifiedHosts = await this.verifiedHosts(session.projectId, orgId);
    const runtimeState = await readRuntimeStorageState(sessionId, body);
    const finalUrl = validateLoginUrlInVerifiedScope(runtimeState.finalUrl ?? body.finalUrl ?? session.loginUrl, verifiedHosts);
    const storageState = sanitizeBrowserStorageState(runtimeState.storageState);
    const storageStateCipher = encryptString(JSON.stringify(storageState)).ciphertext;
    const expiresAt = new Date(Date.now() + SAVED_SESSION_TTL_MS);

    const updated = await (this.prisma as any).browserSessionState.update({
      where: { id: session.id },
      data: {
        status: 'active',
        finalUrl: finalUrl.href,
        storageStateCipher,
        expiresAt,
        completedAt: new Date(),
      },
      select: publicSessionSelect,
    });
    await cancelRuntimeSession(sessionId).catch(() => {});
    return toPublicLoginSession(updated, runtimeStatus(updated.streamUrl));
  }

  async cancel(sessionId: string, orgId: string, userId: string) {
    const session = await this.findSession(sessionId, orgId, userId);
    await cancelRuntimeSession(sessionId).catch(() => {});
    const updated = await (this.prisma as any).browserSessionState.update({
      where: { id: session.id },
      data: { status: 'cancelled', cancelledAt: new Date(), storageStateCipher: null },
      select: publicSessionSelect,
    });
    return toPublicLoginSession(updated, runtimeStatus(updated.streamUrl));
  }

  private async findSession(sessionId: string, orgId: string, userId?: string) {
    const session = await (this.prisma as any).browserSessionState.findFirst({
      where: { id: sessionId, organizationId: orgId, ...(userId ? { createdByUserId: userId } : {}) },
      select: publicSessionSelect,
    });
    if (!session) throw new GuardrailError('INVALID_INPUT', 'Login session not found');
    return session;
  }

  async assertSessionAccess(sessionId: string, orgId: string, userId: string) {
    return this.findSession(sessionId, orgId, userId);
  }

  async assertInteractiveSessionAccess(sessionId: string, orgId: string, userId: string) {
    const session = await this.findSession(sessionId, orgId, userId);
    if (session.status !== 'pending' || session.expiresAt.getTime() <= Date.now()) {
      await cancelRuntimeSession(sessionId).catch(() => {});
      throw new GuardrailError('INVALID_INPUT', 'Login session is not interactive');
    }
    return session;
  }

  async cancelInteractiveSessionsForUser(orgId: string, userId: string) {
    const sessions = await (this.prisma as any).browserSessionState.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['pending', 'active'] },
        expiresAt: { gt: new Date() },
        OR: [{ createdByUserId: userId }, { createdByUserId: null }],
      },
      select: { id: true, status: true },
    });

    for (const session of sessions) {
      await cancelRuntimeSession(session.id).catch(() => {});
      if (session.status === 'pending') {
        await (this.prisma as any).browserSessionState.update({
          where: { id: session.id },
          data: { status: 'cancelled', cancelledAt: new Date(), storageStateCipher: null },
        });
      }
    }
  }

  private async cancelPendingInteractiveSessions(testAccountId: string, orgId: string) {
    const pending = await (this.prisma as any).browserSessionState.findMany({
      where: {
        testAccountId,
        organizationId: orgId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    for (const session of pending) {
      await cancelRuntimeSession(session.id).catch(() => {});
      await (this.prisma as any).browserSessionState.update({
        where: { id: session.id },
        data: { status: 'cancelled', cancelledAt: new Date(), storageStateCipher: null },
      });
    }
  }

  private async verifiedHosts(projectId: string, orgId: string): Promise<string[]> {
    const domains = await this.prisma.domain.findMany({
      where: {
        projectId,
        project: { organizationId: orgId },
        verifications: {
          some: {
            status: 'verified',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      select: { hostname: true },
    });
    if (domains.length === 0) throw new GuardrailError('DOMAIN_NOT_VERIFIED', 'Project has no verified domain');
    return domains.map((domain) => domain.hostname);
  }
}

export async function latestDecryptedSessionStateForScan(scanId: string): Promise<null | {
  storageState: SanitizedBrowserStorageState;
  expiresAt: string;
  finalUrl: string | null;
}> {
  const prisma = getPrisma();
  const scan = await prisma.scanJob.findUnique({
    where: { id: scanId },
    select: { projectId: true, authScope: true, project: { select: { organizationId: true } } },
  });
  if (!scan || scan.authScope === 'none') return null;
  const row = await (prisma as any).browserSessionState.findFirst({
    where: {
      organizationId: scan.project.organizationId,
      projectId: scan.projectId,
      status: 'active',
      expiresAt: { gt: new Date() },
      storageStateCipher: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    select: { storageStateCipher: true, expiresAt: true, finalUrl: true, status: true },
  });
  if (!row || !isBrowserSessionFresh(row)) return null;
  const parsed = JSON.parse(decryptString(row.storageStateCipher));
  return {
    storageState: sanitizeBrowserStorageState(parsed),
    expiresAt: row.expiresAt.toISOString(),
    finalUrl: row.finalUrl ?? null,
  };
}

export interface SanitizedBrowserStorageState {
  cookies: Array<Record<string, unknown>>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
    sessionStorage: Array<{ name: string; value: string }>;
  }>;
}

export function validateLoginUrlInVerifiedScope(rawUrl: string, verifiedHosts: string[]): URL {
  const normalized = normalizeUrl(rawUrl).url;
  assertInScope(normalized.href, {
    allowedHosts: verifiedHosts,
    allowedPaths: [],
    excludedPaths: [],
    testAccountPermission: true,
    sensitiveActionPermission: false,
    scanMode: 'free_hunter',
    authScope: 'one_account',
    targetType: 'interactive_web_app',
    testIntensityMode: 'safe_discovery',
    surfaceFlags: DEFAULT_SURFACE_FLAGS,
    aggressiveStagingRiskAccepted: false,
  });
  return normalized;
}

export function isBrowserSessionFresh(session: FreshSessionLike, now = new Date()): boolean {
  return session.status === 'active' && session.expiresAt.getTime() > now.getTime();
}

export function sanitizeBrowserStorageState(input: unknown): SanitizedBrowserStorageState {
  const obj = objectOf(input);
  const cookies = Array.isArray(obj.cookies)
    ? obj.cookies.map(sanitizeCookie).filter((cookie): cookie is Record<string, unknown> => Boolean(cookie))
    : [];
  const origins = Array.isArray(obj.origins)
    ? obj.origins.map(sanitizeOrigin).filter((origin): origin is SanitizedBrowserStorageState['origins'][number] => Boolean(origin))
    : [];
  return { cookies, origins };
}

function sanitizeCookie(input: unknown): Record<string, unknown> | null {
  const obj = objectOf(input);
  if (typeof obj.name !== 'string' || typeof obj.value !== 'string' || typeof obj.domain !== 'string') return null;
  return {
    name: sanitizeText(obj.name).slice(0, 256),
    value: String(obj.value).slice(0, 4096),
    domain: sanitizeText(obj.domain).slice(0, 256),
    path: typeof obj.path === 'string' ? sanitizeText(obj.path).slice(0, 512) : '/',
    ...(typeof obj.expires === 'number' ? { expires: obj.expires } : {}),
    ...(typeof obj.httpOnly === 'boolean' ? { httpOnly: obj.httpOnly } : {}),
    ...(typeof obj.secure === 'boolean' ? { secure: obj.secure } : {}),
    ...(typeof obj.sameSite === 'string' ? { sameSite: sanitizeText(obj.sameSite).slice(0, 32) } : {}),
  };
}

function sanitizeOrigin(input: unknown): SanitizedBrowserStorageState['origins'][number] | null {
  const obj = objectOf(input);
  if (typeof obj.origin !== 'string') return null;
  const origin = normalizeUrl(obj.origin).origin;
  return {
    origin,
    localStorage: sanitizeStorageEntries(obj.localStorage),
    sessionStorage: sanitizeStorageEntries(obj.sessionStorage),
  };
}

function sanitizeStorageEntries(input: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      const obj = objectOf(entry);
      if (typeof obj.name !== 'string' || typeof obj.value !== 'string') return null;
      const name = sanitizeText(obj.name).slice(0, 256);
      if (/password|passwd|pwd/i.test(name)) return null;
      return { name, value: String(obj.value).slice(0, 8192) };
    })
    .filter((entry): entry is { name: string; value: string } => Boolean(entry));
}

const publicSessionSelect = {
  id: true,
  projectId: true,
  testAccountId: true,
  createdByUserId: true,
  status: true,
  loginUrl: true,
  finalUrl: true,
  streamUrl: true,
  expiresAt: true,
  createdAt: true,
  completedAt: true,
  cancelledAt: true,
};

function toPublicLoginSession(session: any, sessionRuntimeStatus: 'ready' | 'unavailable') {
  const status = freshPublicStatus(session.status, session.expiresAt);
  return {
    id: session.id,
    projectId: session.projectId,
    testAccountId: session.testAccountId,
    status,
    loginUrl: session.loginUrl,
    finalUrl: session.finalUrl,
    streamUrl: session.streamUrl,
    runtimeStatus: sessionRuntimeStatus,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    cancelledAt: session.cancelledAt?.toISOString() ?? null,
  };
}

function freshPublicStatus(status: BrowserSessionStatus, expiresAt: Date): BrowserSessionStatus {
  if ((status === 'active' || status === 'pending') && expiresAt.getTime() <= Date.now()) return 'expired';
  return status;
}

function runtimeStatus(streamUrl?: string | null): 'ready' | 'unavailable' {
  return streamUrl ? 'ready' : 'unavailable';
}

export function publicLoginSessionStreamUrl(sessionId: string): string {
  const safeId = encodeURIComponent(sessionId);
  const wsPath = encodeURIComponent(`${STREAM_PREFIX.replace(/^\/+/, '')}/${sessionId}/stream/websockify`);
  return `${STREAM_PREFIX}/${safeId}/stream/vnc.html?autoconnect=1&resize=scale&path=${wsPath}`;
}

export function browserSessionRuntimeBaseUrl(): string | null {
  return process.env.BROWSER_SESSION_BASE_URL?.replace(/\/+$/, '') || null;
}

async function createRuntimeSession(sessionId: string, loginUrl: string, allowedHosts: string[]): Promise<RuntimeSessionResponse> {
  const baseUrl = process.env.BROWSER_SESSION_BASE_URL?.replace(/\/+$/, '');
  if (!baseUrl) throw new GuardrailError('TOOL_UNAVAILABLE', 'Browser session runtime is unavailable');
  const res = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      loginUrl,
      allowedHosts,
      ttlSeconds: INTERACTIVE_SESSION_TTL_MS / 1000,
    }),
  });
  if (!res.ok) throw new GuardrailError('TOOL_UNAVAILABLE', 'Browser session runtime is unavailable');
  return (await res.json()) as RuntimeSessionResponse;
}

async function readRuntimeStorageState(sessionId: string, body: { finalUrl?: string; storageState?: unknown }): Promise<RuntimeStorageResponse> {
  if (process.env.ALLOW_BROWSER_SESSION_BODY_CAPTURE === 'true' && body.storageState) {
    return { finalUrl: body.finalUrl, storageState: body.storageState };
  }
  const baseUrl = browserSessionRuntimeBaseUrl();
  if (!baseUrl) throw new GuardrailError('TOOL_UNAVAILABLE', 'Browser session runtime is unavailable');
  const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/storage-state`, { method: 'POST' });
  if (!res.ok) throw new GuardrailError('TOOL_UNAVAILABLE', 'Unable to capture browser session state');
  return (await res.json()) as RuntimeStorageResponse;
}

async function cancelRuntimeSession(sessionId: string): Promise<void> {
  const baseUrl = browserSessionRuntimeBaseUrl();
  if (!baseUrl) return;
  await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

function objectOf(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}
