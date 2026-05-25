# Scenario <scenario_id>

- Expert: `<expert>`
- Routing unit: `<routing_unit_id>`
- Recon item: `<recon_item_id>`
- Target path: `<target_path>`
- Priority: `<priority>`
- Routing rationale: <routing_rationale>
- Expected finding width: <expected_finding_width>
- Candidate policy: <candidate_policy>
- Result location: `<result_location>`
- Proof question: <proof_question>
- Evidence required: <evidence_required>
- Security invariant: <security_invariant>
- Required proof obligations: <proof_obligations>

## Instructions

Read the expert manifest, shared protocol, run config, routing unit, recon item,
and source file before answering. Stay inside this scenario unless same-root
expansion or a cross-family handoff is needed.

If this prompt is part of an approved multi-scenario run, still answer this
scenario as an individual expert review. Do not use a bulk classification,
sampled sweep, or repeated template as a substitute for reading this prompt and
the relevant source. If you did not review this scenario, do not emit a finished
result for it.

Operate as a specialist for the assigned root-cause family, not as a generic
scanner. Use the expert manifest as a playbook: map the reachable entrypoint,
trace attacker control to the exact sink or boundary, inspect guards in the
context where they are consumed, check class-specific edge cases, and expand to
sibling parameters/endpoints/jobs that share the same root cause.

Do not stop after the first bug-shaped issue. A finding closes only the proof
obligation it proves vulnerable; it does not finish the scenario while other
central obligations remain unanswered. Answer every required proof obligation
listed above with `proven_safe`, `proven_vulnerable`, `not_applicable`, or
`needs_context`.

Evidence must be concrete enough for another reviewer to replay the reasoning
without guessing. Prefer exact files, functions, routes, line references,
configuration paths, data-flow steps, caller roles, preconditions, and final
security impact. Suspicious names, dangerous APIs, dependency folklore, and
framework reputation are only leads until tied to reachability and impact.

Do not treat delegated trust as proof. If an important guard is handled by a
framework, library, SDK, ORM, sanitizer, serializer, crypto primitive, cloud
policy, generated code, or deployment configuration, cite the exact locked
source/config/runtime behavior that enforces it. If you cannot inspect the
relevant dependency or generated artifact, mark that obligation `needs_context`
instead of treating it as safe.

When the scenario is promising but not yet proven, return `candidate` or
`needs_context` with the smallest missing facts. When a different root-cause
family owns the next step, create `candidate_queue_entries` instead of
stretching this expert beyond its ownership boundary.

Write JSON with:

- `scenario_id`
- `review_mode`: `per-scenario-subagent`
- `subagent_id`: a unique identifier for the one subagent that reviewed this
  scenario
- `scenario_prompt_sha256`: SHA-256 of this rendered `S*.md` prompt file
- `reviewed_files`: source files this subagent actually read
- `status`: `verified`, `candidate`, `rejected`, or `needs_context`
- `expert`
- `summary`
- `evidence`
- `proof_obligations`: one result item for every required proof obligation:
  - `id`: must match the scenario obligation id
  - `status`: `proven_safe`, `proven_vulnerable`, `not_applicable`, or
    `needs_context`
  - `summary`: short conclusion for that obligation
  - `evidence`: source-line evidence for closed obligations; use an empty array
    only for `needs_context` and explain the missing context in `summary`
- `surface_class_coverage`
- `same_root_expansion`
- `candidate_queue_entries`
- `findings` (verified finding candidates for later independent triage)

Every `evidence` item must cite a reviewed source file with `path`, `line`,
`snippet`, and `note`. The `snippet` must be copied from the cited source line;
the recorder and validator reject results whose snippets do not match the
source checkout.

Prefer width: one verified scenario may emit multiple finding candidates when distinct
parameters, endpoints, sinks, roles, or deployment paths are independently
vulnerable. Only put verified vulnerabilities in `findings`. Use
`candidate_queue_entries` for promising but unproven leads or work that belongs
to another expert.

The scenario expert does not create final reports. `record-scenario-result`
stores these entries under `finding-candidates/`; the `finding-triage` agent
later decides whether each candidate is accepted, downgraded, duplicated,
rejected, or needs more context.

For each verified finding candidate, include enough context for both engineering and
non-technical review:

- `title`: `<severity> - <type of vuln> - <location>`
- `severity`
- `target_path`
- `attacker_role`
- `preconditions`
- `non_technical_summary`
- `summary`
- `evidence`
- `attack_chain`
- `example_attack`
- `impact`
- `impact_analysis`
- `attacker_use`
- `recommended_fix`
- `validation_notes`

Write the attack chain and example as controlled-test explanations: concrete
enough to understand exploitability, but avoid unnecessary live-target
weaponization when a conceptual proof is sufficient.
