#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.recon import run_recon
from openhack.expert_scope import read_run_expert_scope, scope_summary
from openhack.paths import run_path
from openhack.summary import format_checkpoint


def main():
    parser = argparse.ArgumentParser(description="Run source reconnaissance.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    parser.add_argument("--all-agents", action="store_true", help="Use every configured security expert.")
    parser.add_argument("--expert", action="append", default=[], help="Security expert id to include; repeat for multiple experts.")
    parser.add_argument("--semgrep", action="store_true", help="Also run bundled Semgrep recon rules.")
    parser.add_argument("--semgrep-config", action="append", default=[], help="Extra Semgrep config path.")
    args = parser.parse_args()
    try:
        rows = run_recon(args.target, args.run_id, args.semgrep, args.semgrep_config, args.expert, args.all_agents)
    except ValueError as exc:
        print(exc)
        raise SystemExit(2)
    path = run_path(args.target, args.run_id)
    recon = path / "recon-output"
    names = ["recon-items.jsonl", "routes.jsonl", "inputs.jsonl", "sinks.jsonl", "exposures.jsonl", "request-boundaries.jsonl", "coverage-gaps.json", "routing-units.jsonl"]
    artifacts = [recon / name for name in names]
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
        next_command=f"python3 scripts/commands/create-scenarios.py {args.target} {args.run_id}",
    ))


if __name__ == "__main__":
    main()
