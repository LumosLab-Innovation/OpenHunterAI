import { createBridgeClient, runModuleReasoning, type CodingCliBridge } from '@x-hunter/llm-gateway';
import type { LlmCallAudit, LlmRouteSnapshot, ScanProfile } from '@x-hunter/shared';
import { isLlmRouteSnapshot, sanitizeText } from '@x-hunter/shared';

/**
 * Fix prompts go through the scan's LLM route snapshot and the host bridge.
 * There is no alias or API-key fallback. Output stays recommendation-only.
 */

const FIX_SYSTEM_PROMPT =
  'You are a secure-coding assistant. Given a sanitized security finding, write a concise, ' +
  'concrete remediation prompt a developer can act on. No raw secrets. Plain text, <= 120 words.';

export interface FixPromptInput {
  projectId: string;
  scanId: string;
  findingId: string;
  profile: ScanProfile;
  title: string;
  category: string;
  affectedAsset: string;
  description: string;
}

/**
 * Generates a developer fix prompt for a finding. Returns a deterministic
 * fallback string when the LLM is unavailable or errors, so report finalization
 * never blocks on the LLM. Output is sanitized before return.
 */
export function bridgeFromEnv(): CodingCliBridge | null {
  const baseUrl = process.env.OPENHUNTER_LLM_BRIDGE_URL;
  const token = process.env.OPENHUNTER_LLM_BRIDGE_TOKEN;
  if (!baseUrl || !token) return null;
  return createBridgeClient({ baseUrl, token });
}

export function snapshotFromPlan(plan: unknown): LlmRouteSnapshot | null {
  const snapshot = plan && typeof plan === 'object' ? (plan as { llmRouteSnapshot?: unknown }).llmRouteSnapshot : null;
  return isLlmRouteSnapshot(snapshot) ? snapshot : null;
}

export async function generateFixPrompt(
  input: FixPromptInput & { snapshot: LlmRouteSnapshot | null; bridge: CodingCliBridge | null },
): Promise<{ text: string; fallback: boolean; audits: LlmCallAudit[]; coverageGap?: string }> {
  const fallback = `Review ${input.affectedAsset} for ${input.category}. Apply input validation, output encoding, and access control as appropriate, then run the finding's retest scenario to confirm the issue no longer reproduces.`;
  if (!input.snapshot) {
    return { text: fallback, fallback: true, audits: [], coverageGap: 'llm:fix_prompt:SNAPSHOT_MISSING' };
  }
  try {
    const res = await runModuleReasoning({
      snapshot: input.snapshot,
      useCase: 'fix_prompt',
      bridge: input.bridge,
      systemPrompt: FIX_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        title: input.title,
        category: input.category,
        affectedAsset: input.affectedAsset,
        description: input.description,
      }),
    });
    if (res.coverageGap || !res.outputText.trim()) {
      return { text: fallback, fallback: true, audits: res.audits, ...(res.coverageGap ? { coverageGap: res.coverageGap } : {}) };
    }
    return { text: sanitizeText(res.outputText.trim()), fallback: false, audits: res.audits };
  } catch {
    return { text: fallback, fallback: true, audits: [] };
  }
}
