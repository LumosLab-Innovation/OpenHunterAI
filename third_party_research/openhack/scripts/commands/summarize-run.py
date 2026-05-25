#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from openhack.summary import summarize_run


def main():
    parser = argparse.ArgumentParser(description="Summarize a run.")
    parser.add_argument("target")
    parser.add_argument("run_id")
    args = parser.parse_args()
    print("\n".join(summarize_run(args.target, args.run_id)))


if __name__ == "__main__":
    main()
