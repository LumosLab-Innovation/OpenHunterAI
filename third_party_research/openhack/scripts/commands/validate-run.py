#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.validate import validate_run
from openhack.summary import format_checkpoint


def main():
    parser = argparse.ArgumentParser(description="Validate openhack layout and run artifacts.")
    parser.add_argument("target", nargs="?")
    parser.add_argument("run_id", nargs="?")
    args = parser.parse_args()
    errors = validate_run(args.target, args.run_id)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit(1)
    scope = f"{args.target}/{args.run_id}" if args.target and args.run_id else "repository"
    print(format_checkpoint(
        "Validate",
        f"Validation passed for {scope}.",
        review="Use summarize-run.py for the final run counts before handoff.",
    ))


if __name__ == "__main__":
    main()
