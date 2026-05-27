# @x-hunter/db

Prisma schema and client for the OpenHunter Workspace.

## Layout

- `prisma/schema.prisma` — single source of truth for the v1 data model (see
  `ARCHITECTURE.md` §7.1).
- `src/index.ts` — singleton-style Prisma client factory.
- `src/seed.ts` — local dev seed.

## Commands

```bash
pnpm db:generate     # generate the Prisma client (after schema changes)
pnpm db:migrate      # apply migrations to DATABASE_URL (deploy mode)
pnpm db:seed         # seed demo org / user / project
pnpm run migrate:dev # create a new migration locally
pnpm run studio      # open Prisma Studio
```

## Schema notes

- All credentials and personal secrets are AES-256-GCM ciphertext (`credentialCipher`).
- The schema does **not** store raw passwords, cookies, or tokens anywhere.
- `evidence_items.sanitized` defaults to `true` — workers must run the
  evidence sanitizer before insert.
- `audit_logs.detail` is always sanitized JSON.
