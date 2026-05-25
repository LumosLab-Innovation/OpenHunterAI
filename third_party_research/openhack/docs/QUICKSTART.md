# Quickstart

The easiest way to get started is to open this repository in a coding harness
such as Codex, Claude Code, or Cursor and ask it:

```text
Initiate a whitebox pentest on https://github.com/example/app.git
```

The harness should follow `AGENTS.md`: initialize a run, summarize each
checkpoint, and ask before moving to the next phase. After recon, one approval
should cover rendering the router prompt, collecting the router answer, and
recording the scenario backlog.

From the repository root, install the CLI in editable mode:

```bash
python3 -m pip install -e .
```

This repository is the runtime workspace. The `agents/`, `config/`,
`templates/`, and `runs/` directories are part of normal operation, so use a
cloned checkout rather than a standalone wheel install. If you invoke the CLI
from another directory, set `OPENHACK_ROOT` to this repository root.

Do this sequence before any expert/LLM vulnerability review. Run one command at
a time. Each checkpoint prints what changed, what to review, and the next command
to run after the human approves proceeding. The two scenario-routing commands
belong to the same post-recon approval.

```bash
openhack init-run demo https://github.com/example/app.git
openhack run-recon demo <run-id> --all-agents
openhack create-scenarios demo <run-id>
openhack record-scenario-backlog demo <run-id> router-result.json
openhack render-scenario-prompt demo <run-id> S001
openhack record-scenario-result demo <run-id> S001 result.json
openhack render-finding-triage-prompt demo <run-id> S001-F001
openhack record-finding-triage demo <run-id> S001-F001 triage-result.json
openhack validate-run demo <run-id>
openhack summarize-run demo <run-id>
```

The first review phase is recon and scenario routing; expert analysis starts
from recorded `scenarios/backlog/S*.md` prompts. Use `summarize-run` when
resuming a run to see the current counts and next checkpoint.

Recon writes `recon-items.jsonl` plus lightweight `routes.jsonl`,
`inputs.jsonl`, `sinks.jsonl`, `exposures.jsonl`, `request-boundaries.jsonl`,
`coverage-gaps.json`, and `routing-units.jsonl`. Routing units cluster raw
line hits into endpoint, sink, parser, storage, exposure, auth-flow, and
dependency review surfaces before the scenario-router prompt is built. Router
output must cover every mandatory `routing_unit_id + expert` pair and every
`routing_requirements` path/expert pair with a scenario or an explicit
`coverage_decision`.

To enrich recon with bundled Semgrep rules, run:

```bash
openhack run-recon demo <run-id> --all-agents --semgrep
```

Semgrep output is stored as `semgrep-results.json` and normalized into the same
recon items, routing units, and routing requirements. Treat these matches as
routing evidence, not verified vulnerabilities.

To record a verified scenario result as a finding candidate:

```bash
openhack record-scenario-result demo <run-id> S001 result.json
```

To record independent finding triage and materialize an accepted final finding:

```bash
openhack render-finding-triage-prompt demo <run-id> S001-F001
openhack record-finding-triage demo <run-id> S001-F001 triage-result.json
```

The triage result is a separate agent answer. It should justify
`final_severity`, `severity_rationale`, `confidence`, dedupe/scope decisions,
and any evidence gaps before a candidate becomes a final report.

To record a multi-scenario expert bundle:

```bash
openhack record-scenario-result demo <run-id> expert-results.json
```

The bundle must contain a top-level `results` array. Each item needs
`scenario_id` and the normal scenario result fields. Bundles create finding
candidates, not final findings; triage each candidate separately.
