/**
 * OrcaRouter model discovery and capability filtering.
 *
 * The authoritative catalog is `GET {api}/models?capability=<capability>`.
 * Live results are authoritative; a small verified seed is used only when
 * discovery fails, and the seed is never merged into a successful live result.
 * Filtering fails closed whenever the catalog does not explicitly advertise a
 * capability (notably non-text input modalities).
 */

import { ORCAROUTER_API_BASE_URL, orcaRouterApiBase } from '../providers/orcarouter.js';

export type OrcaCapability = 'chat' | 'embedding' | 'image' | 'video' | 'rerank';

export const TEXT_ENDPOINT_TYPES = [
  'openai',
  'openai-response',
  'anthropic',
  'gemini',
] as const;

const NON_TEXT_ENDPOINT_TYPES = ['image-generation', 'openai-video', 'jina-rerank', 'embeddings'];

export const MAX_CATALOG_BYTES = 512 * 1024;
export const MAX_CATALOG_ITEMS = 500;
export const CATALOG_TIMEOUT_MS = 8_000;

export interface OrcaModel {
  id: string;
  name?: string;
  ownedBy?: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  inputModalities: string[];
  outputModalities: string[];
  endpointTypes: string[];
  endpointCapabilities: string[];
  supportedParameters: string[];
  reasoningEfforts?: string[];
  /** True when this entry came from the verified outage seed, not live discovery. */
  fromSeed?: boolean;
}

export interface CatalogResult {
  models: OrcaModel[];
  source: 'live' | 'fallback';
  degraded: boolean;
  catalogSource: string;
  capability: OrcaCapability;
  error?: string;
}

/**
 * The official chat catalog URL. This is the primary source of truth for text
 * model selectors and the value reported as `catalog_source` in UI evidence.
 */
export function chatCatalogSource(apiBase = orcaRouterApiBase()): string {
  return capabilityCatalogUrl(apiBase, 'chat');
}

export function capabilityCatalogUrl(apiBase: string, capability: OrcaCapability): string {
  return `${apiBase.replace(/\/+$/, '')}/models?capability=${capability}`;
}

/**
 * Verified cold-start seed. Deliberately small and annotated: only IDs the
 * integration has verified, with conservative modality metadata. `orcarouter/auto`
 * is the provider default; `orcarouter/fusion` is the general fallback.
 */
export const VERIFIED_FALLBACK_MODELS: OrcaModel[] = [
  {
    id: 'openai/gpt-5.5',
    name: 'OpenAI: GPT-5.5',
    contextLength: 400_000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'openai-response'],
    endpointCapabilities: ['chat_completions'],
    supportedParameters: ['temperature', 'max_tokens', 'response_format'],
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Anthropic: Claude Opus 4.8',
    contextLength: 200_000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['anthropic', 'openai'],
    endpointCapabilities: ['anthropic_messages', 'chat_completions'],
    supportedParameters: ['temperature', 'max_tokens'],
    reasoningEfforts: ['low', 'medium', 'high'],
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Google: Gemini 3.5 Flash',
    contextLength: 1_000_000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['gemini', 'openai'],
    endpointCapabilities: ['chat_completions', 'gemini_generate_content'],
    supportedParameters: ['temperature', 'max_tokens'],
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek: V4 Pro',
    contextLength: 128_000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'openai-response'],
    endpointCapabilities: ['chat_completions', 'openai_responses'],
    supportedParameters: ['temperature', 'max_tokens'],
  },
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter: Auto',
    inputModalities: ['text'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    endpointCapabilities: ['chat_completions'],
    supportedParameters: ['temperature', 'max_tokens'],
  },
  {
    id: 'orcarouter/fusion',
    name: 'OrcaRouter: Fusion',
    inputModalities: ['text'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'openai-response', 'anthropic', 'gemini'],
    endpointCapabilities: ['chat_completions'],
    supportedParameters: ['temperature', 'max_tokens'],
  },
];

type Json = Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Model ids keep their vendor namespace: exactly one `/`, no path tricks. */
export function isValidModelId(id: string): boolean {
  if (!id || id.length > 200 || id.includes('..')) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._@+-]*\/[A-Za-z0-9][A-Za-z0-9._@+:-]*$/.test(id);
}

/** Parse one catalog record without trusting unknown shapes. */
export function parseCatalogModel(raw: unknown): OrcaModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Json;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!isValidModelId(id)) return null;
  const architecture = (item.architecture ?? {}) as Json;
  const topProvider = (item.top_provider ?? {}) as Json;
  return {
    id,
    name: typeof item.name === 'string' ? item.name : undefined,
    ownedBy: typeof item.owned_by === 'string' ? item.owned_by : undefined,
    contextLength: asNumber(item.context_length) ?? asNumber(topProvider.context_length),
    maxCompletionTokens:
      asNumber(item.max_completion_tokens) ?? asNumber(topProvider.max_completion_tokens),
    inputModalities: asStringArray(architecture.input_modalities),
    outputModalities: asStringArray(architecture.output_modalities),
    endpointTypes: asStringArray(item.supported_endpoint_types),
    endpointCapabilities: asStringArray(item.endpoint_capabilities),
    supportedParameters: asStringArray(item.supported_parameters),
    reasoningEfforts: asStringArray(item.reasoning_efforts),
  };
}

