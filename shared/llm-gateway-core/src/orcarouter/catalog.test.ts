import { describe, expect, it, vi } from 'vitest';
import {
  VERIFIED_FALLBACK_MODELS,
  capabilityCatalogUrl,
  chatCatalogSource,
  discoverOrcaRouterModels,
  filterModelsForCapability,
  isModelSelectable,
  parseCatalogEnvelope,
} from './catalog.js';

const CATALOG_FIXTURE = {
  object: 'list',
  success: true,
  data: [
    {
      id: 'openai/gpt-5.5',
      owned_by: 'OpenAI',
      supported_endpoint_types: ['openai', 'openai-response'],
      context_length: 400000,
      architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      supported_parameters: ['temperature'],
      reasoning_efforts: ['low', 'medium', 'high', 'xhigh'],
    },
    {
      id: 'anthropic/claude-opus-4.8',
      owned_by: 'Anthropic',
      supported_endpoint_types: ['anthropic', 'openai'],
      context_length: 200000,
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
    },
    {
      id: 'deepseek/deepseek-v4-flash-vision-exp',
      owned_by: 'DeepSeek',
      supported_endpoint_types: ['openai', 'openai-response', 'anthropic'],
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
    },
    {
      id: 'orca/orcacyber-ultra-1.0',
      owned_by: 'Orca',
      supported_endpoint_types: ['openai'],
      architecture: { input_modalities: ['text'], output_modalities: ['text'] },
      context_length: 1048576,
      support_parameters: ['reasoning'],
    },
    {
      id: 'openai/text-embedding-4',
      owned_by: 'OpenAI',
      supported_endpoint_types: ['embeddings'],
      architecture: { input_modalities: ['text'], output_modalities: ['embedding'] },
    },
    {
      id: 'openai/gpt-image-2',
      owned_by: 'OpenAI',
      supported_endpoint_types: ['image-generation'],
      architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    },
    {
      id: 'openai/sora-3',
      owned_by: 'OpenAI',
      supported_endpoint_types: ['openai-video'],
    },
    {
      id: 'jina/jina-reranker-v3',
      owned_by: 'Jina',
      supported_endpoint_types: ['jina-rerank'],
    },
    {
      id: 'mystery/undocumented-model',
      supported_endpoint_types: ['openai'],
    },
    { id: '../../etc/passwd', supported_endpoint_types: ['openai'] },
    { id: 'openai/gpt-5.5', supported_endpoint_types: ['openai'] },
  ],
};

describe('catalog parsing', () => {
  it('parses the OpenAI-style envelope, de-duplicates and rejects bad ids', () => {
    const models = parseCatalogEnvelope(CATALOG_FIXTURE);
    expect(models.map((m) => m.id)).toContain('openai/gpt-5.5');
    expect(models.filter((m) => m.id === 'openai/gpt-5.5')).toHaveLength(1);
    expect(models.some((m) => m.id.includes('etc/passwd'))).toBe(false);
    expect(models.find((m) => m.id === 'openai/gpt-5.5')?.contextLength).toBe(400000);
    expect(models.find((m) => m.id === 'openai/gpt-5.5')?.reasoningEfforts).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
  });

  it('treats an unknown payload as empty', () => {
    expect(parseCatalogEnvelope(null)).toEqual([]);
    expect(parseCatalogEnvelope({ data: 'nope' })).toEqual([]);
  });
});

