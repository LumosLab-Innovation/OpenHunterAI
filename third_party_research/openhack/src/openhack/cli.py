from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .log import emit
from .expert_scope import expert_options_text, read_run_expert_scope, scope_summary
from .paths import run_path
from .backlog import record_backlog
from .queue import expert_queue
from .recon import run_recon
from .results import record_bundle, record_result
from .run import init_run
from .scenarios import prepare_scenario_router, render_prompt
from .summary import format_checkpoint, next_step, summarize_run
from .triage import record_triage, render_triage_prompt
from .validate import validate_run


def _add_target_run(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("target")
    parser.add_argument("run_id")


def _cmd_init_run(args: argparse.Namespace) -> None:
    path = init_run(args.target, args.git_url, args.run_id, args.branch)
    run_id = path.name
    print(format_checkpoint(
        "Initialize Run",
        f"Created run {args.target}/{run_id} from a fresh source checkout.",
        artifacts=[path, path / "run-config.yaml", path / "plan.md"],
        review=(
            "Confirm scope, branch, commit, and choose security experts before "
            "recon. Options:\n" + expert_options_text()
        ),
        next_command=f"openhack run-recon {args.target} {run_id} --all-agents",
    ))


def _cmd_run_recon(args: argparse.Namespace) -> None:
    try:
        rows = run_recon(
            args.target,
            args.run_id,
            args.semgrep,
            args.semgrep_config,
            args.expert,
            args.all_agents,
        )
    except ValueError as exc:
        print(exc)
        raise SystemExit(2)
    path = run_path(args.target, args.run_id)
    recon = path / "recon-output"
    artifacts = [recon / name for name in [
        "recon-items.jsonl",
        "routes.jsonl",
        "inputs.jsonl",
        "sinks.jsonl",
        "exposures.jsonl",
        "request-boundaries.jsonl",
        "coverage-gaps.json",
        "routing-units.jsonl",
    ]]
    if args.semgrep:
        artifacts.append(recon / "semgrep-results.json")
    source = " plus Semgrep hints" if args.semgrep else ""
    scope = read_run_expert_scope(path)
    expert_note = f" Expert scope: {scope_summary(scope['experts'])}" if scope else ""
    print(format_checkpoint(
        "Run Recon",
        f"Recorded {len(rows)} recon items, lightweight inventories, and routing units{source}.{expert_note}",
        artifacts=artifacts,
        review=(
            "Skim the recon counts and decide whether to generate the "
            "scenario backlog. Approval covers prompt creation, router answer, "
            "and backlog recording."
        ),
        next_command=f"openhack create-scenarios {args.target} {args.run_id}",
    ))


def _cmd_create_scenarios(args: argparse.Namespace) -> None:
    prompt = prepare_scenario_router(args.target, args.run_id)
    print(format_checkpoint(
        "Prepare Scenario Routing",
        "Wrote the scenario-router prompt from routing units, compact recon evidence, and the expert registry.",
        artifacts=[prompt],
        next_note=(
            "No separate human gate is required here when recon-to-backlog "
            "routing was already approved. Have the scenario-router produce "
            "JSON with a top-level scenarios array, then record it."
        ),
        next_command=(
            f"openhack record-scenario-backlog {args.target} {args.run_id} "
            "router-result.json"
        ),
        next_command_label="Next command in approved routing phase:",
        proceed_prompt=None,
    ))


def _cmd_record_scenario_backlog(args: argparse.Namespace) -> None:
    scenarios = record_backlog(args.target, args.run_id, args.router_result_json)
    path = run_path(args.target, args.run_id)
    print(format_checkpoint(
        "Record Scenario Backlog",
        f"Recorded {len(scenarios)} scenario assignments from router output.",
        artifacts=[path / "scenarios" / "index.jsonl", path / "scenarios" / "backlog"],
        review=(
            "Confirm backlog size, coverage decisions, and expert fan-out, then "
            "ask for one approval to review the entire unfinished scenario backlog."
        ),
        next_note=(
            "After approval, review each unfinished scenario individually from "
            "its rendered prompt and relevant source, then record one result per "
            "scenario. Do not ask again at internal ranges or substitute a broad "
            "batch classification."
        ),
    ))


def _cmd_render_scenario_prompt(args: argparse.Namespace) -> None:
    prompt = render_prompt(args.target, args.run_id, args.scenario_id)
    print(format_checkpoint(
        "Render Expert Prompt",
        f"Rendered the expert prompt for {args.scenario_id}.",
        artifacts=[prompt],
        review="Confirm the scenario is in scope before asking the assigned expert to answer.",
        next_note="Save the expert answer as result JSON after review.",
        next_command=(
            f"openhack record-scenario-result {args.target} {args.run_id} "
            f"{args.scenario_id} result.json"
        ),
    ))


def _cmd_record_scenario_result(args: argparse.Namespace) -> None:
    path = run_path(args.target, args.run_id)
    if args.result_json:
        written = record_result(
            args.target, args.run_id, args.scenario_or_bundle, args.result_json
        )
        finished = path / "scenarios" / "finished" / f"{args.scenario_or_bundle}.json"
        artifacts = [finished] + written
    else:
        written = record_bundle(args.target, args.run_id, Path(args.scenario_or_bundle))
        artifacts = [path / "scenarios" / "finished"] + written
    step = next_step(args.target, args.run_id)
    print(format_checkpoint(
        "Record Scenario Result",
        f"Recorded scenario result and wrote {len(written)} finding candidates.",
        artifacts=artifacts,
        review="Check the scenario result status and any generated finding candidates before triage decisions.",
        next_command=step["command"],
    ))


def _cmd_render_finding_triage_prompt(args: argparse.Namespace) -> None:
    prompt = render_triage_prompt(args.target, args.run_id, args.candidate_id)
    print(format_checkpoint(
        "Render Finding Triage Prompt",
        f"Rendered the independent triage prompt for {args.candidate_id}.",
        artifacts=[prompt],
        review="Ask the finding-triage agent to verify reportability, severity, and scope.",
        next_note="Save the triage answer as result JSON after review.",
        next_command=(
            f"openhack record-finding-triage {args.target} {args.run_id} "
            f"{args.candidate_id} triage-result.json"
        ),
    ))


def _cmd_record_finding_triage(args: argparse.Namespace) -> None:
    written = record_triage(args.target, args.run_id, args.candidate_id, args.triage_json)
    step = next_step(args.target, args.run_id)
    print(format_checkpoint(
        "Record Finding Triage",
        f"Recorded triage for {args.candidate_id}.",
        artifacts=written,
        review="Accepted or downgraded decisions are now materialized as final findings.",
        next_command=step["command"],
    ))


def _cmd_next_expert_queue(args: argparse.Namespace) -> None:
    scenarios = expert_queue(args.target, args.run_id, args.expert, args.limit)
    print(json.dumps({
        "target": args.target,
        "run_id": args.run_id,
        "expert": args.expert,
        "limit": args.limit,
        "count": len(scenarios),
        "scenarios": scenarios,
    }, indent=2, sort_keys=True))


def _cmd_log_event(args: argparse.Namespace) -> None:
    emit(run_path(args.target, args.run_id), args.actor, args.status, args.summary)


def _cmd_summarize_run(args: argparse.Namespace) -> None:
    print("\n".join(summarize_run(args.target, args.run_id)))


def _cmd_validate_run(args: argparse.Namespace) -> None:
    errors = validate_run(args.target, args.run_id)
    if errors:
        print("\n".join(errors))
        raise SystemExit(1)
    scope = f"{args.target}/{args.run_id}" if args.target and args.run_id else "repository"
    print(format_checkpoint(
        "Validate",
        f"Validation passed for {scope}.",
        review="Use summarize-run for the final run counts before handoff.",
    ))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="openhack")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init-run", help="Create a fresh run.")
    init.add_argument("target")
    init.add_argument("git_url")
    init.add_argument("--run-id")
    init.add_argument("--branch")
    init.set_defaults(func=_cmd_init_run)

    recon = subparsers.add_parser("run-recon", help="Run source reconnaissance.")
    _add_target_run(recon)
    recon.add_argument("--all-agents", action="store_true", help="Use every configured security expert.")
    recon.add_argument("--expert", action="append", default=[], help="Security expert id to include; repeat for multiple experts.")
    recon.add_argument("--semgrep", action="store_true", help="Also run bundled Semgrep recon rules.")
    recon.add_argument("--semgrep-config", action="append", default=[], help="Extra Semgrep config path.")
    recon.set_defaults(func=_cmd_run_recon)

    route = subparsers.add_parser("create-scenarios", help="Prepare the scenario-router prompt for backlog generation.")
    _add_target_run(route)
    route.set_defaults(func=_cmd_create_scenarios)

    backlog = subparsers.add_parser("record-scenario-backlog", help="Record router output.")
    _add_target_run(backlog)
    backlog.add_argument("router_result_json", type=Path)
    backlog.set_defaults(func=_cmd_record_scenario_backlog)

    render = subparsers.add_parser("render-scenario-prompt", help="Render one expert prompt.")
    _add_target_run(render)
    render.add_argument("scenario_id")
    render.set_defaults(func=_cmd_render_scenario_prompt)

    result = subparsers.add_parser("record-scenario-result", help="Record expert result JSON.")
    _add_target_run(result)
    result.add_argument("scenario_or_bundle")
    result.add_argument("result_json", nargs="?", type=Path)
    result.set_defaults(func=_cmd_record_scenario_result)

    triage_render = subparsers.add_parser("render-finding-triage-prompt", help="Render one finding triage prompt.")
    _add_target_run(triage_render)
    triage_render.add_argument("candidate_id")
    triage_render.set_defaults(func=_cmd_render_finding_triage_prompt)

    triage = subparsers.add_parser("record-finding-triage", help="Record a triage decision JSON.")
    _add_target_run(triage)
    triage.add_argument("candidate_id")
    triage.add_argument("triage_json", type=Path)
    triage.set_defaults(func=_cmd_record_finding_triage)

    queue = subparsers.add_parser("next-expert-queue", help="Print unfinished scenarios to dispatch per expert.")
    _add_target_run(queue)
    queue.add_argument("--expert")
    queue.add_argument("--limit", type=int, default=8)
    queue.set_defaults(func=_cmd_next_expert_queue)

    log = subparsers.add_parser("log-event", help="Append a structured run log event.")
    _add_target_run(log)
    log.add_argument("actor")
    log.add_argument("status")
    log.add_argument("summary")
    log.set_defaults(func=_cmd_log_event)

    summary = subparsers.add_parser("summarize-run", help="Summarize run state.")
    _add_target_run(summary)
    summary.set_defaults(func=_cmd_summarize_run)

    validate = subparsers.add_parser("validate-run", help="Validate the repo or a run.")
    validate.add_argument("target", nargs="?")
    validate.add_argument("run_id", nargs="?")
    validate.set_defaults(func=_cmd_validate_run)

    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