/** Parse an OpenAI-style `{ data: [...] }` catalog envelope. */
export function parseCatalogEnvelope(payload: unknown): OrcaModel[] {
  const data =
    payload && typeof payload === 'object' && Array.isArray((payload as Json).data)
      ? ((payload as Json).data as unknown[])
      : [];
  const seen = new Set<string>();
  const models: OrcaModel[] = [];
  for (const item of data.slice(0, MAX_CATALOG_ITEMS)) {
    const model = parseCatalogModel(item);
    if (!model || seen.has(model.id)) continue;
    seen.add(model.id);
    models.push(model);
  }
  return models;
}

function hasTextEndpoint(model: OrcaModel): boolean {
  return model.endpointTypes.some((type) => (TEXT_ENDPOINT_TYPES as readonly string[]).includes(type));
}

function isNonTextOnly(model: OrcaModel): boolean {
  if (hasTextEndpoint(model)) return false;
  return model.endpointTypes.some((type) => NON_TEXT_ENDPOINT_TYPES.includes(type));
}

/**
 * Filter models for an entry point. `requiredInputModalities` must all be
 * explicitly declared by the catalog; missing metadata fails closed.
 */
export function filterModelsForCapability(
  models: readonly OrcaModel[],
  capability: OrcaCapability,
  requiredInputModalities: readonly string[] = [],
): OrcaModel[] {
  return models.filter((model) => {
    switch (capability) {
      case 'chat': {
        if (!hasTextEndpoint(model) || isNonTextOnly(model)) return false;
        if (model.endpointTypes.includes('image-generation')) return false;
        if (requiredInputModalities.length === 0) return true;
        // Multimodal fail-closed: every required modality must be declared.
        return requiredInputModalities.every((modality) =>
          model.inputModalities.includes(modality),
        );
      }
      case 'embedding':
        return (
          model.endpointTypes.includes('embeddings') ||
          model.endpointCapabilities.includes('embeddings')
        );
      case 'image':
        return (
          model.endpointTypes.includes('image-generation') ||
          model.endpointCapabilities.includes('image_generation')
        );
      case 'video':
        return model.endpointTypes.includes('openai-video');
      case 'rerank':
        return model.endpointTypes.includes('jina-rerank');
      default:
        return false;
    }
  });
}

/** True when a previously selected model is still offered by the current list. */
export function isModelSelectable(models: readonly OrcaModel[], modelId: string): boolean {
  return models.some((model) => model.id === modelId);
}

export interface DiscoverOptions {
  apiKey: string;
  apiBase?: string;
  capability?: OrcaCapability;
  requiredInputModalities?: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch and filter the catalog. Discovery failures degrade to the verified
 * seed for chat and to an empty list for every other capability.
 */
export async function discoverOrcaRouterModels(opts: DiscoverOptions): Promise<CatalogResult> {
  const apiBase = opts.apiBase ?? orcaRouterApiBase();
  const capability = opts.capability ?? 'chat';
  const catalogSource = capabilityCatalogUrl(apiBase, capability);
  const fallback = filterModelsForCapability(
    VERIFIED_FALLBACK_MODELS,
    capability,
    opts.requiredInputModalities,
  ).map((model) => ({ ...model, fromSeed: true }));

  const fail = (message: string): CatalogResult => ({
    models: fallback,
    source: 'fallback',
    degraded: true,
    catalogSource,
    capability,
    error: message,
  });

  if (!opts.apiKey) return fail('ORCAROUTER_API_KEY is not configured');

  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? CATALOG_TIMEOUT_MS);
  try {
    const res = await fetchImpl(catalogSource, {
      method: 'GET',
      headers: { authorization: `Bearer ${opts.apiKey}`, accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return fail(`model catalog returned HTTP ${res.status}`);
    }
    const text = await res.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_CATALOG_BYTES) {
      return fail('model catalog response exceeded the size limit');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return fail('model catalog returned invalid JSON');
    }
    const parsed = parseCatalogEnvelope(payload);
    if (parsed.length === 0) return fail('model catalog returned no usable models');
    // Live discovery is authoritative: do not merge the seed into this list.
    const models = filterModelsForCapability(
      parsed,
      capability,
      opts.requiredInputModalities,
    );
    if (models.length === 0) return fail('no models matched the requested capability');
    return { models, source: 'live', degraded: false, catalogSource, capability };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(`model catalog request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

export { ORCAROUTER_API_BASE_URL };
