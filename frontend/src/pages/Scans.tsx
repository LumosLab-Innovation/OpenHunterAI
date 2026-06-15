import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Radar, FileText } from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ scans: Scan[] }>('/v1/scans').then((res) => {
      if (res.ok) setScans(res.data.scans);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Scans" description="Live and historical scan jobs across your projects." />
      {loading ? (
        <SkeletonRows rows={4} />
      ) : scans.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No scans yet"
          description="Authorize a scan from a project to launch the hunter pipeline."
          action={<ButtonLink to="/projects">Go to projects</ButtonLink>}
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Scan</TH>
                <TH>Mode</TH>
                <TH>State</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <tbody>
              {scans.map((scan) => (
                <TR key={scan.id}>
                  <TD className="text-data text-xs">{scan.id.slice(0, 8)}</TD>
                  <TD>{scan.mode}</TD>
                  <TD>
                    <StatusBadge state={scan.state} />
                  </TD>
                  <TD className="text-right">
                    <Link to={`/scans/${scan.id}`} className="text-signal hover:underline">
                      Open
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export function ScanDetailPage() {
  const { id = '' } = useParams();
  const [scan, setScan] = useState<Scan | null>(null);
  const [draftSections, setDraftSections] = useState<DraftSection[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    void apiFetch<{ scan: Scan }>(`/v1/scans/${id}`).then((res) => {
      if (res.ok) {
        setScan(res.data.scan);
        setDraftSections(res.data.scan.reportDraftSections ?? []);
      }
    });
  }, [id]);

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/v1/scans/${id}/report-events`, {
      withCredentials: true,
    });
    const apply = (event: Event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { sections: DraftSection[] };
      setDraftSections(payload.sections);
    };
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.addEventListener('draft_snapshot', apply);
    source.addEventListener('section_ready', apply);
    source.addEventListener('report_finalized', apply);
    return () => source.close();
  }, [id]);

  const latestReport = scan?.reports?.[0];

  return (
    <div>
      <PageHeader
        title="Scan"
        description={<span className="text-data text-xs text-ink-faint">{id}</span>}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={scan?.state} />
            {latestReport && (
              <ButtonLink to={`/reports/${latestReport.id}`} size="sm">
                <FileText className="h-4 w-4" /> Report v{latestReport.version}
              </ButtonLink>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Steps */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pipeline steps</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-2">
            {(scan?.steps ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">No steps reported yet.</p>
            ) : (
              (scan?.steps ?? []).map((step) => (
                <div
                  key={step.kind}
                  className="flex items-center justify-between rounded border border-hairline px-3 py-2"
                >
                  <span className="text-data text-xs text-ink">{step.kind}</span>
                  <StatusBadge state={step.state} />
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* Live report draft */}
        <Card>
          <CardHeader>
            <CardTitle>Report draft</CardTitle>
            <Badge tone={live ? 'signal' : 'neutral'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal animate-pulse-ring' : 'bg-ink-faint'}`}
              />
              {live ? 'live' : 'offline'}
            </Badge>
          </CardHeader>
          <CardBody className="grid gap-3">
            {draftSections.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Draft sections will appear here as workers produce sanitized output.
              </p>
            ) : (
              draftSections.map((section) => (
                <article key={section.id} className="rounded-lg border border-hairline bg-surface-raised p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-700 text-ink">{section.sectionKey}</h3>
                    <StatusBadge state={section.state} />
                  </div>
                  <pre className="overflow-auto rounded bg-canvas p-3 text-data text-xs leading-relaxed text-ink-muted">
                    {JSON.stringify(section.content ?? {}, null, 2)}
                  </pre>
                </article>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
