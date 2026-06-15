import type { AuthScope, PackageTier, ScanMode, SurfaceFlags, TargetType, TestIntensityMode } from './packages.js';
import type { Confidence, Severity } from './types.js';
import { sanitizeText, sanitizeValue } from './sanitizer.js';

export const REPORT_FORMAT_VERSION = 'report_v1' as const;

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

export interface ReportFindingV1 {
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
}

export interface ReportContentV1 {
  formatVersion: typeof REPORT_FORMAT_VERSION;
  reportType: 'finding_report' | 'coverage_only';
  packageTier: PackageTier;
  scanMode: ScanMode;
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
  findings: ReportFindingV1[];
  developerFixPack: Array<{
    findingId: string;
    rootCauseHypothesis: string;
    concreteFixPrompt: string;
    validationSteps: string[];
    regressionTestIdeas: string[];
    acceptanceCriteria: string;
  }>;
  coverage: {
    targetType: TargetType;
    workersRun: string[];
    huntersRun: string[];
    skippedHunters: Array<{ hunter: string; reason: string }>;
    coverageGaps: string[];
    limitations: string[];
  };
  hardeningRecommendations: string[];
  retestAndMonitor: {
    eligibleFindings: string[];
    remainingRetestQuota: number;
    cooldownDays: number;
    manualRetestActions: string[];
  };
  generatedAt: string;
}

export interface RankRecommendation {
  id: string;
  rank: number;
  reason?: string;
}

export function sanitizeReportContent<T>(content: T): T {
  return sanitizeValue(content) as T;
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

export function renderReportMarkdown(content: ReportContentV1): string {
  const findingLines =
    content.findings.length > 0
      ? content.findings
          .map(
            (finding) =>
              `${finding.rank}. ${finding.title} (${finding.severity}/${finding.confidence}) - ${finding.affectedAsset}`,
          )
          .join('\n')
      : 'No valuable finding was confirmed within the scan budget.';

  return sanitizeText(`# OpenHunterAI Report

## Owner Summary

${content.ownerSummary.headline}

- Risk: ${content.ownerSummary.riskLevel}
- Tested: ${content.ownerSummary.whatWasTested}
- Outcome: ${content.ownerSummary.topRiskOrOutcome}
- Next action: ${content.ownerSummary.recommendedNextAction}

## Findings

${findingLines}

## Coverage

- Target type: ${content.coverage.targetType}
- Pipeline: ${content.coverage.workersRun.join(', ') || 'none'}
- Hunters run: ${content.coverage.huntersRun.join(', ') || 'none'}
- Limitations: ${content.coverage.limitations.join('; ') || 'none'}
`);
}

export function renderReportHtml(content: ReportContentV1, latestOverlay?: unknown): string {
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
      : '<p>No valuable finding was confirmed within the scan budget.</p>';

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
  <section>
    <h2>Coverage</h2>
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
