/**
 * Strix Core — attacker-mindset reasoning over a compact security context.
 *
 * Strix runs ONLY for standard / auth / launch packages. It receives the
 * sanitized output of:
 *   - browser-inspector (routes, api endpoints, cookies, storage, console errors)
 *   - openhack-hunter   (candidates, warnings, hardening, coverage gaps)
 *   - zap-signal        (candidates summary)
 *   - nuclei-signal     (candidates summary)
 *
 * It produces:
 *   - observations: short bulleted text for the human report
 *   - findings:     additional FindingCandidates (reasoned) — same shape as
 *                   the hunter output, so the orchestrator merges them uniformly
 *   - severity/confidence adjustments are passed back to the orchestrator via
 *     `findings` rewrites (we don't rewrite existing rows in v1; the orchestrator
 *     persists Strix candidates alongside).
 *
 * Strix NEVER calls a provider SDK directly — it goes through @x-hunter/llm-gateway.
 * Strix never sees raw secrets; the prompt sanitizer + sanitizeValue() over the
 * compact context guarantee this.
 */

import type { BrowserObservation } from '@x-hunter/browser-inspector';
import type { ZapSignalResult } from '@x-hunter/zap-signal';
import type { NucleiSignalResult } from '@x-hunter/nuclei-signal';
import type { OpenHackResult } from '@x-hunter/openhack-hunter';
import {
  type FindingCandidate,
  type Logger,
  type ScanMode,
  type ScopeSnapshot,
  type Severity,
  type Confidence,
  createLogger,
  sanitizeText,
} from '@x-hunter/shared';
import type { LLMGateway } from '@x-hunter/llm-gateway';

export interface StrixInput {
  scanId: string;
  projectId: string;
  scope: ScopeSnapshot;
  mode: ScanMode;
  browser: BrowserObservation;
  hunter: OpenHackResult;
  zap?: ZapSignalResult;
  nuclei?: NucleiSignalResult;
  gateway: LLMGateway;
  logger?: Logger;
}

export interface StrixResult {
  observations: string[];
  findings: FindingCandidate[];
  remediation: string[];
  fixPrompts: Array<{ findingTitle: string; prompt: string }>;
  retestProposals: Array<{ findingTitle: string; scenario: Record<string, unknown> }>;
}

const SYSTEM_PROMPT = `Bạn là Strix Core — chuyên gia bảo mật ứng dụng web với tư duy tấn công.
Nhiệm vụ của bạn:
1. Đọc compact security context (đã sanitize, không chứa secret thô).
2. Tìm các bề mặt rủi ro có giá trị THỰC TẾ mà các rule-based hunter có thể đã bỏ qua.
3. Đề xuất finding mới chỉ khi có bằng chứng cụ thể trong context. KHÔNG bịa.
4. Mỗi finding phải có severity (info/low/medium/high/critical) và confidence (low/medium/high).
5. Đề xuất prompt fix gửi cho LLM coding khác để vá lỗi.
6. Đề xuất retest scenario CHỈ THAO TÁC trên finding đó, không scan toàn bộ app.

Quy tắc cứng:
- KHÔNG đề xuất scan ngoài scope.
- KHÔNG đề xuất brute-force, fuzzing phá hoại, chiếm tài khoản thực.
- KHÔNG hỏi xin secret/cookie/token thô.
- Trả về JSON đúng schema.`;

interface StrixLlmPayload {
  observations: string[];
  findings: Array<{
    title: string;
    description: string;
    severity: string;
    confidence: string;
    category: string;
    affected_asset: string;
  }>;
  remediation: string[];
  fix_prompts: Array<{ finding_title: string; prompt: string }>;
  retest_proposals: Array<{ finding_title: string; scenario: Record<string, unknown> }>;
}

