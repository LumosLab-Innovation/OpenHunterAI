import { reportHandoffSchema, type ReportHandoff } from './report-handoff.js';
import type { AuthScope, ScanProfile, SurfaceFlags, TargetType, TestIntensityMode } from './packages.js';
import type { Confidence, Severity } from './types.js';
import { sanitizeText, sanitizeValue } from './sanitizer.js';

export const REPORT_FORMAT_VERSION = 'report_v2' as const;

export const REPORT_STATES = ['draft', 'final', 'superseded'] as const;
export const REPORT_DRAFT_SECTION_KEYS = [
  'scope',
  'coverage',
  'signals',
  'ranking',
  'findings',
  'hardening',
  'retest',
  'limitations',
] as const;
export const REPORT_DRAFT_SECTION_STATES = ['pending', 'running', 'ready', 'failed'] as const;

export type ReportState = (typeof REPORT_STATES)[number];
export type ReportDraftSectionKey = (typeof REPORT_DRAFT_SECTION_KEYS)[number];
export type ReportDraftSectionState = (typeof REPORT_DRAFT_SECTION_STATES)[number];

export interface ReportFindingV2 {
  id: string;
  rank: number;
  title: string;
  severity: Severity;
  confidence: Confidence;
  affectedAsset: string;
  category: string;
  attackerPath: string;
  sanitizedProof: {
    description: string;
    evidenceRefs: string[];
    sanitized: true;
  };
  impact: string;
  fixSummary: string;
  retestScenario?: unknown;
  validationStatus: 'validated';
}

export interface ReportContentV2 {
  formatVersion: typeof REPORT_FORMAT_VERSION;
  reportType: 'finding_report' | 'coverage_only';
  profile: ScanProfile;
  targetType: TargetType;
  authScope: AuthScope;
  testIntensityMode: TestIntensityMode;
  surfaceFlags: SurfaceFlags;
  ownerSummary: {
    headline: string;
    riskLevel: Severity | 'none';
    whatWasTested: string;
    topRiskOrOutcome: string;
    businessImpact: string;
    recommendedNextAction: string;
  };
  findings: ReportFindingV2[];
  /** Historical snapshots are retained without implying independent replay. */
  historicalFindings?: Array<Omit<ReportFindingV2, 'validationStatus'> & { validationStatus: 'legacy_unverified' }>;
  developerFixPack: Array<{
    findingId: string;
    rootCauseHypothesis: string;
    concreteFixPrompt: string;
    validationSteps: string[];
    regressionTestIdeas: string[];
    acceptanceCriteria: string;
  }>;
  historicalDeveloperFixPack?: ReportContentV2['developerFixPack'];
  coverage: {
    targetType: TargetType;
    workersRun: string[];
    /** Planned hunter families are not proof that each scenario ran. */
    huntersPlanned?: string[];
    huntersRun: string[];
    skippedHunters: Array<{ hunter: string; reason: string }>;
    coverageGaps: string[];
    limitations: string[];
    unvalidatedCandidates?: number;
  };
  hardeningRecommendations: string[];
  retest: {
    eligibleFindings: string[];
    manualRetestActions: string[];
  };
  generatedAt: string;
  handoff?: ReportHandoff;
}

export interface RankRecommendation {
  id: string;
  rank: number;
  reason?: string;
}

export interface WorkerStepSummary {
  kind: string;
  state: string;
  errorCode?: string | null;
  outputRef?: unknown;
}

/** Converts persisted worker outcomes into honest report coverage. */
export function deriveWorkerCoverage(steps: WorkerStepSummary[], expectedWorkers: string[] = []): {
  workersRun: string[];
  coverageGaps: string[];
  limitations: string[];
} {
  const workersRun = new Set<string>();
  const coverageGaps = new Set<string>();
  const limitations = new Set<string>();
  for (const step of steps) {
    if (step.state !== 'skipped' && step.state !== 'pending' && step.state !== 'running') {
      workersRun.add(step.kind);
    }
    const output = objectValue(step.outputRef);
    const coverage = objectValue(output.coverage);
    for (const gap of stringValues(coverage.gaps)) coverageGaps.add(sanitizeText(gap));
    for (const limitation of stringValues(output.limitations)) limitations.add(sanitizeText(limitation));
    if (step.state === 'failed' || step.state === 'skipped' || output.coverageGap === true || output.status === 'partial') {
      coverageGaps.add(`${step.kind}:${step.errorCode || output.status || step.state}`);
    }
  }
  const observedKinds = new Set(steps.map((step) => step.kind));
  for (const expected of expectedWorkers) {
    const kind = canonicalWorkerKind(expected);
    if (!observedKinds.has(kind)) coverageGaps.add(`${kind}:not_started`);
  }
  return {
    workersRun: [...workersRun],
    coverageGaps: [...coverageGaps].filter(Boolean),
    limitations: [...limitations].filter(Boolean),
  };
}

