import { runModuleReasoning, type CodingCliBridge } from '@x-hunter/llm-gateway';
import { intensityToProfile, type LlmCallAudit, type LlmRouteSnapshot } from '@x-hunter/shared';

const SYSTEM_PROMPT = 'Summarize the sanitized scan metadata in one sentence. Do not invent findings, request tools, or browse.';

export function signalSummaryInput(scan: {
  testIntensityMode: string;
  steps?: Array<{ kind?: string; state?: string }>;
}, candidateCount: number): string {
  return JSON.stringify({
    profile: intensityToProfile(scan.testIntensityMode as Parameters<typeof intensityToProfile>[0]),
    candidateCount,
    steps: (scan.steps ?? []).map((step) => ({ kind: String(step.kind ?? ''), state: String(step.state ?? '') })),
  });
}

export async function summarizeSignals(input: {
  snapshot: LlmRouteSnapshot | null;
  bridge: CodingCliBridge | null;
  scan: { testIntensityMode: string; steps?: Array<{ kind?: string; state?: string }> };
  candidateCount: number;
}): Promise<{ text: string; audits: LlmCallAudit[]; coverageGap?: string }> {
  if (!input.snapshot) {
    return { text: '', audits: [], coverageGap: 'llm:signal_summary:SNAPSHOT_MISSING' };
  }
  const result = await runModuleReasoning({
    snapshot: input.snapshot,
    useCase: 'signal_summary',
    bridge: input.bridge,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: signalSummaryInput(input.scan, input.candidateCount),
  });
  return {
    text: result.outputText,
    audits: result.audits,
    ...(result.coverageGap ? { coverageGap: result.coverageGap } : {}),
  };
}
