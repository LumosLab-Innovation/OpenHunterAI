/**
 * Browser Inspector worker.
 *
 * Drives a Chromium instance through Playwright, navigates the verified
 * domain (and a small set of same-origin links), and records:
 *
 *   - routes visited (URL, method, status)
 *   - cross-origin or in-scope API endpoints called by the page
 *   - cookies (attributes only — values masked by the sanitizer)
 *   - localStorage / sessionStorage keys (values masked)
 *   - console errors (sanitized)
 *
 * The worker enforces the scan's ScopeSnapshot for every request:
 *   - Out-of-scope navigations are blocked by `route.abort()`.
 *   - Redirects out of scope cause the run to fail with REDIRECT_OUT_OF_SCOPE.
 *
 * If Playwright isn't installed, the worker returns TOOL_UNAVAILABLE — the
 * orchestrator will mark the step as `skipped` and continue with degraded
 * coverage (per ACCEPTANCE_CRITERIA §16).
 */

import {
  assertInScope,
  createLogger,
  GuardrailError,
  isGuardrailError,
  isHostAllowed,
  type Logger,
  normalizeUrl,
  sanitizeText,
  type ScanMode,
  type ScopeSnapshot,
  sanitizeValue,
} from '@x-hunter/shared';
import { BaseWorker, type WorkerContext, type WorkerResult } from '@x-hunter/worker-runtime';

export interface BrowserInspectorInput {
  scanId: string;
  projectId: string;
  packageTier: 'free' | 'light' | 'standard' | 'auth' | 'launch';
  scope: ScopeSnapshot;
  mode: ScanMode;
  /** Optional explicit seed URL. Defaults to https://<verifiedDomain>/. */
  seedUrl?: string;
  /** Page navigation budget. */
  maxPages?: number;
  logger?: Logger;
}

export interface ObservedRoute {
  url: string;
  method: string;
  statusCode?: number;
  contentType?: string;
}

export interface ObservedApiEndpoint {
  url: string;
  methods: string[];
  pathPattern?: string;
}

export interface ObservedCookie {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  domain?: string;
  path?: string;
}

export interface ObservedStorageKey {
  scope: 'localStorage' | 'sessionStorage';
  keyName: string;
  looksTokenLike: boolean;
}

export interface BrowserObservation {
  routes: ObservedRoute[];
  apiEndpoints: ObservedApiEndpoint[];
  cookies: ObservedCookie[];
  storageKeys: ObservedStorageKey[];
  consoleErrors: string[];
  /** Pages that we tried to fetch but the policy gate blocked. */
  policyBlocks: Array<{ url: string; code: string }>;
}

