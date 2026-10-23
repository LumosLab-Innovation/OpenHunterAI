#13 — one self-host scan and report contract

## Outcome

CLI and dashboard send `scan_request_v2` to the same API service and receive `report_v2`. Standard is the default. No paid workspace, Free Hunter gate, finding cap, retest quota/cooldown or billing schema survives. Worker failures and unvalidated candidates remain visible as gaps/next checks, not clean results or findings.

## Dependencies and boundaries

Worktree and database data must be preserved. Before destructive migration: full `pg_dump`, separate report/commerce backup, checksum and successful restore to a temporary DB. The PolyForm Noncommercial license is unchanged. #14 owns independent replay/retest; #22 owns the ground-truth vulnerable target and efficacy benchmark. #13 does not claim real vulnerability recall.

## Implementation slices

1. `POST /v1/scans/preflight` and `POST /v1/scans`: public HTTPS URL/path, profile Quick/Standard/Deep, explicit authorization, optional exact-host/path scope and exclusions. URL path defaults to its subtree. Project routes adapt into the same service. Profile maps to `safe_discovery`, `controlled_attack_simulation`, `aggressive_staging`. Authorization/scope snapshot is stored before queue publication.
2. Preflight returns deterministic plan, safety/resource ceilings, and installed/configured/reachable/executable for every planned runtime. Standard may continue with missing optional worker only after explicit gap acceptance; Deep blocks when mandatory safety/runtime prerequisites fail. No silent downgrade.
3. Remove tier/mode/quota enforcement in scan, LLM gateway, findings, report and retest. Keep bounded resource budgets and policy gates. A failed budget/worker must create a limitation/coverage gap.
4. Migrate report/DB data: preserve IDs and sanitized evidence, strip commercial JSON, move old claims into `historicalFindings`/`legacy_unverified`, and drop payment/subscription/credit/webhook tables plus commercial enum/columns. Regenerate Prisma. Draft/final reports and exports use `report_v2`.
5. Finalize only after worker and triage terminal states. Worker claims remain `needs_more_evidence` until #14 independently verifies artifacts. Retest without a real executor returns `RETEST_UNSUPPORTED`; it never claims fixed.
6. Update CLI/dashboard, schema, docs, runbook and linked #12/#14/#22 issue contracts. Keep PolyForm unchanged.

## Negative cases and acceptance artifacts

- URL with path, explicit host-wide expansion, exclusions, private/local/metadata target, redirect outside scope; changing profile/scope needs renewed consent.
- Unreachable/uninstalled/malformed/timed-out worker, LLM exhaustion, duplicate callback, cancel/restart. No fake finding, clean coverage or duplicate report.
- Seed two separately validated decisions and verify two report findings; ordinary worker-only candidates stay outside findings. Repeat unsupported manual retest without a quota response.
- Compare counts and ID digests for project, authorization, scan, candidate, finding, step and report on restored pre/post-migration clones and local stack. Historical report must remain readable but not verified.
- Docker smoke with CLI and dashboard against one authorized public HTTPS host: same plan/report type, Standard gap shown before and after a missing worker. Save sanitized request/response, runtime status, logs and report. This is not an XSS/SQLi/IDOR benchmark.

## Local implementation check (20/09/2026)

- Full and report/commerce backups were checksummed outside the repo and restored into a temporary DB. `prisma migrate deploy` passed on the restored copy and the local stack. Project, authorization, scan, candidate, finding, step and report ID digests matched before/after; 24 historical reports became `report_v2`, and commercial tables were removed.
- Standard preflight showed `strix:RUNTIME_NOT_INSTALLED`; CLI and dashboard each accepted that gap explicitly and produced a final `coverage_only` report. The final rebuilt stack reproduced this via API: 0 validated findings, 12 candidates pending independent review, `S:TOOL_UNAVAILABLE` in the report. A browser screenshot and sanitized output are local artifacts pending PR attachment.
- Unit/contract tests cover path scope, readiness/gap acceptance, callback idempotency, two independently validated findings in final report content, archive access and repeated `RETEST_UNSUPPORTED` without fake records.

**Still open:** review/merge the code and attach reproducible smoke artifacts. Browser CDP event parsing warning is tracked in #22; it must not be mistaken for complete browser/network coverage. Independent replay/retest (#14) and vulnerability recall benchmark (#22) remain separate gates. Do not close #13 based on a zero-finding smoke alone.
