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
      userPrompt: JSON.stringify({ candidates }),
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
