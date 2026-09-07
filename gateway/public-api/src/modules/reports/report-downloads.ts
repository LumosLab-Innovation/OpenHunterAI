import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import { sanitizeReportContent, sanitizeText, type ReportContentV1 } from '@x-hunter/shared';

export const REPORT_EXPORT_FORMATS = ['docx', 'csv', 'json', 'html', 'pdf'] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export function reportCsv(input: ReportContentV1, latestStatus?: string): string {
  const report = sanitizeReportContent(input);
  const rows: unknown[][] = [['type', 'id', 'title', 'severity', 'confidence', 'asset', 'detail', 'fix']];
  rows.push(['summary', '', report.ownerSummary.headline, '', '', '', report.ownerSummary.topRiskOrOutcome, report.ownerSummary.recommendedNextAction]);
  for (const f of report.findings) {
    rows.push(['validated_finding', f.id, f.title, f.severity, f.confidence, f.affectedAsset,
      `${f.impact}\n${f.sanitizedProof.description}`, f.fixSummary]);
  }
  for (const text of report.hardeningRecommendations) rows.push(['hardening', '', '', '', '', '', text, '']);
  for (const text of report.coverage.coverageGaps) rows.push(['coverage_gap', '', '', '', '', '', text, '']);
  for (const text of report.coverage.limitations) rows.push(['limitation', '', '', '', '', '', text, '']);
  for (const item of report.coverage.skippedHunters) rows.push(['skipped', '', item.hunter, '', '', '', item.reason, '']);
  if (latestStatus) rows.push(['latest_status', '', '', '', '', '', sanitizeText(latestStatus), '']);
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Spreadsheet apps can execute formulas even inside quoted CSV cells.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function reportDocx(input: ReportContentV1, latestStatus?: string): Promise<Buffer> {
  const report = sanitizeReportContent(input);
  const children: Paragraph[] = [new Paragraph({ text: 'OpenHunterAI Report', heading: HeadingLevel.TITLE })];
  const section = (title: string, values: string[]) => {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
    for (const value of values) {
      for (const line of value.split(/\r?\n/)) children.push(new Paragraph({ text: line }));
    }
  };
  section('Scope', [
    `Generated: ${report.generatedAt}`, `Package: ${report.packageTier}`, `Mode: ${report.scanMode}`,
    `Target type: ${report.targetType}`, `Intensity: ${report.testIntensityMode}`, `Authentication: ${report.authScope}`,
    report.ownerSummary.whatWasTested,
  ]);
  section('Owner summary', Object.values(report.ownerSummary));
  section('Validated findings', report.findings.length ? [] : [
    'No validated Critical/High findings in the tested scope. Review coverage and limitations below.',
  ]);
  for (const f of report.findings) {
    children.push(new Paragraph({ text: `${f.rank}. ${f.title}`, heading: HeadingLevel.HEADING_2 }));
    for (const text of [
      `Severity: ${f.severity}; confidence: ${f.confidence}`, `Asset: ${f.affectedAsset}`,
      `Category: ${f.category}`, `Attacker path: ${f.attackerPath}`, `Impact: ${f.impact}`,
      `Sanitized proof: ${f.sanitizedProof.description}`, `Evidence references: ${f.sanitizedProof.evidenceRefs.join(', ')}`,
      `Fix: ${f.fixSummary}`, `Retest scenario: ${JSON.stringify(f.retestScenario ?? null)}`,
    ]) children.push(new Paragraph({ text }));
  }
  for (const fix of report.developerFixPack) section(`Developer fix pack: ${fix.findingId}`, [
    fix.rootCauseHypothesis, fix.concreteFixPrompt, ...fix.validationSteps, ...fix.regressionTestIdeas, fix.acceptanceCriteria,
  ]);
  section('Coverage', [
    `Pipeline: ${report.coverage.workersRun.join(', ')}`, `Hunters: ${report.coverage.huntersRun.join(', ')}`,
    ...report.coverage.skippedHunters.map((item) => `Skipped ${item.hunter}: ${item.reason}`),
    ...report.coverage.coverageGaps,
  ]);
  section('Hardening', report.hardeningRecommendations);
  section('Limitations', report.coverage.limitations);
  section('Manual retest and monitor', [
    `Retests remaining: ${report.retestAndMonitor.remainingRetestQuota}`,
    `Cooldown days: ${report.retestAndMonitor.cooldownDays}`, ...report.retestAndMonitor.manualRetestActions,
  ]);
  if (latestStatus) section('Latest status (separate from scan snapshot)', [sanitizeText(latestStatus)]);
  return Packer.toBuffer(new Document({
    creator: 'OpenHunterAI', title: 'OpenHunterAI Report',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  }));
}
