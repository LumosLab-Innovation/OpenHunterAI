import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';
import { SeverityBadge } from '../ui/Badge';
import { ErrorState } from '../ui/States';

interface Finding { id: string; title: string; severity: string; affectedAsset: string; description: string; status: string; retestScenario?: unknown; acceptanceCriteria?: string; evidence?: { description?: string }; retestRuns?: Array<{ id: string; result?: string }> }

export function FindingPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    setFinding(null); setError(null); setNotice(null); setConfirmed(false);
    void apiFetch<{ finding: Finding }>(`/v1/findings/${encodeURIComponent(id)}`).then((result) => {
      if (!active) return;
      if (result.ok) setFinding(result.data.finding);
      else setError(result.error.message ?? 'Finding could not be loaded.');
    });
    return () => { active = false; };
  }, [id]);
  async function retest() {
    if (!finding?.retestScenario || !confirmed || busy) return;
    setBusy(true); setNotice(null);
    const result = await apiFetch<{ retestRun: { id: string; result?: string } }>(`/v1/findings/${encodeURIComponent(id)}/retest`, { method: 'POST' });
    setBusy(false);
    if (!result.ok) setNotice(`${result.error.code ?? 'RETEST_FAILED'}: ${result.error.message ?? 'No successful retest was confirmed.'}`);
    else setNotice(result.data.retestRun.result ? `Retest result: ${result.data.retestRun.result}` : 'Retest requested; no result is available yet.');
  }
  return <section aria-labelledby="finding-heading" className="space-y-3 border-t border-hairline pt-6">
    <div className="flex items-start justify-between gap-3"><h2 id="finding-heading" tabIndex={-1} className="font-display text-lg font-semibold">{finding?.title ?? 'Finding'}</h2><Button size="sm" variant="ghost" onClick={onClose}>Close finding</Button></div>
    {error && <ErrorState message={error} />}
    {finding && <><div className="flex flex-wrap gap-2"><SeverityBadge severity={finding.severity} /><span className="text-xs text-ink-muted">{finding.status}</span></div><p className="break-all text-xs text-ink-muted">{finding.affectedAsset}</p><p className="text-sm">{finding.description}</p>{finding.evidence?.description && <p className="text-sm text-ink-muted">{finding.evidence.description}</p>}
      <p className="text-xs text-ink-muted">Response and remediation belong in OpenShieldAI. OpenHunter records assessment and verification evidence within its authorized scope.</p>
      {finding.acceptanceCriteria && <p className="text-sm">Acceptance: {finding.acceptanceCriteria}</p>}
      {finding.retestScenario ? <><label className="flex items-start gap-2 text-xs text-ink-muted"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-signal" />I authorize this finding-specific retest within its original scope. Sensitive actions still require approval.</label><Button size="sm" variant="secondary" disabled={busy || !confirmed} onClick={() => void retest()}>Request manual retest</Button></> : <p className="text-xs text-ink-muted">No replay scenario is available for this finding.</p>}
      {notice && <p role="status" className="break-words text-sm text-ink-muted">{notice}</p>}
    </>}
  </section>;
}
