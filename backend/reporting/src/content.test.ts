import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFinalContent } from './content.js';

const seededFinding = (id: string, decision: 'validated' | 'needs_more_evidence') => ({
  id,
  title: `Issue ${id}`,
  description: `Impact ${id}`,
  severity: 'medium',
  confidence: 'high',
  affectedAsset: 'https://example.com/app',
  category: 'test',
  evidence: { description: `Sanitized proof ${id}`, evidenceRefs: [`artifact:${id}`] },
  candidates: [{ triageDecision: { state: decision, validator: 'independent_policy_v1' } }],
});

describe('final report v2 content', () => {
  it('includes two independently validated findings without a tier cap and excludes unvalidated claims', () => {
    const report = buildFinalContent({
      testIntensityMode: 'controlled_attack_simulation',
      targetType: 'interactive_web_app',
      authScope: 'none',
      surfaceFlags: {},
      findings: [
        seededFinding('finding_1', 'validated'),
        seededFinding('finding_2', 'validated'),
        seededFinding('candidate_only', 'needs_more_evidence'),
      ],
      scanPlan: { enabledWorkers: {} },
      steps: [],
      unvalidatedCandidates: 1,
    });

    equal(report.formatVersion, 'report_v2');
    equal(report.reportType, 'finding_report');
    deepStrictEqual(report.findings.map((finding) => finding.id), ['finding_1', 'finding_2']);
    ok(report.findings.every((finding) => finding.validationStatus === 'validated'));
    equal(report.coverage.unvalidatedCandidates, 1);
  });

  it('marks an unavailable reasoning route as incomplete coverage', () => {
    const report = buildFinalContent({
      testIntensityMode: 'controlled_attack_simulation',
      targetType: 'static_content_website',
      authScope: 'none',
      surfaceFlags: {},
      findings: [],
      scanPlan: { enabledWorkers: {} },
      steps: [],
      budgetUsed: { llmCoverageGaps: ['llm:signal_summary:unavailable', 'llm:signal_summary:unavailable'] },
    });

    deepStrictEqual(report.coverage.coverageGaps, ['llm:signal_summary:unavailable']);
    equal(report.ownerSummary.headline, 'Incomplete assessment');
    ok(report.coverage.limitations.some((item) => item.includes('reasoning modules')));
  });
});
