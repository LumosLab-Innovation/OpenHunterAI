# OpenHunterAI architecture

The dashboard, CLI, and future coding-agent skill share one `scan_request_v2` → `report_v2` pipeline:

```text
Client → public API/preflight → immutable authorization + scope snapshot
       → deterministic scan plan → Postgres + NATS → orchestrator
       → browser/ZAP/Nuclei/built-in passive/Strix workers
       → sanitized candidates → independent triage → findings
       → report builder → immutable report_v2 + live UI events
```

Self-host local mode creates an internal operator automatically and exposes the unauthenticated API only through a loopback-published port. Project IDs group scans and support audit. Billing, entitlement, payment, subscription, and credit state are not runtime concepts.

## Request and plan

The canonical request carries a public HTTPS URL (path included), profile `quick | standard | deep`, explicit authority confirmation, optional exact-host/path scope, exclusions, target type, auth scope, and surface hints. If a URL has a path, its subtree is the default scope. Both client preflight and creation call the same scan service; project-scoped routes are compatibility adapters. Changing profile or scope requires fresh user confirmation.

Profile maps to existing intensity: Quick → `safe_discovery`, Standard → `controlled_attack_simulation`, Deep → `aggressive_staging`. The plan deterministically selects workers and hunter families plus resource ceilings. An LLM can rank or explain sanitized observations but cannot expand scope, select unapproved workers, create findings, or override validation. Preflight probes each planned runtime; missing Standard workers require acknowledged gaps while mandatory Deep prerequisites block creation.

## Worker lifecycle and coverage

`scan.created` includes a frozen scope snapshot and plan. The orchestrator fans out one scoped `WorkerRunPayload` per planned worker. Workers receive the exact seed URL and recheck host/path, DNS/IP and redirects before requests. `WorkerRunResult` carries `status`, signals/candidates, evidence references, attempted/completed/skipped surfaces, gaps, limitations, retryability and exact runtime provenance. Callback writes are idempotent by run ID; failed, skipped, partial and missing steps are not treated as successful coverage.

The findings service records one triage decision per candidate. A worker's severity, confidence or `validated_finding` claim is not independent proof. Until #14 implements artifact verification/replay, the metadata gate leaves worker claims at `needs_more_evidence`. The report builder finalizes only after worker and triage states are terminal; only independent validated decisions may enter `findings`.

## Persistence and reports

Postgres stores project, authorization, scan, step, candidate, triage, finding, draft and final report records. Reports are structured sanitized `report_v2` JSON; HTML/Markdown exports render from that snapshot on demand. Historical reports are migrated to `report_v2` with prior claims retained as `legacy_unverified`, never silently promoted. Sanitized finding/evidence IDs are stable across migration. Raw credentials, cookies, tokens, HAR and sensitive HTTP bodies are not stored or sent to models.

NATS carries scan/worker/retest events, not the canonical evidence store. Browser and scanner integrations are internal implementation details. The DB enum `openhack_hunter` remains for compatibility, while UI/manifest calls that worker the built-in passive surface hunter; it is not OpenHack runtime.

## Operational gates

Docker Compose self-host defaults to loopback-published UI/API/DB/NATS ports. Commercial schema removal requires a checked full backup and successful restore into a temporary DB before `prisma migrate deploy`. A completed scan with zero findings and any worker gap is inconclusive, not “clean.” Full positive/negative pentest efficacy requires #14 replay and #22 ground-truth benchmark.
