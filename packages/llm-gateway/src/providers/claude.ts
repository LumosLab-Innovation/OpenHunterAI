import { BaseProvider } from './base.js';
import type { LLMResponse, ProviderName, SanitizedLLMRequest } from '../types.js';

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
  error?: { type?: string; message?: string };
}

export class ClaudeProvider extends BaseProvider {
  readonly name: ProviderName = 'claude';
  private readonly baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
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
        error: {
          code: 'NOT_CONFIGURED',
          message: 'ANTHROPIC_API_KEY is not set',
          retryable: false,
        },
      };
    }

    const body = {
      model: req.resolvedModel,
      max_tokens: req.effectiveMaxOutputTokens,
      temperature: req.temperature ?? 0.2,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
    };

    try {
      const { status, data, latencyMs } = await this.fetchJSON(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        timeoutMs: req.effectiveTimeoutMs,
        signal,
      });
      const parsed = data as ClaudeResponse;
      if (status >= 400) {
        return {
          provider: this.name,
          modelAlias: req.modelAlias,
          model: req.resolvedModel,
          outputText: '',
          latencyMs,
          error: {
            code: parsed.error?.type || `HTTP_${status}`,
            message: parsed.error?.message || `Anthropic returned status ${status}`,
            retryable: status === 429 || status >= 500,
          },
        };
      }
      const outputText = (parsed.content ?? [])
        .filter((c) => c.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text as string)
        .join('');
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText,
        inputTokens: parsed.usage?.input_tokens,
        outputTokens: parsed.usage?.output_tokens,
        latencyMs,
        finishReason: parsed.stop_reason,
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
