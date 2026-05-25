# Scenario Router Assignment

You are the scenario-router orchestration agent. Convert routing units into
final scenario backlog entries.

## Inputs

### Routing Units

These are deterministic recon clusters created before routing. Treat them as
the primary work-unit input. A routing unit is more specific than a source path:
it clusters evidence by endpoint, boundary, sink family, storage path, parser,
identity state, deployment exposure, or dependency surface when the recon data
can distinguish those shapes.

Every unit with `coverage: "mandatory"` has `required_experts`; for each
`routing_unit_id + expert` pair, create a scenario or write a concrete
unit-specific `coverage_decision`. Suggested experts are optional routing leads,
not hard requirements.

```json
<routing_units_json>
```

### Recon Item Samples

```json
<recon_items_json>
```

### Compact Recon Inventory

These are coverage and inventory summaries. Treat them as prompts for agent
review, not proof by themselves. When Semgrep recon was enabled, normalized
Semgrep hits are summarized under `semgrep_summary`; treat them as structured
routing hints, not proof. Full raw artifacts remain on disk for expert prompts
and source review.

```json
<recon_inventory_json>
```

### Agent Registry

```json
<agent_registry_json>
```

## Task

Create a width-first scenario backlog. Route from `routing_units` first. For
each selected unit/expert pair, choose one
root-cause expert, write a specific proof question, define the security
invariant that must hold, and decompose that invariant into proof obligations
that the expert must close before the scenario can be finished. One scenario has
one primary expert, but one file, path, endpoint, parser, routing unit, or recon item may and
often should produce many scenarios so every relevant expert reviews the same
evidence from their root-cause angle.

This is a checkpointed pentest pipeline, not a sampling exercise. The scenario
backlog is the work queue for the next approved phase, where operators can run
controlled expert batches over the scenarios the previous phase created on large
targets. Produce enough concrete, evidence-backed scenarios for that downstream
expert phase to run broadly.

Do not return a small sample. There is no fixed scenario quota; produce however
many concrete scenarios are needed to cover the credible recon evidence. A
backlog of 10-30 scenarios is incomplete for a broad pentest unless the evidence
is genuinely that small or the human explicitly scoped the run that narrowly. If
the backlog is small, include `coverage_notes` explaining the concrete evidence
constraint.

Do not route by keyword alone. Route by sink, trust boundary, reachable behavior,
and deployment context. Fan out one routing unit to multiple experts when
distinct root-cause families are plausible. Never choose "the best" expert for a
unit when several root causes are credible; create one scenario per relevant
required expert. Do not collapse different endpoints, parameters, roles, storage
paths, parsers, or deployment aliases just because they may share a remediation
theme. If one routing unit still contains multiple concrete endpoints,
parameters, roles, parser modes, storage paths, or deployment aliases, split it
into multiple scenarios and explain the split in `routing_rationale`.

Use candidate scenarios for plausible source-to-sink paths that still need proof.
Reject only items with no concrete path, boundary, sink, or sensitive exposure
context. The goal is broad coverage with explicit proof obligations.

A proof obligation is a required security check, not a lead. Examples:
signature verification, issuer/audience binding, CSRF token validation,
authorization before object access, parser sandboxing, path canonicalization,
SQL parameter binding, upload type enforcement, webhook secret validation,
session rotation, replay prevention, resource limits, dependency integrity, or
deployment policy enforcement. Do not collapse different required checks into a
single broad obligation such as "review auth"; split them into the properties
that must independently hold.

If a scenario relies on a framework, library, SDK, ORM, sanitizer, serializer,
crypto primitive, cloud policy, generated code, or deployment configuration for
an important guard, create a proof obligation for that delegated guard. The
downstream expert must cite the exact locked dependency/config/runtime behavior
or return `needs_context`; do not let "the framework handles it" become
evidence.

Use `routing_units.required_experts` as the primary explicit coverage contract.
Each listed `unit_id + expert` pair must either receive a scenario with that
same `routing_unit_id` and `expert`, or have a unit-specific
`coverage_decision` that explains why the pair is not applicable, out of scope,
merged into a named scenario, or blocked on context.

