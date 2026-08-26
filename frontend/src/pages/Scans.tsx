import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, FileText, Filter, MousePointer2, Radar, Search, ShieldCheck, Square, Trash2 } from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Badge, SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/States';
import { SkeletonRows } from '../components/ui/Loading';
import { Table, TD, TH, THead, TR } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Field';

interface Scan {
  id: string;
  mode: string;
  state: string;
  targetType?: string;
  createdAt?: string;
  scopeSnapshot?: { verifiedDomain?: string; allowedHosts?: string[] };
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

interface LiveScanSnapshot {
  scan: {
    id: string;
    projectId: string;
    mode: string;
    targetType: string;
    authScope: string;
    testIntensityMode: string;
    state: string;
    target: string;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  workers: Array<{
    code: string;
    state: string;
    title: string;
    summary: string | null;
    errorCode: string | null;
    updatedAt: string | null;
  }>;
  activity: Array<{
    id: string;
    at: string;
    type: string;
    actor: string;
    title: string;
    body: string;
    titleKey?: string;
    bodyKey?: string;
    bodyParams?: Record<string, unknown>;
    status: string;
    severity?: string | null;
    sanitized: true;
  }>;
  findingsPreview: Array<{
    id: string;
    title: string;
    severity: string;
    confidence: string;
    affectedAsset: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  findingsSummary?: {
    validatedFindings: LiveScanSnapshot['findingsPreview'];
    candidates: Array<{
      id: string;
      title: string;
      severity: string;
      confidence: string;
      affectedAsset: string;
      category: string;
      validationState: string;
      createdAt: string;
    }>;
    hardeningCoverage: Array<{
      id: string;
      title: string;
      severity: string;
      confidence: string;
      affectedAsset: string;
      category: string;
      evidenceClass: string;
      createdAt: string;
    }>;
  };
  reportPreview: {
    latestReportId: string | null;
    latestReportState: string | null;
    sections: Array<{
      id: string;
      sectionKey: string;
      state: string;
      summary: string;
      updatedAt: string;
    }>;
  };
  cursorPreview: {
    visible: boolean;
    actor: string;
    xPercent: number;
    yPercent: number;
    caption: string;
    screenshotAlt: string;
    visualArtifact?: SanitizedVisualArtifact;
  };
  degraded?: { events: boolean; reason: string };
}

type LiveLocale = 'vi' | 'en';
type SanitizedVisualArtifact = {
  kind: 'thumbnail';
  dataUrl: string;
  width?: number;
  height?: number;
  expiresAt: string;
  sanitized: true;
  synthetic?: true;
  masked?: true;
};

export function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('all');
  const [mode, setMode] = useState('all');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (state !== 'all') params.set('state', state);
    if (mode !== 'all') params.set('mode', mode);
    if (q.trim()) params.set('q', q.trim());
    params.set('sort', sort);
    setLoading(true);
    void apiFetch<{ scans: Scan[] }>(`/v1/scans?${params.toString()}`).then((res) => {
      if (res.ok) setScans(res.data.scans);
      setLoading(false);
    });
  }, [mode, q, sort, state]);

  async function stopScan(scan: Scan) {
    if (!window.confirm(`Stop scan ${scan.id.slice(0, 8)}?`)) return;
    const res = await apiFetch<{ scan: Scan }>(`/v1/scans/${scan.id}/cancel`, { method: 'POST' });
    if (res.ok) setScans((current) => current.map((item) => (item.id === scan.id ? res.data.scan : item)));
  }

  async function hideScan(scan: Scan) {
    if (!window.confirm(`Hide scan ${scan.id.slice(0, 8)} from this list?`)) return;
    const res = await apiFetch<{ scan: Scan }>(`/v1/scans/${scan.id}`, { method: 'DELETE' });
    if (res.ok) setScans((current) => current.filter((item) => item.id !== scan.id));
  }

