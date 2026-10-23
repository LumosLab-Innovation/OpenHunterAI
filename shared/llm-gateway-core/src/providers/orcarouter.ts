/**
 * Named OrcaRouter Cyber Inference provider.
 *
 * OrcaRouter is an OpenAI-compatible gateway. Inference lives on
 * `https://api.orcarouter.ai/v1`; account authorization lives on
 * `https://www.orcarouter.ai` and must never be derived from the API origin.
 *
 * Cyber positioning: this provider is the named route for security teams doing
 * authorized, scoped red/blue work. The default model is `orcarouter/auto`; the
 * dedicated cyber tier (`orca/orcacyber-ultra-1.0`, `orca/orcacyber-zero-1.5`)
 * is recommended to teams verified for it; `orcarouter/fusion` is the general
 * fallback. No offensive payloads, exploit code, or target data belong in this
 * adapter — it only carries the host's already-sanitized prompts.
 */

import { BaseProvider } from './base.js';
import type { LLMResponse, ProviderName, SanitizedLLMRequest } from '../types.js';

export const ORCAROUTER_PROVIDER_ID = 'orcarouter' as const;
export const ORCAROUTER_DISPLAY_NAME = 'OrcaRouter Cyber Inference';
export const ORCAROUTER_HOME_URL = 'https://www.orcarouter.ai';
export const ORCAROUTER_CYBER_URL = 'https://www.orcarouter.ai/cyber';
export const ORCAROUTER_CYBER_MODELS_URL = 'https://www.orcarouter.ai/models?tier=cyber';
export const ORCAROUTER_AUTH_BASE_URL = 'https://www.orcarouter.ai';
export const ORCAROUTER_API_BASE_URL = 'https://api.orcarouter.ai/v1';
export const ORCAROUTER_DEFAULT_MODEL = 'orcarouter/auto';
export const ORCAROUTER_GENERAL_FALLBACK_MODEL = 'orcarouter/fusion';
export const ORCAROUTER_CYBER_MODELS = [
  'orca/orcacyber-ultra-1.0',
  'orca/orcacyber-zero-1.5',
] as const;
export const ORCAROUTER_KEY_PREFIX = 'sk-orca-';

/**
 * Resolve the inference origin. Explicit API override wins over the shared
 * self-hosted base, which wins over the public default. Remote non-HTTPS
 * origins are rejected; HTTP is only allowed for loopback development.
 */
export function orcaRouterApiBase(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeOrigin(
    env.ORCA_API_BASE_URL || env.ORCA_BASE_URL || ORCAROUTER_API_BASE_URL,
    'OrcaRouter API',
  );
}

/** Resolve the auth origin with the same precedence rules. */
export function orcaRouterAuthBase(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeOrigin(
    env.ORCA_AUTH_BASE_URL || env.ORCA_BASE_URL || ORCAROUTER_AUTH_BASE_URL,
    'OrcaRouter auth',
  );
}

export function normalizeOrigin(raw: string, label: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} base URL is not a valid URL`);
  }
  const loopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error(`${label} base URL must use HTTPS (HTTP is only allowed for loopback)`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} base URL must not contain userinfo`);
  }
  return url.toString().replace(/\/+$/, '');
}

/** Mask a key for status surfaces. Never returns the full secret. */
export function maskOrcaRouterKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string };
}

export class OrcaRouterProvider extends BaseProvider {
  readonly name: ProviderName = ORCAROUTER_PROVIDER_ID;
  private readonly baseUrl: string;

  constructor(opts: { baseUrl?: string; apiKey?: string } = {}) {
    super();
    this.baseUrl = opts.baseUrl ?? orcaRouterApiBase();
    this.apiKey = opts.apiKey ?? process.env.ORCAROUTER_API_KEY;
  }

  private readonly apiKey?: string;

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(req: SanitizedLLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    this.assertSanitized(req);
    if (!this.apiKey) {
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText: '',
        latencyMs: 0,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'ORCAROUTER_API_KEY is not set',
          retryable: false,
        },
      };
    }

    const body: Record<string, unknown> = {
      model: req.resolvedModel,
      max_tokens: req.effectiveMaxOutputTokens,
      temperature: req.temperature ?? 0.2,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    };
    if (req.requireJson) body.response_format = { type: 'json_object' };

    try {
      const { status, data, latencyMs } = await this.fetchJSON(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          timeoutMs: req.effectiveTimeoutMs,
          signal,
        },
      );
      const parsed = data as OpenAIChatResponse;
      if (status >= 400) {
        return {
          provider: this.name,
          modelAlias: req.modelAlias,
          model: req.resolvedModel,
          outputText: '',
          latencyMs,
          // A durable OrcaRouter key is not refreshable. A 401 is terminal
          // until the user reconnects; never retry it as if it were transient.
          error: {
            code: status === 401 ? 'NEEDS_REAUTH' : parsed.error?.code || `HTTP_${status}`,
            message:
              status === 401
                ? 'OrcaRouter rejected this key. Reconnect OrcaRouter to issue a new key.'
                : parsed.error?.message || `OrcaRouter returned status ${status}`,
            retryable: status === 429 || status >= 500,
          },
        };
      }
      return {
        provider: this.name,
        modelAlias: req.modelAlias,
        model: req.resolvedModel,
        outputText: parsed.choices?.[0]?.message?.content ?? '',
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
