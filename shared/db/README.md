# Database

Prisma schema and client for OpenHunterAI. The package identifier remains
`@x-hunter/db`; it is an internal name, not a different product.

| File | Purpose |
| --- | --- |
| [schema.prisma](prisma/schema.prisma) | Authoritative data model |
| [migrations](prisma/migrations/) | Versioned database changes |
| [src/index.ts](src/index.ts) | Prisma client factory |
| [src/seed.ts](src/seed.ts) | Explicit contributor demo seed; not run by local bootstrap |

## Commands

Run from the repository root with pnpm installed:

```bash
pnpm --dir shared/db run generate
pnpm --dir shared/db run migrate
```

`generate` creates the client; `migrate` applies existing migrations to the
configured `DATABASE_URL`. Check the target database before executing.

For a deliberately configured development database only:

```bash
pnpm --dir shared/db run migrate:dev
pnpm --dir shared/db run studio
pnpm --dir shared/db run seed
```

The local Docker bootstrap applies migrations itself and does not seed demo users.
See [local setup](../../docs/LOCAL_WORKSPACE.md); stop/restart preserves volumes.

## Sensitive data

| Field/data | Representation |
| --- | --- |
| Target test account | AES-256-GCM `credentialCipher` |
| Captured target session | Encrypted `storageStateCipher`, with lifecycle/expiry |
| Hosted password / session token | `passwordHash` / `tokenHash` |
| Candidate, finding, report, audit detail | Sanitized JSON; never raw secrets or traffic |

Encryption is not permission to expose decrypted fields in logs, prompts, reports,
or exports. Preserve the encryption key when keeping an existing database.
See [data model](../../docs/ARCHITECTURE.md#data-model) and
[security guardrails](../../docs/SECURITY_GUARDRAILS.md).
