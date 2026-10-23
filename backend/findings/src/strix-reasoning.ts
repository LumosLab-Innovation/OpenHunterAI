import { runModuleReasoning, type CodingCliBridge } from '@x-hunter/llm-gateway';
import { sanitizeText, type LlmCallAudit, type LlmRouteSnapshot } from '@x-hunter/shared';

const HYPOTHESIS_PROMPT = 'Rank at most three of the supplied hunter IDs for a manual, authorized security review. Return only a JSON array of IDs. Do not claim a vulnerability, request tools, or suggest an active probe.';
const PLAN_PROMPT = 'Rank the supplied review-step IDs for the selected hunter IDs. Return only a JSON array of IDs. No tool use, network request, credential use, or active validation is authorized by this prompt.';
const REVIEW_STEPS = ['read_only_baseline', 'approval_gated_validation', 'independent_evidence_replay'] as const;

export interface StrixReasoningInput {
  snapshot: LlmRouteSnapshot;
  bridge: CodingCliBridge | null;
  target: string;
  targetType: string;
  profile: string;
  authScope: string;
  hunterIds: string[];
}

export function selectedIds(output: string, allowed: readonly string[], limit: number): string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(output); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const known = new Set(allowed);
  return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)))].slice(0, limit);
}

export async function reasonWithCodex(input: StrixReasoningInput) {
  const hunterIds = [...new Set(input.hunterIds.filter((id) => /^[a-z0-9_]{1,64}$/.test(id)))].slice(0, 20);
  const audits: LlmCallAudit[] = [];
  const gaps = ['STRIX_RUNTIME_NOT_EXECUTED'];
  if (hunterIds.length === 0) return { signals: [], audits, gaps: [...gaps, 'NO_PLANNED_HUNTERS'] };

  const hypothesis = await runModuleReasoning({
    snapshot: input.snapshot,
    useCase: 'attacker_hypothesis',
    bridge: input.bridge,
    systemPrompt: HYPOTHESIS_PROMPT,
    userPrompt: JSON.stringify({ targetType: input.targetType, profile: input.profile, authScope: input.authScope, hunterIds }),
    maxOutputChars: 2_000,
  });
  audits.push(...hypothesis.audits);
  if (hypothesis.coverageGap) gaps.push(hypothesis.coverageGap);
  const rankedHunters = selectedIds(hypothesis.outputText, hunterIds, 3);
  if (!hypothesis.coverageGap && rankedHunters.length === 0) gaps.push('llm:attacker_hypothesis:OUTPUT_INVALID');
  if (rankedHunters.length === 0) return { signals: [], audits, gaps };

  const plan = await runModuleReasoning({
    snapshot: input.snapshot,
    useCase: 'validation_plan',
    bridge: input.bridge,
    systemPrompt: PLAN_PROMPT,
    userPrompt: JSON.stringify({ profile: input.profile, authScope: input.authScope, hunterIds: rankedHunters, reviewStepIds: REVIEW_STEPS }),
    maxOutputChars: 2_000,
  });
  audits.push(...plan.audits);
  if (plan.coverageGap) gaps.push(plan.coverageGap);
  const steps = selectedIds(plan.outputText, REVIEW_STEPS, REVIEW_STEPS.length);
  if (!plan.coverageGap && steps.length === 0) gaps.push('llm:validation_plan:OUTPUT_INVALID');

  const asset = sanitizeText(input.target);
  const signals = [
    ...rankedHunters.map((id) => ({
      kind: 'strix_hypothesis',
      title: `Review priority: ${id.replaceAll('_', ' ')}`,
      severity: 'info',
      confidence: 'low',
      asset,
      description: 'Codex ranked a planned hunter family for manual review. No vulnerability was demonstrated.',
      evidenceClass: 'hypothesis',
      validationState: 'candidate',
    })),
    ...(steps.length > 0 ? [{
      kind: 'strix_validation_plan',
      title: 'Review steps proposed',
      severity: 'info',
      confidence: 'low',
      asset,
      description: `Review-step IDs: ${steps.join(', ')}. Sensitive validation requires separate approval; no step was executed.`,
      evidenceClass: 'hypothesis',
      validationState: 'candidate',
    }] : []),
  ];
  return { signals, audits, gaps };
}
