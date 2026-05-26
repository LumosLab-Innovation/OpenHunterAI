'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

interface Finding {
  id: string;
  title: string;
  severity: string;
  confidence: string;
  status: string;
  affectedAsset: string;
}

export default function FindingsPage() {
  const [items, setItems] = useState<Finding[]>([]);
  useEffect(() => {
    apiFetch<{ findings: Finding[] }>('/v1/findings').then((r) => {
      if (r.ok) setItems(r.data.findings);
    });
  }, []);
  return (
    <>
      <h1>Finding board</h1>
      <table className="card">
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Asset</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id}>
              <td>{f.title}</td>
              <td>
                <span className={`sev-${f.severity}`}>{f.severity.toUpperCase()}</span>
              </td>
              <td>{f.confidence}</td>
              <td>{f.status}</td>
              <td className="muted">{f.affectedAsset}</td>
              <td>
                <a href={`/findings/${f.id}`}>Mở</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
