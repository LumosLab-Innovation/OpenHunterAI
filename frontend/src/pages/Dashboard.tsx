import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Radar } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { ErrorState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';

interface ProjectSummary { id: string; name: string }
interface ScanSummary {
  id: string;
  state: string;
  createdAt?: string;
  target?: string;
}
interface ReportSummary { id: string; state: string; headline?: string; generatedAt?: string }
interface RouteHop { cli?: string; provider?: string; model: string; reasoningLevel?: string; accepted: boolean; reason?: string }
interface RoutePreview { useCase: string; primary: RouteHop; fallback: RouteHop; coverageGap?: string }
interface RouteSettings { preview: RoutePreview[]; probedAt: string | null; completion: string; configError: string | null }

export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostInput, setHostInput] = useState('');
  const [scopeMode, setScopeMode] = useState<'path' | 'host'>('path');
  const [profile, setProfile] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [deepRiskAccepted, setDeepRiskAccepted] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState<string[]>([]);
  const [gapsAcknowledged, setGapsAcknowledged] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [routeSettings, setRouteSettings] = useState<RouteSettings | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeUseCase, setRouteUseCase] = useState('signal_summary');
  const [routeSlot, setRouteSlot] = useState<'primary' | 'fallback'>('primary');
  const [routeCli, setRouteCli] = useState('gemini');
  const [routeModel, setRouteModel] = useState('cli-default');
  const [routeLevel, setRouteLevel] = useState('low');
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch<{ projects: ProjectSummary[] }>('/v1/projects'),
      apiFetch<{ scans: ScanSummary[] }>('/v1/scans?sort=newest'),
      apiFetch<{ reports: ReportSummary[] }>('/v1/reports'),
    ]).then(([projectResult, scanResult, reportResult]) => {
      if (!active) return;
      if (!projectResult.ok || !scanResult.ok || !reportResult.ok) {
        setError('Local data could not be loaded. Refresh to try again.');
      } else {
        setProjects(projectResult.data.projects);
        setScans(scanResult.data.scans);
        setReports(reportResult.data.reports);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void apiFetch<RouteSettings>('/v1/llm-routes').then((result) => {
      if (!active) return;
      if (!result.ok) setRouteError(result.error.message ?? 'Reasoning routes could not be loaded.');
      else setRouteSettings(result.data);
    });
    return () => { active = false; };
  }, []);

  const activeScans = scans.filter((scan) => ['queued', 'running', 'awaiting_approval'].includes(scan.state)).length;
  const latestReport = reports.find((report) => report.state === 'final');
  let previewTarget: { host: string; path: string } | null = null;
  try { previewTarget = normalizeTargetInput(hostInput); } catch { /* Show validation on submit. */ }
  const hasPath = previewTarget !== null && previewTarget.path !== '/';
  const allowedPaths = hasPath && previewTarget && scopeMode === 'path' ? [previewTarget.path] : [];
  const authorityLabel = previewTarget
    ? allowedPaths.length > 0
      ? `I confirm I am authorized to test ${previewTarget.host}${allowedPaths[0]} and its descendants.`
      : `I confirm I am authorized to test the entire ${previewTarget.host} host.`
    : 'I confirm I am authorized to test this exact host.';

  async function startScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (starting) return;
    setStartError(null);
    if (!authorityConfirmed) {
      setStartError('Confirm you are authorized to test this host.');
      return;
    }
    let target: { host: string; path: string };
    try { target = normalizeTargetInput(hostInput); }
    catch (cause) {
      setStartError(cause instanceof Error ? cause.message : 'Enter a public HTTPS host.');
      return;
    }
    const scanPaths = target.path !== '/' && scopeMode === 'path' ? [target.path] : [];
    setStarting(true);
    try {
      const body = {
        schemaVersion: 'scan_request_v2',
        targetUrl: `https://${target.host}${target.path}`,
        profile,
        authorityConfirmed: true,
        scope: { allowedPaths: scanPaths, excludedPaths: [] },
        aggressiveStagingRiskAccepted: profile === 'deep' && deepRiskAccepted,
      };
      const preflight = await apiFetch<{ preflight: { ok: boolean; failures?: Array<{ code: string }>; coverageGaps?: string[] } }>('/v1/scans/preflight', {
        method: 'POST', body: JSON.stringify(body),
      });
      if (!preflight.ok) throw new Error(preflight.error.message ?? 'Preflight could not run.');
      if (!preflight.data.preflight.ok) throw new Error(`Preflight blocked: ${(preflight.data.preflight.failures ?? []).map((failure) => failure.code).join(', ')}`);
      const gaps = preflight.data.preflight.coverageGaps ?? [];
      if (gaps.some((gap) => !gapsAcknowledged || !coverageGaps.includes(gap))) {
        setCoverageGaps(gaps);
        setGapsAcknowledged(false);
        return;
      }
      const started = await apiFetch<{ scan: { id: string } }>('/v1/scans', {
        method: 'POST', body: JSON.stringify({ ...body, acceptedCoverageGaps: gapsAcknowledged ? coverageGaps : [] }),
      });
      if (!started.ok) throw new Error(started.error.message ?? 'Scan could not start.');
      navigate(`/scans/${started.data.scan.id}`);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : 'Scan could not start.');
    } finally { setStarting(false); }
  }

  return (
    <div className="space-y-8">
      <header className="relative min-h-48 overflow-hidden border-b border-hairline pb-6 sm:min-h-56">
        <div className="relative z-10 max-w-xl pr-28 sm:pr-48">
          <p className="text-data text-xs uppercase tracking-widest text-signal">Local dashboard</p>
          <h1 className="mt-3 font-display text-3xl font-900 tracking-tight text-ink sm:text-4xl">
            OpenHunterAI
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Enter an authorized URL, choose scan depth, and review the evidence-backed report.
          </p>
          <a href="#quick-scan" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-signal hover:underline">
            Start a scan <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <img
          src="/hunter-character.png"
          alt="OpenHunterAI hooded hunter character"
          className="pointer-events-none absolute -bottom-4 right-0 h-48 w-48 object-contain object-bottom opacity-85 sm:h-64 sm:w-64"
          width="240"
          height="182"
        />
      </header>

      <section aria-labelledby="reasoning-routes-title" className="border-b border-hairline pb-8">
        <h2 id="reasoning-routes-title" className="font-display text-lg font-700 text-ink">Reasoning routes</h2>
        <p className="mt-1 text-sm text-ink-muted">System-wide CLI, model, and reasoning level. A scan keeps the copy taken when it starts. Login is not completion; only a bridge-locked CLI route can run.</p>
        {routeError && <p className="mt-3 text-sm text-ink-muted">{routeError}</p>}
        {routeSettings && (
          <>
            <ul className="mt-4 divide-y divide-hairline border-y border-hairline text-xs">
              {routeSettings.preview.map((row) => (
                <li key={row.useCase} className="grid gap-1 py-2 sm:grid-cols-2">
                  <span className="font-medium text-ink">{row.useCase}</span>
                  <span className="text-ink-muted">
                    primary {row.primary.cli ?? row.primary.provider}/{row.primary.model}/{row.primary.reasoningLevel ?? 'api'} {row.primary.accepted ? 'accepted' : row.primary.reason ?? 'not accepted'}
                    {'; '}
                    fallback {row.fallback.cli ?? row.fallback.provider}/{row.fallback.model}/{row.fallback.reasoningLevel ?? 'api'} {row.fallback.accepted ? 'accepted' : row.fallback.reason ?? 'not accepted'}
                  </span>
                </li>
              ))}
            </ul>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              setRouteBusy(true);
              setRouteError(null);
              const route = routeCli === 'openai' || routeCli === 'deepseek'
                ? { transport: 'api_key', provider: routeCli, model: routeModel }
                : { transport: 'coding_cli', cli: routeCli, model: routeModel, reasoningLevel: routeLevel };
              void apiFetch<RouteSettings>('/v1/llm-routes', {
                method: 'PUT',
                body: JSON.stringify({ update: { useCase: routeUseCase, slot: routeSlot, route } }),
              }).then((result) => {
                if (!result.ok) setRouteError(result.error.message ?? 'Route was not saved.');
                else setRouteSettings(result.data);
              }).finally(() => setRouteBusy(false));
            }}>
              <Select aria-label="Reasoning module" value={routeUseCase} onChange={(event) => setRouteUseCase(event.target.value)}>
                {(routeSettings.preview).map((row) => <option key={row.useCase} value={row.useCase}>{row.useCase}</option>)}
              </Select>
              <Select aria-label="Route slot" value={routeSlot} onChange={(event) => setRouteSlot(event.target.value as 'primary' | 'fallback')}>
                <option value="primary">primary</option>
                <option value="fallback">fallback</option>
              </Select>
              <Select aria-label="Coding CLI or API provider" value={routeCli} onChange={(event) => setRouteCli(event.target.value)}>
                {['codex', 'claude', 'gemini', 'grok', 'openai', 'deepseek'].map((cli) => <option key={cli} value={cli}>{cli}</option>)}
              </Select>
              <Select aria-label="Reasoning level" value={routeLevel} onChange={(event) => setRouteLevel(event.target.value)}>
                {['low', 'medium', 'high', 'xhigh'].map((level) => <option key={level} value={level}>{level}</option>)}
              </Select>
              <Input aria-label="Model" value={routeModel} onChange={(event) => setRouteModel(event.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={routeBusy}>Save route</Button>
                <Button type="button" variant="ghost" disabled={routeBusy} onClick={() => {
                  setRouteBusy(true);
                  setRouteError(null);
                  void apiFetch<RouteSettings>('/v1/llm-routes/probe', { method: 'POST', body: '{}' }).then((result) => {
                    if (!result.ok) setRouteError(result.error.message ?? 'CLI probe did not finish.');
                    else setRouteSettings(result.data);
                  }).finally(() => setRouteBusy(false));
                }}>Probe CLIs</Button>
              </div>
            </form>
            <p className="mt-2 text-xs text-ink-faint">
              {routeSettings.probedAt ? `Last probe ${routeSettings.probedAt}. ` : 'No probe stored. '}
              {routeSettings.completion}. Unprobed routes stay not accepted. This is not a finding or scan gate.
            </p>
          </>
        )}
      </section>

      <section id="quick-scan" aria-labelledby="quick-scan-title" className="scroll-mt-20 border-b border-hairline pb-8">
        <h2 id="quick-scan-title" className="font-display text-lg font-700 text-ink">Start a scan</h2>
        <p className="mt-1 text-sm text-ink-muted">One public HTTPS URL. No DNS challenge or canary required.</p>
        <form className="mt-4 grid gap-3" onSubmit={(event) => { void startScan(event); }}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="quick-scan-host">Public HTTPS URL or host</label>
            <Input id="quick-scan-host" type="text" value={hostInput} onChange={(event) => {
              setHostInput(event.target.value);
              setScopeMode('path');
              setAuthorityConfirmed(false);
              setCoverageGaps([]);
              setGapsAcknowledged(false);
              setStartError(null);
            }} placeholder="https://example.com/app" autoComplete="url" required className="min-w-0 flex-1" />
            <Select aria-label="Scan profile" value={profile} onChange={(event) => {
              setProfile(event.target.value as 'quick' | 'standard' | 'deep');
              setAuthorityConfirmed(false);
              setCoverageGaps([]);
              setGapsAcknowledged(false);
            }} className="sm:w-36">
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </Select>
            <Button type="submit" disabled={starting || !authorityConfirmed} className="shrink-0">
              {starting ? 'Starting…' : 'Run scan'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {hasPath && previewTarget && (
            <fieldset className="grid gap-2 rounded border border-hairline p-3 text-xs text-ink-muted">
              <legend className="px-1 font-semibold text-ink">Scan scope</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="quick-scan-scope" value="path" checked={scopeMode === 'path'}
                  onChange={() => { setScopeMode('path'); setAuthorityConfirmed(false); setCoverageGaps([]); setGapsAcknowledged(false); }} className="mt-0.5 accent-lime-400" />
                <span>Only <span className="font-mono">{previewTarget.host}{previewTarget.path}</span> and its descendants</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="quick-scan-scope" value="host" checked={scopeMode === 'host'}
                  onChange={() => { setScopeMode('host'); setAuthorityConfirmed(false); setCoverageGaps([]); setGapsAcknowledged(false); }} className="mt-0.5 accent-lime-400" />
                <span>Entire <span className="font-mono">{previewTarget.host}</span> host (broader scope)</span>
              </label>
            </fieldset>
          )}
          <label className="flex items-start gap-2 text-xs leading-5 text-ink-muted">
            <input type="checkbox" checked={authorityConfirmed} onChange={(event) => setAuthorityConfirmed(event.target.checked)}
              className="mt-1 accent-lime-400" />
            {authorityLabel}
          </label>
          {profile === 'deep' && (
            <label className="flex items-start gap-2 text-xs leading-5 text-ink-muted">
              <input type="checkbox" checked={deepRiskAccepted} onChange={(event) => setDeepRiskAccepted(event.target.checked)} className="mt-1 accent-lime-400" />
              This is staging/dev/test I control; I accept active-testing risk.
            </label>
          )}
          {coverageGaps.length > 0 && (
            <div role="alert" className="rounded border border-amber-500/40 p-3 text-xs text-ink-muted">
              <p>Some planned workers cannot run: {coverageGaps.join(', ')}. The report will show these coverage gaps.</p>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={gapsAcknowledged} onChange={(event) => setGapsAcknowledged(event.target.checked)} className="accent-lime-400" />
                Continue with the same {profile} profile
              </label>
            </div>
          )}
          {startError && <ErrorState message={startError} />}
        </form>
      </section>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
      {loading ? <SkeletonRows rows={3} /> : !error && (
        <>
          <div className="grid grid-cols-3 gap-3 border-b border-hairline pb-6 text-sm">
            <Metric label="Projects" value={projects.length} />
            <Metric label="Active scans" value={activeScans} />
            <Metric label="Reports" value={reports.length} />
          </div>

          <section aria-labelledby="recent-scans-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-scans-title" className="font-display text-lg font-700 text-ink">Recent scans</h2>
              <Link to="/scans" className="text-sm text-signal hover:underline">View all</Link>
            </div>
            {scans.length === 0 ? (
              <div className="mt-4 flex items-start gap-3 border-t border-hairline py-5 text-sm text-ink-muted">
                <Radar className="h-5 w-5 shrink-0 text-signal" />
                <p>No scans yet. Create a project, confirm the host you may test, and run safe discovery.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-hairline border-t border-hairline">
                {scans.slice(0, 5).map((scan) => (
                  <Link key={scan.id} to={`/scans/${scan.id}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-signal">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{scan.target ?? 'Authorized target'}</span>
                      <span className="text-data text-xs text-ink-faint">{scan.id.slice(0, 8)}</span>
                    </span>
                    <StatusBadge state={scan.state} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="latest-report-title" className="border-t border-hairline pt-6">
            <h2 id="latest-report-title" className="font-display text-lg font-700 text-ink">Latest report</h2>
            {latestReport ? (
              <Link to={`/reports/${latestReport.id}`} className="mt-4 flex items-center justify-between gap-3 rounded py-2 text-sm hover:text-signal">
                <span className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-signal" /><span className="truncate">{latestReport.headline ?? `Report ${latestReport.id.slice(0, 8)}`}</span></span>
                <Badge tone="neutral">Final</Badge>
              </Link>
            ) : <p className="mt-3 text-sm text-ink-muted">A report appears when a scan completes. No finding is claimed without validation.</p>}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-data text-2xl font-semibold text-ink">{value}</p><p className="mt-1 text-xs text-ink-muted">{label}</p></div>;
}

function normalizeTargetInput(input: string): { host: string; path: string } {
  const raw = input.trim();
  if (!raw || /:[0-9]+(?:[/?#]|$)/.test(raw)) throw new Error('Enter one public HTTPS URL without a port.');
  let url: URL;
  try { url = new URL(raw.includes('://') ? raw : `https://${raw}`); }
  catch { throw new Error('Enter a valid public HTTPS URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.search || url.hash || !/^[a-z0-9.-]+$/.test(host) || !host.includes('.') ||
      host.includes('..') || ['.local', '.localhost', '.internal', '.intranet', '.lan', '.home.arpa'].some((suffix) => host.endsWith(suffix)) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error('Enter one public HTTPS URL without a port, query, fragment, or credentials.');
  }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return { host, path };
}
