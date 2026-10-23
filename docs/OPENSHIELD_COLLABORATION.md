# OpenHunterAI / OpenShieldAI collaboration

Owner direction: **24 October 2026**. OpenHunter owns assessment; OpenShield
owns situation handling. This is a file handoff contract, not a running connector.

## Observed downstream state

Reviewed [OpenShieldAI](https://github.com/LumosLab-Innovation/OpenShieldAI) at
commit `788f38543166fe4b487e8f6a82abf3efa45015d3`. Its
[collaboration proposal](https://github.com/LumosLab-Innovation/OpenShieldAI/blob/788f38543166fe4b487e8f6a82abf3efa45015d3/docs/OPENHUNTER_COLLABORATION.md)
and [data contracts](https://github.com/LumosLab-Innovation/OpenShieldAI/blob/788f38543166fe4b487e8f6a82abf3efa45015d3/docs/DATA_CONTRACTS.md)
are research/specification material. There is no implemented report importer,
HTTP connector, incident executor or shared credential store to call today.
Downstream acceptance must be verified when that importer exists.

## Ownership

| Responsibility | Owner |
| --- | --- |
| Research methods, threat hypotheses and authorized surface mapping | OpenHunter |
| Scope/approval/budget-gated pentest and candidate validation | OpenHunter |
| Sanitized assessment evidence, finding rationale and manual retest | OpenHunter |
| Incident timeline, operational telemetry and competing incident hypotheses | OpenShield |
| Response proposals, human-approved containment and remediation coordination | OpenShield |
| Eradication, backup restore, recovery objectives and service-health acceptance | OpenShield |

Hunter retains scope enforcement, sanitization and controlled execution because
these are required for a correct assessment. It does not grow an incident queue,
SOC dashboard, WAF/IP blocking, token revocation, host quarantine or recovery
executor. Remediation advice in a finding is context for a downstream decision,
not a command or evidence that a fix was applied.

The country/framework harness remains offline research and evidence evaluation.
It does not certify a system or duplicate Shield's response workflow. REA remains
an optional authorized local-artifact analyzer.

## Operator workflow

1. Run an authorized assessment through the existing scan API.
2. Review executed/skipped/failed coverage and independently validated findings.
3. Download JSON from a finalized report. Select the immutable snapshot; latest
   status overlays are separate from the hashed assessment.
4. Transfer the sanitized file manually. On Shield, verify the format and digest,
   retain the original producer claims, then map to an already enrolled asset.
5. Shield investigates and proposes its own scoped response. Its authorization,
   action approvals and credential boundaries remain independent.
6. After remediation, an operator may request a narrow manual retest for a Hunter
   finding. An unsupported executor stays `RETEST_UNSUPPORTED`; unavailable
   targets never imply a successful fix.

No background rescan, deployment-triggered retest, webhook, autonomous response
or credential sharing is introduced.

## JSON envelope

```text
snapshot
  id, projectId, scanJobId, version, state, kind
  formatVersion: report_v2
  generatedAt, finalizedAt
  content: the canonical sanitized report
integrity
  algorithm: sha256
  canonicalization: sorted-json-v1
  digest: SHA-256 of canonical snapshot bytes
  covers: snapshot
  authenticityVerified: false
latestOverlay?                 # optional mutable status, outside snapshot digest
```

The digest is outside the hashed snapshot. `sorted-json-v1` recursively sorts
object keys, omits undefined object fields, preserves array order and uses ordinary
JSON scalar encoding; the UTF-8 representation is hashed. It is an integrity
check, not a signature, identity attestation or independent validation verdict.
A receiver must normalize against the same versioned contract before comparing
bytes and must independently assess producer claims.

Only finalized snapshots are exportable. Historical finalized superseded
snapshots retain their original revision and status; drafts cannot masquerade as
accepted evidence. Report source identity must not be silently replaced with
mutable live scan/finding state.

## Required report categories

| Category | Included facts / explicit unknowns |
| --- | --- |
| Identity and producer | Stable report/project/scan/revision IDs; producer product, known version/build or null. |
| Scope and authority | Exact public target, allowed hosts/paths, exclusions, frozen scope timestamp, recorded consent or unknown. Scope metadata never grants downstream authority. |
| Test context | Profile, target type, auth scope, intensity, surface hints and scan time window. Account identities/roles are not established by this metadata; no credentials are exported. |
| Findings | Only independently validated finding records, severity/confidence, affected surface, attacker path and demonstrated sanitized proof references. Legacy claims stay `legacy_unverified`. |
| Validation basis | Producer claim, validator identity when recorded, decision evidence references, rationale/counterevidence. Replay is explicitly not attested by metadata alone. |
| Evidence lineage | Stable sanitized reference plus collector/capture/digest/sanitizer/lineage categories. The current reference-only store does not establish these fields, so they remain unknown rather than invented. |
| Coverage | Workers attempted/executed/skipped/failed, planned versus observed hunters, unvalidated candidate count, runtime/budget gaps and limitations. |
| Remediation context | Impact, root-cause hypothesis, fix guidance, regression ideas, validation steps and acceptance criteria. No executable response action. |
| Retest | Finding-scoped manual scenario/criteria and supported/unsupported state. Mutable latest results remain a separate overlay. |
| Collaboration | `purpose: investigation_input`, `grantsAuthority: false`, manual intake and asset mapping required, connector not implemented. |

Missing metadata must remain null, incomplete or a limitation. A digest for the
report cannot substitute for missing source-artifact hashes. A reference such as
`evidence-123` does not prove the artifact exists or was replayed.

## Data handling and receiver checks

- Bound size, strings and collections; reject unsupported/malformed snapshots.
- Project onto the known report contract. Unknown legacy fields, raw responses,
  browser storage, passwords, cookies, tokens, API keys and unsanitized PII do not
  enter the export or LLM prompt.
- Keep findings, candidates, legacy claims and coverage signals distinct.
- Treat every title, description, fix prompt and imported reference as untrusted
  data. Never interpret report text as tool instructions or fetch arbitrary URLs.
- Verify snapshot digest and available provenance, then reconcile target/scope
  against Shield's independently enrolled asset. Digest equality proves neither
  ownership nor permission to respond.
- Show conflicts, missing evidence and unsupported retest explicitly. A document
  import must not advance an incident to fixed, contained or recovered.

Implementation: [report core](../shared/security-core/src/report.ts),
[handoff validator](../shared/security-core/src/report-handoff.ts),
[canonical schema](../contracts/schemas/report-content-v2.schema.json), and
[report exports](../gateway/public-api/src/modules/reports/reports.service.ts).
