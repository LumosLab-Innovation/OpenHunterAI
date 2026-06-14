import { type HunterId } from './scan-plan.js';
import { type HunterProvenance } from './hunter-provenance.js';

/**
 * Hunter Playbook Catalog.
 *
 * A metadata/reasoning layer over the canonical hunter ids the deterministic Scan Plan
 * emits (scan-plan.ts HUNTER_IDS). This catalog does NOT select or run hunters — the Scan
 * Plan still owns selection. It carries:
 *   - reasoningGuides:  attacker-mindset prompts for the high_reasoning_model (Strix-style)
 *   - validationGate:   questions every candidate must pass before becoming a finding
 *   - evidenceHygiene:  redaction rules for any captured evidence
 *   - provenance:       where the guidance was enriched from (manual run only)
 *
 * Enriched manually per docs/MANUAL_UPSTREAM_ENRICHMENT_POLICY.md. Reasoning guides must
 * be used with compact, sanitized context and must respect Test Intensity Mode and
 * approval gates. Nothing here authorizes out-of-scope or destructive actions.
 */

export interface HunterPlaybook {
  hunterId: HunterId;
  title: string;
  /** Attacker-mindset reasoning prompts for the high_reasoning_model. */
  reasoningGuides: string[];
  /** Questions a candidate must pass before being promoted to a finding. */
  validationGate: string[];
  /** Evidence redaction rules applied before persistence/report. */
  evidenceHygiene: string[];
  provenance: HunterProvenance[];
}

const CBH = {
  upstreamId: 'claude_bughunter' as const,
  upstreamUrl: 'https://github.com/elementalsouls/Claude-BugHunter',
  upstreamRef: 'main',
  importMode: 'reasoning_guide' as const,
  importedBy: 'manual_claude_code_run' as const,
  licenseNote: 'MIT',
};

const OPENHACK = {
  upstreamId: 'openhack' as const,
  upstreamUrl: 'https://github.com/hadriansecurity/openhack',
  importMode: 'reference_only' as const,
  importedBy: 'manual_claude_code_run' as const,
};

/**
 * Validation gate shared by all playbooks. Derived from Claude-BugHunter's
 * triage-validation "7-Question Gate", trimmed to v1 in-scope concerns. One failed
 * question kills the candidate finding (it does not stop the scan).
 */
export const SHARED_VALIDATION_GATE: string[] = [
  'Can an attacker use this right now, expressed as a concrete in-scope request? If you cannot write the request, kill the candidate.',
  'Is the root cause in an in-scope, verified asset (not out-of-scope, not private/internal)?',
  'Is there real signal, not a guess? No signal means coverage_gap, never a fabricated finding.',
  'Does demonstrating impact stay within Test Intensity Mode and the allowed validation level?',
  'Do any sensitive actions (state change, access-control, test-account use) require an approval gate first?',
];

export const SHARED_EVIDENCE_HYGIENE: string[] = [
  'Redact your-account secrets: session cookies, Authorization/Bearer tokens, API keys, CSRF tokens bound to your session.',
  "Redact other users' PII (names, emails, phones, faces) unless cross-account impact is the point; even then minimize.",
  'Leave triager-useful, non-sensitive metadata visible: trace ids, request ids, response shapes, your test-account label.',
  'Persist only masked fingerprint/hash/metadata for any discovered secret, and recommend rotate/revoke.',
  'Never persist raw HAR, raw request/response, or unsanitized PII in DB, logs, prompts, reports, or storage.',
];

export const HUNTER_PLAYBOOKS: HunterPlaybook[] = [
  {
    hunterId: 'session_auth',
    title: 'Session & Authentication',
    reasoningGuides: [
      'Treat every session token as untrusted: test fixation, missing rotation on privilege change, and weak logout/invalidation.',
      'Probe authentication boundaries (login, MFA step-up, password reset) for response/timing oracles within scope.',
    ],
    validationGate: SHARED_VALIDATION_GATE,
    evidenceHygiene: SHARED_EVIDENCE_HYGIENE,
    provenance: [
      { hunterId: 'session_auth', source: { ...CBH, upstreamPath: 'skills/hunt-auth-bypass' } },
      { hunterId: 'session_auth', source: { ...OPENHACK, upstreamPath: 'agents/experts/authentication-failures.md' } },
    ],
  },
  {
    hunterId: 'admin_like_surface',
    title: 'Admin-like Surface & Access Control',
    reasoningGuides: [
      'Treat every object reference as untrusted until proven bound to the caller: test horizontal, vertical, and cross-tenant access.',
      'Check projection/expansion knobs (fields, include, expand, populate) that often bypass authorization in resolvers/serializers.',
    ],
    validationGate: SHARED_VALIDATION_GATE,
    evidenceHygiene: SHARED_EVIDENCE_HYGIENE,
    provenance: [
      { hunterId: 'admin_like_surface', source: { ...CBH, upstreamPath: 'skills/hunt-idor' } },
      { hunterId: 'admin_like_surface', source: { ...OPENHACK, upstreamPath: 'agents/experts/broken-access-control.md' } },
    ],
  },
  {
    hunterId: 'data_exposure',
    title: 'Data Exposure',
    reasoningGuides: [
      'Hunt for over-broad responses: mass assignment, verbose errors, and unfiltered list/export endpoints leaking other tenants.',
      'Prioritize exports/backups/reporting endpoints and billing/PII/PHI surfaces as high-value targets.',
    ],
    validationGate: SHARED_VALIDATION_GATE,
    evidenceHygiene: SHARED_EVIDENCE_HYGIENE,
    provenance: [
      { hunterId: 'data_exposure', source: { ...CBH, upstreamPath: 'skills/hunt-api-misconfig' } },
      { hunterId: 'data_exposure', source: { ...OPENHACK, upstreamPath: 'agents/experts/sensitive-information-exposure.md' } },
    ],
  },
  {
    hunterId: 'ai_prompt',
    title: 'AI / LLM Prompt Surface',
    reasoningGuides: [
      'Probe prompt-injection and instruction-override against the chat surface within scope; do not attempt model exfiltration or jailbreak chains beyond demonstrating the boundary.',
      'Check tool-calling and RAG retrieval for untrusted-input-to-action paths.',
    ],
    validationGate: SHARED_VALIDATION_GATE,
    evidenceHygiene: SHARED_EVIDENCE_HYGIENE,
    provenance: [
      { hunterId: 'ai_prompt', source: { ...CBH, upstreamPath: 'skills/hunt-llm-ai' } },
    ],
  },
];

export function getPlaybook(hunterId: HunterId): HunterPlaybook | undefined {
  return HUNTER_PLAYBOOKS.find((p) => p.hunterId === hunterId);
}
