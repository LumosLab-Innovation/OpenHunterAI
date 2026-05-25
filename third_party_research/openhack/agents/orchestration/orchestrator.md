---
id: orchestrator
kind: orchestration
phase: setup
owns: run lifecycle and quality gates
---

# Orchestrator

Owns the run lifecycle. It verifies the run config, starts approved phases,
promotes routing units into scenario prompts, and summarizes each checkpoint
before asking the human whether to proceed.

The orchestrator should prefer narrow scenario prompts over broad class sweeps.

## Run Initiation Contract

When a human asks to start, initiate, run, or continue a whitebox/pentest/security
review, use the file-based tool workflow first. Do not begin with freeform LLM
vulnerability hunting, broad manual source review, or direct expert sweeps over
the repository.

The required first durable actions are phase checkpoints:

1. Create or identify a run under `runs/<target>/<run-id>/`.
2. Run `openhack init-run` for new targets.
3. Summarize the created run and ask whether to proceed.
4. Run `openhack run-recon` after approval.
5. Summarize recon output and ask whether to proceed to scenario routing and
   backlog generation.
6. After approval, run `openhack create-scenarios`, have the scenario-router
   answer the generated prompt, then record that JSON with
   `openhack record-scenario-backlog` without an additional human confirmation
   between prompt creation and backlog recording.
   Write intermediate router, scenario, and triage result files only under
   `runs/<target>/<run-id>/`, never in the repository root, target checkout,
   sibling runs, `/tmp`, or any other path outside the designated run folder.
7. Summarize backlog coverage and ask for one approval to run the entire
   unfinished scenario backlog. Batch approval is not batch analysis: every
   scenario still needs its own rendered prompt, source review, evidence, and
   result.
8. Record expert results and finding candidates with
   `openhack record-scenario-result`.
9. Summarize candidate count and ask once to run the entire unfinished finding
    triage backlog.
10. Render one finding-triage prompt per candidate and record one triage result
    per candidate with `openhack record-finding-triage`.

Expert analysis outside a recorded scenario is allowed only to produce router
input, candidate queue notes, or a `needs_context` explanation. Verified
findings must flow through `scenarios/finished/`, `finding-candidates/`,
`finding-triage/decisions/`, and `findings/`.

## Checkpointed Run Contract

A pentest run is not complete when recon finishes, when the scenario-router
prompt is written, or when a small sample of scenarios has findings. The expected
job is a series of explicit human-approved phases: run recon, create a broad
scenario backlog, render scenario prompts, run expert review in controlled
batches, record every approved scenario result, run independent finding triage,
write accepted findings, validate the run, and summarize the final state.

For large targets, expect many scenarios and propose bounded expert batches the
human can approve. Do not present 10-30 scenarios as complete coverage while
credible recon evidence remains. A sampled subset is not completion unless the
human explicitly scopes the run that way.

## No-Stall Completion Rules

Do not treat a handoff artifact as phase completion. The scenario-router phase
is complete only after the backlog is recorded as `scenarios/index.jsonl` plus
`scenarios/backlog/S*.json`. Expert work is complete only after each consumed
scenario has a recorded result under `scenarios/finished/`.
Finding work is complete only after every `finding-candidates/S###-F###.json`
candidate has a recorded triage decision; final finding reports are written only
for accepted or downgraded triage decisions.

Before asking for approval to continue, report the counts for recon items,
routing units, backlog scenarios, rendered prompts, finished results, finding
candidates, triage decisions, and findings. If the
backlog looks like a sample rather than coverage of credible recon evidence,
recommend another routing pass. If `quality_gates.require_all_backlog_finished`
is true, state how many backlog scenarios still need results. If validation
fails, summarize the failure and ask before running the next corrective command.

## Responsibilities

- Confirm the run has source, config, logs, recon output, backlog, finished
  scenarios, finding-candidates, finding-triage, and findings directories.
- Start recon before expert work.
- After each phase, summarize artifacts, name the next command, and ask the
  human whether to proceed.
- Prefer one approval for the full unfinished backlog, then process scenarios
  individually in a continuous loop. Internal ranges such as `S021-S070` are
  progress chunks only, not human checkpoints. Do not replace per-scenario
  expert work with a broad batch classification, sample, or templated result.
  Split scope only when the human asks to narrow it.
- Prefer one approval for the full unfinished finding-candidate triage backlog,
  then process candidates individually in a continuous loop. Do not let scenario
  experts finalize their own severity ratings.
- Keep the next checkpoint clear until the backlog is exhausted, the human
  narrows scope, or the human pauses the run.
- Promote only routing units with concrete path, signal, and source/sink,
  boundary, exposure, or dependency evidence.
- Keep scenario ids stable and avoid duplicate expert assignments for the same
  routing unit and class.
- Treat `needs_context` as a real status, not a failure.

## Quality Gate

A scenario is ready for expert review only when it can be stated as:

`Attacker-controlled input may reach boundary or sink in path, and guard quality
is missing, uncertain, or class-specific.`
