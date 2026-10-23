import { createHash } from 'node:crypto';
import { z } from 'zod';
import { GuardrailError } from './errors.js';
import { sanitizeText } from './sanitizer.js';
import { assertInScope } from './scope.js';
import type { ScopeAuthorization } from './types.js';
import type { ReportContentV2 } from './report.js';

const text = z.string().max(8000).transform(sanitizeText);
const id = z.string().min(1).max(160).regex(/^[^\u0000-\u001f\u007f]+$/).transform(sanitizeText);
const time = z.string().datetime().nullable();
const texts = z.array(text).max(1000);
const ids = z.array(id).max(1000);
const unknown = z.null();

export const reportHandoffSchema = z.object({
  purpose: z.literal('investigation_input'),
  producer: z.object({ product: z.literal('OpenHunterAI'), version: z.string().max(64).regex(/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/).transform(sanitizeText).nullable(), buildRef: z.string().regex(/^[a-f0-9]{7,40}$/).nullable() }).strict(),
  source: z.object({ projectId: id.nullable(), scanId: id.nullable(), authorizationId: id.nullable() }).strict(),
  scope: z.object({ status: z.enum(['recorded', 'incomplete']), targetUrl: text.nullable(), allowedHosts: texts, allowedPaths: texts, excludedPaths: texts,
    capturedAt: time, authorityConfirmation: z.enum(['recorded', 'unknown']) }).strict(),
  scanWindow: z.object({ startedAt: time, finishedAt: time }).strict(),
  evidence: z.array(z.object({ ref: id, collector: unknown, capturedAt: unknown, sha256: unknown,
    sanitizerVersion: unknown, lineage: z.array(id).max(0), status: z.literal('metadata_unavailable') }).strict()).max(1000),
  validation: z.array(z.object({ findingId: id, producerClaim: z.literal('validated'),
    validator: z.literal('independent_policy_v1').nullable(), decisionEvidenceRefs: ids,
    replayStatus: z.literal('not_attested'), rationale: text.nullable(), counterevidence: text.nullable() }).strict()).max(1000),
  grantsAuthority: z.literal(false),
  assetMappingRequired: z.literal(true),
  manualIntakeRequired: z.literal(true),
  connectorStatus: z.literal('not_implemented'),
  retestMode: z.literal('manual'),
  retestExecution: z.literal('unsupported'),
  limitations: texts,
}).strict();

export type ReportHandoff = z.infer<typeof reportHandoffSchema>;

/** Derives only recorded scan metadata; missing provenance is never invented. */
export function buildReportHandoff(scan: any, findings: Array<{ id: string; sanitizedProof: { evidenceRefs: string[] } }>, producer: { version?: string; buildRef?: string } = {}): ReportHandoff {
  const scope = record(scan.scopeSnapshot);
  const authorization = record(scan.authorization);
  const stringOrNull = (value: unknown) => typeof value === 'string' && value.length > 0 ? sanitizeText(value) : null;
  const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(sanitizeText) : [];
  const refs = [...new Set(findings.flatMap((finding) => finding.sanitizedProof.evidenceRefs))];
  const handoff = {
    purpose: 'investigation_input',
    producer: { product: 'OpenHunterAI', version: producer.version && producer.version.length <= 64 && /^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(producer.version) ? producer.version : null,
      buildRef: producer.buildRef && /^[a-f0-9]{7,40}$/.test(producer.buildRef) ? producer.buildRef : null },
    source: { projectId: stringOrNull(scan.projectId), scanId: stringOrNull(scan.id), authorizationId: stringOrNull(scan.authorizationId) },
    scope: { status: hasRecordedScope(scope) ? 'recorded' : 'incomplete',
      targetUrl: safeTarget(scope.targetUrl), allowedHosts: list(scope.allowedHosts), allowedPaths: list(scope.allowedPaths),
      excludedPaths: list(scope.excludedPaths), capturedAt: dateString(scope.capturedAt),
      authorityConfirmation: typeof authorization.acceptedByUserId === 'string' && !!authorization.acceptedByUserId &&
        typeof authorization.consentText === 'string' && !!authorization.consentText ? 'recorded' : 'unknown' },
    scanWindow: { startedAt: dateString(scan.startedAt), finishedAt: dateString(scan.finishedAt) },
    evidence: refs.map((ref) => ({ ref, collector: null, capturedAt: null, sha256: null, sanitizerVersion: null, lineage: [], status: 'metadata_unavailable' })),
    validation: findings.map((finding) => {
      const row = (scan.findings ?? []).find((item: any) => item.id === finding.id);
      const decision = row?.candidates?.map((candidate: any) => candidate.triageDecision)
        .find((item: any) => item?.state === 'validated' && item.validator === 'independent_policy_v1');
      return { findingId: finding.id, producerClaim: 'validated', validator: decision ? 'independent_policy_v1' : null,
        decisionEvidenceRefs: list(decision?.evidenceRefs), replayStatus: 'not_attested', rationale: stringOrNull(decision?.rationale), counterevidence: stringOrNull(decision?.counterevidence) };
    }),
    grantsAuthority: false, assetMappingRequired: true, manualIntakeRequired: true, connectorStatus: 'not_implemented',
    retestMode: 'manual', retestExecution: 'unsupported',
    limitations: [
      'A vulnerability is not evidence that an incident occurred. No action or access is authorized by this report.',
      'Collector, evidence capture time, digest, sanitizer version and derivation lineage are unavailable in this snapshot.',
      'Producer validation decisions are recorded claims; independent exchange replay is not attested by this export.',
      'Missing scope, time or producer version metadata remains unknown. The receiver must verify enrolled asset mapping.',
      'OpenShieldAI intake is proposed; no connector or operational response was executed.',
    ],
  };
  const parsed = reportHandoffSchema.safeParse(handoff);
  if (!parsed.success) throw new GuardrailError('INVALID_INPUT', 'Report handoff metadata exceeds its supported contract');
  return parsed.data;
}

