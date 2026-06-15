import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Crosshair } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Badge, SeverityBadge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState, ErrorState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { cn } from '../lib/cn';

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  affectedAsset?: string;
  description?: string;
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const FILTERS = ['all', ...SEVERITY_ORDER] as const;

export function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  useEffect(() => {
    void apiFetch<{ findings: Finding[] }>('/v1/findings').then((res) => {
      if (res.ok) setFindings(res.data.findings);
      setLoading(false);
    });
  }, []);

  const sorted = useMemo(
    () =>
      [...findings].sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity?.toLowerCase()) -
          SEVERITY_ORDER.indexOf(b.severity?.toLowerCase()),
      ),
    [findings],
  );

  const visible = filter === 'all' ? sorted : sorted.filter((f) => f.severity?.toLowerCase() === filter);

  return (
    <div>
      <PageHeader title="Findings" description="Sanitized, ranked findings across your scans." />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f === 'all' ? findings.length : findings.filter((x) => x.severity?.toLowerCase() === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors',
                filter === f
                  ? 'border-signal bg-signal/10 text-signal'
                  : 'border-hairline-strong text-ink-muted hover:text-ink',
              )}
            >
              {f} <span className="text-data text-ink-faint">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title={findings.length === 0 ? 'No findings yet' : 'Nothing at this severity'}
          description={
            findings.length === 0
              ? 'Findings appear here as scans confirm sanitized evidence.'
              : 'Try a different severity filter.'
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Finding</TH>
                <TH>Severity</TH>
                <TH>Status</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <tbody>
              {visible.map((f) => (
                <TR key={f.id}>
                  <TD className="font-medium">{f.title}</TD>
                  <TD>
                    <SeverityBadge severity={f.severity} />
                  </TD>
                  <TD>
                    <Badge tone="neutral" className="normal-case tracking-normal">
                      {f.status}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Link to={`/findings/${f.id}`} className="text-signal hover:underline">
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

export function FindingDetailPage() {
  const { id = '' } = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ finding: Finding }>(`/v1/findings/${id}`).then((res) => {
      if (res.ok) setFinding(res.data.finding);
      else setError(res.error.message ?? `HTTP ${res.status}`);
      setLoading(false);
    });
  }, [id]);

  return (
    <div>
      <PageHeader
        title={finding?.title ?? 'Finding'}
        description={<span className="text-data text-xs text-ink-faint">{id}</span>}
        actions={finding && <SeverityBadge severity={finding.severity} />}
      />
      {error && <ErrorState message={error} className="mb-4" />}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          {finding && (
            <Badge tone="neutral" className="normal-case tracking-normal">
              {finding.status}
            </Badge>
          )}
        </CardHeader>
        <CardBody className="grid gap-4">
          {loading ? (
            <SkeletonRows rows={2} />
          ) : (
            <>
              {finding?.affectedAsset && (
                <div className="grid gap-1">
                  <span className="text-xs uppercase tracking-wider text-ink-faint">Affected asset</span>
                  <span className="text-data text-sm text-ink">{finding.affectedAsset}</span>
                </div>
              )}
              {finding?.description && (
                <div className="grid gap-1">
                  <span className="text-xs uppercase tracking-wider text-ink-faint">Description</span>
                  <p className="text-sm leading-relaxed text-ink-muted">{finding.description}</p>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
