/**
 * @x-hunter/db — re-exports the generated Prisma client and a tiny client
 * factory that wires connection pooling and logging.
 *
 * Run `pnpm db:generate` after schema changes so this file resolves.
 */

import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
    });
  }
  return _client;
}

export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