class BrowserInspectorWorker extends BaseWorker<BrowserInspectorInput, BrowserObservation> {
  protected async run(input: BrowserInspectorInput, signal: AbortSignal): Promise<BrowserObservation> {
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch {
      throw new GuardrailError('TOOL_UNAVAILABLE', 'Playwright is not installed');
    }

    const seedRaw = input.seedUrl ?? `https://${input.scope.verifiedDomain}/`;
    const seed = normalizeUrl(seedRaw);
    assertInScope(seed.url.toString(), input.scope);

    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const context = await browser.newContext({
        userAgent: 'X-hunter-Inspector/0.1 (+https://example.com/info)',
        viewport: { width: 1280, height: 720 },
        bypassCSP: false,
        recordVideo: undefined,
      });

      const routes: ObservedRoute[] = [];
      const apiMap = new Map<string, Set<string>>();
      const consoleErrors: string[] = [];
      const policyBlocks: Array<{ url: string; code: string }> = [];

      const page = await context.newPage();

      // Block requests outside scope. Allow CSS/JS/IMG to same-origin and CDNs;
      // record API calls.
      await page.route('**/*', async (route, req) => {
        const url = req.url();
        try {
          const u = new URL(url);
          if (!isHostAllowed(u.hostname.toLowerCase(), input.scope.allowedHosts)) {
            // CDN-style 3p assets are fine — we just don't follow them as routes.
            // We let GET asset types through (static); for navigation we abort.
            const type = req.resourceType();
            if (type === 'image' || type === 'font' || type === 'media' || type === 'stylesheet' || type === 'script') {
              await route.continue();
              return;
            }
            policyBlocks.push({ url, code: 'OUT_OF_SCOPE_HOST' });
            await route.abort();
            return;
          }
          // Inside scope: record as observed API/route.
          await route.continue();
        } catch {
          await route.abort();
        }
      });

      page.on('response', (res) => {
        const url = res.url();
        const method = res.request().method().toUpperCase();
        const statusCode = res.status();
        try {
          const u = new URL(url);
          if (!isHostAllowed(u.hostname.toLowerCase(), input.scope.allowedHosts)) return;
          const resourceType = res.request().resourceType();
          if (resourceType === 'document') {
            routes.push({ url, method, statusCode, contentType: res.headers()['content-type'] });
          } else if (resourceType === 'xhr' || resourceType === 'fetch') {
            const key = u.origin + u.pathname;
            if (!apiMap.has(key)) apiMap.set(key, new Set());
            apiMap.get(key)!.add(method);
          }
        } catch {
          /* ignore */
        }
      });

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(sanitizeText(msg.text()).slice(0, 1000));
        }
      });

      const navTimeout = pageTimeoutMs(input.mode);
      const maxPages = input.maxPages ?? defaultMaxPages(input.mode);
      const queue: string[] = [seed.url.toString()];
      const visited = new Set<string>();

      while (queue.length > 0 && visited.size < maxPages) {
        if (signal.aborted) throw new GuardrailError('TIMEOUT', 'browser-inspector aborted');
        const next = queue.shift()!;
        if (visited.has(next)) continue;
        visited.add(next);
        try {
          const res = await page.goto(next, { timeout: navTimeout, waitUntil: 'load' });
          if (res && res.url() !== next) {
            try {
              assertInScope(res.url(), input.scope, { asRedirect: true });
            } catch (e) {
              if (isGuardrailError(e)) {
                policyBlocks.push({ url: res.url(), code: e.code });
                continue;
              }
              throw e;
            }
          }
          // After settling, collect same-origin anchor hrefs.
          const links = await page.$$eval('a[href]', (els) =>
            (els as HTMLAnchorElement[]).map((e) => e.href).filter(Boolean),
          );
          for (const link of links) {
            try {
              const ln = normalizeUrl(link);
              if (isHostAllowed(ln.hostname, input.scope.allowedHosts)) {
                const candidate = ln.url.toString();
                if (!visited.has(candidate) && queue.length + visited.size < maxPages) {
                  queue.push(candidate);
                }
              }
            } catch {
              /* ignore bad hrefs */
            }
          }
        } catch (e) {
          // Per-page navigation errors are non-fatal — record and continue.
          consoleErrors.push(
            sanitizeText(`navigate_failed url=${next}: ${e instanceof Error ? e.message : String(e)}`).slice(0, 1000),
          );
        }
      }

      // Cookies and storage from the final state.
      const rawCookies = await context.cookies();
      const cookies: ObservedCookie[] = rawCookies.map((c) => ({
        name: c.name,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        domain: c.domain,
        path: c.path,
      }));
      const storageKeys: ObservedStorageKey[] = await page.evaluate(() => {
        function describe(scope: 'localStorage' | 'sessionStorage', store: Storage): ObservedStorageKey[] {
          const out: ObservedStorageKey[] = [];
          for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (!key) continue;
            const value = store.getItem(key) ?? '';
            out.push({
              scope,
              keyName: key,
              looksTokenLike: value.length > 20 && /[A-Za-z0-9._-]{16,}/.test(value),
            });
          }
          return out;
        }
        return [...describe('localStorage', window.localStorage), ...describe('sessionStorage', window.sessionStorage)];
      });

      const apiEndpoints: ObservedApiEndpoint[] = Array.from(apiMap.entries()).map(([url, methods]) => ({
        url,
        methods: Array.from(methods),
        pathPattern: detectPathPattern(new URL(url).pathname),
      }));

      const result: BrowserObservation = {
        routes,
        apiEndpoints,
        cookies,
        storageKeys,
        consoleErrors,
        policyBlocks,
      };
      // Final sanitize pass to be safe — sanitizeValue is recursive and idempotent.
      return sanitizeValue(result) as BrowserObservation;
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

function pageTimeoutMs(mode: ScanMode): number {
  switch (mode) {
    case 'free':
      return 15_000;
    case 'light':
      return 25_000;
    case 'standard':
      return 35_000;
    case 'auth':
      return 45_000;
    default:
      return 25_000;
  }
}
function defaultMaxPages(mode: ScanMode): number {
  switch (mode) {
    case 'free':
      return 6;
    case 'light':
      return 12;
    case 'standard':
      return 25;
    case 'auth':
      return 35;
    default:
      return 12;
  }
}

function detectPathPattern(path: string): string | undefined {
  // Collapse numeric / uuid path segments to :id markers.
  const parts = path.split('/').map((p) => {
    if (/^\d+$/.test(p)) return ':id';
    if (/^[0-9a-f-]{8,}$/i.test(p)) return ':id';
    return p;
  });
  const collapsed = parts.join('/');
  return collapsed === path ? undefined : collapsed;
}

export async function runBrowserInspector(
  input: BrowserInspectorInput,
): Promise<WorkerResult<BrowserObservation>> {
  const ctx: WorkerContext = {
    scanId: input.scanId,
    projectId: input.projectId,
    workerType: 'browser_inspector',
    timeoutMs: workerTimeoutMs(input.mode),
    maxAttempts: 1,
    logger: input.logger ?? createLogger({ component: 'browser-inspector' }),
  };
  const w = new BrowserInspectorWorker(ctx);
  return w.execute(input);
}

function workerTimeoutMs(mode: ScanMode): number {
  switch (mode) {
    case 'free':
      return 120_000;
    case 'light':
      return 240_000;
    case 'standard':
      return 600_000;
    case 'auth':
      return 900_000;
    default:
      return 240_000;
  }
}
