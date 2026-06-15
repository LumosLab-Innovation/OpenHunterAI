import { LLMGateway } from '@x-hunter/llm-gateway';
import type { PackageTier } from '@x-hunter/shared';
import { sanitizeText } from '@x-hunter/shared';

/**
 * Single LLMGateway for the reporting service. Used for report_generation and
 * fix_prompt use cases via aliases only (LLM_PROVIDER_SPEC.md §1-§3). The LLM
 * augments the deterministic report; it never overrides policy or invents
 * findings (PRODUCTION_READINESS.md §5).
 */
let _gateway: LLMGateway | null = null;

export function getGateway(): LLMGateway {
  if (!_gateway) {
    _gateway = new LLMGateway({ retryAttempts: Number(process.env.LLM_RETRY_ATTEMPTS || 1) });
  }
  return _gateway;
}

export function setGateway(gateway: LLMGateway): void {
  _gateway = gateway;
}

const FIX_SYSTEM_PROMPT =
  'You are a secure-coding assistant. Given a sanitized security finding, write a concise, ' +
  'concrete remediation prompt a developer can act on. No raw secrets. Plain text, <= 120 words.';

export interface FixPromptInput {
  projectId: string;
  scanId: string;
  findingId: string;
  packageTier: PackageTier;
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
export async function generateFixPrompt(gateway: LLMGateway, input: FixPromptInput): Promise<{ text: string; fallback: boolean }> {
  const fallback = `Review ${input.affectedAsset} for ${input.category}. Apply input validation, output encoding, and access control as appropriate, then run the finding's retest scenario to confirm the issue no longer reproduces.`;
  try {
    const res = await gateway.generate({
      useCase: 'fix_prompt',
      projectId: input.projectId,
      scanId: input.scanId,
      findingId: input.findingId,
      packageTier: input.packageTier,
      systemPrompt: FIX_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        title: input.title,
        category: input.category,
        affectedAsset: input.affectedAsset,
        description: input.description,
      }),
    });
    if (res.error || !res.outputText.trim()) {
      return { text: fallback, fallback: true };
    }
    return { text: sanitizeText(res.outputText.trim()), fallback: false };
  } catch {
    return { text: fallback, fallback: true };
  }
}
