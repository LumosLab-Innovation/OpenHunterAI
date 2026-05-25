# Finding Triage <candidate_id>

You are the independent finding-triage agent for this candidate. Your job is to
decide whether the candidate becomes a final reportable finding, whether its
severity is justified, and whether scope/deduplication/report quality need
changes.

## Run Source

```yaml
<run_source>
```

## Shared Protocol

<shared_protocol>

## Triage Agent Manifest

<finding_triage_agent>

## Candidate

```json
<candidate_json>
```

## Scenario Result

```json
<scenario_result_json>
```

## Existing Final Findings

Use this list for deduplication and merge decisions:

```json
<existing_findings_json>
```

## Required Work

Read the candidate, the source files cited by the scenario result, and any
nearby guards or call sites needed to validate severity and scope. Do not accept
the scenario expert's severity by default.

Check:

- Whether the evidence proves reachability, attacker control, sink or boundary,
  missing guard, and concrete impact.
- Whether deployment assumptions, feature flags, privileges, tenant/user
  boundaries, and exploit complexity support the claimed severity.
- Whether the candidate duplicates an existing final finding or should be merged
  with a same-root issue.
- Whether the finding text is complete enough for engineering remediation and
  stakeholder review.

Write JSON only, shaped like this template:

```json
<result_template_json>
```

Use `decision: "accepted"` when the candidate is ready as-is except for minor
editorial cleanup. Use `decision: "downgraded"` when it is reportable but the
severity or blast radius should be reduced. Use `duplicate`, `rejected`, or
`needs_context` when it should not become a final finding yet.

`triage_prompt_sha256` must be the SHA-256 of this rendered prompt file.
`reviewed_files` must list the source files you actually read.
