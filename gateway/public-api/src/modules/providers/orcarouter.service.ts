/**
 * OrcaRouter Cyber Inference provider settings.
 *
 * The frontend never sees the raw key. Credentials stay in the local API
 * process and are persisted through the repository's existing `.env.local`
 * provider-secret mechanism. Model discovery happens server-side with the
 * stored Bearer key and returns only selector metadata.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  CredentialGenerationTracker,
  EnvFileCredentialStore,
  activeOrcaRouterKey,
  apiKeyCredential,
  persistCredential,
  type CatalogResult,
  type OrcaCapability,
  OrcaRouterPkceFlow,
  ORCAROUTER_CYBER_MODELS,
  ORCAROUTER_CYBER_MODELS_URL,
  ORCAROUTER_CYBER_URL,
  ORCAROUTER_DEFAULT_MODEL,
  ORCAROUTER_DISPLAY_NAME,
  ORCAROUTER_GENERAL_FALLBACK_MODEL,
  ORCAROUTER_HOME_URL,
  ORCAROUTER_PROVIDER_ID,
  discoverOrcaRouterModels,
  orcaRouterApiBase,
  orcaRouterAuthBase,
  type PkceAttemptView,
} from '@x-hunter/llm-gateway';

const CAPABILITIES: OrcaCapability[] = ['chat', 'embedding', 'image', 'video', 'rerank'];
const CATALOG_TTL_MS = 60_000;

function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'go.work')) || existsSync(join(dir, '.env.local.example'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

export function orcaRouterEnvFile(): string {
  return process.env.OPENHUNTER_ENV_FILE || join(findRepoRoot(), '.env.local');
}

const store = new EnvFileCredentialStore(orcaRouterEnvFile());
export const credentialGenerations = new CredentialGenerationTracker();

interface AttemptOwner {
  accountId: string;
}

const attemptOwners = new Map<string, AttemptOwner>();

const flow = new OrcaRouterPkceFlow({
  authBaseUrl: orcaRouterAuthBase(),
  appName: 'OpenHunterAI',
  onCredential: async (result) => {
    if (!result.ok) return;
    const persisted = await persistCredential(store, result);
    if (!persisted.ok) throw new Error(persisted.error.code);
  },
});

interface CatalogCacheEntry {
  expiresAt: number;
  result: CatalogResult;
}
const catalogCache = new Map<string, CatalogCacheEntry>();

export interface ProviderModelView {
  id: string;
  name?: string;
  contextLength?: number;
  inputModalities: string[];
  reasoningEfforts?: string[];
  fromSeed?: boolean;
}

export interface OrcaRouterStatus {
  provider: {
    id: string;
    displayName: string;
    apiBase: string;
    authBase: string;
    homeUrl: string;
    cyberUrl: string;
    cyberModelsUrl: string;
    defaultModel: string;
    recommendedCyberModels: readonly string[];
    generalFallbackModel: string;
  };
  auth: {
    apiKey: { configured: boolean; maskedKey?: string };
    pkce: { available: boolean; flow: 'loopback'; pendingAttempts: number };
  };
  catalog: {
    capability: OrcaCapability;
    source: 'live' | 'fallback';
    degraded: boolean;
    catalogSource: string;
    modelCount: number;
    models: ProviderModelView[];
    error?: string;
  };
}

export async function providerStatus(): Promise<OrcaRouterStatus> {
  const key = await activeOrcaRouterKey(store);
  const catalog = await modelsFor('chat');
  return {
    provider: {
      id: ORCAROUTER_PROVIDER_ID,
      displayName: ORCAROUTER_DISPLAY_NAME,
      apiBase: orcaRouterApiBase(),
      authBase: orcaRouterAuthBase(),
      homeUrl: ORCAROUTER_HOME_URL,
      cyberUrl: ORCAROUTER_CYBER_URL,
      cyberModelsUrl: ORCAROUTER_CYBER_MODELS_URL,
      defaultModel: ORCAROUTER_DEFAULT_MODEL,
      recommendedCyberModels: ORCAROUTER_CYBER_MODELS,
      generalFallbackModel: ORCAROUTER_GENERAL_FALLBACK_MODEL,
    },
    auth: {
      apiKey: {
        configured: Boolean(key),
        maskedKey: key ? maskConfiguredKey(key) : undefined,
      },
      pkce: {
        available: true,
        flow: 'loopback',
        pendingAttempts: [...attemptOwners.keys()].length,
      },
    },
    catalog: {
      capability: catalog.capability,
      source: catalog.source,
      degraded: catalog.degraded,
      catalogSource: catalog.catalogSource,
      modelCount: catalog.models.length,
      models: catalog.models.map(toView),
      error: catalog.error,
    },
  };
}

function toView(model: CatalogResult['models'][number]): ProviderModelView {
  return {
    id: model.id,
    name: model.name,
    contextLength: model.contextLength,
    inputModalities: model.inputModalities,
    reasoningEfforts: model.reasoningEfforts,
    fromSeed: model.fromSeed,
  };
}

function maskConfiguredKey(key: string): string {
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export async function saveApiKey(rawKey: string) {
  const credential = apiKeyCredential(rawKey, credentialGenerations.current('local') + 1);
  const persisted = await persistCredential(store, credential);
  if (persisted.ok) {
    credentialGenerations.begin('local');
    invalidateCatalog();
  }
  return persisted;
}

export async function clearApiKey(): Promise<void> {
  await store.clear();
  invalidateCatalog();
}

export async function startPkce(accountId: string, mode: 'loopback' | 'oob') {
  const view = mode === 'oob' ? flow.startOutOfBand(accountId) : await flow.startLoopback(accountId);
  attemptOwners.set(view.id, { accountId });
  return view;
}

export async function pkceAttempt(accountId: string, id: string): Promise<PkceAttemptView | undefined> {
  return flow.getForAccount(id, accountId);
}

export async function submitPkceCode(
  accountId: string,
  id: string,
  code: string,
): Promise<PkceAttemptView | undefined> {
  const view = await flow.submitCodeForAccount(id, code, accountId);
  if (view?.status === 'complete') {
    credentialGenerations.begin(accountId);
    invalidateCatalog();
  }
  return view;
}

export function cancelPkce(accountId: string, id: string): boolean {
  const cancelled = flow.cancelForAccount(id, accountId);
  if (cancelled) attemptOwners.delete(id);
  return cancelled;
}

export async function modelsFor(
  capability: OrcaCapability,
  requiredInputModalities: string[] = [],
  forceRefresh = false,
): Promise<CatalogResult> {
  if (!CAPABILITIES.includes(capability)) {
    return {
      models: [],
      source: 'fallback',
      degraded: true,
      catalogSource: '',
      capability,
      error: 'unsupported capability',
    };
  }
  const cacheKey = `${capability}:${requiredInputModalities.join(',')}`;
  const cached = catalogCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.result;

  const key = await activeOrcaRouterKey(store);
  const result = await discoverOrcaRouterModels({
    apiKey: key ?? '',
    apiBase: orcaRouterApiBase(),
    capability,
    requiredInputModalities,
  });
  catalogCache.set(cacheKey, { expiresAt: Date.now() + CATALOG_TTL_MS, result });
  return result;
}

export function invalidateCatalog(): void {
  catalogCache.clear();
}
