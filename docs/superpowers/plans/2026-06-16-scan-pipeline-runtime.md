# Historical scan-runtime investigation

**Archived plan — 2026-06-16.** Do not execute as a current deployment runbook.
The [original plan at 3ed0447](https://github.com/LumosLab-Innovation/OpenHunterAI/blob/3ed0447b4f6218207ff5e104b81a376b59798fae/docs/superpowers/plans/2026-06-16-scan-pipeline-runtime.md)
remains in Git, including its historical commands and observations.

## What the plan investigated

The June hosted scan request reportedly waited roughly 20 seconds before failing.
The investigation focused on Cloud Run → VM NATS connectivity, bounded queue
errors, persisted scan/draft state, worker completion, and report streaming.

Those observations were tied to that deployment and date. They do not establish
the state of today's cloud account or local stack.

| Original workstream | Current reference |
| --- | --- |
| Queue connectivity and publish failures | [Production readiness](../../PRODUCTION_READINESS.md) |
| Deterministic dispatch and fan-in | [Worker specification](../../WORKER_SPEC.md) |
| Candidate promotion and report finalization | [Architecture](../../ARCHITECTURE.md) |
| SSE/DB fallback and report-write failures | [Open gaps](../../PUBLIC_RELEASE_READINESS.md#open-gaps) |
| Authorized positive/fixed-control smoke | [Canary contract](../../OPENHUNTER_CANARY_CONTRACT.md) |
| Cloud migration | [Proposed ADR](../../adr/2026-06-16-managed-scan-runtime.md) |

## What is not carried forward as instructions

Hardcoded cloud project IDs, VM addresses, archived production URLs, destructive
rollback commands, unverified task checkboxes, and unavailable skill invocation
directives are not a current operational procedure.

Use [local setup](../../LOCAL_WORKSPACE.md) for development. Any hosted diagnosis
must first identify the actual deployment, obtain the requested authority, and
capture fresh evidence. A docs review does not authorize cloud changes or scans.
