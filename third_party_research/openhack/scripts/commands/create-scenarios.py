#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.scenarios import prepare_scenario_router
from openhack.summary import format_checkpoint


def main():
    parser = argparse.ArgumentParser(description="Prepare scenario-router prompt for backlog generation.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    args = parser.parse_args()
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
        next_command=f"python3 scripts/commands/record-scenario-backlog.py {args.target} {args.run_id} router-result.json",
        next_command_label="Next command in approved routing phase:",
        proceed_prompt=None,
    ))


if __name__ == "__main__":
    main()
