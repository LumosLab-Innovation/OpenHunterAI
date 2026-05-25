#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.queue import expert_queue


def main():
    parser = argparse.ArgumentParser(description="Print unfinished scenarios to dispatch per expert.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    parser.add_argument("--expert")
    parser.add_argument("--limit", type=int, default=8)
    args = parser.parse_args()
    scenarios = expert_queue(args.target, args.run_id, args.expert, args.limit)
    print(json.dumps({
        "target": args.target,
        "run_id": args.run_id,
        "expert": args.expert,
        "limit": args.limit,
        "count": len(scenarios),
        "scenarios": scenarios,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
