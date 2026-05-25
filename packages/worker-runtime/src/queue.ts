/**
 * BullMQ queue + connection helpers. Centralizes the Redis connection so the
 * worker processes and the API share queue configuration.
 */

import { ConnectionOptions, Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export const QUEUE_SCAN = 'scan';
export const QUEUE_RETEST = 'retest';
export const QUEUE_REPORT = 'report';

let _connection: IORedis | null = null;
let _connectionOptions: ConnectionOptions | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _connection = new IORedis(url, { maxRetriesPerRequest: null });
    _connectionOptions = { connection: _connection };
  }
  return _connection;
}

export function getQueueConnectionOptions(): { connection: IORedis } {
  getRedisConnection();
  return _connectionOptions as { connection: IORedis };
}

const queues = new Map<string, Queue>();

export function getQueue<T = unknown>(name: string): Queue<T> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, getQueueConnectionOptions());
    queues.set(name, q);
  }
  return q as Queue<T>;
}

export function getQueueEvents(name: string): QueueEvents {
  return new QueueEvents(name, getQueueConnectionOptions());
}

/** Job payload shapes shared by API + workers. */
export interface ScanJobPayload {
  scanJobId: string;
}

export interface RetestJobPayload {
  retestRunId: string;
}