  return (
    <div>
      <PageHeader title="Scans" description="Live and historical scan jobs across your projects." />
      <Card className="mb-4">
        <CardBody className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_190px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search target or scan id" className="pl-9" />
          </div>
          <Select value={state} onChange={(event) => setState(event.target.value)} aria-label="Filter state">
            <option value="all">All states</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="awaiting_approval">Awaiting approval</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="timeout">Timeout</option>
          </Select>
          <Select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Filter mode">
            <option value="all">All modes</option>
            <option value="free_hunter">Free Hunter</option>
            <option value="ai_blackhat_mindset_check">AI mindset check</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort scans">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </Select>
        </CardBody>
      </Card>
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
                <TH>Target</TH>
                <TH>Mode</TH>
                <TH>State</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <tbody>
              {scans.map((scan) => (
                <TR key={scan.id}>
                  <TD className="text-data text-xs">{scan.id.slice(0, 8)}</TD>
                  <TD className="max-w-[260px] truncate text-sm">{scanTarget(scan)}</TD>
                  <TD>{scan.mode}</TD>
                  <TD>
                    <StatusBadge state={scan.state} />
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {['queued', 'running', 'awaiting_approval'].includes(scan.state) && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => void stopScan(scan)} title="Stop scan">
                          <Square className="h-3.5 w-3.5" /> Stop
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => void hideScan(scan)} title="Hide scan">
                        <Trash2 className="h-3.5 w-3.5" /> Hide
                      </Button>
                      <Link to={`/scans/${scan.id}`} className="inline-flex h-8 items-center text-signal hover:underline">
                        Open
                      </Link>
                    </div>
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
  const [snapshot, setSnapshot] = useState<LiveScanSnapshot | null>(null);
  const [live, setLive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [locale, setLocale] = useState<LiveLocale>('vi');

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/v1/scans/${id}/live-events?view=curated&limit=25`, {
      withCredentials: true,
    });
    const apply = (event: Event) => {
      const payload = JSON.parse((event as MessageEvent).data) as LiveScanSnapshot;
      setSnapshot(payload);
      setStreamError(null);
    };
    source.onopen = () => setLive(true);
    source.onerror = () => {
      setLive(false);
      setStreamError('Live connection is reconnecting.');
    };
    source.addEventListener('scan_snapshot', apply);
    source.addEventListener('scan_activity', apply);
    source.addEventListener('stream_degraded', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { reason?: string };
      setStreamError(payload.reason ?? 'Live event bus is degraded; polling fallback is active.');
    });
    return () => source.close();
  }, [id]);

  const latestReportId = snapshot?.reportPreview.latestReportId;
  const scan = snapshot?.scan;

  return (
    <div>
      <PageHeader
        title="Live scan"
        description={
          <span className="text-data text-xs text-ink-faint">
            {scan?.target ?? id} · {id.slice(0, 12)}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge state={scan?.state} />
            <Badge tone={live ? 'signal' : 'neutral'}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-signal animate-pulse-ring' : 'bg-ink-faint'}`}
              />
              {live ? 'live' : 'offline'}
            </Badge>
            {latestReportId && (
              <ButtonLink to={`/reports/${latestReportId}`} size="sm">
                <FileText className="h-4 w-4" /> {ui(locale, 'report')}
              </ButtonLink>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLocale((current) => (current === 'vi' ? 'en' : 'vi'))}
            >
              {locale.toUpperCase()}
            </Button>
          </div>
        }
      />

      {!snapshot ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="grid h-fit gap-4">
            <RunSummary snapshot={snapshot} live={live} streamError={streamError} locale={locale} />
            <WorkerRail workers={snapshot.workers} locale={locale} />
          </aside>

          <main className="grid gap-4">
            <CursorPreview snapshot={snapshot} locale={locale} />
            <ActivityTimeline events={snapshot.activity} locale={locale} />
          </main>

          <aside className="grid h-fit gap-4">
            <FindingsPreview snapshot={snapshot} locale={locale} />
            <ReportPreview preview={snapshot.reportPreview} locale={locale} />
          </aside>
        </div>
      )}
    </div>
  );
}

function RunSummary({
  snapshot,
  live,
  streamError,
  locale,
}: {
  snapshot: LiveScanSnapshot;
  live: boolean;
  streamError: string | null;
  locale: LiveLocale;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ui(locale, 'run')}</CardTitle>
        <StatusBadge state={snapshot.scan.state} />
      </CardHeader>
      <CardBody className="grid gap-3 text-sm">
        <SummaryRow label={ui(locale, 'target')} value={snapshot.scan.target} />
        <SummaryRow label={ui(locale, 'mode')} value={snapshot.scan.mode} />
        <SummaryRow label={ui(locale, 'intensity')} value={snapshot.scan.testIntensityMode} />
        <SummaryRow label={ui(locale, 'stream')} value={snapshot.degraded?.events ? 'degraded' : live ? 'live' : 'offline'} />
        {(streamError || snapshot.degraded?.reason || snapshot.scan.errorMessage) && (
          <p className="rounded border border-medium/30 bg-medium/10 p-3 text-xs leading-relaxed text-medium">
            {snapshot.scan.errorMessage ?? snapshot.degraded?.reason ?? streamError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function WorkerRail({ workers, locale }: { workers: LiveScanSnapshot['workers']; locale: LiveLocale }) {
  return (
        <Card className="h-fit">
          <CardHeader>
        <CardTitle className="text-base">{ui(locale, 'pipeline')}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-2">
        {workers.map((worker) => (
          <div
            key={worker.code}
            className="grid gap-1 rounded border border-hairline bg-surface-raised px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-data text-xs text-ink">{pipelineCode(worker.code)}</span>
              <StatusBadge state={worker.state} />
            </div>
            {worker.summary && <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{publicCopy(worker.summary)}</p>}
          </div>
        ))}
          </CardBody>
        </Card>
  );
}

function CursorPreview({ snapshot, locale }: { snapshot: LiveScanSnapshot; locale: LiveLocale }) {
  const cursor = snapshot.cursorPreview;
  const previewAlt = cursor.visualArtifact
    ? cursor.visualArtifact.synthetic
      ? 'Sanitized structural browser preview generated from safe page metrics.'
      : cursor.screenshotAlt
    : 'Simulated browser preview. Waiting for a sanitized thumbnail from Browser.';
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointer2 className="h-4 w-4 text-signal" /> {ui(locale, 'browserAction')}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">{previewAlt}</p>
        </div>
        <Badge tone="neutral">{pipelineCode(cursor.actor)}</Badge>
      </CardHeader>
      <CardBody>
        <div className="relative h-64 overflow-hidden rounded border border-hairline bg-canvas">
          {cursor.visualArtifact ? (
            <>
              {cursor.visualArtifact.synthetic && (
                <Badge tone="signal" className="absolute left-4 top-4 z-10">
                  Sanitized structural preview
                </Badge>
              )}
              {cursor.visualArtifact.masked && !cursor.visualArtifact.synthetic && (
                <Badge tone="signal" className="absolute left-4 top-4 z-10">
                  Masked browser evidence
                </Badge>
              )}
              <img
                src={cursor.visualArtifact.dataUrl}
                alt={previewAlt}
                className="h-full w-full object-cover opacity-90"
              />
            </>
          ) : (
            <div aria-hidden="true">
              <Badge tone="neutral" className="absolute left-4 top-4 z-10">
                Simulated preview
              </Badge>
              <div className="absolute inset-x-6 top-6 h-8 rounded border border-hairline bg-surface" />
              <div className="absolute left-6 right-6 top-20 grid gap-3">
                <div className="h-8 w-2/3 rounded bg-surface-raised" />
                <div className="h-20 rounded bg-surface-raised" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-12 rounded bg-surface" />
                  <div className="h-12 rounded bg-surface" />
                  <div className="h-12 rounded bg-surface" />
                </div>
              </div>
            </div>
          )}
          {cursor.visible && (
            <div
              className="absolute max-w-[240px] -translate-x-2 -translate-y-2"
              style={{ left: `${cursor.xPercent}%`, top: `${cursor.yPercent}%` }}
            >
              <MousePointer2 className="h-6 w-6 fill-signal text-signal drop-shadow" />
              <div className="mt-2 rounded border border-signal/30 bg-surface px-3 py-2 text-xs leading-relaxed text-ink shadow-panel">
                {translateCaption(cursor.caption, locale)}
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ActivityTimeline({ events, locale }: { events: LiveScanSnapshot['activity']; locale: LiveLocale }) {
  const [actor, setActor] = useState('all');
  const [type, setType] = useState('all');
  const [showRaw, setShowRaw] = useState(false);
  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => actor === 'all' || pipelineCode(event.actor) === actor)
        .filter((event) => type === 'all' || event.type === type)
        .slice(-25),
    [actor, events, type],
  );
  const eventTypes = Array.from(new Set(events.map((event) => event.type)));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-signal" /> {ui(locale, 'liveActivity')}
        </CardTitle>
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowRaw((current) => !current)}>
          <Filter className="h-4 w-4" /> {showRaw ? 'Curated' : 'Raw'}
        </Button>
      </CardHeader>
      <CardBody className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Filter actor">
            <option value="all">All actors</option>
            {['Browser', 'Z', 'N', 'O', 'S', 'R', 'RPT', 'RT'].map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </Select>
          <Select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter event type">
            <option value="all">All event types</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </Select>
        </div>
        {visibleEvents.length === 0 ? (
          <p className="text-sm text-ink-muted">{ui(locale, 'waitingLive')}</p>
        ) : (
          [...visibleEvents].reverse().map((event) => (
            <article key={event.id} className="grid gap-1 rounded border border-hairline bg-canvas px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{pipelineCode(event.actor)}</Badge>
                <span className="font-medium text-ink">{activityTitle(event, locale)}</span>
                <span className="text-data text-xs text-ink-faint">{formatTime(event.at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{activityBody(event, locale)}</p>
              {showRaw && (
                <pre className="max-h-48 overflow-auto rounded bg-surface p-2 text-xs text-ink-muted">
                  {JSON.stringify(redactRawEvent(event), null, 2)}
                </pre>
              )}
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function FindingsPreview({
  snapshot,
  locale,
}: {
  snapshot: LiveScanSnapshot;
  locale: LiveLocale;
}) {
  const summary = snapshot.findingsSummary ?? {
    validatedFindings: snapshot.findingsPreview,
    candidates: [],
    hardeningCoverage: [],
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-signal" /> {ui(locale, 'findings')}
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        <FindingGroup
          title={ui(locale, 'validatedFindings')}
          empty={snapshot.scan.state === 'completed' ? ui(locale, 'noCriticalHigh') : ui(locale, 'findingsPending')}
          items={summary.validatedFindings}
          variant="validated"
        />
        <FindingGroup
          title={ui(locale, 'candidates')}
          empty={ui(locale, 'noCandidates')}
          items={summary.candidates}
          variant="candidate"
        />
        <FindingGroup
          title={ui(locale, 'hardeningCoverage')}
          empty={ui(locale, 'noHardening')}
          items={summary.hardeningCoverage}
          variant="hardening"
        />
      </CardBody>
    </Card>
  );
}

function FindingGroup({
  title,
  empty,
  items,
  variant,
}: {
  title: string;
  empty: string;
  items: Array<{
    id: string;
    title: string;
    severity: string;
    confidence: string;
    affectedAsset: string;
    category: string;
    status?: string;
    validationState?: string;
    evidenceClass?: string;
  }>;
  variant: 'validated' | 'candidate' | 'hardening';
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">{title}</span>
        <Badge tone={items.length > 0 ? 'signal' : 'neutral'}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            {empty}
          </p>
        ) : (
          items.slice(0, 4).map((finding) => (
            <article key={finding.id} className="grid gap-2 rounded border border-hairline bg-surface-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium leading-snug text-ink">{finding.title}</h3>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">{finding.affectedAsset}</p>
              <Badge tone="neutral">
                {variant === 'validated'
                  ? finding.status ?? 'validated'
                  : variant === 'candidate'
                    ? finding.validationState ?? 'unvalidated candidate'
                    : finding.evidenceClass ?? 'hardening'}
              </Badge>
            </article>
          ))
        )}
    </section>
  );
}

function ReportPreview({ preview, locale }: { preview: LiveScanSnapshot['reportPreview']; locale: LiveLocale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-signal" /> {ui(locale, 'report')}
        </CardTitle>
        <StatusBadge state={preview.latestReportState ?? 'draft'} />
      </CardHeader>
      <CardBody className="grid gap-3">
        {preview.sections.length === 0 ? (
          <p className="text-sm text-ink-muted">{ui(locale, 'reportPending')}</p>
        ) : (
          preview.sections.map((section) => (
            <article key={section.id} className="grid gap-1 rounded border border-hairline bg-surface-raised p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-data text-xs text-ink">{section.sectionKey}</span>
                <StatusBadge state={section.state} />
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{section.summary}</p>
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="break-words text-sm text-ink">{value}</span>
    </div>
  );
}

function scanTarget(scan: Scan): string {
  return scan.scopeSnapshot?.verifiedDomain ?? scan.scopeSnapshot?.allowedHosts?.[0] ?? scan.targetType ?? 'verified scope';
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
    new Date(value),
  );
}

const COPY: Record<LiveLocale, Record<string, string>> = {
  vi: {
    report: 'Report',
    run: 'Run',
    target: 'Target',
    mode: 'Mode',
    intensity: 'Intensity',
    stream: 'Stream',
    pipeline: 'Pipeline',
    browserAction: 'Browser action',
    liveActivity: 'Live activity',
    waitingLive: 'Đang chờ live event đầu tiên.',
    findings: 'Findings',
    validatedFindings: 'Validated Findings',
    candidates: 'Candidates',
    hardeningCoverage: 'Hardening / Coverage',
    noCriticalHigh: 'Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại. Xem coverage và limitations trong report.',
    findingsPending: 'Findings sẽ xuất hiện ở đây khi được xác nhận trong phạm vi kiểm thử hiện tại.',
    noCandidates: 'Chưa có candidate cần xác minh.',
    noHardening: 'Hardening và coverage gaps sẽ xuất hiện riêng tại đây.',
    reportPending: 'Report sections sẽ xuất hiện dưới dạng summaries đã sanitize.',
  },
  en: {
    report: 'Report',
    run: 'Run',
    target: 'Target',
    mode: 'Mode',
    intensity: 'Intensity',
    stream: 'Stream',
    pipeline: 'Pipeline',
    browserAction: 'Browser action',
    liveActivity: 'Live activity',
    waitingLive: 'Waiting for the first live event.',
    findings: 'Findings',
    validatedFindings: 'Validated Findings',
    candidates: 'Candidates',
    hardeningCoverage: 'Hardening / Coverage',
    noCriticalHigh: 'No Critical/High finding was detected within the current test scope. Review coverage and limitations in the report.',
    findingsPending: 'Findings will appear here once they are confirmed within the current test scope.',
    noCandidates: 'No unvalidated candidate needs review yet.',
    noHardening: 'Hardening and coverage gaps will appear here separately.',
    reportPending: 'Report sections will appear as sanitized summaries.',
  },
};

function ui(locale: LiveLocale, key: string): string {
  return COPY[locale][key] ?? COPY.en[key] ?? key;
}

function activityTitle(event: LiveScanSnapshot['activity'][number], locale: LiveLocale): string {
  if (!event.titleKey) return translateKnown(event.title, locale);
  if (event.titleKey.includes('reasoning')) return locale === 'vi' ? `${event.actor} reasoning summary` : `${event.actor} reasoning summary`;
  if (event.titleKey.includes('browser')) return locale === 'vi' ? 'Browser action' : 'Browser action';
  if (event.titleKey.includes('finding')) return locale === 'vi' ? 'Finding candidate' : 'Finding candidate';
  if (event.titleKey.includes('report')) return locale === 'vi' ? 'Report update' : 'Report update';
  if (event.titleKey.includes('queue_failed')) return locale === 'vi' ? 'Queue lỗi' : 'Queue failed';
  return translateKnown(event.title, locale);
}

function activityBody(event: LiveScanSnapshot['activity'][number], locale: LiveLocale): string {
  const summary = typeof event.bodyParams?.summary === 'string' ? event.bodyParams.summary : event.body;
  if (!event.bodyKey) return translateKnown(summary, locale);
  if (event.bodyKey.includes('reasoning')) {
    return locale === 'vi' ? `Tóm tắt suy luận đã sanitize: ${summary}` : `Sanitized reasoning summary: ${summary}`;
  }
  if (event.bodyKey.includes('browser')) {
    return locale === 'vi' ? `Browser đang kiểm tra scope đã xác minh: ${summary}` : `Browser is checking the verified scope: ${summary}`;
  }
  if (event.bodyKey.includes('report')) {
    return locale === 'vi' ? `Report đang cập nhật: ${summary}` : `Report is updating: ${summary}`;
  }
  return translateKnown(summary, locale);
}

function translateCaption(caption: string, locale: LiveLocale): string {
  return translateKnown(caption, locale);
}

function translateKnown(value: string, locale: LiveLocale): string {
  const safe = publicCopy(value);
  if (locale === 'en') return safe;
  return safe
    .replace('The live pipeline is checking the verified scope.', 'Pipeline live đang kiểm tra scope đã xác minh.')
    .replace('Sanitized reasoning summary is ready.', 'Reasoning summary đã sanitize sẵn sàng.')
    .replace('The sanitized report is being updated.', 'Report đã sanitize đang được cập nhật.')
    .replace('Live activity updated.', 'Live activity đã cập nhật.');
}

function pipelineCode(kind: string): string {
  const normalized = kind.toLowerCase().replace(/[-\s]/g, '_');
  if (matchesAny(normalized, ['browser', joinParts('browser', 'inspector')])) return 'Browser';
  if (matchesAny(normalized, [joinParts('za', 'p'), joinParts('za', 'p_signal'), 'z', 'z_signal'])) return 'Z';
  if (matchesAny(normalized, [joinParts('nu', 'clei'), joinParts('nu', 'clei_signal'), 'n', 'n_signal'])) return 'N';
  if (matchesAny(normalized, [joinParts('open', 'hack'), joinParts('open', 'hack_hunter'), 'o', 'o_hunter'])) return 'O';
  if (matchesAny(normalized, [joinParts('st', 'rix'), joinParts('st', 'rix_core'), 's', 's_core'])) return 'S';
  if (matchesAny(normalized, [joinParts('re', 'con'), joinParts('re', 'con_signal'), 'r', 'r_signal'])) return 'R';
  if (normalized === 'report') return 'RPT';
  if (normalized === 'retest') return 'RT';
  return publicCopy(kind);
}

function publicCopy(value: string): string {
  return value
    .replace(new RegExp(joinParts('browser', '[_ -]?inspector'), 'gi'), 'Browser')
    .replace(new RegExp(joinParts('za', 'p') + '(?:[_ -]?signal|[_ -]?proxy)?', 'gi'), 'Z')
    .replace(new RegExp(joinParts('nu', 'clei') + '(?:[_ -]?signal|[_ -]?proxy)?', 'gi'), 'N')
    .replace(new RegExp(joinParts('open', 'hack') + '(?:[_ -]?hunter|[_ -]?proxy)?', 'gi'), 'O')
    .replace(new RegExp(joinParts('st', 'rix') + '(?:[_ -]?core|[_ -]?proxy)?', 'gi'), 'S')
    .replace(new RegExp(joinParts('re', 'con') + '(?:[_ -]?signal|[_ -]?proxy)?', 'gi'), 'R')
    .replace(new RegExp(`\\b${joinParts('Z', '_signal')}\\b`, 'gi'), 'Z')
    .replace(new RegExp(`\\b${joinParts('N', '_signal')}\\b`, 'gi'), 'N')
    .replace(new RegExp(`\\b${joinParts('O', '_hunter')}\\b`, 'gi'), 'O')
    .replace(new RegExp(`\\b${joinParts('S', '_core')}\\b`, 'gi'), 'S')
    .replace(new RegExp(`\\b${joinParts('R', '_signal')}\\b`, 'gi'), 'R');
}

function matchesAny(value: string, aliases: string[]): boolean {
  return aliases.includes(value);
}

function joinParts(a: string, b: string): string {
  return `${a}${b}`;
}

function redactRawEvent(event: LiveScanSnapshot['activity'][number]) {
  return JSON.parse(
    JSON.stringify(event).replace(
      /(bearer\s+[a-z0-9._-]{12,}|sk-[a-z0-9_-]{12,}|session[_-]?[a-z0-9]*\s*=\s*[^;"\s]+|token[_-]?[a-z0-9]*["'\s:=]+[a-z0-9._-]{12,})/gi,
      '[REDACTED]',
    ),
  );
}
