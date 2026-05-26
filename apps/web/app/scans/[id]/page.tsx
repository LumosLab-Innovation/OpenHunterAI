'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface ScanDetail {
  id: string;
  mode: string;
  state: string;
  steps: Array<{ kind: string; state: string; errorCode: string | null; errorMsg: string | null }>;
  findings: Array<{
    id: string;
    title: string;
    severity: string;
    confidence: string;
    status: string;
  }>;
  reports: Array<{ id: string; kind: string; body: string }>;
}

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const [scan, setScan] = useState<ScanDetail | null>(null);
  useEffect(() => {
    apiFetch<{ scan: ScanDetail }>(`/v1/scans/${params.id}`).then((r) => {
      if (r.ok) setScan(r.data.scan);
    });
  }, [params.id]);
  if (!scan) return <p>Loading…</p>;
  return (
    <>
      <h1>
        Scan {scan.id.slice(0, 8)}… ({scan.state})
      </h1>
      <section className="card">
        <h2>Steps</h2>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>State</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {scan.steps.map((s, i) => (
              <tr key={i}>
                <td>{s.kind}</td>
                <td>{s.state}</td>
                <td className="muted">
                  {s.errorCode}
                  {s.errorMsg ? `: ${s.errorMsg}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Findings</h2>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Confidence</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scan.findings.map((f) => (
              <tr key={f.id}>
                <td>{f.title}</td>
                <td>
                  <span className={`sev-${f.severity}`}>{f.severity.toUpperCase()}</span>
                </td>
                <td>{f.confidence}</td>
                <td>{f.status}</td>
                <td>
                  <a href={`/findings/${f.id}`}>Mở</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Reports</h2>
        {scan.reports.map((r) => (
          <details key={r.id} style={{ marginBottom: '1rem' }}>
            <summary>{r.kind}</summary>
            <pre>{r.body}</pre>
          </details>
        ))}
      </section>
    </>
  );
}