describe('capability filtering', () => {
  const models = parseCatalogEnvelope(CATALOG_FIXTURE);

  it('keeps only text-capable chat models and excludes generation/rerank endpoints', () => {
    const chat = filterModelsForCapability(models, 'chat');
    const ids = chat.map((m) => m.id);
    expect(ids).toContain('openai/gpt-5.5');
    expect(ids).toContain('orca/orcacyber-ultra-1.0');
    expect(ids).not.toContain('openai/gpt-image-2');
    expect(ids).not.toContain('openai/sora-3');
    expect(ids).not.toContain('jina/jina-reranker-v3');
    expect(ids).not.toContain('openai/text-embedding-4');
  });

  it('fails closed for multimodal chat when the catalog omits modalities', () => {
    const vision = filterModelsForCapability(models, 'chat', ['image']);
    expect(vision.map((m) => m.id).sort()).toEqual([
      'anthropic/claude-opus-4.8',
      'deepseek/deepseek-v4-flash-vision-exp',
    ]);
    expect(vision.some((m) => m.id === 'openai/gpt-5.5')).toBe(false);
    expect(vision.some((m) => m.id === 'mystery/undocumented-model')).toBe(false);
  });

  it('filters embedding, image, video and rerank strictly', () => {
    expect(filterModelsForCapability(models, 'embedding').map((m) => m.id)).toEqual([
      'openai/text-embedding-4',
    ]);
    expect(filterModelsForCapability(models, 'image').map((m) => m.id)).toEqual([
      'openai/gpt-image-2',
    ]);
    expect(filterModelsForCapability(models, 'video').map((m) => m.id)).toEqual([
      'openai/sora-3',
    ]);
    expect(filterModelsForCapability(models, 'rerank').map((m) => m.id)).toEqual([
      'jina/jina-reranker-v3',
    ]);
  });

  it('invalidates a selected model that is no longer compatible', () => {
    const textOnly = filterModelsForCapability(models, 'chat');
    expect(isModelSelectable(textOnly, 'openai/gpt-5.5')).toBe(true);
    const visionOnly = filterModelsForCapability(models, 'chat', ['image']);
    expect(isModelSelectable(visionOnly, 'openai/gpt-5.5')).toBe(false);
  });
});

describe('discovery', () => {
  it('uses the authoritative chat catalog URL and treats live results as authoritative', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(CATALOG_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const result = await discoverOrcaRouterModels({
      apiKey: 'sk-orca-test',
      apiBase: 'https://api.orcarouter.ai/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.orcarouter.ai/v1/models?capability=chat');
    expect(result.catalogSource).toBe('https://api.orcarouter.ai/v1/models?capability=chat');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-orca-test');
    expect(result.source).toBe('live');
    expect(result.degraded).toBe(false);
    // No seed mixed into an authoritative live result.
    expect(result.models.some((m) => m.fromSeed)).toBe(false);
    expect(result.models.some((m) => m.id === 'orcarouter/fusion' && m.fromSeed)).toBe(false);
  });

  it('falls back to the verified seed on failure without inventing capabilities', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const result = await discoverOrcaRouterModels({
      apiKey: 'sk-orca-test',
      apiBase: 'https://api.orcarouter.ai/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.source).toBe('fallback');
    expect(result.degraded).toBe(true);
    expect(result.models.every((m) => m.fromSeed)).toBe(true);
    const ids = result.models.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'openai/gpt-5.5',
        'anthropic/claude-opus-4.8',
        'google/gemini-3.5-flash',
        'deepseek/deepseek-v4-pro',
        'orcarouter/auto',
      ]),
    );
    const gpt = result.models.find((m) => m.id === 'openai/gpt-5.5');
    expect(gpt?.reasoningEfforts).toEqual(['low', 'medium', 'high', 'xhigh']);
    expect(gpt?.inputModalities).toEqual(['text']);
  });

  it('returns an empty, clearly degraded list when no key is configured', async () => {
    const result = await discoverOrcaRouterModels({ apiKey: '' });
    expect(result.source).toBe('fallback');
    expect(result.degraded).toBe(true);
  });

  it('rejects oversized and malformed catalog responses', async () => {
    const huge = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'x', pad: 'a'.repeat(600 * 1024) }] }), {
        status: 200,
      }),
    );
    const result = await discoverOrcaRouterModels({
      apiKey: 'sk-orca-test',
      fetchImpl: huge as unknown as typeof fetch,
    });
    expect(result.degraded).toBe(true);
    expect(result.error).toMatch(/size limit/);
  });
});

describe('catalog source', () => {
  it('is the official chat catalog endpoint', () => {
    expect(chatCatalogSource('https://api.orcarouter.ai/v1')).toBe(
      'https://api.orcarouter.ai/v1/models?capability=chat',
    );
    expect(capabilityCatalogUrl('https://api.orcarouter.ai/v1', 'embedding')).toBe(
      'https://api.orcarouter.ai/v1/models?capability=embedding',
    );
  });

  it('keeps the required verified seed metadata for gpt-5.5', () => {
    const gpt = VERIFIED_FALLBACK_MODELS.find((m) => m.id === 'openai/gpt-5.5');
    expect(gpt?.reasoningEfforts).toEqual(['low', 'medium', 'high', 'xhigh']);
  });
});
