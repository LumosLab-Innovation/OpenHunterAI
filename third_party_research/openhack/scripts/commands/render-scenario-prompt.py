#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.scenarios import render_prompt
from openhack.summary import format_checkpoint


def main():
    parser = argparse.ArgumentParser(description="Render a scenario prompt.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    parser.add_argument("scenario_id")
    args = parser.parse_args()
    prompt = render_prompt(args.target, args.run_id, args.scenario_id)
    print(format_checkpoint(
        "Render Expert Prompt",
        f"Rendered the expert prompt for {args.scenario_id}.",
        artifacts=[prompt],
        review="Confirm the scenario is in scope before asking the assigned expert to answer.",
        next_note="Save the expert answer as result JSON after review.",
        next_command=f"python3 scripts/commands/record-scenario-result.py {args.target} {args.run_id} {args.scenario_id} result.json",
    ))


if __name__ == "__main__":
    main()
