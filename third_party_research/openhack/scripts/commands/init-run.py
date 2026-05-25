#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.run import init_run
from openhack.expert_scope import expert_options_text
from openhack.summary import format_checkpoint


def main():
    parser = argparse.ArgumentParser(description="Create a fresh openhack run.")
    parser.add_argument("target")
    parser.add_argument("git_url")
    parser.add_argument("--run-id")
    parser.add_argument("--branch")
    args = parser.parse_args()
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
        next_command=(
            f"python3 scripts/commands/run-recon.py {args.target} {run_id} "
            "--all-agents"
        ),
    ))


if __name__ == "__main__":
    main()
