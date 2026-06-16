import type { Request, Response } from 'express';
import { subscribeEvent } from '@openhunter/event-core';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ReportsService } from '../reports/reports.service.js';
import { LiveScanService } from './live-scan.service.js';
import { ScansService } from './scans.service.js';

const service = new ScansService();
const reports = new ReportsService();
const liveScans = new LiveScanService();

export async function listScans(req: Request, res: Response) {
  const result = await service.list(currentUser(req).orgId, req.query);
  res.json({ scans: result.items.map(service.toPublicScan), nextPageToken: result.nextPageToken });
}

export async function getScan(req: Request, res: Response) {
  const scan = await service.get(req.params.id!, currentUser(req).orgId);
  if (!scan) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ scan: service.toPublicScan(scan) });
}

export async function createScan(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({ scan: service.toPublicScan(await service.create(req.params.id!, user.orgId, user.userId, req.body)) });
}

export async function cancelScan(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({ scan: service.toPublicScan(await service.cancel(req.params.id!, user.orgId, user.userId)) });
}

export async function hideScan(req: Request, res: Response) {
  const user = currentUser(req);
  res.json({ scan: service.toPublicScan(await service.hide(req.params.id!, user.orgId, user.userId)) });
}

export async function getReportDraft(req: Request, res: Response) {
  const draft = await reports.getDraft(req.params.id!, currentUser(req).orgId);
  if (!draft) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.json({ draft });
}

export async function streamReportEvents(req: Request, res: Response) {
  const user = currentUser(req);
  const scanId = req.params.id!;
  const existingDraft = await reports.getDraft(scanId, user.orgId);
  if (!existingDraft) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastUpdatedAt: string | null = null;
  let eventId = 0;
  let closed = false;
  const cleanups: Array<() => void> = [];

  function shutdown() {
    if (closed) return;
    closed = true;
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    res.end();
  }
  req.on('close', shutdown);

  // Sends the current draft snapshot, deduped by updatedAt. Returns true when a
  // final report exists so the caller can close the stream.
  async function sendSnapshot(eventName = 'draft_snapshot'): Promise<{ sent: boolean; final: boolean }> {
    const draft = await reports.getDraft(scanId, user.orgId);
    if (!draft) {
      res.write(`event: section_failed\ndata: ${JSON.stringify({ code: 'NOT_FOUND' })}\n\n`);
      return { sent: false, final: false };
    }
    const updated = draft.updatedAt ?? '';
    if (eventName !== 'draft_snapshot' && updated === lastUpdatedAt) return { sent: false, final: false };
    lastUpdatedAt = updated;
    const hasFinalReport = draft.latestReportState === 'final';
    eventId += 1;
    res.write(`id: ${eventId}\nevent: ${hasFinalReport ? 'report_finalized' : eventName}\ndata: ${JSON.stringify(draft)}\n\n`);
    return { sent: true, final: hasFinalReport };
  }

  // Initial snapshot. If the report is already final, close immediately.
  const initial = await sendSnapshot();
  if (initial.final) {
    shutdown();
    return;
  }

  // Event-driven: push a fresh snapshot whenever the reporting service emits a
  // draft/finalize event for this scan. Org-scoping is enforced by getDraft.
  const unsubscribe = await subscribeEvent(`report.${scanId}.>`, () => {
    if (closed) return;
    void sendSnapshot('section_ready').then((r) => {
      if (r.final) shutdown();
    });
  });
  cleanups.push(unsubscribe);

  // Heartbeat so proxies don't drop an idle connection (every 15s).
  const heartbeat = setInterval(() => {
    if (closed) return;
    res.write(`: ping\n\n`);
  }, 15_000);
  cleanups.push(() => clearInterval(heartbeat));

  // Safety-net poll in case an event is missed (every 10s, far less chatty than
  // the old 2s poll), plus a hard max-duration cap so a stream never lives
  // forever.
  const poll = setInterval(() => {
    if (closed) return;
    void sendSnapshot('section_ready').then((r) => {
      if (r.final) shutdown();
    });
  }, 10_000);
  cleanups.push(() => clearInterval(poll));

  const maxDuration = setTimeout(shutdown, 30 * 60_000);
  cleanups.push(() => clearTimeout(maxDuration));
}

export async function streamLiveEvents(req: Request, res: Response) {
  const user = currentUser(req);
  const scanId = req.params.id!;
  const initialSnapshot = await liveScans.getSnapshot(scanId, user.orgId);
  if (!initialSnapshot) {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let eventId = 0;
  let closed = false;
  let lastSignature = '';
  let degraded: { events: boolean; reason: string } | undefined;
  const cleanups: Array<() => void> = [];

  function shutdown() {
    if (closed) return;
    closed = true;
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    res.end();
  }
  req.on('close', shutdown);

  async function sendSnapshot(eventName = 'scan_snapshot', force = false) {
    const snapshot = await liveScans.getSnapshot(scanId, user.orgId, degraded, {
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      actor: typeof req.query.actor === 'string' ? req.query.actor : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
      view: req.query.view === 'raw' ? 'raw' : 'curated',
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
    });
    if (!snapshot) {
      res.write(`event: stream_degraded\ndata: ${JSON.stringify({ code: 'NOT_FOUND' })}\n\n`);
      return;
    }
    const signature = JSON.stringify({
      updatedAt: snapshot.scan.updatedAt,
      scanState: snapshot.scan.state,
      workers: snapshot.workers.map((worker) => `${worker.code}:${worker.state}:${worker.updatedAt ?? ''}`),
      activity: snapshot.activity.map((activity) => `${activity.id}:${activity.status}`),
      reports: `${snapshot.reportPreview.latestReportId ?? ''}:${snapshot.reportPreview.latestReportState ?? ''}`,
    });
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    eventId += 1;
    res.write(`id: ${eventId}\nevent: ${eventName}\ndata: ${JSON.stringify(snapshot)}\n\n`);
  }

  await sendSnapshot('scan_snapshot', true);

  async function subscribe(subject: string) {
    try {
      const unsubscribe = await subscribeEvent(subject, (envelope) => {
        const payload = envelope.payload as { scanId?: string } | undefined;
        if (payload?.scanId && payload.scanId !== scanId) return;
        if (closed) return;
        void sendSnapshot('scan_activity', true);
      });
      cleanups.push(unsubscribe);
    } catch (error) {
      degraded = {
        events: true,
        reason: error instanceof Error ? error.message : 'Live event bus unavailable; using polling fallback.',
      };
      eventId += 1;
      res.write(`id: ${eventId}\nevent: stream_degraded\ndata: ${JSON.stringify(degraded)}\n\n`);
    }
  }

  await subscribe(`report.${scanId}.>`);
  await subscribe('worker.>');
  await subscribe('scan.>');

  const heartbeat = setInterval(() => {
    if (closed) return;
    res.write(`: ping\n\n`);
  }, 15_000);
  cleanups.push(() => clearInterval(heartbeat));

  const poll = setInterval(() => {
    if (closed) return;
    void sendSnapshot('scan_snapshot');
  }, 5_000);
  cleanups.push(() => clearInterval(poll));

  const maxDuration = setTimeout(shutdown, 30 * 60_000);
  cleanups.push(() => clearTimeout(maxDuration));
}
