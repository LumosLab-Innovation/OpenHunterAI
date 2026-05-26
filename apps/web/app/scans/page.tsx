'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

interface ScanJob {
  id: string;
  projectId: string;
  mode: string;
  state: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export default function ScansPage() {
  const [scans, setScans] = useState<ScanJob[]>([]);
  useEffect(() => {
    apiFetch<{ scans: ScanJob[] }>('/v1/scans').then((r) => {
      if (r.ok) setScans(r.data.scans);
    });
  }, []);
  return (
    <>
      <h1>All scans</h1>
      <div className="card">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Project</th>
            <th>Mode</th>
            <th>State</th>
            <th>Started</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id}>
              <td className="muted">{s.id.slice(0, 8)}…</td>
              <td className="muted">{s.projectId.slice(0, 8)}…</td>
              <td>{s.mode}</td>
              <td>{s.state}</td>
              <td className="muted">
                {s.startedAt ? new Date(s.startedAt).toLocaleString() : '—'}
              </td>
              <td>
                <a href={`/scans/${s.id}`}>Mở</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
