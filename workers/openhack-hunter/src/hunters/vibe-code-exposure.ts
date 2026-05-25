import type { Hunter, HunterOutput } from './types.js';

const SUSPECT_HOST_HINTS = ['staging', 'dev', 'qa', 'preview', 'next', 'beta', 'test', 'sandbox', 'internal'];
const SUSPECT_PATH_HINTS = ['/debug', '/__debug__', '/swagger', '/openapi.json', '/.env', '/.git/', '/admin'];

export const vibeCodeExposureHunter: Hunter = Object.assign(
  function vibeCodeExposureHunter(input): HunterOutput {
    const out: HunterOutput = { candidates: [], warnings: [], hardening: [], coverageGaps: [] };
    const visitedPaths = new Set(input.browser.routes.map((r) => new URL(r.url).pathname.toLowerCase()));

    // 1. Non-prod-looking hosts in scope.
    for (const h of input.scope.allowedHosts) {
      const low = h.toLowerCase();
      if (SUSPECT_HOST_HINTS.some((kw) => low.includes(kw))) {
        out.warnings.push(`Allowed host ${h} looks non-production — verify it is intentionally exposed.`);
      }
    }

    // 2. Debug / docs / git endpoints accessible.
    for (const path of SUSPECT_PATH_HINTS) {
      if ([...visitedPaths].some((p) => p === path || p.startsWith(`${path}/`))) {
        out.candidates.push({
          source: 'openhack',
          title: `Sensitive path accessible: ${path}`,
          severity: path === '/.env' || path.startsWith('/.git') ? 'high' : 'medium',
          confidence: 'medium',
          category: 'exposure',
          affectedAsset: path,
          evidence: { description: `Path ${path} was reachable on a verified host.`, sanitized: true },
        });
      }
    }

    // 3. console errors with sensitive looking content.
    for (const e of input.browser.consoleErrors) {
      if (/cors|csp|mixed content/i.test(e)) {
        out.warnings.push(`Console error suggests browser-policy issue: ${e.slice(0, 120)}`);
      }
    }

    // 4. Coverage gap: scope is very narrow (single path)
    if (input.scope.allowedPaths.length === 1) {
      out.coverageGaps.push('allowed_paths_only_single_prefix');
    }
    return out;
  },
  { name: 'vibe-code-exposure' },
);
