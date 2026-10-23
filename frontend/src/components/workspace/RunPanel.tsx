import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { ErrorState } from '../ui/States';

interface Observation { id: string; title: string; severity: string; affectedAsset?: string; validationState?: string }
interface Snapshot {
  scan: { id: string; state: string; target: string; profile: string; errorMessage?: string };
  workers: Array<{ code: string; title: string; state: string; summary?: string; errorCode?: string }>;
  activity: Array<{ id: string; at: string; title: string; body: string; sanitized: boolean }>;
  findingsPreview: Observation[];
  findingsSummary?: { validatedFindings: Observation[]; candidates: Observation[]; hardeningCoverage: Observation[] };
  reportPreview: { latestReportId?: string; latestReportState?: string };
  llmRoutes?: { capturedAt: string; routes: Array<{ useCase: string; slot: string; cli?: string; provider?: string; model: string; reasoningLevel?: string; accepted: boolean }> };
}
interface Approval { id: string; scanJobId: string; action: string; target: string; testAccount?: string; willNotPerform: unknown; residualRisk: string; expiresAt: string }

export function RunPanel({ id, onFinding, onReport, onChanged }: { id: string; onFinding: (id: string) => void; onReport: (id: string) => void; onChanged: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(null); setError(null); setConnected(false);
    const source = new EventSource(`${API_BASE}/v1/scans/${encodeURIComponent(id)}/live-events?view=curated&limit=100`, { withCredentials: true });
    const apply = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as Snapshot;
        if (data.scan?.id !== id) throw new Error('Invalid scan snapshot.');
        setSnapshot(data); setError(null);
      } catch { setError('Live scan data could not be read. Reconnect to retry.'); }
    };
    source.onopen = () => setConnected(true);
    source.onerror = () => { setConnected(false); setError('Live connection lost; reconnecting.'); };
    source.addEventListener('scan_snapshot', apply);
    source.addEventListener('scan_activity', apply);
    source.addEventListener('stream_degraded', () => setError('Event bus degraded; server polling fallback is active.'));
    return () => source.close();
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadApprovals() {
      const result = await apiFetch<{ approvals: Approval[] }>('/v1/approvals?state=pending');
      if (!active) return;
      if (result.ok) { setApprovals(result.data.approvals.filter((approval) => approval.scanJobId === id)); setApprovalError(null); }
      else setApprovalError(result.error.message ?? 'Approvals could not be loaded.');
    }
    void loadApprovals();
    const timer = window.setInterval(() => void loadApprovals(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id, snapshot?.scan.state]);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    const result = await apiFetch(`/v1/scans/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    setBusy(false);
    if (!result.ok) setError(result.error.message ?? 'Scan could not be stopped.');
    else onChanged();
  }

  async function decide(approval: Approval, decision: 'approved' | 'denied') {
    if (busy) return;
    setBusy(true); setApprovalError(null);
    const result = await apiFetch(`/v1/approvals/${encodeURIComponent(approval.id)}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
    setBusy(false);
    if (!result.ok) setApprovalError(result.error.message ?? 'Decision could not be saved.');
    else setApprovals((current) => current.filter((item) => item.id !== approval.id));
  }

  const findings = snapshot?.findingsSummary?.validatedFindings ?? [];
  const candidates = snapshot?.findingsSummary?.candidates ?? snapshot?.findingsPreview ?? [];
  return <section aria-labelledby="run-heading" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 id="run-heading" tabIndex={-1} className="font-display text-lg font-semibold">Selected scan</h2><p className="break-all text-xs text-ink-muted">{snapshot?.scan.target ?? id}</p></div>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-muted">{connected ? 'Live' : 'Reconnecting'}</span><StatusBadge state={snapshot?.scan.state} />
        {snapshot && ['queued', 'running', 'awaiting_approval'].includes(snapshot.scan.state) && <Button variant="secondary" size="sm" disabled={busy} onClick={() => void cancel()}>Stop scan</Button>}
        {snapshot?.reportPreview.latestReportId && <Button variant="secondary" size="sm" onClick={() => onReport(snapshot.reportPreview.latestReportId!)}>Open report</Button>}
      </div>
    </div>
    {error && <ErrorState message={error} />}
    {snapshot?.scan.errorMessage && <ErrorState message={snapshot.scan.errorMessage} />}
    {!snapshot ? <p role="status" className="text-sm text-ink-muted">Waiting for scan activity…</p> : <>
      <ul aria-label="Workers" className="divide-y divide-hairline border-y border-hairline">
        {snapshot.workers.map((worker) => <li key={worker.code} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"><div className="min-w-0 flex-1"><span className="font-medium">{worker.title}</span><p className="break-words text-xs text-ink-muted">{worker.errorCode ?? worker.summary}</p></div><StatusBadge state={worker.state} /></li>)}
      </ul>
      <ObservationList title="Validated findings" items={findings} onSelect={onFinding} />
      <ObservationList title="Candidates awaiting independent evidence" items={candidates} />
      {(snapshot.findingsSummary?.hardeningCoverage.length ?? 0) > 0 && <details><summary className="cursor-pointer text-sm text-ink-muted">Hardening observations ({snapshot.findingsSummary?.hardeningCoverage.length})</summary><ObservationList title="Hardening observations" items={snapshot.findingsSummary!.hardeningCoverage} /></details>}
    </>}
    <section aria-label="Sensitive action approvals" className="space-y-3">
      <h3 className="text-sm font-semibold">Action approvals</h3>
      {approvalError && <ErrorState message={approvalError} />}
      {!approvals.length && !approvalError && <p className="text-xs text-ink-muted">No pending actions for this scan.</p>}
      {approvals.map((approval) => <article key={approval.id} className="space-y-2 border-l-2 border-medium pl-4 text-sm">
        <h4 className="font-medium">{approval.action}</h4><p className="break-all">{approval.target}</p>
        {approval.testAccount && <p>Account: {approval.testAccount}</p>}
        {Array.isArray(approval.willNotPerform) && <p className="text-xs text-ink-muted">Excluded actions: {approval.willNotPerform.filter((item): item is string => typeof item === 'string').join(', ')}</p>}
        <p className="text-xs text-ink-muted">Residual risk: {approval.residualRisk}</p>
        <p className="text-xs text-ink-muted">Expires {new Date(approval.expiresAt).toLocaleString()}</p>
        <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={busy || Date.parse(approval.expiresAt) <= Date.now()} onClick={() => void decide(approval, 'approved')}>Approve action</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void decide(approval, 'denied')}>Deny action</Button></div>
      </article>)}
    </section>
    {snapshot && <details><summary className="cursor-pointer text-sm text-ink-muted">Activity log ({snapshot.activity.length})</summary><ol className="mt-3 max-h-96 space-y-3 overflow-auto">
      {snapshot.activity.filter((event) => event.sanitized === true).slice(-50).map((event) => <li key={event.id} className="text-sm"><p className="font-medium">{event.title}</p><p className="break-words text-xs text-ink-muted">{event.body}</p><time className="text-xs text-ink-faint">{new Date(event.at).toLocaleTimeString()}</time></li>)}
    </ol></details>}
    {snapshot?.llmRoutes && <details><summary className="cursor-pointer text-sm text-ink-muted">Reasoning routes captured for this scan</summary><ul className="mt-3 space-y-1 text-xs text-ink-muted">{snapshot.llmRoutes.routes.map((route) => <li key={`${route.useCase}-${route.slot}`} className="break-all">{route.useCase} · {route.slot} · {route.cli ?? route.provider}/{route.model}/{route.reasoningLevel ?? 'api'} · {route.accepted ? 'accepted' : 'unavailable'}</li>)}</ul></details>}
  </section>;
}

function ObservationList({ title, items, onSelect }: { title: string; items: Observation[]; onSelect?: (id: string) => void }) {
  return <section className="space-y-2"><h3 className="text-sm font-semibold">{title} ({items.length})</h3>{!items.length && <p className="text-xs text-ink-muted">None recorded. Review executed coverage and limitations.</p>}<ul className="divide-y divide-hairline">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0 flex-1">{onSelect ? <button onClick={() => onSelect(item.id)} className="text-left text-signal hover:underline">{item.title}</button> : <span>{item.title}</span>}<p className="break-all text-xs text-ink-muted">{item.affectedAsset} {item.validationState && `· ${item.validationState}`}</p></div><SeverityBadge severity={item.severity} /></li>)}</ul></section>;
}