Use `coverage_gaps.routing_requirements` as a compatibility backstop. Each
listed path/expert pair must either receive a scenario with that same
`target_path` and `expert`, or have an expert-specific `coverage_decision`.
Use `coverage_gaps.expert_opportunities` as the human-readable scouting map
behind those requirements. It is not a guarantee of vulnerability; it only shows
where registry routing signals appeared in recon evidence. Prefer high-quality
scenarios from credible routing units before adding more of a class that is
already well represented. If an opportunity group is skipped, explain why in
`coverage_notes` and `coverage_decisions` using the evidence, not a generic
"low confidence" dismissal.

Use `coverage_gaps.boundary_requirements` as mandatory endpoint coverage. Each
listed request boundary represents an externally reachable endpoint discovered
from framework config, security firewalls, generated routes, environment-derived
paths, or vendor-owned handlers. Create a scenario that carries the listed
`boundary_id` or `recon_item_id`, or add a boundary-specific `coverage_decision`
with the same `path`, `expert`, and `boundary_id`. Do not drop a boundary merely
because the concrete handler body lives in a missing dependency or generated
framework code; use `needs_context` only when the implementation is genuinely
unavailable after recording the endpoint and proof obligations.

Coverage rule: every route/input file with a sink or exposure hint should either
receive at least one scenario or have an explicit path-level
`coverage_decision`. Every admin/debug/example exposure, direct execution alias,
object-id route, state-changing route, parser, upload, redirect, HTML sink, SQL
builder, shell sink, and outbound HTTP/file fetch deserves routing
consideration.

## Output JSON

Write JSON with a top-level `scenarios` array and `coverage_decisions` array.
Add optional top-level `coverage_notes` when you intentionally skip a credible
opportunity group.
Each scenario item must contain:

- `id`: stable id such as `S001`
- `routing_unit_id`: stable id such as `U001` when `routing_units` are present
- `recon_item_id`
- `expert`
- `target_path`
- `proof_question`
- `evidence_required`
- `security_invariant`: the property that must hold for this route/sink/boundary
  to be safe
- `proof_obligations`: array of concrete checks the expert must answer before
  finishing the scenario. Each item must contain:
  - `id`: stable lowercase id such as `unsigned_response_rejected`
  - `question`: one precise yes/no or prove/reject question
  - `evidence_required`: source, config, dependency, runtime, or test evidence
    needed to close this obligation
  - `central`: boolean, true when unresolved context blocks a finished
    `verified` or `rejected` scenario result

Each item should also include:

- `priority`: `critical`, `high`, `normal`, or `low`
- `routing_rationale`: why this expert owns this scenario
- `expected_finding_width`: how many distinct findings may emerge, or `unknown`
- `candidate_policy`: what would keep the scenario candidate instead of verified
- `result_location`: expected path under `scenarios/finished/`

Each `coverage_decisions` item must contain:

- `path`: source path covered by the decision
- `routing_unit_id`: required for unit-specific decisions when routing units are
  present
- `expert`: expert id for expert-specific decisions, or `*` for path-level only
- `decision`: `scenario`, `covered_by_scenario`, `merged`, `not_applicable`,
  `needs_context`, or `out_of_scope`
- `scenario_ids`: required when the decision is `scenario`,
  `covered_by_scenario`, or `merged`
- `reason`: concrete evidence-based reason, required for non-scenario decisions

The backlog recorder rejects router output when a mandatory routing unit lacks a
matching `routing_unit_id + expert` scenario or unit-specific coverage decision.
It also rejects output when a path in
`coverage_gaps.input_with_sink_or_exposure` lacks both a scenario and a
path-level `coverage_decision`, or when a path/expert pair in
`coverage_gaps.routing_requirements` lacks both a matching scenario and an
expert-specific `coverage_decision`, or when a boundary in
`coverage_gaps.boundary_requirements` lacks both a scenario carrying that
`boundary_id`/`recon_item_id` and a boundary-specific `coverage_decision`.
