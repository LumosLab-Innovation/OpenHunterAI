import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface Scan {
  id: string;
  mode: string;
  state: string;
  steps?: Array<{ kind: string; state: string }>;
}

export function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);

  useEffect(() => {
    void apiFetch<{ scans: Scan[] }>('/v1/scans').then((res) => {
      if (res.ok) setScans(res.data.scans);
    });
  }, []);

  return (
    <section className="panel">
      <h1>Scans</h1>
      <table>
        <tbody>
          {scans.map((scan) => (
            <tr key={scan.id}>
              <td>{scan.id.slice(0, 8)}</td>
              <td>{scan.mode}</td>
              <td>{scan.state}</td>
              <td>
                <Link to={`/scans/${scan.id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ScanDetailPage() {
  const { id = '' } = useParams();
  const [scan, setScan] = useState<Scan | null>(null);

  useEffect(() => {
    void apiFetch<{ scan: Scan }>(`/v1/scans/${id}`).then((res) => {
      if (res.ok) setScan(res.data.scan);
    });
  }, [id]);

  return (
    <section className="panel">
      <h1>Scan {id.slice(0, 8)}</h1>
      <p className="badge">{scan?.state ?? 'loading'}</p>
      <h2>Steps</h2>
      <table>
        <tbody>
          {(scan?.steps ?? []).map((step) => (
            <tr key={step.kind}>
              <td>{step.kind}</td>
              <td>{step.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