const findingFields = {
  id, rank: z.number().int().min(1), title: text, severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  confidence: z.enum(['low', 'medium', 'high']), affectedAsset: text, category: text, attackerPath: text,
  sanitizedProof: z.object({ description: text, evidenceRefs: ids, sanitized: z.literal(true) }), impact: text, fixSummary: text,
  retestScenario: z.object({ title: text.optional(), steps: texts.optional() }).nullable().optional(),
};
const fixPackSchema = z.object({ findingId: id, rootCauseHypothesis: text, concreteFixPrompt: text,
  validationSteps: texts, regressionTestIdeas: texts, acceptanceCriteria: text });
const reportSchema = z.object({
  formatVersion: z.literal('report_v2'), reportType: z.enum(['finding_report', 'coverage_only']), profile: z.enum(['quick', 'standard', 'deep']),
  targetType: z.enum(['static_content_website', 'interactive_web_app', 'api_service', 'ai_llm_application']),
  authScope: z.enum(['none', 'one_account', 'two_accounts']), testIntensityMode: z.enum(['safe_discovery', 'controlled_attack_simulation', 'aggressive_staging']),
  surfaceFlags: z.object({ has_login: z.boolean().optional(), has_test_account: z.boolean().optional(), has_api_docs: z.boolean().optional(),
    has_file_upload: z.boolean().optional(), has_payment: z.boolean().optional(), has_admin_dashboard: z.boolean().optional(),
    has_webhook: z.boolean().optional(), has_chatbot_or_rag_or_tool_calling: z.boolean().optional() }),
  ownerSummary: z.object({ headline: text, riskLevel: z.enum(['none', 'info', 'low', 'medium', 'high', 'critical']),
    whatWasTested: text, topRiskOrOutcome: text, businessImpact: text, recommendedNextAction: text }),
  findings: z.array(z.object({ ...findingFields, validationStatus: z.literal('validated') })).max(1000),
  historicalFindings: z.array(z.object({ ...findingFields, validationStatus: z.literal('legacy_unverified') })).max(1000).optional(),
  developerFixPack: z.array(fixPackSchema).max(1000),
  historicalDeveloperFixPack: z.array(fixPackSchema).max(1000).optional(),
  coverage: z.object({ targetType: text, workersRun: texts, huntersPlanned: texts.optional(), huntersRun: texts,
    skippedHunters: z.array(z.object({ hunter: text, reason: text })).max(1000), coverageGaps: texts, limitations: texts,
    unvalidatedCandidates: z.number().int().min(0).optional() }),
  hardeningRecommendations: texts, retest: z.object({ eligibleFindings: ids, manualRetestActions: texts }),
  generatedAt: z.string().datetime(), handoff: reportHandoffSchema.optional(),
});

