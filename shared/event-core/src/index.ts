import { connect, JSONCodec, RetentionPolicy, StorageType, type NatsConnection, type Subscription } from 'nats';

export interface EventEnvelope<T = unknown> {
  id: string;
  subject: string;
  occurredAt: string;
  payload: T;
}

let connection: NatsConnection | null = null;
let streamReady = false;
const codec = JSONCodec<EventEnvelope>();
const STREAM_NAME = 'OPENHUNTER';
const STREAM_SUBJECTS = ['scan.>', 'worker.>', 'retest.>', 'report.>'];

export async function publishEvent<T>(subject: string, payload: T): Promise<void> {
  if (process.env.EVENTS_DISABLED === 'true') return;
  const nc = await getConnection();
  if (!nc) return;
  await ensureStream(nc);
  const js = nc.jetstream();
  await withTimeout(
    js.publish(
      subject,
      codec.encode({
        id: randomId(),
        subject,
        occurredAt: new Date().toISOString(),
        payload,
      }),
    ),
    timeoutMs('NATS_PUBLISH_TIMEOUT_MS', 3_000),
    `Timed out publishing ${subject}`,
  );
}

async function getConnection(): Promise<NatsConnection | null> {
  if (connection) return connection;
  const servers = process.env.NATS_URL || 'nats://localhost:4222';
  try {
    connection = await connect({
      servers,
      name: process.env.SERVICE_NAME || 'openhunter-ts',
      timeout: timeoutMs('NATS_CONNECT_TIMEOUT_MS', 3_000),
    });
    return connection;
  } catch (error) {
    connection = null;
    if (process.env.NODE_ENV !== 'production') return null;
    const detail = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Unable to connect to NATS at ${servers}: ${detail}`);
  }
}

async function ensureStream(nc: NatsConnection): Promise<void> {
  if (streamReady) return;
  const jsm = await nc.jetstreamManager();
  try {
    await jsm.streams.info(STREAM_NAME);
  } catch {
    await jsm.streams.add({
      name: STREAM_NAME,
      subjects: STREAM_SUBJECTS,
      retention: RetentionPolicy.Workqueue,
      storage: StorageType.File,
      max_age: 24 * 60 * 60 * 1_000_000_000,
    });
  }
  streamReady = true;
}

/**
 * Subscribes to a subject (NATS wildcards allowed, e.g. `report.scan_1.>`) and
 * invokes onEvent for each decoded envelope. Returns an unsubscribe function.
 * Returns a no-op unsubscribe if NATS is unavailable in non-production so the
 * caller (e.g. an SSE endpoint) degrades gracefully instead of throwing.
 */
export async function subscribeEvent<T = unknown>(
  subject: string,
  onEvent: (envelope: EventEnvelope<T>) => void,
): Promise<() => void> {
  let nc: NatsConnection | null = null;
  try {
    nc = await getConnection();
  } catch {
    return () => {};
  }
  if (!nc) return () => {};
  const sub: Subscription = nc.subscribe(subject);
  (async () => {
    for await (const msg of sub) {
      try {
        onEvent(codec.decode(msg.data) as EventEnvelope<T>);
      } catch {
        // Ignore undecodable messages; never crash the subscriber loop.
      }
    }
  })().catch(() => {});
  return () => sub.unsubscribe();
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function timeoutMs(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? '');
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
