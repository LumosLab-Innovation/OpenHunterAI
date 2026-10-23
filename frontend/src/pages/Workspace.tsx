import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { AUTH_SCOPE_OPTIONS, SCAN_PROFILE_OPTIONS, SURFACE_FLAGS, TARGET_TYPE_OPTIONS } from '../lib/product';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Field';
import { ErrorState } from '../components/ui/States';
import { AccessPanel } from '../components/workspace/AccessPanel';
import { ReasoningSettings } from '../components/workspace/ReasoningSettings';
import { RunPanel } from '../components/workspace/RunPanel';
import { FindingPanel } from '../components/workspace/FindingPanel';
import { ReportPanel } from '../components/workspace/ReportPanel';

interface Project { id: string; name: string }
interface Scan { id: string; projectId: string; target?: string; state: string; createdAt: string }
interface Report { id: string; scanJobId?: string; headline?: string; state: string }
interface Preflight {
  ok: boolean;
  failures?: Array<{ code: string; message: string }>;
  coverageGaps?: string[];
  runtimes?: Array<{ worker: string; installed: boolean; configured: boolean; reachable: boolean; executable: boolean; reason?: string }>;
  resolvedScope?: { targetUrl?: string; allowedHosts: string[]; allowedPaths: string[]; excludedPaths: string[] };
}

