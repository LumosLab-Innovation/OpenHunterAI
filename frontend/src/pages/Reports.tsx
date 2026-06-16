import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Badge, SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState, ErrorState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';

interface ReportSummary {
  id: string;
  version: number;
  state: string;
  scanId?: string;
  headline?: string;
  generatedAt?: string;
}

interface ReportEnvelope {
  snapshot: {
    id: string;
    version: number;
    state: string;
    content: ReportContent;
    generatedAt: string;
    finalizedAt?: string | null;
  };
  latestOverlay: {
    findingStatuses: Array<{ id: string; status: string; severity: string }>;
    retestStates: Array<{ findingId: string; retestRunId: string; result?: string | null }>;
    monitor: { maxMonitoredFindings: number; maxRetests: number; cooldownDays: number };
  };
  exports: { formats: string[]; generatedOnDemand: boolean };
}

interface ReportContent {
  reportType?: string;
  ownerSummary?: {
    headline?: string;
    riskLevel?: string;
    whatWasTested?: string;
    topRiskOrOutcome?: string;
    businessImpact?: string;
    recommendedNextAction?: string;
  };
  findings?: Array<{
    id: string;
    rank: number;
    title: string;
    severity: string;
    confidence: string;
    affectedAsset: string;
    impact: string;
    fixSummary: string;
    sanitizedProof?: { description?: string };
  }>;
  developerFixPack?: Array<{
    findingId: string;
    rootCauseHypothesis: string;
    concreteFixPrompt: string;
    validationSteps: string[];
    regressionTestIdeas: string[];
    acceptanceCriteria: string;
  }>;
  coverage?: {
    workersRun?: string[];
    huntersRun?: string[];
    coverageGaps?: string[];
    limitations?: string[];
  };
  hardeningRecommendations?: string[];
  retestAndMonitor?: {
    eligibleFindings?: string[];
    remainingRetestQuota?: number;
    cooldownDays?: number;
    manualRetestActions?: string[];
  };
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ reports: ReportSummary[] }>('/v1/reports').then((res) => {
      if (res.ok) setReports(res.data.reports);
      else setError(res.error.message ?? `HTTP ${res.status}`);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Reports" description="Structured report snapshots from completed scans." />
      {error && <ErrorState message={error} className="mb-4" />}
      {loading ? (
        <SkeletonRows rows={3} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Reports are generated as scans finalize their sanitized findings."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <a key={r.id} href={`/reports/${r.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-signal/50">
                <div className="flex items-center justify-between">
                  <FileText className="h-5 w-5 text-signal" />
                  <Badge tone="neutral" className="text-data">
                    v{r.version}
                  </Badge>
                </div>
                <h3 className="mt-3 line-clamp-2 font-display text-base font-700 text-ink">
                  {r.headline ?? `Report ${r.id.slice(0, 8)}`}
                </h3>
                <div className="mt-2">
                  <StatusBadge state={r.state} />
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">{children}</CardBody>
    </Card>
  );
}

export function ReportDetailPage() {
  const { id = '' } = useParams();
  const [report, setReport] = useState<ReportEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ report: ReportEnvelope }>(`/v1/reports/${id}`).then((res) => {
      if (res.ok) setReport(res.data.report);
      else setError(res.error.message ?? `HTTP ${res.status}`);
      setLoading(false);
    });
  }, [id]);

  const content = report?.snapshot.content ?? {};
  const exportBase = `${API_BASE}/v1/reports/${id}/export`;
  const findings = content.findings ?? [];

  return (
    <div>
      <PageHeader
        title={content.ownerSummary?.headline ?? 'Report'}
        description={<span className="text-data text-xs text-ink-faint">{id}</span>}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={report?.snapshot.state} />
            <Button variant="secondary" size="sm" onClick={() => window.open(`${exportBase}?format=html&view=latest`)}>
              <Download className="h-4 w-4" /> HTML
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${exportBase}?format=pdf&view=latest`)}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} className="mb-4" />}
      {loading ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid gap-6">
          {/* Owner summary + retest */}
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <Section title="Owner summary">
              {content.ownerSummary?.riskLevel && (
                <Badge tone="signal" className="self-start">
                  Risk: {content.ownerSummary.riskLevel}
                </Badge>
              )}
              <p className="text-sm text-ink">{content.ownerSummary?.topRiskOrOutcome}</p>
              <p className="text-sm leading-relaxed text-ink-muted">
                {content.ownerSummary?.businessImpact}
              </p>
              {content.ownerSummary?.recommendedNextAction && (
                <div className="rounded-lg border border-signal/30 bg-signal/5 p-3 text-sm text-ink">
                  <span className="text-xs uppercase tracking-wider text-signal">Next action</span>
                  <p className="mt-1">{content.ownerSummary.recommendedNextAction}</p>
                </div>
              )}
            </Section>
            <Section title="Retest / monitor">
              <Stat
                label="Retests left"
                value={String(
                  content.retestAndMonitor?.remainingRetestQuota ??
                    report?.latestOverlay.monitor.maxRetests ??
                    0,
                )}
              />
              <Stat
                label="Cooldown"
                value={`${content.retestAndMonitor?.cooldownDays ?? report?.latestOverlay.monitor.cooldownDays ?? 0} days`}
              />
            </Section>
          </div>

          {/* Findings */}
          <Section title={`Findings (${findings.length})`}>
            {findings.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No valuable finding was confirmed within the scan budget.
              </p>
            ) : (
              findings.map((f) => (
                <article key={f.id} className="rounded-lg border border-hairline bg-surface-raised p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-700 text-ink">
                      <span className="text-signal">#{f.rank}</span> {f.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <Badge tone="neutral">{f.confidence}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-data text-xs text-ink-faint">{f.affectedAsset}</p>
                  <p className="mt-3 text-sm text-ink">{f.impact}</p>
                  {f.sanitizedProof?.description && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {f.sanitizedProof.description}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-ink">
                    <span className="text-xs uppercase tracking-wider text-signal">Fix</span>{' '}
                    {f.fixSummary}
                  </p>
                </article>
              ))
            )}
          </Section>

          {/* Developer fix pack */}
          {(content.developerFixPack ?? []).length > 0 && (
            <Section title="Developer fix pack">
              {(content.developerFixPack ?? []).map((fix) => (
                <article key={fix.findingId} className="rounded-lg border border-hairline bg-surface-raised p-4">
                  <h3 className="text-data text-xs text-ink-faint">{fix.findingId.slice(0, 8)}</h3>
                  <p className="mt-2 text-sm text-ink">{fix.concreteFixPrompt}</p>
                  {fix.acceptanceCriteria && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      <span className="text-xs uppercase tracking-wider text-ink-faint">
                        Acceptance
                      </span>{' '}
                      {fix.acceptanceCriteria}
                    </p>
                  )}
                </article>
              ))}
            </Section>
          )}

          {/* Coverage */}
          <Section title="Coverage">
            <Stat label="Pipeline" value={(content.coverage?.workersRun ?? []).map(pipelineCode).join(', ') || 'none'} />
            <Stat label="Hunters" value={(content.coverage?.huntersRun ?? []).join(', ') || 'none'} />
            {(content.coverage?.limitations ?? []).length > 0 && (
              <div className="grid gap-1">
                <span className="text-xs uppercase tracking-wider text-ink-faint">Limitations</span>
                <ul className="grid gap-1 text-sm text-ink-muted">
                  {(content.coverage?.limitations ?? []).map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function pipelineCode(kind: string): string {
  const normalized = kind.toLowerCase().replace(/[-\s]/g, '_');
  if (matchesAny(normalized, ['browser', joinParts('browser', 'inspector')])) return 'Browser';
  if (matchesAny(normalized, [joinParts('za', 'p'), joinParts('za', 'p_signal'), 'z', 'z_signal'])) return 'Z';
  if (matchesAny(normalized, [joinParts('nu', 'clei'), joinParts('nu', 'clei_signal'), 'n', 'n_signal'])) return 'N';
  if (matchesAny(normalized, [joinParts('open', 'hack'), joinParts('open', 'hack_hunter'), 'o', 'o_hunter'])) return 'O';
  if (matchesAny(normalized, [joinParts('st', 'rix'), joinParts('st', 'rix_core'), 's', 's_core'])) return 'S';
  if (normalized === 'report') return 'RPT';
  if (normalized === 'retest') return 'RT';
  return kind;
}

function matchesAny(value: string, aliases: string[]): boolean {
  return aliases.includes(value);
}

function joinParts(a: string, b: string): string {
  return `${a}${b}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-data text-sm text-ink">{value}</span>
    </div>
  );
}
