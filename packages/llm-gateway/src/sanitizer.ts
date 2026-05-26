/**
 * Prompt Sanitizer. Wraps the shared evidence sanitizer with strict pre-flight
 * checks for known credential patterns. Any prompt that still contains a
 * raw token after sanitization causes a hard error — we never silently send.
 */

import { sanitizeText, sanitizeValue, GuardrailError } from '@x-hunter/shared';
import type { LLMRequest } from './types.js';

const FORBIDDEN_AFTER_SANITIZE: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._\-+/]+=*\b/,
  /\beyJ[A-Za-z0-9._-]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{16,}\b/i,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{36,}\b/,
];

export interface SanitizedPromptParts {
  systemPrompt: string;
  userPrompt: string;
  compactContext?: Record<string, unknown>;
}

export function sanitizePrompt(req: LLMRequest): SanitizedPromptParts {
  const systemPrompt = sanitizeText(req.systemPrompt);
  const userPrompt = sanitizeText(req.userPrompt);
  const compactContext =
    req.compactContext === undefined
      ? undefined
      : (sanitizeValue(req.compactContext) as Record<string, unknown>);

  assertNoRawSecrets(systemPrompt);
  assertNoRawSecrets(userPrompt);
  if (compactContext) assertNoRawSecrets(JSON.stringify(compactContext));

  return { systemPrompt, userPrompt, compactContext };
}

function assertNoRawSecrets(text: string): void {
  for (const re of FORBIDDEN_AFTER_SANITIZE) {
    if (re.test(text)) {
      throw new GuardrailError(
        'EVIDENCE_NOT_SANITIZED',
        'Sanitizer detected residual secret-like token. Refusing to send to LLM provider.',
      );
    }
  }
}
