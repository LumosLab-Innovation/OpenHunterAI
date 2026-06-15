/**
 * @x-hunter/db — re-exports the generated Prisma client and a tiny client
 * factory that wires connection pooling and logging.
 *
 * The Prisma client is generated to ../generated/client (see schema.prisma
 * `output`). Importing from that fixed in-package path means every workspace
 * service resolves the SAME generated client, instead of pnpm's per-package
 * isolated @prisma/client copies (only one of which gets generated).
 *
 * Run `pnpm generate` after schema changes so this path resolves.
 */

import * as pkg from '../generated/client/index.js';
import type { PrismaClient as PrismaClientType } from '../generated/client/index.js';

// The generated client is CommonJS with named exports. Use namespace import so
// this resolves whether @x-hunter/db is loaded via ESM (internal-api) or CJS
// require (findings/reporting use createRequire). A default-import yields
// undefined under CJS interop, which crashes destructuring.
const PrismaClient = (pkg as any).PrismaClient;
const Prisma = (pkg as any).Prisma;

let _client: PrismaClientType | null = null;

export function getPrisma(): PrismaClientType {
  if (_client) return _client;
  const client: PrismaClientType = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  });
  _client = client;
  return client;
}

export type { PrismaClient } from '../generated/client/index.js';
export { Prisma };
