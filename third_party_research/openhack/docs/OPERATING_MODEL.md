# Operating Model

This repository is a standalone workspace for local whitebox vulnerability discovery and
source-guided security review.

Every run is stored under `runs/<target>/<run-id>/` and starts with a fresh git
clone into `sourcecode/`. Agents operate through files: recon output, scenario
prompts, scenario results, finding candidates, triage decisions, findings, and
logs.

Run initiation is command-first and checkpointed. A new pentest must begin by
creating or identifying a run folder, running recon, and then generating a
recorded scenario backlog. The post-recon approval covers creating the
scenario-router prompt, having the router answer it, and recording the backlog;
the prompt itself is not a separate human checkpoint. Each checkpoint stops with
a short summary, the artifacts to review, and the next command to run after the
human approves. Broad LLM-based checks over the target source are not the first
phase; they belong inside recorded expert scenarios after routing.

The durable model is:

1. Recon item: a discovered route, file, sink, auth boundary, manifest, or other
   security-relevant place. Recon also emits lightweight line-based inventories
   for routes, inputs, sinks, exposures, and coverage gaps. These inventories
   are intentionally cheap hints, not proof. Optional Semgrep recon adds
   structured source-pattern hits and stores the raw Semgrep JSON, but those hits
   are still routing evidence rather than verified vulnerabilities.
2. Routing unit: a deterministic cluster of recon evidence around an endpoint,
   handler, parameter, upload or download path, SQL/HTML/redirect sink, parser,
   auth flow, static exposure, or dependency surface. These units live in
   `recon-output/routing-units.jsonl` and are the primary router input.
3. Router assignment: the scenario-router agent reviews routing units and the
   expert registry, then creates a width-first backlog. It should fan out
   plausible units to multiple root-cause experts instead of collapsing distinct
   endpoints, parameters, roles, storage paths, parsers, or deployment aliases
   too early. Recon still writes `routing_requirements` as a path/expert
   compatibility backstop, but mandatory `routing_unit_id + expert` coverage is
   the sharper contract for new runs.
4. Scenario: one routing unit paired with one expert and a proof question.
5. Scenario result: a recorded expert answer for one scenario: verified,
   rejected, or needs more context.
6. Finding candidate: a scenario expert's proposed verified vulnerability,
   pending independent triage.
7. Triage decision: a one-candidate admission decision that checks
   reportability, deduplication, confidence, scope, and severity.
8. Finding: a triage-accepted vulnerability. One scenario may create many
   candidates, and broad candidate width is preferred over overly aggressive
   grouping.

Logs are audit artifacts, not private reasoning transcripts. They record what
was done, what evidence was used, what decision was made, and what should happen
next.

## Human Checkpoints

The tool does not need to be autonomous to be systematic. Checkpoint commands
should complete one durable phase, or one handoff inside an already approved
phase, and print:

1. What phase completed.
2. Which artifacts changed.
3. What the operator should review.
4. Which command would continue the run after approval.

Agents using this workspace should summarize those points and ask the human
whether to proceed before running the next phase, unless the human has already
approved a continuous batch. Post-recon approval is one continuous routing batch:
render the router prompt, collect the router JSON, and record the scenario
backlog before asking again.

Expert agents own 12 OWASP/MITRE-aligned root-cause families. Recon surfaces such
as API, GraphQL, upload, admin, parser, or native boundaries are not
deterministically assigned to experts by scripts. They are routed by the
scenario-router agent, and the final finding must name one primary root-cause
owner. The current registry is broad enough for general source-guided review,
while still allowing cross-family handoffs when one bug enables another.

Each expert manifest in `agents/experts/*.md` declares `routing_signals` in
its YAML frontmatter to connect recon evidence to plausible experts. These
signals are intentionally broad enough to find review opportunities, but they
are not vulnerability signatures and do not prove impact.

One primary root-cause owner per scenario does not mean one expert per file. If a
routing unit or path credibly touches upload handling, file paths, parser
behavior, and resource exhaustion, the router should create separate scenarios
for every relevant expert. If it intentionally skips a mandatory unit/expert
pair, path, or path/expert pair, it must write a structured
`coverage_decision`; otherwise `record-scenario-backlog.py` rejects the router
output.

Expert result recording supports both single-scenario files and small bundles. A
bundle uses a top-level `results` array where each entry includes `scenario_id`
plus the usual scenario result fields. The recorder fans that bundle into
`scenarios/finished/` and `finding-candidates/`, which avoids manual JSON
splitting after parallel expert work. Final `findings/` are written only by the
finding-triage recorder after an independent triage agent accepts or downgrades
a candidate.

## Finding Triage

Finding triage is a durable gate, not editorial cleanup. Each
`finding-candidates/S###-F###.json` file gets its own rendered prompt under
`finding-triage/prompts/` and its own triage-agent answer under
`finding-triage/decisions/`.

The triage agent checks whether the candidate is reportable, whether it
duplicates or should merge with an existing finding, whether the evidence proves
the claimed boundary crossing, and whether severity is justified by attacker
role, preconditions, exploitability, blast radius, confidence, and deployment
assumptions. Only `accepted` and `downgraded` decisions materialize final
`findings/*.md` reports.
