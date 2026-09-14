# Acceptance criteria

Required acceptance checks for v1. Unchecked items are gates, **not a status
report**. Record the tested commit, environment, command, and sanitized evidence
before marking a release accepted. See [current gaps](PUBLIC_RELEASE_READINESS.md#open-gaps).

## Local workspace

- [ ] Fresh clone starts at localhost:3001 without workspace signup/login.
- [ ] Reserved identity is isolated; projects survive reload and restart.
- [ ] Host/Origin/rebinding/cross-site requests are rejected before bootstrap.
- [ ] Hosted mode still rejects missing/invalid sessions and wrong-organization access.
- [ ] Status contains no credentials and distinguishes key presence from verified model access.
- [ ] UI has loading, empty, error/retry states and usable desktop/mobile layouts.
- [ ] Skill installs into the documented clients' discovery paths without starting a scan.
- [ ] Only the reserved local organization bypasses hosted commercial checks.
- [ ] Baseline startup is tested separately from authorized scan E2E; missing tools are explicit.

## Product and authorization

| Contract | Required result |
| --- | --- |
| Packages | Free Hunter / AI Black-hat Mindset Check / Monitor Workspace / Enterprise / PAYG |
| Auth scope | Target-account scope, not another package |
| Readiness export | Report view/export, not a scan package |
| Monitor sub-tiers | Not public package names; no automatic retest implied |
| Domain and consent | Verified/unexpired public domain plus explicit unexpired authorization |
| Scope | Allowed hosts/paths and exclusions preserved; private targets and scope-escaping redirects blocked |
| Account count | `none`: zero required; `one_account`: at least one; `two_accounts`: at least two |
| Intensity | Aggressive staging requires explicit controlled staging/dev/test acceptance |

## Deterministic plan

- [ ] Target type and flags produce the [documented worker/hunter matrix](WORKER_SPEC.md#3-profiles-by-target-type).
- [ ] Plan includes skipped-hunter reasons, quotas, and validation/approval level.
- [ ] LLM does not choose target type or the worker set; no profiler worker is added.
- [ ] Free may use each target/intensity when authorized and subject to the same safety gates.
- [ ] Sensitive actions require human approval; budget exhaustion never opens broader scope.

## Free Hunter

- [ ] One returned finding, one monitored finding, one retest, seven-day cooldown.
- [ ] First valuable finding stops expensive remaining work.
- [ ] Limited finding/retest view does not become the full paid workspace.
- [ ] No valuable finding returns coverage, hardening, limitations, and next steps.

The first-valuable-finding output cap is not proof that early stopping is complete.
See [fan-in limitations](WORKER_SPEC.md#5-completion-and-reporting-limits).

## Workers and models

- [ ] ZAP remains passive/baseline; Nuclei runs only a reviewed allowlist.
- [ ] Nuclei template configuration is effective; missing/failed runtime cannot return fake clean success.
- [ ] OpenHack/Strix use real configured runtimes, within scope/intensity/approval limits.
- [ ] Recon actively probes only approved hosts; discovery never auto-expands scope.
- [ ] Every worker has bounded timeout/retries, explicit failed/skipped coverage, and sanitized callbacks.
- [ ] Business logic uses LLM aliases through the gateway.
- [ ] Sanitizer, use-case allowance, budgets, timeout, retry, and fallback are tested.
- [ ] Model recommendations cannot invent findings, evidence, IDs, or override policy.

## Storage, reports, and exports

- [ ] Sanitized findings/reports are stored in Postgres; no external artifact-store dependency.
- [ ] Credentials/session state use dedicated encrypted fields; hosted access uses hashes.
- [ ] Raw secrets, cookies, tokens, HAR, sensitive traffic, and private data never enter evidence/logs/prompts/exports.
- [ ] Detected secrets retain only masked fingerprint/hash/metadata.
- [ ] `report_v1` JSON is the immutable report snapshot; draft sections stream through scoped SSE.
- [ ] DOCX/CSV/JSON/HTML/PDF exports are generated on demand, not persisted as raw artifacts.
- [ ] Downloads require an organization-scoped final/superseded report; drafts are not final downloads.
- [ ] JSON preserves the snapshot; latest status remains a separate optional overlay.
- [ ] CSV neutralizes spreadsheet formulas and separates findings from hardening/coverage.
- [ ] Long and Unicode report content is not lost in exported formats.
- [ ] Manual retest updates its result and latest view without rewriting historical evidence.

## Excluded scope

Fail acceptance if unapproved implementation adds private/cloud/VPS scanning,
server agents, mobile APK auditing, SAST/SCA/secrets scanning, automatic GitHub/Jira
integration, CI/CD/deployment retest, or unrestricted offensive execution.
The product remains attacker-style security assessment, not a compliance certification.

Use [production readiness](PRODUCTION_READINESS.md) for release-environment checks.
