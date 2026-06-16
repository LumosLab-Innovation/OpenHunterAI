# ADR: Managed Scan Runtime Target

## Status

Proposed after hybrid pipeline hardening.

## Context

The current v1 runtime is hybrid: Cloudflare Pages serves the frontend, Cloud Run serves the public API, and the scan bus/workers/browser runtime run on the VM. This is acceptable for the immediate v1 hardening phase, but it creates operational drift between managed API services and VM-hosted workers.

## Decision

Keep the current hybrid deployment until the scan pipeline passes end-to-end smoke tests. The target architecture after that is:

```text
Cloudflare Pages
  -> Cloud Run public-api
  -> Cloud Run internal services
  -> Pub/Sub scan/work/report topics
  -> Cloud Run jobs/services for Browser, Z, N, O, S, reporting, findings
  -> Cloud SQL, Secret Manager, Artifact Registry, Cloud Logging
```

## Standards

- API boundaries use typed errors, cursor pagination, and resumable SSE where streaming is required.
- Workers remain bounded by timeout, retry limit, structured logs, and explicit coverage gaps on tool failure.
- Browser artifacts are sanitized thumbnails with TTL only; no raw HAR, raw request/response, cookie, token, or browser storage is persisted.
- Passive signals and hardening warnings do not become findings without an evidence gate.

## Migration Gates

- Local compose smoke: domain/auth/scan -> bus -> Browser/Z/N/O/S -> candidates -> promotion gate -> report.
- Staging smoke on verified target with `controlled_attack_simulation`.
- Cloud Logging dashboards for queue publish latency, worker completion, tool unavailable, report finalized, and scan cancelled.
- Rollback path documented for public-api and workers before replacing VM NATS.
