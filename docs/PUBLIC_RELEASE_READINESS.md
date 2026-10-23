# Public release status

**Alpha.** Documentation/code audit baseline:
[3ed0447](https://github.com/LumosLab-Innovation/OpenHunterAI/commit/3ed0447b4f6218207ff5e104b81a376b59798fae).
This is a source review, not fresh production or target-scan evidence.

## Present in the repository

| Surface | Implementation |
| --- | --- |
| Local bootstrap | [ops/local.mjs](../ops/local.mjs), [Compose](../compose.local.yml), generated private configuration and migrations |
| Local access | Reserved identity, loopback request checks, no workspace login |
| UI | Overview, setup/models, projects, scan activity, findings, reports, light/dark theme |
| Coding-agent skill | [Skill and read-only helper](../skills/openhunter/); named client installation |
| Scan pipeline | Deterministic plan, NATS dispatch, normalized worker IDs, callbacks, candidate promotion, report finalization |
| Exports | Organization-scoped DOCX/CSV/JSON/HTML/PDF routes; PDF limitations below |
| Hosted compatibility | Existing account/session and commercial entitlement paths retained |
| Repository policy | Root license, licensing guide, contribution policy, private security-reporting link |

Presence of code does not establish completed runtime acceptance.

## Open gaps

| Priority | Gap | Evidence / consequence |
| --- | --- | --- |
| Blocker | Nuclei reviewed-template policy is not wired | [Template directory](../integrations/nuclei/templates/) contains only README. Compose sets `NUCLEI_TEMPLATES_DIR` / `NUCLEI_DISABLE_TEMPLATE_DOWNLOAD`; [adapter](../integrations/nuclei/cmd/nuclei/main.go) reads `NUCLEI_TEMPLATES` and does not consume the other flags. Do not claim curated-only execution or start scans until resolved. |
| Blocker | Nuclei process errors can look like empty success | `runNuclei` ignores the process exit error except timeout and parses stdout. A healthy binary or zero signals is not successful coverage. |
| Required runtime | OpenHack/Strix tools are external to the local stack | Local URLs point to separately installed adapters; their checked-in Dockerfiles contain adapter binaries, not complete upstream tools. |
| Required evidence | Full authorized local scan E2E | Need fresh positive/fixed-control scan, callbacks, report, exports, and manual retest evidence after blockers are resolved. Startup/project CRUD alone is insufficient. |
| Functional gap | Free Hunter early stopping | [Fan-in](../workers/orchestrator/cmd/orchestrator/fanin.go) waits for all expected workers; output/promotion limits exist, immediate stop of expensive work does not. |
| Export gap | PDF truncates long reports | [Renderer](../gateway/public-api/src/modules/reports/reports.service.ts) takes 45 lines and 100 characters per line, one page, without a Unicode font strategy. Prefer JSON/DOCX/HTML for full content. |
| Resilience gap | Report event publish follows the DB write | [Reporting](../backend/reporting/src/server.ts) awaits NATS after persistence. Publish failure can fail the request despite saved data; polling fallback does not make this atomic. |
| Deployment gap | Recon staging coverage differs from local | Local/developer tooling includes R; staging worker overlay and Cloud Build pipeline do not. |
| Contract gap | Published schemas are partial | [AsyncAPI](../contracts/events/events.asyncapi.yaml) lists only scan/retest requests; [OpenAPI](../contracts/api/public-api.openapi.yaml) is not a full controller inventory. |
| Toolchain gap | CI bootstrap differs from workspace | [CI](../.github/workflows/ci.yml) sets Go 1.22 while [go.work](../go.work) requires 1.26; verify toolchain auto-download/build behavior explicitly. |

The docs cleanup records these gaps; it does **not** fix runtime code or certify
safety. Health checks and worker completion must be read together with actual
coverage and errors.

## Distribution and contribution gates

The root [LICENSE](../LICENSE) and [LICENSING.md](../LICENSING.md) already exist;
the licensor/contact is HungBil. Do not keep treating those as pending setup choices.

Still required before broader distribution/commercial licensing:

- Review rights to existing contributions and the third-party notice inventory.
- Complete the contributor agreement/acceptance process before reopening external
  source contributions, as stated in [CONTRIBUTING.md](../CONTRIBUTING.md).
- Review tracked files and history for secrets without printing their values;
  rotate exposed credentials where needed.
- Record actual release SHA and runtime/browser evidence.

This review does not alter licensing terms or establish that contribution rights
have been cleared.

## Future proposals

A streaming terminal client, user-selectable module switches, and durable
checkpoints are proposals, not features of the bundled read-only helper.
They require explicit product approval and must preserve scope, approval,
sanitization, quotas, and manual retest policy.

Release acceptance: [production checklist](PRODUCTION_READINESS.md).
