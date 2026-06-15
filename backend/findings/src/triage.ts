import type { LLMGateway } from '@x-hunter/llm-gateway';
import type { PackageTier } from '@x-hunter/shared';

/**
 * LLM-assisted candidate triage. The LLM is RECOMMENDATION-ONLY: it ranks and
 * groups duplicate finding candidates, but it can never create findings or
 * override policy (PRODUCTION_READINESS.md §5). The deterministic promotion
 * decision lives in the caller; this module only proposes an ordering and
 * duplicate clusters from sanitized candidate metadata.
 */

export interface CandidateSummary {
  id: string;
  title: string;
  severity: string;
  confidence: string;
  category: string;
  affectedAsset: string;
  evidence?: unknown;
}

export interface TriageRecommendation {
  /** Candidate ids in recommended ranking order (highest value first). */
  rankedIds: string[];
  /** Clusters of candidate ids the model believes are duplicates. */
  duplicateClusters: string[][];
  /** True when the recommendation came from a deterministic fallback. */
  fallback: boolean;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const CONFIDENCE_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Deterministic ranking used as the fallback (and as the canonical safety net
 * when the LLM is unavailable). Ranks by severity then confidence.
 */
export function deterministicRanking(candidates: CandidateSummary[]): string[] {
  return [...candidates]
    .sort((a, b) => {
      const sev = (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      if (sev !== 0) return sev;
      return (CONFIDENCE_ORDER[b.confidence] ?? 0) - (CONFIDENCE_ORDER[a.confidence] ?? 0);
    })
    .map((c) => c.id);
}

/**
 * Parses the LLM JSON output into a recommendation, validating every id against
 * the known candidate set so the model can never inject unknown ids. Any id the
 * model omits is appended in deterministic order so nothing is dropped.
 */
export function parseTriageOutput(raw: string, candidates: CandidateSummary[]): TriageRecommendation | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const known = new Set(candidates.map((c) => c.id));
  const obj = parsed as { rankedIds?: unknown; duplicateClusters?: unknown };

  const rankedIds = Array.isArray(obj.rankedIds)
    ? obj.rankedIds.filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  // Append any omitted candidates so the result always covers the full set.
  const seen = new Set(rankedIds);
  for (const id of deterministicRanking(candidates)) {
    if (!seen.has(id)) {
      rankedIds.push(id);
      seen.add(id);
    }
  }

  const duplicateClusters = Array.isArray(obj.duplicateClusters)
    ? obj.duplicateClusters
        .filter((c): c is string[] => Array.isArray(c))
        .map((cluster) => cluster.filter((id): id is string => typeof id === 'string' && known.has(id)))
        .filter((cluster) => cluster.length > 1)
    : [];

  return { rankedIds, duplicateClusters, fallback: false };
}

const SYSTEM_PROMPT =
  'You are a security triage assistant. Given sanitized finding candidates, rank them by ' +
  'real attacker value (severity then exploitability) and group duplicates. ' +
  'Respond ONLY with JSON: {"rankedIds": string[], "duplicateClusters": string[][]}. ' +
  'Use only the provided candidate ids. Do not invent findings or ids.';

/**
 * Runs LLM-assisted triage. Falls back to deterministic ranking if the gateway
 * errors, returns no provider, or emits unparseable output — never throws on the
 * LLM path so triage cannot block the pipeline.
 */
export async function triageCandidates(
  gateway: LLMGateway,
  args: { projectId: string; scanId: string; packageTier: PackageTier; candidates: CandidateSummary[] },
): Promise<TriageRecommendation> {
  const { candidates } = args;
  const llmCandidates = candidates.map(({ evidence: _evidence, ...candidate }) => candidate);
  if (candidates.length <= 1) {
    return { rankedIds: candidates.map((c) => c.id), duplicateClusters: [], fallback: true };
  }

  try {
    const res = await gateway.generate({
      useCase: 'candidate_dedupe',
      projectId: args.projectId,
      scanId: args.scanId,
      packageTier: args.packageTier,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({ candidates: llmCandidates }),
      requireJson: true,
    });
    if (res.error || !res.outputText) {
      return { rankedIds: deterministicRanking(candidates), duplicateClusters: [], fallback: true };
    }
    const parsed = parseTriageOutput(res.outputText, candidates);
    if (!parsed) {
      return { rankedIds: deterministicRanking(candidates), duplicateClusters: [], fallback: true };
    }
    return parsed;
  } catch {
    return { rankedIds: deterministicRanking(candidates), duplicateClusters: [], fallback: true };
  }
}

export interface PromotionCandidate extends CandidateSummary {
  evidence: unknown;
}

export function selectPromotionCandidates(
  candidates: PromotionCandidate[],
  recommendation: TriageRecommendation,
  args: { scanMode: string; maxFindings?: number },
): PromotionCandidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const duplicateIds = new Set<string>();
  for (const cluster of recommendation.duplicateClusters) {
    const knownCluster = cluster.filter((id) => byId.has(id));
    for (const duplicateId of knownCluster.slice(1)) {
      duplicateIds.add(duplicateId);
    }
  }

  const ranked = [...recommendation.rankedIds, ...deterministicRanking(candidates)];
  const seen = new Set<string>();
  const packageMaxFindings = args.scanMode === 'free_hunter' ? 1 : 50;
  const maxFindings = Math.min(packageMaxFindings, args.maxFindings ?? packageMaxFindings);
  if (maxFindings <= 0) return [];
  const selected: PromotionCandidate[] = [];

  for (const id of ranked) {
    if (seen.has(id) || duplicateIds.has(id)) continue;
    seen.add(id);
    const candidate = byId.get(id);
    if (!candidate || !isValuableCandidate(candidate) || !hasSanitizedEvidence(candidate.evidence)) continue;
    selected.push(candidate);
    if (selected.length >= maxFindings) break;
  }

  return selected;
}

function isValuableCandidate(candidate: CandidateSummary): boolean {
  return (SEVERITY_ORDER[candidate.severity] ?? 0) >= SEVERITY_ORDER.medium &&
    (CONFIDENCE_ORDER[candidate.confidence] ?? 0) >= CONFIDENCE_ORDER.medium;
}

function hasSanitizedEvidence(evidence: unknown): boolean {
  if (!evidence || typeof evidence !== 'object') return false;
  const value = evidence as Record<string, unknown>;
  if (value.rawRequest || value.rawResponse || value.rawHar || value.rawCookie || value.rawToken || value.rawSecret) {
    return false;
  }
  return typeof value.description === 'string' || value.sanitized === true || Array.isArray(value.evidenceRefs);
}
