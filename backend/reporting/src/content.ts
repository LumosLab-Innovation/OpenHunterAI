import {
  deriveWorkerCoverage,
  intensityToProfile,
  isIndependentlyValidatedFinding,
  REPORT_FORMAT_VERSION,
  sanitizeReportContent,
  sanitizeText,
  type ReportContentV2,
} from '@x-hunter/shared';

/** Pure final-report assembly, shared by runtime and contract tests. */
export function buildFinalContent(scan: any): ReportContentV2 {
  const findings = (scan.findings ?? []).filter(isIndependentlyValidatedFinding);
  const reportFindings = findings.map((finding: any, index: number) => ({
    id: finding.id,
    rank: index + 1,
    title: finding.title,
    severity: finding.severity,
    confidence: finding.confidence,
    affectedAsset: finding.affectedAsset,
    category: finding.category,
    attackerPath: finding.description,
    sanitizedProof: {
      description: finding.evidence?.description ?? 'Sanitized evidence is unavailable.',
      evidenceRefs: finding.evidence?.evidenceRefs ?? [],
      sanitized: true as const,
    },
    impact: finding.description,
    fixSummary: finding.fixPrompt ?? 'Apply the recommended fix and retest.',
    retestScenario: finding.retestScenario ?? null,
    validationStatus: 'validated' as const,
  }));
  const coverageOnly = reportFindings.length === 0;
  const scanPlan = scan.scanPlan ?? {};
  const workerCoverage = deriveWorkerCoverage(scan.steps ?? [], Object.keys(scanPlan.enabledWorkers ?? {}));
  const budgetUsed = scan.budgetUsed && typeof scan.budgetUsed === 'object' && !Array.isArray(scan.budgetUsed) ? scan.budgetUsed : {};
  const llmGaps = Array.isArray(budgetUsed.llmCoverageGaps)
    ? budgetUsed.llmCoverageGaps.filter((gap: unknown): gap is string => typeof gap === 'string' && /^llm:[a-z_]+:[A-Za-z_]+$/.test(gap))
    : [];
  const coverageGaps = [...new Set([...workerCoverage.coverageGaps, ...llmGaps])];
  const incompleteCoverage = coverageGaps.length > 0;

  return sanitizeReportContent({
    formatVersion: REPORT_FORMAT_VERSION,
    reportType: coverageOnly ? 'coverage_only' : 'finding_report',
    profile: intensityToProfile(scan.testIntensityMode),
    targetType: scan.targetType,
    authScope: scan.authScope,
    testIntensityMode: scan.testIntensityMode,
    surfaceFlags: scan.surfaceFlags,
    ownerSummary: {
      headline: coverageOnly && incompleteCoverage ? 'Incomplete assessment' : coverageOnly ? 'Coverage report' : `${reportFindings.length} finding(s) confirmed`,
      riskLevel: coverageOnly ? 'none' : reportFindings[0].severity,
      whatWasTested: `${scan.targetType} under ${scan.testIntensityMode}`,
      topRiskOrOutcome: coverageOnly && incompleteCoverage ? 'Some planned checks did not complete; absence of findings is inconclusive.' : coverageOnly ? 'No finding was independently validated in this scope.' : reportFindings[0].title,
      businessImpact: coverageOnly && incompleteCoverage ? 'Unexecuted or failed coverage may hide issues.' : coverageOnly ? 'Review coverage and hardening recommendations.' : reportFindings[0].impact,
      recommendedNextAction: coverageOnly && incompleteCoverage ? 'Resolve coverage gaps and rerun the affected checks.' : coverageOnly ? 'Review limitations, add required test accounts where appropriate, and rerun.' : 'Fix and retest the ranked findings.',
    },
    findings: reportFindings,
    developerFixPack: reportFindings.map((finding: any) => ({
      findingId: finding.id,
      rootCauseHypothesis: finding.attackerPath,
      concreteFixPrompt: finding.fixSummary,
      validationSteps: ['Apply fix.', 'Run manual retest.', 'Confirm no regression.'],
      regressionTestIdeas: ['Add a targeted regression test for this affected asset.'],
      acceptanceCriteria: 'Retest no longer reproduces the issue.',
    })),
    coverage: {
      targetType: scan.targetType,
      workersRun: workerCoverage.workersRun.map(displayUnitCode),
      huntersPlanned: (scanPlan.enabledHunters ?? []).map(displayUnitCode),
      huntersRun: [],
      skippedHunters: (scanPlan.skippedHunters ?? []).map((item: any) => ({
        ...item,
        hunter: displayUnitCode(String(item?.hunter ?? '')),
      })),
      coverageGaps,
      unvalidatedCandidates: scan.unvalidatedCandidates ?? 0,
      limitations: [
        ...workerCoverage.limitations,
        ...(llmGaps.length > 0 ? ['Some reasoning modules were unavailable; their results were not counted as completed coverage.'] : []),
        'Hunter-family execution is not measured separately; planned families do not imply tested coverage.',
        ...((scan.unvalidatedCandidates ?? 0) > 0 ? [`${scan.unvalidatedCandidates} candidate(s) need independent evidence review.`] : []),
        ...(coverageOnly ? ['Coverage-only report; no finding was created.'] : ['Report uses sanitized evidence only.']),
      ],
    },
    hardeningRecommendations: coverageOnly
      ? ['Review headers, auth boundaries, file upload exposure, API docs exposure, and sensitive data handling.']
      : ['Prioritize confirmed findings before broad hardening.'],
    retest: {
      eligibleFindings: reportFindings.map((finding: any) => finding.id),
      manualRetestActions: reportFindings.map((finding: any) => `Retest ${finding.title}`),
    },
    generatedAt: new Date().toISOString(),
  });
}

function displayUnitCode(key: string): string {
  switch (key.toLowerCase().replace(/[-\s]/g, '_')) {
    case 'browser':
    case 'browser_inspector': return 'Browser';
    case 'zap':
    case 'zap_signal': return 'Z';
    case 'nuclei':
    case 'nuclei_signal': return 'N';
    case 'openhack':
    case 'openhack_hunter':
    case 'o': return 'Passive surface';
    case 'strix':
    case 'strix_core':
    case 's': return 'S';
    case 'report': return 'RPT';
    case 'retest': return 'RT';
    default: return sanitizeText(key);
  }
}
