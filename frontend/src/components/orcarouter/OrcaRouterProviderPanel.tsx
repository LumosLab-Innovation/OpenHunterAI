import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ExternalLink, KeyRound, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  cancelPkce,
  clearApiKey,
  fetchModels,
  fetchStatus,
  pollPkce,
  saveApiKey,
  startPkce,
  submitPkceCode,
  type OrcaRouterAttempt,
  type OrcaRouterModel,
  type OrcaRouterStatus,
} from '../../lib/orcarouter';

const SELECTED_MODEL_KEY = 'orcarouter:selected-model';
const DEFAULT_MODEL = 'orcarouter/auto';

/**
 * OrcaRouter Cyber Inference provider panel.
 *
 * Two credential paths are always offered side by side: a pasted API key and
 * OAuth 2.0 + PKCE. Both produce the same durable `sk-orca-…` credential; the
 * provider and model-catalog code never sees which path was used.
 */
export function OrcaRouterProviderPanel() {
  const [status, setStatus] = useState<OrcaRouterStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [models, setModels] = useState<OrcaRouterModel[]>([]);
  const [catalogSource, setCatalogSource] = useState<string>('');
  const [catalogDegraded, setCatalogDegraded] = useState(false);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [maskedKey, setMaskedKey] = useState<string | undefined>(undefined);
  const [savingKey, setSavingKey] = useState(false);

  const [selectedModel, setSelectedModel] = useState(
    () => window.localStorage.getItem(SELECTED_MODEL_KEY) || DEFAULT_MODEL,
  );
  const [modelOpen, setModelOpen] = useState(false);
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<OrcaRouterAttempt | null>(null);
  const [oauthMode, setOauthMode] = useState<'loopback' | 'oob'>('loopback');
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthHint, setOauthHint] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pastedCode, setPastedCode] = useState('');

  // Every async login response is checked against this generation. pagehide and
  // unmount bump it so a late response cannot mutate a newer attempt's state.
  const generation = useRef(0);
  const attemptIdRef = useRef<string | null>(null);

  const applyCatalog = useCallback(
    (
      next: OrcaRouterModel[],
      _source: 'live' | 'fallback',
      catalogSourceUrl: string,
      degraded: boolean,
      error?: string,
    ) => {
    setModels(next);
    setCatalogSource(catalogSourceUrl || 'https://api.orcarouter.ai/v1/models?capability=chat');
    setCatalogDegraded(degraded);
    setCatalogNote(
      degraded
        ? `Live catalog unavailable${error ? ` (${error})` : ''}. Showing a small verified fallback list.`
        : null,
    );
    setSelectedModel((current) => {
      if (next.some((model) => model.id === current)) return current;
      const fromStorage = window.localStorage.getItem(SELECTED_MODEL_KEY);
      if (fromStorage && next.some((model) => model.id === fromStorage)) return fromStorage;
      const fallback = next.some((model) => model.id === DEFAULT_MODEL) ? DEFAULT_MODEL : next[0]?.id;
      if (fallback) {
        setModelNotice(
          current === fallback
            ? null
            : `The previous model is not offered by the current catalog; selected ${fallback}.`,
        );
      }
      return fallback ?? '';
    });
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusError(null);
    const res = await fetchStatus();
    if (!res.ok) {
      setStatusError(res.error.message ?? 'OrcaRouter settings are unavailable.');
      return null;
    }
    setStatus(res.data);
    setMaskedKey(res.data.auth.apiKey.maskedKey);
    applyCatalog(
      res.data.catalog.models,
      res.data.catalog.source,
      res.data.catalog.catalogSource,
      res.data.catalog.degraded,
      res.data.catalog.error,
    );
    return res.data;
  }, [applyCatalog]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Persist and validate the selected model against the current compatible list.
  useEffect(() => {
    if (!selectedModel) return;
    window.localStorage.setItem(SELECTED_MODEL_KEY, selectedModel);
  }, [selectedModel]);

  // Terminal cleanup for bfcache/pagehide: clear UI synchronously and cancel the
  // server-side attempt with keepalive. Do not rely on a guarded finally block.
  useEffect(() => {
    const onPageHide = () => {
      generation.current += 1;
      setOauthBusy(false);
      setOauthHint(null);
      const id = attemptIdRef.current;
      attemptIdRef.current = null;
      if (id) void cancelPkce(id, true).catch(() => undefined);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      generation.current += 1;
      const id = attemptIdRef.current;
      attemptIdRef.current = null;
      if (id) void cancelPkce(id).catch(() => undefined);
    };
  }, []);

  // Poll a pending Flow A attempt without hot-looping.
  useEffect(() => {
    if (!attempt || attempt.status !== 'pending') return;
    const myGeneration = generation.current;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      if (cancelled || generation.current !== myGeneration) return;
      const res = await pollPkce(attempt.id);
      if (cancelled || generation.current !== myGeneration) return;
      if (!res.ok) {
        setOauthError(res.error.message ?? 'Could not check the OrcaRouter sign-in.');
        setOauthBusy(false);
        return;
      }
      setAttempt(res.data);
      if (res.data.status === 'pending') {
        timer = window.setTimeout(tick, 1200);
        return;
      }
      setOauthBusy(false);
      if (res.data.status === 'complete') {
        setOauthHint('Connected. OrcaRouter issued a key for this workspace.');
        setOauthError(null);
        setMaskedKey(res.data.maskedKey);
        void loadStatus();
      } else {
        setOauthError(res.data.error?.message ?? 'OrcaRouter sign-in did not complete.');
      }
    };
    timer = window.setTimeout(tick, 800);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [attempt, loadStatus]);

  async function onSaveKey() {
    setSavingKey(true);
    setKeyMessage(null);
    const res = await saveApiKey(apiKey);
    setSavingKey(false);
    if (!res.ok) {
      setKeyMessage(res.error.message ?? 'The key could not be saved.');
      return;
    }
    setMaskedKey(res.data.maskedKey);
    setApiKey('');
    setKeyMessage('Saved to the local workspace. It is used by model discovery immediately.');
    void loadStatus();
  }

  async function onClearKey() {
    setKeyMessage(null);
    const res = await clearApiKey();
    if (!res.ok) {
      setKeyMessage(res.error.message ?? 'The key could not be cleared.');
      return;
    }
    setMaskedKey(undefined);
    setKeyMessage('OrcaRouter key cleared.');
    void loadStatus();
  }

  async function onStartLogin(mode: 'loopback' | 'oob') {
    generation.current += 1;
    const myGeneration = generation.current;
    setOauthMode(mode);
    setOauthBusy(true);
    setOauthError(null);
    setOauthHint(null);
    setPastedCode('');
    const res = await startPkce(mode);
    if (generation.current !== myGeneration) {
      // pagehide/unmount happened while /oauth/start was in flight. Release the
      // server-side attempt instead of leaking it.
      if (res.ok) void cancelPkce(res.data.id, true).catch(() => undefined);
      return;
    }
    if (!res.ok) {
      setOauthBusy(false);
      setOauthError(res.error.message ?? 'Could not start OrcaRouter sign-in.');
      return;
    }
    attemptIdRef.current = res.data.id;
    setAttempt(res.data);
    if (mode === 'loopback') {
      window.open(res.data.authorizeUrl, '_blank', 'noopener,noreferrer');
      setOauthHint('A browser window opened. Approve access, then return here.');
    } else {
      setOauthHint('Open the authorization page and paste the code OrcaRouter shows.');
    }
  }

  async function onSubmitCode() {
    if (!attempt) return;
    const myGeneration = generation.current;
    setOauthBusy(true);
    setOauthError(null);
    const res = await submitPkceCode(attempt.id, pastedCode);
    if (generation.current !== myGeneration) return;
    setOauthBusy(false);
    if (!res.ok) {
      setOauthError(res.error.message ?? 'That code could not be redeemed.');
      return;
    }
    setAttempt(res.data);
    if (res.data.status === 'complete') {
      setOauthHint('Connected. OrcaRouter issued a key for this workspace.');
      setMaskedKey(res.data.maskedKey);
      void loadStatus();
    } else {
      setOauthError(res.data.error?.message ?? 'OrcaRouter sign-in did not complete.');
    }
  }

  async function onCancelLogin() {
    const id = attempt?.id;
    const myGeneration = ++generation.current;
    if (id) {
      const res = await cancelPkce(id);
      if (generation.current !== myGeneration) return;
      if (!res.ok) {
        setOauthBusy(false);
        setOauthError('Sign-in could not be cancelled. Check the connection status.');
        setAttempt(current => current ? { ...current } : current);
        void loadStatus();
        return;
      }
    }
    attemptIdRef.current = null;
    setAttempt(null);
    setOauthBusy(false);
    setOauthHint(null);
    setOauthError(null);
  }

  async function onRefreshCatalog() {
    setLoadingModels(true);
    setModelNotice(null);
    const res = await fetchModels('chat', [], true);
    setLoadingModels(false);
    if (!res.ok) {
      setCatalogNote(res.error.message ?? 'Could not refresh the OrcaRouter catalog.');
      return;
    }
    applyCatalog(res.data.models, res.data.source as 'live' | 'fallback', res.data.catalogSource, res.data.degraded, res.data.error);
  }

  const selected = models.find((model) => model.id === selectedModel);
  const cyberRecommended = new Set(status?.provider.recommendedCyberModels ?? []);

  return (
    <div
      data-testid="orcarouter-provider-panel"
      className="my-5 rounded-xl border border-hairline bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-signal" />
            OrcaRouter Cyber Inference
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-ink-muted">
            Named inference route for authorized, scoped security work. Cyber models
            for red teams and gateway controls for blue teams on one OpenAI-compatible
            endpoint. Built for teams whose OrcaRouter workspace is verified for the
            cyber tier; general requests route through the same provider.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <a className="inline-flex items-center gap-1 text-signal" href={status?.provider.cyberUrl ?? 'https://www.orcarouter.ai/cyber'} target="_blank" rel="noreferrer">
              Cyber provider <ExternalLink size={12} />
            </a>
            <a className="inline-flex items-center gap-1 text-signal" href={status?.provider.cyberModelsUrl ?? 'https://www.orcarouter.ai/models?tier=cyber'} target="_blank" rel="noreferrer">
              Cyber model catalog <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <span className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-ink-muted">
          {status?.provider.apiBase ?? 'https://api.orcarouter.ai/v1'}
        </span>
      </div>

      {statusError && (
        <p className="mt-4 rounded-lg border border-high/40 bg-high/10 px-3 py-2 text-xs text-high">
          {statusError}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div data-testid="auth-api-key" className="rounded-lg border border-hairline p-4">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <KeyRound size={14} /> API key
          </h4>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Paste an existing <code>sk-orca-…</code> key. Stored with the workspace&apos;s
            existing private provider secrets.
          </p>
          <label className="mt-3 block text-xs font-medium" htmlFor="orca-api-key">
            OrcaRouter API key
          </label>
          <input
            id="orca-api-key"
            data-testid="orca-api-key-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm"
            placeholder="sk-orca-…"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void onSaveKey()} disabled={savingKey || !apiKey.trim()}>
              {savingKey ? 'Saving…' : 'Save key'}
            </Button>
            <Button variant="ghost" onClick={() => void onClearKey()} disabled={!maskedKey}>
              Clear
            </Button>
          </div>
          <p data-testid="orca-key-status" className="mt-3 text-xs text-ink-muted">
            {maskedKey ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <CheckCircle2 size={13} /> Configured — <span data-testid="orca-masked-key">{maskedKey}</span>
              </span>
            ) : (
              'No key configured.'
            )}
          </p>
          {keyMessage && <p className="mt-2 text-xs text-ink-muted">{keyMessage}</p>}
        </div>

        <div data-testid="auth-pkce" className="rounded-lg border border-hairline p-4">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <LogIn size={14} /> Connect with OrcaRouter
          </h4>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            OAuth 2.0 + PKCE (S256). No client secret and no redirect URI to register.
            The browser returns the code to a loopback listener on this machine.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              data-testid="orca-connect-button"
              onClick={() => void onStartLogin('loopback')}
              disabled={oauthBusy}
            >
              {oauthBusy ? 'Waiting for approval…' : 'Connect with OrcaRouter'}
            </Button>
            <Button variant="ghost" onClick={() => void onStartLogin('oob')} disabled={oauthBusy}>
              Show me a code
            </Button>
            {attempt && attempt.status === 'pending' && (
              <Button variant="ghost" onClick={() => void onCancelLogin()}>
                Cancel
              </Button>
            )}
          </div>
          {attempt && attempt.status === 'pending' && (
            <p className="mt-3 break-all text-xs text-ink-muted">
              If no window opened, <a className="text-signal underline" href={attempt.authorizeUrl} target="_blank" rel="noreferrer">open the authorization page</a>.
            </p>
          )}
          {attempt && oauthMode === 'oob' && attempt.status === 'pending' && (
            <div className="mt-3">
              <label className="block text-xs font-medium" htmlFor="orca-oob-code">Code shown by OrcaRouter</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="orca-oob-code"
                  data-testid="orca-oob-code"
                  className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm"
                  value={pastedCode}
                  onChange={(event) => setPastedCode(event.target.value)}
                />
                <Button variant="secondary" onClick={() => void onSubmitCode()} disabled={!pastedCode.trim()}>
                  Connect
                </Button>
              </div>
            </div>
          )}
          {oauthHint && <p className="mt-3 text-xs text-ink-muted">{oauthHint}</p>}
          {oauthError && <p className="mt-3 text-xs text-high">{oauthError}</p>}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <label id="orca-model-label" className="text-xs font-semibold uppercase tracking-wide text-ink-muted" htmlFor="orca-model-trigger">
              Reasoning model
            </label>
            <p className="mt-1 text-xs text-ink-muted">
              Populated from <code>{catalogSource || 'https://api.orcarouter.ai/v1/models?capability=chat'}</code>.
            </p>
          </div>
          <Button variant="ghost" data-testid="orca-refresh-catalog" onClick={() => void onRefreshCatalog()} disabled={loadingModels}>
            <RefreshCw size={13} className={loadingModels ? 'animate-spin' : undefined} />
            Refresh catalog
          </Button>
        </div>

        <div className="relative mt-2">
          <button
            id="orca-model-trigger"
            data-testid="orca-model-trigger"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={modelOpen}
            aria-labelledby="orca-model-label"
            className="flex w-full items-center justify-between rounded-md border border-hairline bg-canvas px-3 py-2 text-left text-sm"
            onClick={() => setModelOpen((open) => !open)}
          >
            <span className="truncate">
              {selected?.id ?? (loadingModels ? 'Loading models…' : 'No compatible model')}
            </span>
            <ChevronDown size={15} className="text-ink-muted" />
          </button>
          {modelOpen && (
            <ul
              data-testid="orca-model-listbox"
              role="listbox"
              aria-labelledby="orca-model-label"
              className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-hairline-strong bg-surface p-1 shadow-panel"
            >
              {models.length === 0 && (
                <li className="px-3 py-2 text-xs text-ink-muted">No compatible chat models.</li>
              )}
              {models.map((model) => (
                <li key={model.id} role="option" aria-selected={model.id === selectedModel}>
                  <button
                    type="button"
                    data-testid="orca-model-option"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-raised"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setModelNotice(null);
                      setModelOpen(false);
                    }}
                  >
                    <span className="truncate">{model.id}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-muted">
                      {cyberRecommended.has(model.id) && (
                        <span className="rounded-full border border-signal/40 px-1.5 py-0.5 text-signal">cyber</span>
                      )}
                      {model.reasoningEfforts?.length ? 'reasoning' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span>
            Default <code>orcarouter/auto</code> · general fallback <code>orcarouter/fusion</code>
          </span>
          {catalogDegraded && (
            <span data-testid="orca-catalog-degraded" className="rounded-full border border-medium/40 px-2 py-0.5 text-medium">
              Fallback catalog
            </span>
          )}
          {catalogSource && (
            <span data-testid="orca-catalog-source" className="truncate">
              Source: {catalogSource}
            </span>
          )}
        </div>
        {catalogNote && <p className="mt-2 text-xs text-medium">{catalogNote}</p>}
        {modelNotice && <p className="mt-2 text-xs text-medium">{modelNotice}</p>}
      </div>
    </div>
  );
}
