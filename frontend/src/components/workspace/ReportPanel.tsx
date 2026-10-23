import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { ErrorState } from '../ui/States';

interface ReportContent {
  formatVersion?: string;
  ownerSummary?: { headline?: string; whatWasTested?: string; topRiskOrOutcome?: string; businessImpact?: string; recommendedNextAction?: string };
  findings?: Array<{ id: string; title: string; severity: string; affectedAsset: string; impact: string; sanitizedProof?: { description?: string; evidenceRefs?: string[] }; fixSummary?: string }>;
  historicalFindings?: Array<{ id: string; title: string; validationStatus: string }>;
  developerFixPack?: Array<{ findingId: string; rootCauseHypothesis: string; concreteFixPrompt: string; validationSteps: string[]; regressionTestIdeas: string[]; acceptanceCriteria: string }>;
  coverage?: { workersRun?: string[]; huntersPlanned?: string[]; huntersRun?: string[]; skippedHunters?: Array<{ hunter: string; reason: string }>; coverageGaps?: string[]; limitations?: string[] };
  hardeningRecommendations?: string[];
  retest?: { manualRetestActions?: string[] };
  handoff?: { scope: { status: string; authorityConfirmation: string }; evidence: unknown[]; validation: Array<{ replayStatus: string }>; connectorStatus: string; retestExecution: string; limitations: string[] };
}
interface Envelope {
  snapshot: { id: string; state: string; version: number; content: ReportContent; generatedAt: string };
  latestOverlay?: { findingStatuses?: Array<{ id: string; status: string }>; retestStates?: Array<{ findingId: string; result?: string }> };
  exports: { formats: string[] };
}

