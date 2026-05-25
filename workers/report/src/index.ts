/**
 * Report worker. Produces:
 *   - Free Hunter Snapshot (always)
 *   - Human-readable Report  (light+)
 *   - AI/Dev Report          (light+)
 *
 * The body is sanitized markdown. ACCEPTANCE_CRITERIA §16 requires the
 * Free report to be valuable even when no Critical/High is found — it must
 * list what was checked, what wasn't, and what to do next.
 */

import {
  type Logger,
  type ScanMode,
  type ScopeSnapshot,
  type Severity,
  sanitizeText,
} from '@x-hunter/shared';
import type { BrowserObservation } from '@x-hunter/browser-inspector';
import type { OpenHackResult } from '@x-hunter/openhack-hunter';
import type { StrixResult } from '@x-hunter/strix-core';
import { getPrisma } from '@x-hunter/db';
import { LLMGateway } from '@x-hunter/llm-gateway';

export interface ReportInput {
  scanId: string;
  projectId: string;
  scope: ScopeSnapshot;
  mode: ScanMode;
  browser?: BrowserObservation;
  hunter?: OpenHackResult;
  strix?: StrixResult;
  gateway: LLMGateway;
  logger?: Logger;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export async function generateReports(input: ReportInput): Promise<void> {
  const prisma = getPrisma();
  const counts = countSeverities(input.hunter, input.strix);

  // --- Free Hunter Snapshot (always) ---------------------------------------
  const snapshotBody = renderFreeSnapshot(input, counts);
  await prisma.report.create({
    data: {
      projectId: input.projectId,
      scanJobId: input.scanId,
      kind: 'free_snapshot',
      body: snapshotBody,
    },
  });

  if (input.mode === 'free') return;

  // --- Human-readable Report ----------------------------------------------
  const humanBody = await renderHumanReport(input, counts);
  await prisma.report.create({
    data: {
      projectId: input.projectId,
      scanJobId: input.scanId,
      kind: 'human',
      body: humanBody,
    },
  });

  // --- AI/Dev Report -------------------------------------------------------
  const devBody = renderAiDevReport(input, counts);
  await prisma.report.create({
    data: {
      projectId: input.projectId,
      scanJobId: input.scanId,
      kind: 'ai_dev',
      body: devBody,
    },
  });
}

function countSeverities(hunter?: OpenHackResult, strix?: StrixResult): Record<Severity, number> {
  const acc: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const c of hunter?.candidates ?? []) acc[c.severity]++;
  for (const c of strix?.findings ?? []) acc[c.severity]++;
  return acc;
}

function renderFreeSnapshot(input: ReportInput, counts: Record<Severity, number>): string {
  const items = (input.hunter?.candidates ?? []).map(
    (c) =>
      `- **[${c.severity.toUpperCase()}]** ${sanitizeText(c.title)} — \`${sanitizeText(c.affectedAsset)}\``,
  );
  const coverage = (input.hunter?.coverageGaps ?? []).map((g) => `- ${sanitizeText(g)}`);
  const checked = listChecked(input);
  const noBig = counts.critical === 0 && counts.high === 0;
  return [
    `# Free Hunter Snapshot`,
    ``,
    `**Domain xác minh:** \`${input.scope.verifiedDomain}\``,
    `**Gói:** ${input.scope.scanPackage}`,
    `**Đã chạy:** ${checked.join(', ')}`,
    ``,
    `## Mục đã tìm thấy (${input.hunter?.candidates.length ?? 0})`,
    items.length ? items.join('\n') : '_Không tìm thấy mục nào trong phạm vi đã quét._',
    ``,
    `## Phạm vi chưa kiểm tra được`,
    coverage.length ? coverage.join('\n') : '_Không có khuyến nghị bổ sung._',
    ``,
    noBig
      ? [
          `## Kết luận`,
          `Trong phạm vi đã quét, X-hunter **không phát hiện Critical/High đáng kể**.`,
          `Lưu ý: Free Snapshot không thay thế audit đầy đủ. Để có Strix reasoning sâu hơn, dùng gói Standard hoặc Auth.`,
        ].join('\n')
      : `## Kết luận\nVui lòng xem danh sách mục bên trên.`,
  ].join('\n');
}

