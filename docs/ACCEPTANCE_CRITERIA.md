# Acceptance criteria

## #13: trustworthy self-host scan contract

- Dashboard and `openhunterai` CLI use `POST /v1/scans/preflight` and `POST /v1/scans` with `scan_request_v2`; project-scoped routes adapt into the same service. Standard is the UI default. Quick/Standard/Deep remain labeled as selected; no silent downgrade.
- A public HTTPS URL with a path defaults to that path and descendants. Explicit host-wide scope must be selected and reconfirmed. Private/local/metadata targets, out-of-scope paths/hosts and redirects are rejected at API and worker boundaries.
- Preflight reports planned workers and installed/configured/reachable/executable states. If Standard lacks a worker, the gap appears before creation and in `report_v2`, and must be acknowledged. Deep blocks on missing mandatory safety/runtime prerequisites.
- No commercial tier, scan mode, finding cap, retest quota/cooldown or use-case entitlement influences API, plan, LLM, worker event, DB or report. Resource/rate limits and approval gates still apply. LLM or worker budget exhaustion is a limitation/coverage gap.
- Worker crash, timeout, malformed output and unavailability never generate findings or clean coverage. Duplicate callback/retry does not duplicate candidate, step, activity event, finding or final report.
- Only candidates with a separate valid independent decision enter report findings; raw worker claims stay at `needs_more_evidence`. Two independently validated test fixtures appear as two findings. A retest without a real replay executor returns `RETEST_UNSUPPORTED`, with no fake `fixed` state.
- Backup and restore are verified before dropping commercial tables/columns. Migration preserves project, scan, candidate, finding and report IDs and sanitized evidence, converts historical reports to `report_v2`/`legacy_unverified`, and is tested on a clone before local stack.
- CLI and dashboard smoke produce the same request/plan/report type on one authorized host. Smoke does not satisfy exploit-recall acceptance.
- System-wide reasoning routes show the CLI or provider, model, and reasoning level before a scan. The scan stores that copy. A route probe or a dashboard preview is not evidence that a coding CLI completed a prompt, and it is not evidence for XSS, SQLi, or IDOR.

## Assessment workspace and OpenShield handoff

- One local application workspace at `/` exposes scope/preflight, scans, approvals, findings, finding-scoped manual retest, report downloads and reasoning settings. Legacy detail links select the same workspace; desktop/mobile flows preserve authority and gap acknowledgments without horizontal overflow.
- GitHub Pages publishes a separate static project landing. Relative assets work under `/OpenHunterAI/`; the page does not load dashboard code or call API/auth endpoints. The normal local frontend/Docker build retains the operational workspace.
- OpenHunter owns assessment and verification. Incident queues, containment, operational response and recovery belong to OpenShield; finding fix guidance does not execute those actions.
- Each research method records its source edition, prerequisites, safe scope, existing hunter/use-case mapping, deterministic oracle, matched negative and independent-validation requirements. Research-only records have no accepted executor and cannot enable a runtime scenario.
- Finalized JSON exports contain the bounded sanitized `report_v2` snapshot and an external canonical SHA-256 digest. Mutable latest statuses are outside that digest; draft reports cannot be exported as finalized evidence.
- Handoff records scope/authority context, producer and snapshot identity, scan window, validation basis, evidence references, coverage, remediation context and retest limitations. Missing artifact lineage or replay proof remains explicitly unknown. Scope metadata and the report digest grant no downstream authority.
- OpenShield intake is manual until a real importer is implemented and accepted. Imported prose and URLs remain untrusted data, never tool instructions. No credential transfer or autonomous response is introduced.

## Later release gates

- #14 verifies artifact provenance, baseline/exploit replay, demonstrated impact and negative controls; High/Critical require stronger independent evidence. Retest returns fixed/still reproducible/inconclusive with attempt evidence.
- #22 runs an intentionally vulnerable, isolated target with matched negative controls and reports recall by class, false-positive rate, evidence completeness, coverage, time and cost. A new user can self-host, scan, inspect a real report, fix and retest without touching DB/NATS internals.

The PolyForm Noncommercial license and mandatory security guardrails remain in force.
