import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE, apiFetch } from '../lib/api';

interface Scan {
  id: string;
  mode: string;
  state: string;
  steps?: Array<{ kind: string; state: string }>;
  reports?: Array<{ id: string; state: string; version: number }>;
  reportDraftSections?: DraftSection[];
}

interface DraftSection {
  id: string;
  sectionKey: string;
  state: string;
  content?: unknown;
  updatedAt?: string;
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
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);

  useEffect(() => {
    void apiFetch<{ scan: Scan }>(`/v1/scans/${id}`).then((res) => {
      if (res.ok) {
        setScan(res.data.scan);
        setDraftSections(res.data.scan.reportDraftSections ?? []);
      }
    });
  }, [id]);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/v1/scans/${id}/report-events`, { withCredentials: true });
    source.addEventListener('draft_snapshot', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { sections: DraftSection[] };
      setDraftSections(payload.sections);
    });
    source.addEventListener('section_ready', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { sections: DraftSection[] };
      setDraftSections(payload.sections);
    });
    source.addEventListener('report_finalized', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { sections: DraftSection[] };
      setDraftSections(payload.sections);
    });
    return () => source.close();
  }, [id]);

  const latestReport = scan?.reports?.[0];

  return (
    <section className="panel">
      <h1>Scan {id.slice(0, 8)}</h1>
      <p className="badge">{scan?.state ?? 'loading'}</p>
      {latestReport && (
        <p>
          <Link className="button" to={`/reports/${latestReport.id}`}>
            Open report v{latestReport.version}
          </Link>
        </p>
      )}
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
      <h2>Report Draft</h2>
      <div className="report-list">
        {draftSections.length === 0 ? (
          <p className="muted">Draft sections will appear as workers produce sanitized output.</p>
        ) : (
          draftSections.map((section) => (
            <article key={section.id} className="report-item">
              <h3>{section.sectionKey}</h3>
              <p className="badge">{section.state}</p>
              <pre>{JSON.stringify(section.content ?? {}, null, 2)}</pre>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
