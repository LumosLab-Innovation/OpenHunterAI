'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface FindingDetail {
  id: string;
  title: string;
  description: string;
  severity: string;
  confidence: string;
  status: string;
  affectedAsset: string;
  evidence: unknown;
  retestRuns: Array<{
    id: string;
    kind: string;
    result: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
}

export default function FindingDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<FindingDetail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function reload() {
    const r = await apiFetch<{ finding: FindingDetail }>(`/v1/findings/${params.id}`);
    if (r.ok) setItem(r.data.finding);
  }
  useEffect(() => {
    reload();
  }, [params.id]);
  async function startRetest() {
    setMsg(null);
    const r = await apiFetch<{ retestRun: { id: string } }>(`/v1/findings/${params.id}/retest`, {
      method: 'POST',
      body: JSON.stringify({ kind: 'auto' }),
    });
    if (!r.ok) setMsg(`Lỗi: ${r.error.message ?? r.status}`);
    else {
      setMsg('Đã đưa retest vào hàng đợi.');
      await reload();
    }
  }
  async function setStatus(status: string) {
    const r = await apiFetch(`/v1/findings/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (r.ok) await reload();
  }
  if (!item) return <p>Loading…</p>;
  return (
    <>
      <h1>
        <span className={`sev-${item.severity}`}>{item.severity.toUpperCase()}</span> · {item.title}
      </h1>
      <div className="card">
        <p>
          <strong>Asset:</strong> <code>{item.affectedAsset}</code>
        </p>
        <p>
          <strong>Confidence:</strong> {item.confidence} · <strong>Status:</strong> {item.status}
        </p>
        <p>{item.description}</p>
      </div>
      <div className="card">
        <h2>Hành động</h2>
        <button onClick={startRetest}>Retest just this finding</button>{' '}
        <button onClick={() => setStatus('in_progress')}>Đang fix</button>{' '}
        <button onClick={() => setStatus('ready_for_retest')}>Sẵn sàng retest</button>{' '}
        <button onClick={() => setStatus('accepted_risk')}>Chấp nhận rủi ro</button>
        {msg && <p className="muted">{msg}</p>}
      </div>
      <div className="card">
        <h2>Evidence</h2>
        <pre>{JSON.stringify(item.evidence, null, 2)}</pre>
      </div>
      <div className="card">
        <h2>Retest history</h2>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Result</th>
              <th>Started</th>
              <th>Finished</th>
            </tr>
          </thead>
          <tbody>
            {item.retestRuns.map((r) => (
              <tr key={r.id}>
                <td>{r.kind}</td>
                <td>{r.result ?? '—'}</td>
                <td className="muted">
                  {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                </td>
                <td className="muted">
                  {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