export function WorkspacePage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('project') ?? '';
  const scanId = params.get('scan') ?? '';
  const reportId = params.get('report') ?? '';
  const findingId = params.get('finding') ?? '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [host, setHost] = useState('');
  const [profile, setProfile] = useState('standard');
  const [scopeMode, setScopeMode] = useState('path');
  const [excludedPaths, setExcludedPaths] = useState('');
  const [targetType, setTargetType] = useState('interactive_web_app');
  const [authScope, setAuthScope] = useState('none');
  const [surfaces, setSurfaces] = useState<Record<string, boolean>>({});
  const [authority, setAuthority] = useState(false);
  const [deepRisk, setDeepRisk] = useState(false);
  const [gapsAccepted, setGapsAccepted] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const currentProject = useRef(projectId);
  currentProject.current = projectId;

  function select(values: Record<string, string | null>) {
    if ('project' in values && values.project !== projectId) invalidate();
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key);
      return next;
    });
  }
  function invalidate() { requestVersion.current += 1; setBusy(false); setAuthority(false); setDeepRisk(false); setGapsAccepted(false); setPreflight(null); setStartError(null); }
  async function loadHistory() {
    const [projectResult, scanResult, reportResult] = await Promise.all([
      apiFetch<{ projects: Project[] }>('/v1/projects'),
      apiFetch<{ scans: Scan[] }>('/v1/scans?sort=newest'),
      apiFetch<{ reports: Report[] }>('/v1/reports'),
    ]);
    if (projectResult.ok) setProjects(projectResult.data.projects);
    if (scanResult.ok) setScans(scanResult.data.scans);
    if (reportResult.ok) setReports(reportResult.data.reports);
    setLoadError(!projectResult.ok || !scanResult.ok || !reportResult.ok ? 'Some scan history could not be loaded. Retry when the local API is ready.' : null);
  }
  useEffect(() => { void loadHistory(); return () => { requestVersion.current += 1; }; }, []);
  useEffect(() => { invalidate(); }, [projectId]);
  useEffect(() => {
    const heading = document.getElementById(findingId ? 'finding-heading' : reportId ? 'report-heading' : scanId ? 'run-heading' : 'target-heading');
    if (scanId || reportId || findingId) { heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' }); }
  }, [scanId, reportId, findingId]);

  let target: { host: string; path: string } | null = null;
  try { target = normalizeTargetInput(host); } catch { /* Validation appears on submit. */ }
  const scopeText = target ? `${target.host}${scopeMode === 'path' && target.path !== '/' ? `${target.path} and its descendants` : ' (entire exact host)'}` : 'this exact public host and declared paths';

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !authority) return;
    setStartError(null);
    let resolved: { host: string; path: string };
    try { resolved = normalizeTargetInput(host); }
    catch (failure) { setStartError(failure instanceof Error ? failure.message : 'Enter a public HTTPS URL.'); return; }
    if (profile === 'deep' && !deepRisk) { setStartError('Confirm staging ownership and active-testing risk for Deep.'); return; }
    if (authScope !== 'none' && !projectId) { setStartError('Choose a project with the required saved test accounts.'); return; }
    const body = {
      schemaVersion: 'scan_request_v2', targetUrl: `https://${resolved.host}${resolved.path}`, profile,
      authorityConfirmed: true, ...(projectId ? { projectId } : {}), targetType, authScope,
      ...(Object.keys(surfaces).length ? { surfaceFlags: surfaces } : {}),
      scope: { allowedPaths: scopeMode === 'path' && resolved.path !== '/' ? [resolved.path] : [], excludedPaths: excludedPaths.split(',').map((path) => path.trim()).filter(Boolean) },
      aggressiveStagingRiskAccepted: profile === 'deep' && deepRisk,
    };
    const version = requestVersion.current;
    const isCurrent = () => version === requestVersion.current && currentProject.current === projectId;
    setBusy(true);
    try {
      const result = await apiFetch<{ preflight: Preflight }>('/v1/scans/preflight', { method: 'POST', body: JSON.stringify(body) });
      if (!isCurrent()) return;
      if (!result.ok) throw new Error(result.error.message ?? 'Preflight failed.');
      const checked = result.data.preflight;
      const gaps = checked.coverageGaps ?? [];
      const changed = JSON.stringify(gaps) !== JSON.stringify(preflight?.coverageGaps ?? []);
      setPreflight(checked);
      if (!checked.ok) throw new Error((checked.failures ?? []).map((failure) => `${failure.code}: ${failure.message}`).join('; ') || 'Preflight blocked this scan.');
      if (!preflight || changed) { setGapsAccepted(false); return; }
      if (gaps.length && !gapsAccepted) { setStartError('Acknowledge the coverage gaps before running.'); return; }
      const created = await apiFetch<{ scan: { id: string } }>('/v1/scans', { method: 'POST', body: JSON.stringify({ ...body, acceptedCoverageGaps: gapsAccepted ? gaps : [] }) });
      if (!isCurrent()) return;
      if (!created.ok) throw new Error(created.error.message ?? 'Scan could not start.');
      select({ scan: created.data.scan.id, report: null, finding: null });
      invalidate(); void loadHistory();
    } catch (failure) { if (isCurrent()) setStartError(failure instanceof Error ? failure.message : 'Scan could not start.'); }
    finally { if (isCurrent()) setBusy(false); }
  }

  return <div className="space-y-8">
    <section aria-labelledby="target-heading" className="space-y-5">
      <div><h1 id="target-heading" className="font-display text-2xl font-semibold tracking-tight">Pentest workspace</h1><p className="mt-2 text-sm text-ink-muted">Test an authorized public URL. Review evidence and export a report for OpenShieldAI.</p></div>
      <form onSubmit={(event) => void start(event)} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
            <Field label="Public HTTPS URL" htmlFor="scan-target"><Input id="scan-target" value={host} onChange={(event) => { setHost(event.target.value); setScopeMode('path'); invalidate(); }} placeholder="https://example.com/app" autoComplete="url" required /></Field>
            <Field label="Profile" htmlFor="scan-profile"><Select id="scan-profile" value={profile} onChange={(event) => { setProfile(event.target.value); invalidate(); }}>{SCAN_PROFILE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Button type="submit" disabled={!authority || (profile === 'deep' && !deepRisk)}>{busy ? 'Checking…' : preflight?.ok ? 'Run scan' : 'Check plan'}</Button>
          </div>
          {target && target.path !== '/' && <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted"><legend className="mb-2 font-medium text-ink">Authorized paths</legend><label className="flex gap-2"><input type="radio" name="scope" checked={scopeMode === 'path'} onChange={() => { setScopeMode('path'); invalidate(); }} />Only {target.path} and descendants</label><label className="flex gap-2"><input type="radio" name="scope" checked={scopeMode === 'host'} onChange={() => { setScopeMode('host'); invalidate(); }} />Entire exact host</label></fieldset>}
          <details open={!!projectId || undefined} className="border-y border-hairline py-3">
            <summary className="cursor-pointer text-sm text-ink-muted">Scope, authentication and surfaces</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Project (optional)" htmlFor="scan-project"><Select id="scan-project" value={projectId} onChange={(event) => { select({ project: event.target.value }); invalidate(); }}><option value="">Automatic target group</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
              <Field label="Target type" htmlFor="target-type"><Select id="target-type" value={targetType} onChange={(event) => { setTargetType(event.target.value); invalidate(); }}>{TARGET_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field label="Authentication" htmlFor="auth-scope"><Select id="auth-scope" value={authScope} onChange={(event) => { setAuthScope(event.target.value); invalidate(); }}>{AUTH_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field label="Excluded paths (comma separated)" htmlFor="excluded-paths"><Input id="excluded-paths" value={excludedPaths} onChange={(event) => { setExcludedPaths(event.target.value); invalidate(); }} placeholder="/billing, /logout" /></Field>
              <fieldset className="sm:col-span-2"><legend className="mb-2 text-xs font-medium text-ink-muted">Known surfaces</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{SURFACE_FLAGS.map(([key, label]) => <label key={key} className="flex gap-2 text-xs text-ink-muted"><input type="checkbox" checked={surfaces[key] ?? false} onChange={(event) => { setSurfaces({ ...surfaces, [key]: event.target.checked }); invalidate(); }} />{label}</label>)}</div></fieldset>
            </div>
          </details>
          <label className="flex items-start gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={authority} onChange={(event) => setAuthority(event.target.checked)} className="mt-1 accent-signal" />I confirm I am authorized to test {scopeText}.</label>
          {profile === 'deep' && <label className="flex items-start gap-2 text-xs leading-5 text-ink-muted"><input type="checkbox" checked={deepRisk} onChange={(event) => setDeepRisk(event.target.checked)} className="mt-1 accent-signal" />This is staging/dev/test I control. I accept that active testing may cause errors, load, test data or alerts.</label>}
          {preflight && <section aria-label="Scan plan preflight" className="space-y-3 border-l-2 border-signal pl-4">
            <p className="text-sm font-medium">{preflight.ok ? 'Plan ready for review' : 'Plan blocked'} · {profile}</p>
            <p className="break-all text-xs text-ink-muted">Hosts: {preflight.resolvedScope?.allowedHosts.join(', ') || target?.host} · Paths: {preflight.resolvedScope?.allowedPaths.join(', ') || (scopeMode === 'path' ? target?.path : 'Entire exact host')}</p>
            {!!preflight.runtimes?.length && <ul className="space-y-2 text-xs text-ink-muted">{preflight.runtimes.map((runtime) => <li key={runtime.worker} className="break-words"><span className="font-medium text-ink">{runtime.worker}</span> · installed {runtime.installed ? 'yes' : 'no'} · configured {runtime.configured ? 'yes' : 'no'} · reachable {runtime.reachable ? 'yes' : 'no'} · executable {runtime.executable ? 'yes' : 'no'}{runtime.reason && ` · ${runtime.reason}`}</li>)}</ul>}
            {!!preflight.coverageGaps?.length && <><ul className="list-disc pl-4 text-xs text-ink-muted">{preflight.coverageGaps.map((gap) => <li key={gap} className="break-all">{gap}</li>)}</ul><label className="flex gap-2 text-xs text-ink-muted"><input type="checkbox" checked={gapsAccepted} onChange={(event) => setGapsAccepted(event.target.checked)} />I accept these gaps; retain the selected {profile} profile.</label></>}
          </section>}
          {startError && <ErrorState message={startError} />}
        </fieldset>
      </form>
    </section>

    <details open={params.get('settings') === '1' || undefined} className="border-t border-hairline pt-4"><summary className="cursor-pointer text-sm font-medium">Access and model settings</summary><div className="mt-5 grid gap-8 lg:grid-cols-2"><section className="min-w-0"><h2 className="mb-4 text-sm font-semibold">Projects and test accounts</h2><AccessPanel key={projectId} projectId={projectId} onProjectCreated={(id) => { select({ project: id }); invalidate(); void loadHistory(); }} /></section><section className="min-w-0"><ReasoningSettings /></section></div></details>

    <section aria-labelledby="history-heading" className="space-y-3 border-t border-hairline pt-5">
      <div className="flex items-center justify-between"><h2 id="history-heading" className="text-sm font-semibold">Scan history and reports</h2><Button size="sm" variant="ghost" onClick={() => void loadHistory()}>Refresh history</Button></div>
      {loadError && <ErrorState message={loadError} onRetry={() => void loadHistory()} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Selected scan" htmlFor="selected-scan"><Select id="selected-scan" value={scanId} onChange={(event) => { const picked = scans.find((scan) => scan.id === event.target.value); select({ scan: event.target.value, report: null, finding: null, ...(picked?.projectId ? { project: picked.projectId } : {}) }); }}>{!scans.some((scan) => scan.id === scanId) && scanId && <option value={scanId}>{scanId}</option>}<option value="">Select a scan</option>{scans.map((scan) => <option key={scan.id} value={scan.id}>{scan.target ?? scan.id.slice(0, 12)} · {scan.state}</option>)}</Select></Field>
        <Field label="Selected report" htmlFor="selected-report"><Select id="selected-report" value={reportId} onChange={(event) => select({ report: event.target.value, finding: null })}>{!reports.some((report) => report.id === reportId) && reportId && <option value={reportId}>{reportId}</option>}<option value="">Select a report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.headline ?? report.id.slice(0, 12)}</option>)}</Select></Field>
      </div>
      {!scans.length && !reports.length && !loadError && <p className="text-sm text-ink-muted">No assessments yet. Check the plan for an authorized URL above.</p>}
    </section>
    {scanId && <RunPanel key={scanId} id={scanId} onFinding={(id) => select({ finding: id })} onReport={(id) => select({ report: id })} onChanged={() => void loadHistory()} />}
    {reportId && <ReportPanel key={reportId} id={reportId} onFinding={(id) => select({ finding: id })} onClose={() => select({ report: null })} />}
    {findingId && <FindingPanel key={findingId} id={findingId} onClose={() => select({ finding: null })} />}
  </div>;
}

function normalizeTargetInput(input: string): { host: string; path: string } {
  const raw = input.trim();
  if (!raw || /:[0-9]+(?:[/?#]|$)/.test(raw)) throw new Error('Enter one public HTTPS URL without a port.');
  let url: URL;
  try { url = new URL(raw.includes('://') ? raw : `https://${raw}`); }
  catch { throw new Error('Enter a valid public HTTPS URL.'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !/^[a-z0-9.-]+$/.test(hostname) || !hostname.includes('.') || hostname.includes('..') || ['.local', '.localhost', '.internal', '.intranet', '.lan', '.home.arpa'].some((suffix) => hostname.endsWith(suffix)) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) throw new Error('Enter one public HTTPS URL without a port, query, fragment or credentials.');
  return { host: hostname, path: url.pathname.replace(/\/+$/, '') || '/' };
}
