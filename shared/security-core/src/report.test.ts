import { describe, expect, it } from 'vitest';
import {
  applyRankRecommendations,
  REPORT_DRAFT_SECTION_KEYS,
  REPORT_FORMAT_VERSION,
  renderReportHtml,
  sanitizeReportContent,
  type ReportContentV1,
} from './report.js';
import { DEFAULT_SURFACE_FLAGS } from './packages.js';

const baseReport: ReportContentV1 = {
  formatVersion: REPORT_FORMAT_VERSION,
  reportType: 'finding_report',
  packageTier: 'free_hunter',
  scanMode: 'free_hunter',
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
  retestAndMonitor: {
    eligibleFindings: ['f1'],
    remainingRetestQuota: 1,
    cooldownDays: 7,
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
});