export function ReportPanel({ id, onFinding, onClose }: { id: string; onFinding: (id: string) => void; onClose: () => void }) {
  const [report, setReport] = useState<Envelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [format, setFormat] = useState('json');
  const [view, setView] = useState('snapshot');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setReport(null); setError(null); setDownloadError(null);
    void apiFetch<{ report: Envelope }>(`/v1/reports/${encodeURIComponent(id)}`).then((result) => {
      if (!active) return;
      if (result.ok) setReport(result.data.report);
      else setError(result.error.message ?? 'Report could not be loaded.');
    });
    return () => { active = false; };
  }, [id, revision]);
  const content = report?.snapshot.content;
  const formats = ['json', 'docx', 'csv', 'html', 'pdf'].filter((item) => report?.exports.formats.includes(item));
  const selectedFormat = formats.includes(format) ? format : (formats[0] ?? 'json');
  const canExport = !!report && ['final', 'superseded'].includes(report.snapshot.state) && formats.length > 0;
  async function download() {
    if (!canExport || busy) return;
    setBusy(true); setDownloadError(null);
    try {
      const response = await fetch(`${API_BASE}/v1/reports/${encodeURIComponent(id)}/export?${new URLSearchParams({ format: selectedFormat, view })}`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? `Download failed (HTTP ${response.status})`);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `openhunter-report-${id}.${selectedFormat}`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (failure) { setDownloadError(failure instanceof Error ? failure.message : 'Report download failed.'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="report-heading" className="space-y-5 border-t border-hairline pt-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 id="report-heading" tabIndex={-1} className="font-display text-lg font-semibold">{content?.ownerSummary?.headline ?? 'Report'}</h2><p className="break-all text-xs text-ink-muted">{id} {report && `· v${report.snapshot.version} · ${new Date(report.snapshot.generatedAt).toLocaleString()}`}</p></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setRevision((value) => value + 1)}>Refresh report</Button><Button size="sm" variant="ghost" onClick={onClose}>Close report</Button></div></div>
    {error && <ErrorState message={error} />}
    {!report && !error && <p role="status" className="text-sm text-ink-muted">Loading report…</p>}
    {report && <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge state={report.snapshot.state} />
        <Select aria-label="Report format" className="w-auto max-w-full" value={selectedFormat} onChange={(event) => setFormat(event.target.value)} disabled={!canExport || busy}>{formats.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</Select>
        <Select aria-label="Report view" className="w-auto max-w-full" value={view} onChange={(event) => setView(event.target.value)} disabled={!canExport || busy}><option value="snapshot">Scan snapshot</option><option value="latest">With latest status</option></Select>
        <Button size="sm" variant="secondary" disabled={!canExport || busy} aria-busy={busy} onClick={() => void download()}>Download report</Button>
      </div>
      {downloadError && <ErrorState message={downloadError} />}
      <div className="space-y-2 text-sm"><p>{content?.ownerSummary?.topRiskOrOutcome}</p><p className="text-ink-muted">{content?.ownerSummary?.whatWasTested}</p><p className="text-ink-muted">{content?.ownerSummary?.businessImpact}</p><p>{content?.ownerSummary?.recommendedNextAction}</p></div>
      <section className="space-y-3"><h3 className="text-sm font-semibold">Validated findings ({content?.findings?.length ?? 0})</h3>
        {!content?.findings?.length && <p className="text-sm text-ink-muted">No finding was independently validated. Coverage gaps and untested areas remain relevant.</p>}
        {content?.findings?.map((finding) => <article key={finding.id} className="space-y-2 border-l-2 border-hairline pl-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-2"><button className="text-left font-medium text-signal hover:underline" onClick={() => onFinding(finding.id)}>{finding.title}</button><SeverityBadge severity={finding.severity} /></div><p className="break-all text-xs text-ink-muted">{finding.affectedAsset}</p><p>{finding.impact}</p><p className="text-ink-muted">{finding.sanitizedProof?.description}</p><p className="text-xs text-ink-muted">Evidence: {finding.sanitizedProof?.evidenceRefs?.join(', ') || 'No evidence reference'}</p></article>)}
      </section>
      <section className="space-y-2"><h3 className="text-sm font-semibold">Executed coverage and limitations</h3><p className="text-xs text-ink-muted">Workers: {content?.coverage?.workersRun?.join(', ') || 'None'}</p><p className="text-xs text-ink-muted">Hunter families: {content?.coverage?.huntersRun?.join(', ') || 'Not separately evidenced'}</p><TextList items={content?.coverage?.coverageGaps} /><TextList items={content?.coverage?.limitations} /><TextList items={content?.coverage?.skippedHunters?.map((item) => `${item.hunter}: ${item.reason}`)} /></section>
      {!!content?.historicalFindings?.length && <details><summary className="cursor-pointer text-sm">Historical observations (unverified)</summary><ul className="mt-2 space-y-1 text-sm text-ink-muted">{content.historicalFindings.map((finding) => <li key={finding.id}>{finding.title} · {finding.validationStatus}</li>)}</ul></details>}
      <section aria-label="OpenShieldAI handoff" className="space-y-2"><h3 className="text-sm font-semibold">OpenShieldAI handoff</h3><p className="text-xs text-ink-muted">Download JSON for the immutable assessment snapshot. The receiving system must verify its asset mapping and authority before taking action.</p>{content?.handoff ? <><p className="text-xs text-ink-muted">Scope: {content.handoff.scope.status} · Authority record: {content.handoff.scope.authorityConfirmation} · Evidence references: {content.handoff.evidence.length}</p><p className="text-xs text-ink-muted">Connector: {content.handoff.connectorStatus} · Retest execution: {content.handoff.retestExecution} · Replay: not attested</p><TextList items={content.handoff.limitations} /></> : <p className="text-xs text-ink-muted">This historical report has no handoff metadata. Verify provenance and scope before intake.</p>}</section>
      <details><summary className="cursor-pointer text-sm">OpenShieldAI remediation guidance</summary><div className="mt-3 space-y-4 text-sm"><p className="text-xs text-ink-muted">OpenHunter supplies assessment evidence and verification criteria. OpenShieldAI owns response and remediation decisions.</p>{content?.developerFixPack?.map((fix) => <article key={fix.findingId} className="space-y-2"><p className="font-medium">{fix.findingId}</p><p>{fix.rootCauseHypothesis}</p><p>{fix.concreteFixPrompt}</p><TextList items={fix.validationSteps} /><TextList items={fix.regressionTestIdeas} /><p>Acceptance: {fix.acceptanceCriteria}</p></article>)}<TextList items={content?.hardeningRecommendations} /><TextList items={content?.retest?.manualRetestActions} /></div></details>
      {view === 'latest' && <details><summary className="cursor-pointer text-sm">Latest verification status</summary><TextList items={report.latestOverlay?.findingStatuses?.map((finding) => `${finding.id}: ${finding.status}`)} /><TextList items={report.latestOverlay?.retestStates?.map((run) => `${run.findingId}: ${run.result ?? 'Pending'}`)} /></details>}
    </>}
  </section>;
}

function TextList({ items }: { items?: string[] }) { return items?.length ? <ul className="list-disc space-y-1 pl-4 text-sm text-ink-muted">{items.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul> : null; }
