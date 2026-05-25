/**
 * OpenHack mini-hunter pack.
 *
 * Rule-based detectors that turn browser observations + scanner candidates
 * into FindingCandidates. We ship five hunters for v1 per PLAN_V3 §5.4:
 *
 *   1. Vibe-code Exposure Hunter        — looks at non-prod hosts/CORS/csp/debug pages.
 *   2. Frontend Secret & Storage Hunter — flags token-shaped values in localStorage.
 *   3. API Surface Hunter               — flags unauthenticated mutating endpoints.
 *   4. Auth/Session Smoke Hunter        — flags missing httpOnly/secure/sameSite on session cookies.
 *   5. AI App Smoke Hunter              — flags exposed prompt config / model leakage.
 *
 * Each hunter returns FindingCandidate[]. The runner aggregates them, dedupes,
 * and exposes a `warnings` + `coverageGaps` array for the report writer.
 */

import type { BrowserObservation } from '@x-hunter/browser-inspector';
import type { ZapSignalResult } from '@x-hunter/zap-signal';
import type { NucleiSignalResult } from '@x-hunter/nuclei-signal';
import {
  type FindingCandidate,
  type Logger,
  createLogger,
  sanitizeText,
  sanitizeValue,
  type ScanMode,
  type ScopeSnapshot,
} from '@x-hunter/shared';
import { vibeCodeExposureHunter } from './hunters/vibe-code-exposure.js';
import { frontendSecretHunter } from './hunters/frontend-secret.js';
import { apiSurfaceHunter } from './hunters/api-surface.js';
import { authSessionHunter } from './hunters/auth-session.js';
import { aiAppSmokeHunter } from './hunters/ai-app-smoke.js';

export interface OpenHackInput {
  scanId: string;
  projectId: string;
  scope: ScopeSnapshot;
  mode: ScanMode;
  browser: BrowserObservation;
  zap?: ZapSignalResult;
  nuclei?: NucleiSignalResult;
  logger?: Logger;
}

export interface OpenHackResult {
  candidates: FindingCandidate[];
  warnings: string[];
  hardeningSuggestions: string[];
  coverageGaps: string[];
}

export async function runOpenHackHunters(input: OpenHackInput): Promise<OpenHackResult> {
  const log = input.logger ?? createLogger({ component: 'openhack-hunter' });
  const candidates: FindingCandidate[] = [];
  const warnings: string[] = [];
  const hardening: string[] = [];
  const gaps: string[] = [];

  const hunters = [
    vibeCodeExposureHunter,
    frontendSecretHunter,
    apiSurfaceHunter,
    authSessionHunter,
    aiAppSmokeHunter,
  ];
  for (const h of hunters) {
    try {
      const out = h(input);
      candidates.push(...out.candidates);
      warnings.push(...out.warnings);
      hardening.push(...out.hardening);
      gaps.push(...out.coverageGaps);
    } catch (err) {
      log.warn('openhack_hunter_failed', { hunter: h.name, msg: String(err) });
      gaps.push(`hunter_${h.name}_failed`);
    }
  }

  // Final defensive sanitize on all candidate evidence.
  for (const c of candidates) {
    c.evidence.description = sanitizeText(c.evidence.description).slice(0, 1500);
    if (c.rawSignal) c.rawSignal = sanitizeValue(c.rawSignal) as Record<string, unknown>;
  }

  return { candidates, warnings, hardeningSuggestions: hardening, coverageGaps: gaps };
}