export async function runStrixCore(input: StrixInput): Promise<StrixResult> {
  const log = input.logger ?? createLogger({ component: 'strix-core' });
  const compact = buildCompactContext(input);
  const userPrompt =
    `Compact Security Context:\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\`\n\n` +
    `Trả về JSON với schema: { "observations": string[], "findings": [...], "remediation": string[], ` +
    `"fix_prompts": [...], "retest_proposals": [...] }`;

  const llmRes = await input.gateway.generate({
    useCase: 'strix_reasoning',
    projectId: input.projectId,
    scanId: input.scanId,
    packageTier: input.scope.scanPackage,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    requireJson: true,
    temperature: 0.2,
  });

  if (llmRes.error) {
    log.warn('strix_llm_failed', { code: llmRes.error.code, msg: llmRes.error.message });
    return {
      observations: [
        `Strix reasoning không khả dụng (LLM error: ${llmRes.error.code}). Vẫn dùng kết quả hunter làm cơ sở.`,
      ],
      findings: [],
      remediation: [],
      fixPrompts: [],
      retestProposals: [],
    };
  }

  const parsed = parseStrixJson(llmRes.outputText);
  if (!parsed) {
    log.warn('strix_parse_failed');
    return {
      observations: ['Strix output không parse được.'],
      findings: [],
      remediation: [],
      fixPrompts: [],
      retestProposals: [],
    };
  }

  const findings: FindingCandidate[] = parsed.findings.map((f) => ({
    source: 'strix',
    title: sanitizeText(f.title).slice(0, 200),
    severity: coerceSeverity(f.severity),
    confidence: coerceConfidence(f.confidence),
    category: sanitizeText(f.category).slice(0, 64) || 'strix',
    affectedAsset: sanitizeText(f.affected_asset).slice(0, 1024),
    evidence: { description: sanitizeText(f.description).slice(0, 2000), sanitized: true },
  }));

  return {
    observations: parsed.observations.map((o) => sanitizeText(o).slice(0, 1000)),
    findings,
    remediation: parsed.remediation.map((r) => sanitizeText(r).slice(0, 1000)),
    fixPrompts: parsed.fix_prompts.map((p) => ({
      findingTitle: sanitizeText(p.finding_title).slice(0, 200),
      prompt: sanitizeText(p.prompt).slice(0, 4000),
    })),
    retestProposals: parsed.retest_proposals.map((r) => ({
      findingTitle: sanitizeText(r.finding_title).slice(0, 200),
      scenario: r.scenario,
    })),
  };
}

function buildCompactContext(input: StrixInput) {
  return {
    scope: {
      verified_domain: input.scope.verifiedDomain,
      allowed_hosts: input.scope.allowedHosts,
      excluded_paths: input.scope.excludedPaths,
      package: input.scope.scanPackage,
      test_account_permission: input.scope.testAccountPermission,
      sensitive_action_permission: input.scope.sensitiveActionPermission,
    },
    routes: input.browser.routes.slice(0, 60).map((r) => ({
      url: r.url,
      method: r.method,
      status: r.statusCode,
    })),
    api_endpoints: input.browser.apiEndpoints.slice(0, 80).map((e) => ({
      url: e.url,
      methods: e.methods,
      pattern: e.pathPattern,
    })),
    cookies: input.browser.cookies.slice(0, 40).map((c) => ({
      name: c.name,
      http_only: c.httpOnly,
      secure: c.secure,
      same_site: c.sameSite,
      domain: c.domain,
      path: c.path,
    })),
    storage_keys: input.browser.storageKeys.slice(0, 40).map((k) => ({
      scope: k.scope,
      key: k.keyName,
      token_like: k.looksTokenLike,
    })),
    hunter_candidates: input.hunter.candidates.slice(0, 30).map((c) => ({
      source: c.source,
      title: c.title,
      severity: c.severity,
      confidence: c.confidence,
      category: c.category,
      affected: c.affectedAsset,
      description: c.evidence.description,
    })),
    hunter_warnings: input.hunter.warnings.slice(0, 20),
    hunter_coverage_gaps: input.hunter.coverageGaps.slice(0, 20),
    zap_summary: input.zap?.summary ?? null,
    nuclei_summary: input.nuclei
      ? {
          findings: input.nuclei.candidates.length,
          duration_ms: input.nuclei.raw.durationMs,
        }
      : null,
  };
}

function parseStrixJson(text: string): StrixLlmPayload | null {
  try {
    const cleaned = stripFences(text);
    return JSON.parse(cleaned) as StrixLlmPayload;
  } catch {
    return null;
  }
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function coerceSeverity(s: string): Severity {
  const low = (s || '').toLowerCase();
  if (low === 'critical' || low === 'high' || low === 'medium' || low === 'low' || low === 'info')
    return low;
  return 'info';
}
function coerceConfidence(s: string): Confidence {
  const low = (s || '').toLowerCase();
  if (low === 'high' || low === 'medium' || low === 'low') return low;
  return 'low';
}
