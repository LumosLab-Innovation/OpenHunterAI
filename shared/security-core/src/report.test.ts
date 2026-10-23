import { describe, expect, it } from 'vitest';
import {
  applyRankRecommendations,
  deriveWorkerCoverage,
  REPORT_DRAFT_SECTION_KEYS,
  REPORT_FORMAT_VERSION,
  renderReportHtml,
  renderReportMarkdown,
  sanitizeReportContent,
  type ReportContentV2,
} from './report.js';
import { DEFAULT_SURFACE_FLAGS } from './packages.js';

const baseReport: ReportContentV2 = {
  formatVersion: REPORT_FORMAT_VERSION,
  reportType: 'finding_report',
  profile: 'quick',
  targetType: 'interactive_web_app',
  authScope: 'none',
  testIntensityMode: 'safe_discovery',
  surfaceFlags: DEFAULT_SURFACE_FLAGS,
  ownerSummary: {
    headline: 'One confirmed issue',
    riskLevel: 'medium',
    whatWasTested: 'example.com',
    topRiskOrOutcome: 'A test finding was confirmed.',
    businessImpact: 'Potential account risk.',
    recommendedNextAction: 'Fix and retest.',
  },
  findings: [
    {
      id: 'f1',
      rank: 1,
      title: 'Token leaked',
      severity: 'medium',
      confidence: 'high',
      affectedAsset: 'https://example.com',
      category: 'exposure',
      attackerPath: 'Observe exposed value.',
      sanitizedProof: {
        description: 'Authorization: Bearer sk-live-secret-value',
        evidenceRefs: [],
        sanitized: true,
      },
      impact: 'Sensitive value exposure.',
      fixSummary: 'Remove secret and rotate.',
      validationStatus: 'validated',
    },
  ],
  developerFixPack: [],
  coverage: {
    targetType: 'interactive_web_app',
    workersRun: ['browser_inspector', 'Z_signal', 'N_signal', 'O_hunter', 'S_core'],
    huntersRun: ['session'],
    skippedHunters: [],
    coverageGaps: [],
    limitations: [],
  },
  hardeningRecommendations: [],
  retest: {
    eligibleFindings: ['f1'],
    manualRetestActions: ['Retest after fix.'],
  },
  generatedAt: '2026-06-07T00:00:00.000Z',
};

describe('report contract helpers', () => {
  it('exposes the canonical report sections', () => {
    expect(REPORT_DRAFT_SECTION_KEYS).toEqual([
      'scope',
      'coverage',
      'signals',
      'ranking',
      'findings',
      'hardening',
      'retest',
      'limitations',
    ]);
  });

  it('sanitizes report content before storage/export', () => {
    const sanitized = sanitizeReportContent(baseReport);
    expect(JSON.stringify(sanitized)).not.toContain('sk-live-secret-value');
    expect(JSON.stringify(sanitized)).toContain('[REDACTED_TOKEN]');
  });

  it('ignores LLM rank recommendations for unknown findings', () => {
    const ranked = applyRankRecommendations(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { id: 'unknown', rank: 1 },
        { id: 'c', rank: 2 },
      ],
    );
    expect(ranked.map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('renders sanitized HTML export content', () => {
    const html = renderReportHtml(sanitizeReportContent(baseReport));
    expect(html).toContain('<!doctype html>');
    expect(html).not.toContain('sk-live-secret-value');
    expect(html).toContain('[REDACTED_TOKEN]');
  });

  it('does not present planned hunter families as executed coverage', () => {
    const report: ReportContentV2 = {
      ...baseReport,
      coverage: {
        ...baseReport.coverage,
        huntersPlanned: ['auth', 'authorization'],
        huntersRun: [],
      },
    };
    const markdown = renderReportMarkdown(report);
    expect(markdown).toContain('Hunter families planned: auth, authorization');
    expect(markdown).toContain('Hunter families with execution evidence: none');
  });

  it('shows coverage gap codes in Markdown and HTML exports', () => {
    const report: ReportContentV2 = {
      ...baseReport,
      coverage: {
        ...baseReport.coverage,
        coverageGaps: ['llm:signal_summary:CLI_QUOTA_EXHAUSTED'],
      },
    };
    expect(renderReportMarkdown(report)).toContain('Coverage gaps: llm:signal_summary:CLI_QUOTA_EXHAUSTED');
    expect(renderReportHtml(report)).toContain('Coverage gaps:</strong> llm:signal_summary:CLI_QUOTA_EXHAUSTED');
  });

  it('keeps legacy observations visible but separate from validated findings in exports', () => {
    const report: ReportContentV2 = {
      ...baseReport,
      findings: [],
      historicalFindings: [{ ...baseReport.findings[0]!, validationStatus: 'legacy_unverified' }],
    };
    const markdown = renderReportMarkdown(report);
    const html = renderReportHtml(report);
    expect(markdown).toContain('Historical observations (unverified)');
    expect(markdown).toContain('legacy_unverified; replay required');
    expect(html).toContain('Historical observations (unverified)');
    expect(html).toContain('legacy_unverified; replay required');
  });

  it('turns skipped, failed, and partial workers into coverage gaps', () => {
    expect(
      deriveWorkerCoverage([
        { kind: 'browser_inspector', state: 'succeeded', outputRef: { status: 'succeeded' } },
        { kind: 'nuclei_signal', state: 'skipped', errorCode: 'TOOL_UNAVAILABLE', outputRef: { coverageGap: true } },
        { kind: 'strix_core', state: 'succeeded', outputRef: { status: 'partial', limitations: ['budget exhausted'], coverage: { gaps: ['one scenario untested'] } } },
      ]),
    ).toEqual({
      workersRun: ['browser_inspector', 'strix_core'],
      coverageGaps: ['nuclei_signal:TOOL_UNAVAILABLE', 'one scenario untested', 'strix_core:partial'],
      limitations: ['budget exhausted'],
    });
  });

  it('reads coverage from the persisted sanitized output envelope', () => {
    expect(deriveWorkerCoverage([{
      kind: 'strix_core', state: 'succeeded', outputRef: {
        sanitized: true,
        value: { status: 'partial', coverageGap: true, coverage: { gaps: ['STRIX_RUNTIME_NOT_EXECUTED'] }, limitations: ['Reasoning only'] },
      },
    }])).toEqual({
      workersRun: ['strix_core'],
      coverageGaps: ['STRIX_RUNTIME_NOT_EXECUTED', 'strix_core:partial'],
      limitations: ['Reasoning only'],
    });
  });

  it('never reports planned workers without a step as workers run', () => {
    expect(deriveWorkerCoverage([], ['browser', 'nuclei'])).toEqual({
      workersRun: [],
      coverageGaps: ['browser_inspector:not_started', 'nuclei_signal:not_started'],
      limitations: [],
    });
  });
});
