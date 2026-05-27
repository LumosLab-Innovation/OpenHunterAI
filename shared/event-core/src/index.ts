import { connect, JSONCodec, type NatsConnection } from 'nats';

export interface EventEnvelope<T = unknown> {
  id: string;
  subject: string;
  occurredAt: string;
  payload: T;
}

let connection: NatsConnection | null = null;
const codec = JSONCodec<EventEnvelope>();

export async function publishEvent<T>(subject: string, payload: T): Promise<void> {
  if (process.env.EVENTS_DISABLED === 'true') return;
  const nc = await getConnection();
  if (!nc) return;
  nc.publish(
    subject,
    codec.encode({
      id: randomId(),
      subject,
      occurredAt: new Date().toISOString(),
      payload,
    }),
  );
}

async function getConnection(): Promise<NatsConnection | null> {
  if (connection) return connection;
  const servers = process.env.NATS_URL || 'nats://localhost:4222';
  try {
    connection = await connect({ servers, name: process.env.SERVICE_NAME || 'openhunter-ts' });
    return connection;
  } catch {
    if (process.env.NODE_ENV !== 'production') return null;
    throw new Error(`Unable to connect to NATS at ${servers}`);
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
