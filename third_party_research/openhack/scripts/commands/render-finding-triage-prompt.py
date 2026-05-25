#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.summary import format_checkpoint
from openhack.triage import render_triage_prompt


def main():
    parser = argparse.ArgumentParser(description="Render a finding triage prompt.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    parser.add_argument("candidate_id")
    args = parser.parse_args()
    prompt = render_triage_prompt(args.target, args.run_id, args.candidate_id)
    print(format_checkpoint(
        "Render Finding Triage Prompt",
        f"Rendered the independent triage prompt for {args.candidate_id}.",
        artifacts=[prompt],
        review="Ask the finding-triage agent to verify reportability, severity, and scope.",
        next_note="Save the triage answer as result JSON after review.",
        next_command=(
            f"python3 scripts/commands/record-finding-triage.py {args.target} "
            f"{args.run_id} {args.candidate_id} triage-result.json"
        ),
    ))


if __name__ == "__main__":
    main()