function canonicalWorkerKind(value: string): string {
  switch (value.toLowerCase().replace(/[-\s]/g, '_')) {
    case 'browser': case 'browser_inspector': return 'browser_inspector';
    case 'zap': case 'z': case 'zap_signal': return 'zap_signal';
    case 'nuclei': case 'n': case 'nuclei_signal': return 'nuclei_signal';
    case 'openhack': case 'o': case 'openhack_hunter': return 'openhack_hunter';
    case 'strix': case 's': case 'strix_core': return 'strix_core';
    default: return value;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const object = value as Record<string, unknown>;
  if (object.sanitized === true && object.value && typeof object.value === 'object') {
    return object.value as Record<string, unknown>;
  }
  return object;
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function sanitizeReportContent<T>(content: T): T {
  const sanitized = sanitizeValue(content) as T;
  if (content && typeof content === 'object' && 'handoff' in content) {
    const metadata = reportHandoffSchema.safeParse(content.handoff);
    if (metadata.success) (sanitized as Record<string, unknown>).handoff = metadata.data;
  }
  return sanitized;
}

/** A persisted finding is reportable only with a separate independent decision. */
export function isIndependentlyValidatedFinding(finding: {
  candidates?: Array<{ triageDecision?: { state?: string; validator?: string } | null }>;
}): boolean {
  return Array.isArray(finding.candidates) && finding.candidates.some(
    (candidate) => candidate.triageDecision?.state === 'validated' &&
      candidate.triageDecision.validator === 'independent_policy_v1',
  );
}

export function applyRankRecommendations<T extends { id: string }>(
  findings: T[],
  recommendations: RankRecommendation[],
): T[] {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const seen = new Set<string>();
  const ranked = recommendations
    .filter((item) => byId.has(item.id) && !seen.has(item.id))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => {
      seen.add(item.id);
      return byId.get(item.id)!;
    });

  const remainder = findings.filter((finding) => !seen.has(finding.id));
  return [...ranked, ...remainder];
}

export function renderReportMarkdown(content: ReportContentV2): string {
  const findingLines =
    content.findings.length > 0
      ? content.findings
          .map(
            (finding) =>
              `${finding.rank}. ${finding.title} (${finding.severity}/${finding.confidence}) - ${finding.affectedAsset}`,
          )
          .join('\n')
      : 'No finding was independently validated. Review coverage gaps before treating this as a clean result.';

  const historicalLines = (content.historicalFindings ?? [])
    .map((finding) => `- ${finding.title} (${finding.affectedAsset}) — legacy_unverified; replay required`)
    .join('\n');

  return sanitizeText(`# OpenHunterAI Report

## Owner Summary

${content.ownerSummary.headline}

- Risk: ${content.ownerSummary.riskLevel}
- Tested: ${content.ownerSummary.whatWasTested}
- Outcome: ${content.ownerSummary.topRiskOrOutcome}
- Next action: ${content.ownerSummary.recommendedNextAction}

## Findings

${findingLines}

${historicalLines ? `## Historical observations (unverified)\n\n${historicalLines}\n` : ''}

## Coverage

- Target type: ${content.coverage.targetType}
- Pipeline: ${content.coverage.workersRun.join(', ') || 'none'}
- Hunter families planned: ${content.coverage.huntersPlanned?.join(', ') || 'none'}
- Hunter families with execution evidence: ${content.coverage.huntersRun.join(', ') || 'none'}
- Coverage gaps: ${content.coverage.coverageGaps.join('; ') || 'none'}
- Limitations: ${content.coverage.limitations.join('; ') || 'none'}
`);
}

export function renderReportHtml(content: ReportContentV2, latestOverlay?: unknown): string {
  const overlay = latestOverlay ? `<script type="application/json" id="latest-overlay">${escapeHtml(JSON.stringify(latestOverlay))}</script>` : '';
  const findings =
    content.findings.length > 0
      ? content.findings
          .map(
            (finding) => `<article class="finding">
  <h2>${escapeHtml(`${finding.rank}. ${finding.title}`)}</h2>
  <p><strong>${escapeHtml(finding.severity)}</strong> / ${escapeHtml(finding.confidence)} - ${escapeHtml(finding.affectedAsset)}</p>
  <p>${escapeHtml(finding.impact)}</p>
  <h3>Sanitized proof</h3>
  <p>${escapeHtml(finding.sanitizedProof.description)}</p>
  <h3>Fix</h3>
  <p>${escapeHtml(finding.fixSummary)}</p>
</article>`,
          )
          .join('\n')
      : '<p>No finding was independently validated. Review coverage gaps before treating this as a clean result.</p>';

  const historicalFindings = (content.historicalFindings ?? [])
    .map((finding) => `<li>${escapeHtml(finding.title)} — ${escapeHtml(finding.affectedAsset)} (legacy_unverified; replay required)</li>`)
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OpenHunterAI Report</title>
  <style>
    body { color: #171717; font-family: Arial, sans-serif; margin: 40px; line-height: 1.55; }
    .meta, .finding { border-top: 1px solid #ddd; padding-top: 16px; }
    .badge { background: #eee; border-radius: 999px; display: inline-block; padding: 4px 9px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(content.ownerSummary.headline)}</h1>
  <p class="badge">Risk: ${escapeHtml(content.ownerSummary.riskLevel)}</p>
  <section class="meta">
    <p><strong>Tested:</strong> ${escapeHtml(content.ownerSummary.whatWasTested)}</p>
    <p><strong>Outcome:</strong> ${escapeHtml(content.ownerSummary.topRiskOrOutcome)}</p>
    <p><strong>Next action:</strong> ${escapeHtml(content.ownerSummary.recommendedNextAction)}</p>
  </section>
  <section>
    <h2>Findings</h2>
    ${findings}
  </section>
  ${historicalFindings ? `<section><h2>Historical observations (unverified)</h2><ul>${historicalFindings}</ul></section>` : ''}
  <section>
    <h2>Coverage</h2>
    <p><strong>Coverage gaps:</strong> ${escapeHtml(content.coverage.coverageGaps.join('; ') || 'none')}</p>
    <p>${escapeHtml(content.coverage.limitations.join('; ') || 'No material limitations recorded.')}</p>
  </section>
  ${overlay}
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return sanitizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
