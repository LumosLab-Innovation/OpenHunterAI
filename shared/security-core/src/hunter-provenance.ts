import { HUNTER_IDS, type HunterId } from './scan-plan.js';

/**
 * Provenance metadata for hunters / playbooks / reasoning guides that are enriched
 * from upstream sources. This is a metadata layer over the canonical hunter ids the
 * Scan Plan emits (see scan-plan.ts HUNTER_IDS); it does not select or run anything.
 *
 * Process rules: docs/MANUAL_UPSTREAM_ENRICHMENT_POLICY.md.
 * Registry: tools/enrichment/upstream-sources.json.
 */

export const UPSTREAM_IDS = [
  'openhunter_core',
  'openhack',
  'strix',
  'zap',
  'nuclei',
  'claude_bughunter',
] as const;
export type UpstreamId = (typeof UPSTREAM_IDS)[number];

export const IMPORT_MODES = [
  'native',
  'reference_only',
  'reasoning_guide',
  'runtime_adapter',
  'curated_content',
] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export interface HunterSource {
  upstreamId: UpstreamId;
  upstreamUrl: string;
  upstreamRef?: string;
  upstreamPath?: string;
  importMode: ImportMode;
  importedBy: 'manual_claude_code_run';
  /** Optional. MUST NOT be included in any snapshot/equality test (it is non-deterministic). */
  importedAt?: string;
  licenseNote?: string;
}

export interface HunterProvenance {
  /** Must be a hunter id the Scan Plan can emit (scan-plan.ts HUNTER_IDS). */
  hunterId: HunterId;
  source: HunterSource;
}

const HUNTER_ID_SET = new Set<string>(HUNTER_IDS);

export function isHunterId(value: string): value is HunterId {
  return HUNTER_ID_SET.has(value);
}

/**
 * Validates a provenance record against the policy invariants. Returns the list of
 * problems; an empty array means the record is valid.
 */
export function validateHunterProvenance(p: HunterProvenance): string[] {
  const problems: string[] = [];

  if (!isHunterId(p.hunterId)) {
    problems.push(`hunterId "${p.hunterId}" is not a hunter the Scan Plan can emit`);
  }
  if (!UPSTREAM_IDS.includes(p.source.upstreamId)) {
    problems.push(`unknown upstreamId "${p.source.upstreamId}"`);
  }
  if (!IMPORT_MODES.includes(p.source.importMode)) {
    problems.push(`unknown importMode "${p.source.importMode}"`);
  }
  if (p.source.importedBy !== 'manual_claude_code_run') {
    problems.push('importedBy must be "manual_claude_code_run" (no auto sync)');
  }

  // ZAP and Nuclei are signal layers, not business-logic hunters. They cannot be the
  // origin of a hunter playbook; their import modes are runtime/curated only.
  if (p.source.upstreamId === 'zap' && p.source.importMode !== 'runtime_adapter') {
    problems.push('zap may only contribute runtime_adapter capability, not hunter playbooks');
  }
  if (p.source.upstreamId === 'nuclei' && !['runtime_adapter', 'curated_content'].includes(p.source.importMode)) {
    problems.push('nuclei may only contribute runtime_adapter or curated_content, not hunter playbooks');
  }

  return problems;
}
