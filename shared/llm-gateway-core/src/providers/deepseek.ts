import { BaseProvider } from './base.js';
import type { LLMResponse, ProviderName, SanitizedLLMRequest } from '../types.js';

interface DeepSeekResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

/** DeepSeek's API is OpenAI-compatible (same /chat/completions shape). */
export class DeepSeekProvider extends BaseProvider {
  readonly name: ProviderName = 'deepseek';
  private readonly baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

  isConfigured(): boolean {
    return !!process.env.DEEPSEEK_API_KEY;
  }

  async generate(req: SanitizedLLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    this.assertSanitized(req);
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText: '',
        latencyMs: 0,
        error: { code: 'NOT_CONFIGURED', message: 'DEEPSEEK_API_KEY is not set', retryable: false },
      };
    }

    const body = {
      model: req.resolvedModel,
      max_tokens: req.effectiveMaxOutputTokens,
      temperature: req.temperature ?? 0.2,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    };

    try {
      const { status, data, latencyMs } = await this.fetchJSON(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(body),
        timeoutMs: req.effectiveTimeoutMs,
        signal,
      });
      const parsed = data as DeepSeekResponse;
      if (status >= 400) {
        return {
          provider: this.name,
          modelAlias: req.modelAlias,
          model: req.resolvedModel,
          outputText: '',
          latencyMs,
          error: {
            code: parsed.error?.code || `HTTP_${status}`,
            message: parsed.error?.message || `DeepSeek returned status ${status}`,
            retryable: status === 429 || status >= 500,
          },
        };
      }
      const outputText = parsed.choices?.[0]?.message?.content ?? '';
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText,
        inputTokens: parsed.usage?.prompt_tokens,
        outputTokens: parsed.usage?.completion_tokens,
        latencyMs,
        finishReason: parsed.choices?.[0]?.finish_reason,
      };
    } catch (e) {
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText: '',
        latencyMs: 0,
        error: this.normalizeFetchError(e),
      };
    }
  }
}