async function renderHumanReport(
  input: ReportInput,
  counts: Record<Severity, number>,
): Promise<string> {
  // Deterministic backbone:
  const head = [
    `# Báo cáo bảo mật web (Human Report)`,
    ``,
    `**Domain:** ${input.scope.verifiedDomain}`,
    `**Gói:** ${input.scope.scanPackage}`,
    `**Mode:** ${input.mode}`,
    `**Tổng quan:** ${counts.critical} Critical, ${counts.high} High, ${counts.medium} Medium, ${counts.low} Low, ${counts.info} Info`,
    ``,
  ].join('\n');

  const sections = SEVERITY_ORDER.map((sev) => {
    const list = [
      ...(input.hunter?.candidates ?? []).filter((c) => c.severity === sev),
      ...(input.strix?.findings ?? []).filter((c) => c.severity === sev),
    ];
    if (list.length === 0) return '';
    const heads = list
      .map(
        (c) =>
          `### ${sanitizeText(c.title)} (${c.severity.toUpperCase()}, conf=${c.confidence})\n\n` +
          `**Asset:** \`${sanitizeText(c.affectedAsset)}\`\n\n${sanitizeText(c.evidence.description)}`,
      )
      .join('\n\n');
    return `## ${sev.toUpperCase()}\n\n${heads}`;
  })
    .filter(Boolean)
    .join('\n\n');

  const strixObs = input.strix
    ? `\n\n## Strix observations\n\n${input.strix.observations.map((o) => `- ${sanitizeText(o)}`).join('\n')}`
    : '';

  // Optional polish via LLM Gateway. If unavailable, return deterministic body.
  if (input.scope.scanPackage !== 'free') {
    const polish = await input.gateway.generate({
      useCase: 'human_report',
      projectId: input.projectId,
      scanId: input.scanId,
      packageTier: input.scope.scanPackage,
      systemPrompt:
        `Bạn là biên tập viên báo cáo bảo mật. Giữ NGUYÊN số liệu, không thêm finding mới, ` +
        `không bịa đặt. Chỉ viết lại phần "Kết luận chung" cuối báo cáo cho dễ đọc, dưới 200 từ.`,
      userPrompt: head + '\n' + sections + strixObs,
    });
    if (!polish.error && polish.outputText.trim().length > 20) {
      return (
        head + sections + strixObs + `\n\n## Kết luận chung\n\n${sanitizeText(polish.outputText)}`
      );
    }
  }
  return head + sections + strixObs;
}

function renderAiDevReport(input: ReportInput, counts: Record<Severity, number>): string {
  const items = [...(input.hunter?.candidates ?? []), ...(input.strix?.findings ?? [])];
  const lines = items.map((c) => {
    return [
      `## ${sanitizeText(c.title)}`,
      `- severity: ${c.severity}`,
      `- confidence: ${c.confidence}`,
      `- affected_asset: ${sanitizeText(c.affectedAsset)}`,
      `- category: ${sanitizeText(c.category)}`,
      `- evidence: ${sanitizeText(c.evidence.description).slice(0, 600)}`,
      ``,
    ].join('\n');
  });
  const fixPrompts = (input.strix?.fixPrompts ?? []).map(
    (p) =>
      `### Fix prompt for: ${sanitizeText(p.findingTitle)}\n\n\`\`\`\n${sanitizeText(p.prompt)}\n\`\`\``,
  );
  return [
    `# AI / Dev Report`,
    ``,
    `**Mode:** ${input.mode}`,
    `**Totals:** ${counts.critical}C / ${counts.high}H / ${counts.medium}M / ${counts.low}L / ${counts.info}I`,
    ``,
    `## Findings`,
    ...lines,
    `## Fix Prompts`,
    fixPrompts.length ? fixPrompts.join('\n\n') : '_(none)_',
  ].join('\n');
}

function listChecked(input: ReportInput): string[] {
  const out = ['Browser Inspect'];
  if (input.hunter && input.hunter.candidates.length + input.hunter.warnings.length > 0)
    out.push('OpenHack Hunters');
  if (input.strix && input.strix.observations.length > 0) out.push('Strix Reasoning');
  return out;
}
