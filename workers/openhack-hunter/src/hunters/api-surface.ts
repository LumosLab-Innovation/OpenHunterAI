import type { Hunter, HunterOutput } from './types.js';

export const apiSurfaceHunter: Hunter = Object.assign(
  function apiSurfaceHunter(input): HunterOutput {
    const out: HunterOutput = { candidates: [], warnings: [], hardening: [], coverageGaps: [] };
    const mutating = input.browser.apiEndpoints.filter((e) =>
      e.methods.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m.toUpperCase())),
    );
    for (const e of mutating) {
      const url = e.url;
      // We won't actively probe; we just surface mutating endpoints so the
      // human reviewer can check if they are protected.
      out.warnings.push(
        `Mutating endpoint observed: ${e.methods.join(',')} ${url}${e.pathPattern ? ` (pattern: ${e.pathPattern})` : ''}.`,
      );
    }
    // ID-pattern paths often imply IDOR-class risk if access control is weak.
    const idPattern = mutating.filter((e) => e.pathPattern?.includes(':id')).length;
    if (idPattern >= 1) {
      out.candidates.push({
        source: 'openhack',
        title: `Mutating endpoint(s) with id-pattern paths`,
        severity: 'medium',
        confidence: 'low',
        category: 'api-surface',
        affectedAsset: `${idPattern} endpoints`,
        evidence: {
          description:
            `Detected ${idPattern} mutating endpoint(s) where the path contains an id segment. ` +
            `Review whether these endpoints enforce object-level access control (BOLA / IDOR risk).`,
          sanitized: true,
        },
      });
    }
    if (mutating.length === 0) {
      out.coverageGaps.push('no_mutating_endpoints_observed');
    }
    return out;
  },
  { name: 'api-surface' },
);
