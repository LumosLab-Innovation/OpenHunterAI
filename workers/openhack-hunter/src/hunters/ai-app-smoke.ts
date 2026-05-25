import type { OpenHackInput } from '../index.js';
import type { Hunter, HunterOutput } from './types.js';

const AI_APP_PATTERNS = [/openai/i, /anthropic/i, /api\.openai\.com/i, /huggingface/i, /replicate/i];

export const aiAppSmokeHunter: Hunter = function aiAppSmokeHunter(
  input: OpenHackInput,
): HunterOutput {
  const out: HunterOutput = { candidates: [], warnings: [], hardening: [], coverageGaps: [] };

  for (const e of input.browser.apiEndpoints) {
    if (AI_APP_PATTERNS.some((p) => p.test(e.url))) {
      out.candidates.push({
        source: 'openhack',
        title: `Direct LLM provider call observed from the browser`,
        severity: 'high',
        confidence: 'medium',
        category: 'ai-app',
        affectedAsset: e.url,
        evidence: {
          description:
            `The page calls ${e.url} directly. If an API key is required, calling LLM providers from the ` +
            `browser typically exposes that key. Route all LLM requests through a server-side gateway.`,
          sanitized: true,
        },
      });
    }
  }

  for (const k of input.browser.storageKeys) {
    const hint = k.keyName.toLowerCase();
    if (
      hint.includes('openai') ||
      hint.includes('anthropic') ||
      hint.includes('llm') ||
      hint.includes('model')
    ) {
      out.warnings.push(`Possible LLM key cached in ${k.scope}: ${k.keyName}`);
    }
  }
  return out;
};
