import { GuardrailError } from '@x-hunter/shared';
import type { LLMError, LLMProvider, LLMResponse, ProviderName, SanitizedLLMRequest } from '../types.js';

export abstract class BaseProvider implements LLMProvider {
  abstract readonly name: ProviderName;
  abstract isConfigured(): boolean;
  abstract generate(req: SanitizedLLMRequest, signal?: AbortSignal): Promise<LLMResponse>;

  protected assertSanitized(req: SanitizedLLMRequest): void {
    if (!req.sanitized) {
      throw new GuardrailError(
        'EVIDENCE_NOT_SANITIZED',
        'Provider was called with a non-sanitized request',
      );
    }
  }

  protected normalizeFetchError(err: unknown): LLMError {
    const message = err instanceof Error ? err.message : String(err);
    const retryable =
      /timeout|ECONNRESET|ENETUNREACH|ETIMEDOUT|EAI_AGAIN|rate.?limit|overloaded|503|502/i.test(
        message,
      );
    return {
      code: 'PROVIDER_FETCH_FAILED',
      message,
      retryable,
    };
  }

  protected async fetchJSON(
    url: string,
    init: RequestInit & { timeoutMs: number; signal?: AbortSignal },
  ): Promise<{ status: number; data: unknown; latencyMs: number }> {
    const start = Date.now();
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    init.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      const text = await res.text();
      const latencyMs = Date.now() - start;
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }
      return { status: res.status, data, latencyMs };
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener('abort', onAbort);
    }
  }
}
