/**
 * BullMQ queue + connection helpers. Centralizes the Redis connection so the
 * worker processes and the API share queue configuration.
 */

import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

export const QUEUE_SCAN = 'scan';
export const QUEUE_RETEST = 'retest';
export const QUEUE_REPORT = 'report';

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_connection) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    _connection = new Redis(url, { maxRetriesPerRequest: null });
  }
  return _connection;
}

export function getQueueConnectionOptions(): { connection: Redis } {
  return { connection: getRedisConnection() };
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
