import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, FileText, MousePointer2, Radar, Search, ShieldCheck } from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Badge, SeverityBadge, StatusBadge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Button } from '../components/ui/Button';
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
};

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
  const [snapshot, setSnapshot] = useState<LiveScanSnapshot | null>(null);
  const [live, setLive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [locale, setLocale] = useState<LiveLocale>('vi');

  useEffect(() => {
    const source = new EventSource(`${API_BASE}/v1/scans/${id}/live-events`, {
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
            <FindingsPreview findings={snapshot.findingsPreview} scanState={snapshot.scan.state} locale={locale} />
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
            {worker.summary && <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{worker.summary}</p>}
          </div>
        ))}
          </CardBody>
        </Card>
  );
}

function CursorPreview({ snapshot, locale }: { snapshot: LiveScanSnapshot; locale: LiveLocale }) {
  const cursor = snapshot.cursorPreview;
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointer2 className="h-4 w-4 text-signal" /> {ui(locale, 'browserAction')}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">{cursor.screenshotAlt}</p>
        </div>
        <Badge tone="neutral">{cursor.actor}</Badge>
      </CardHeader>
      <CardBody>
        <div className="relative h-64 overflow-hidden rounded border border-hairline bg-canvas">
          {cursor.visualArtifact ? (
            <img
              src={cursor.visualArtifact.dataUrl}
              alt={cursor.screenshotAlt}
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div aria-hidden="true">
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-signal" /> {ui(locale, 'liveActivity')}
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">{ui(locale, 'waitingLive')}</p>
        ) : (
          [...events].reverse().map((event) => (
            <article key={event.id} className="grid gap-1 border-l border-hairline pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{event.actor}</Badge>
                <span className="font-medium text-ink">{activityTitle(event, locale)}</span>
                <span className="text-data text-xs text-ink-faint">{formatTime(event.at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">{activityBody(event, locale)}</p>
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function FindingsPreview({
  findings,
  scanState,
  locale,
}: {
  findings: LiveScanSnapshot['findingsPreview'];
  scanState: string;
  locale: LiveLocale;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4 text-signal" /> {ui(locale, 'findings')}
        </CardTitle>
      </CardHeader>
      <CardBody className="grid gap-3">
        {findings.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            {scanState === 'completed'
              ? ui(locale, 'noCriticalHigh')
              : ui(locale, 'findingsPending')}
          </p>
        ) : (
          findings.map((finding) => (
            <article key={finding.id} className="grid gap-2 rounded border border-hairline bg-surface-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium leading-snug text-ink">{finding.title}</h3>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">{finding.affectedAsset}</p>
              <Badge tone="neutral">{finding.status}</Badge>
            </article>
          ))
        )}
      </CardBody>
    </Card>
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
    noCriticalHigh: 'Không phát hiện Critical/High trong phạm vi kiểm thử hiện tại. Xem coverage và limitations trong report.',
    findingsPending: 'Findings sẽ xuất hiện ở đây khi được xác nhận trong phạm vi kiểm thử hiện tại.',
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
    noCriticalHigh: 'No Critical/High finding was detected within the current test scope. Review coverage and limitations in the report.',
    findingsPending: 'Findings will appear here once they are confirmed within the current test scope.',
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
  if (locale === 'en') return value;
  return value
    .replace('The live pipeline is checking the verified scope.', 'Pipeline live đang kiểm tra scope đã xác minh.')
    .replace('Sanitized reasoning summary is ready.', 'Reasoning summary đã sanitize sẵn sàng.')
    .replace('The sanitized report is being updated.', 'Report đã sanitize đang được cập nhật.')
    .replace('Live activity updated.', 'Live activity đã cập nhật.');
}

function pipelineCode(kind: string): string {
  const normalized = kind.toLowerCase().replace(/[-\s]/g, '_');

  switch (normalized) {
    case 'browser':
    case 'browser_inspector':
      return 'browser_inspector';
    case 'zap':
    case 'zap_signal':
    case 'z':
    case 'z_signal':
      return 'Z';
    case 'nuclei':
    case 'nuclei_signal':
    case 'n':
    case 'n_signal':
      return 'N';
    case 'openhack':
    case 'openhack_hunter':
    case 'o':
    case 'o_hunter':
      return 'O';
    case 'strix':
    case 'strix_core':
    case 's':
    case 's_core':
      return 'S';
    case 'report':
      return 'RPT';
    case 'retest':
      return 'RT';
    default:
      return kind;
  }
}