/** Project onto the bounded report contract; arbitrary legacy fields never enter downloads. */
export function normalizeReportSnapshotContent(input: unknown): ReportContentV2 {
  try {
    const serialized = JSON.stringify(input);
    if (Buffer.byteLength(serialized, 'utf8') > 4 * 1024 * 1024) throw new Error();
    const parsed = reportSchema.parse(JSON.parse(serialized));
    const known = new Set(parsed.findings.map((finding) => finding.id));
    parsed.developerFixPack = parsed.developerFixPack.filter((fix) => known.has(fix.findingId));
    if (parsed.historicalDeveloperFixPack) {
      const historical = new Set(parsed.historicalFindings?.map((finding) => finding.id) ?? []);
      parsed.historicalDeveloperFixPack = parsed.historicalDeveloperFixPack.filter((fix) => historical.has(fix.findingId));
    }
    parsed.retest.eligibleFindings = parsed.retest.eligibleFindings.filter((findingId) => known.has(findingId));
    if (parsed.handoff && (parsed.handoff.validation.some((item) => {
      const proof = parsed.findings.find((finding) => finding.id === item.findingId)?.sanitizedProof.evidenceRefs;
      return !proof || item.decisionEvidenceRefs.some((ref) => !proof.includes(ref) || !parsed.handoff!.evidence.some((entry) => entry.ref === ref));
    }) ||
      parsed.handoff.evidence.some((item) => !parsed.findings.some((finding) => finding.sanitizedProof.evidenceRefs.includes(item.ref))))) throw new Error();
    return parsed as ReportContentV2;
  } catch {
    throw new GuardrailError('INVALID_INPUT', 'Report snapshot is malformed, oversized or unsupported');
  }
}

/** Sorted object keys, retained array order and ordinary JSON scalar encoding. */
export function canonicalReportJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalReportJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).filter((key) => (value as Record<string, unknown>)[key] !== undefined).sort().map((key) => JSON.stringify(key) + ':' + canonicalReportJson((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}

export function reportSnapshotExport(input: any) {
  const content = normalizeReportSnapshotContent(input?.content);
  const schema = z.object({ id, projectId: id, scanJobId: id, version: z.number().int().min(1), state: z.enum(['final', 'superseded']),
    kind: z.enum(['human', 'ai_dev']), formatVersion: z.literal('report_v2'), generatedAt: z.string().datetime(), finalizedAt: z.string().datetime() });
  const parsed = schema.safeParse({ ...input, generatedAt: dateString(input?.generatedAt), finalizedAt: dateString(input?.finalizedAt) });
  if (!parsed.success) throw new GuardrailError('INVALID_INPUT', 'Only a finalized report snapshot can be exported');
  if (content.handoff && ((content.handoff.source.projectId !== null && content.handoff.source.projectId !== parsed.data.projectId) ||
    (content.handoff.source.scanId !== null && content.handoff.source.scanId !== parsed.data.scanJobId))) {
    throw new GuardrailError('INVALID_INPUT', 'Report handoff identity differs from its snapshot');
  }
  const snapshot = { ...parsed.data, content };
  const digest = createHash('sha256').update(canonicalReportJson(snapshot), 'utf8').digest('hex');
  return { snapshot, integrity: { algorithm: 'sha256', canonicalization: 'sorted-json-v1', digest,
    covers: 'snapshot', authenticityVerified: false } };
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function dateString(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? time.toISOString() : null;
}
function safeTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const target = new URL(value);
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) return null;
    return sanitizeText(target.href);
  } catch { return null; }
}

function hasRecordedScope(scope: Record<string, any>): boolean {
  const target = safeTarget(scope.targetUrl);
  if (!target || target !== scope.targetUrl || !['allowedHosts', 'allowedPaths', 'excludedPaths'].every((key) =>
    Array.isArray(scope[key]) && scope[key].every((item: unknown) => typeof item === 'string' && sanitizeText(item) === item))) return false;
  try {
    if (!scope.allowedHosts.some((host: string) => host.toLowerCase() === new URL(target).hostname.toLowerCase())) return false;
    assertInScope(target, scope as ScopeAuthorization);
    return true;
  } catch { return false; }
}

/** Mutable state is a separate, bounded producer claim and is not digest-covered. */
export function normalizeReportLatestOverlay(input: unknown, findingIds: string[]) {
  const schema = z.object({
    findingStatuses: z.array(z.object({ id, status: z.enum(['open', 'in_progress', 'ready_for_retest', 'fixed', 'still_vulnerable', 'accepted_risk']),
      severity: z.enum(['info', 'low', 'medium', 'high', 'critical']), updatedAt: z.union([z.string().datetime(), z.date()]).optional() })).max(1000).default([]),
    retestStates: z.array(z.object({ findingId: id, retestRunId: id, result: z.enum(['fixed', 'still_vulnerable', 'partially_fixed', 'cannot_verify']).nullable(),
      startedAt: z.union([z.string().datetime(), z.date()]).nullable(), finishedAt: z.union([z.string().datetime(), z.date()]).nullable() })).max(1000).default([]),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new GuardrailError('INVALID_INPUT', 'Report status overlay is malformed or oversized');
  const known = new Set(findingIds);
  return { findingStatuses: parsed.data.findingStatuses.filter((finding) => known.has(finding.id)),
    retestStates: parsed.data.retestStates.filter((run) => known.has(run.findingId)) };
}
