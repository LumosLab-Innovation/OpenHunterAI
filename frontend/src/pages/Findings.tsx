import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  affectedAsset?: string;
  description?: string;
}

export function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);

  useEffect(() => {
    void apiFetch<{ findings: Finding[] }>('/v1/findings').then((res) => {
      if (res.ok) setFindings(res.data.findings);
    });
  }, []);

  return (
    <section className="panel">
      <h1>Findings</h1>
      <table>
        <tbody>
          {findings.map((finding) => (
            <tr key={finding.id}>
              <td>{finding.title}</td>
              <td>{finding.severity}</td>
              <td>{finding.status}</td>
              <td>
                <Link to={`/findings/${finding.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function FindingDetailPage() {
  const { id = '' } = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);

  useEffect(() => {
    void apiFetch<{ finding: Finding }>(`/v1/findings/${id}`).then((res) => {
      if (res.ok) setFinding(res.data.finding);
    });
  }, [id]);

  return (
    <section className="panel">
      <h1>{finding?.title ?? `Finding ${id.slice(0, 8)}`}</h1>
      <p className="badge">{finding?.severity ?? 'loading'}</p>
      <p>{finding?.description ?? finding?.affectedAsset}</p>
    </section>
  );
}
