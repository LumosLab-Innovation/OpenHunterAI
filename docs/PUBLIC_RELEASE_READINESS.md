# Public release status

Development snapshot reviewed **24 October 2026**. This file records remaining
acceptance work; it is not evidence that a live deployment or pentest passed.

## Current product boundary

One assessment workspace and one `scan_request_v2` → `report_v2` pipeline.
OpenHunter owns authorized pentest research, assessment evidence and manual
verification retest. OpenShield owns incident/situation handling and response.
Research methods remain separate from accepted executors.

## Present in source

- One-page target/scope/preflight/run/findings/approval/report workflow, with
  account/model settings in disclosures and compatibility links to selected context.
- Explicit public-host authority, deterministic plan, resource limits and
  sanitizer/policy gates. Worker failures remain coverage gaps.
- Native passive surface, pinned curated Nuclei/ZAP adapters and optional governed
  reasoning runtimes; actual availability still requires deployment verification.
- Canonical sanitized report_v2, historical unverified claims, bounded exports
  and a finalized JSON snapshot/digest for manual OpenShield intake.
- Source-linked method catalog, per-method AI/tool/validator responsibilities,
  optional REA local artifact analysis and offline country/framework research.

Source presence does not establish completed runtime acceptance.

## Open gaps

| Gate | Evidence still needed |
| --- | --- |
| Existing-data migration | Verified pg_dump and successful restore before the v2 commercial-table removal migration is applied. No production data migration is established here. |
| Independent vulnerability replay | Real artifact/provenance verification, matched negative controls and replay for each supported class. Metadata-only triage must remain needs_more_evidence. |
| Pentest efficacy | Authorized positive/fixed controls, recall/false-positive measures, evidence completeness, time/cost and supported manual retest. Empty reports or model calls cannot satisfy this. |
| New research methods | Every one of the nine catalog records currently has no accepted executor. Lab-only methods remain blocked from public scans, including Deep. |
| Full local runtime | Docker/service/queue/restart and optional browser/session/runtime checks on the actual deployed revision. Browser fixture checks are UI evidence only. |
| OpenShield intake | Downstream importer is specification-only at the reviewed commit. No live interoperability, containment, remediation or recovery action was performed. |
| Evidence lineage | Current reports expose reference-only provenance gaps. Capture time, collector, artifact hashes and sanitizer lineage must be established by future artifact verification, not fabricated by the exporter. |
| PDF fidelity | The existing simple PDF renderer has pagination/Unicode limits; use JSON/DOCX/HTML for complete structured collaboration until its renderer is upgraded. |
| External contracts | OpenAPI/AsyncAPI inventories and deployment overlays require explicit reconciliation against the chosen runtime. |

Closing an issue as not planned does not satisfy a release gate. Keep the
[acceptance criteria](ACCEPTANCE_CRITERIA.md) and
[production checklist](PRODUCTION_READINESS.md) as required verification.
