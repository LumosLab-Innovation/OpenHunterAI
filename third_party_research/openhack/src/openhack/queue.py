from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .paths import run_path
from .results import scenario_prompt_sha256


def _scenario_sort_key(path: Path) -> int | str:
    stem = path.stem
    return int(stem[1:]) if stem.startswith("S") and stem[1:].isdigit() else stem


def expert_queue(
    target: str, run_id: str, expert: str | None = None, limit: int = 8
) -> list[dict[str, Any]]:
    path = run_path(target, run_id)
    finished = {item.stem for item in (path / "scenarios" / "finished").glob("S*.json")}
    queued: list[dict[str, Any]] = []
    for scenario_file in sorted(
        (path / "scenarios" / "backlog").glob("S*.json"),
        key=_scenario_sort_key,
    ):
        if scenario_file.stem in finished:
            continue
        scenario = json.loads(scenario_file.read_text())
        if expert and scenario["expert"] != expert:
            continue
        scenario_id = scenario["id"]
        prompt = path / "scenarios" / "backlog" / f"{scenario_id}.md"
        queued.append({
            "scenario_id": scenario_id,
            "expert": scenario["expert"],
            "target_path": scenario["target_path"],
            "prompt": str(prompt),
            "scenario_prompt_sha256": scenario_prompt_sha256(path, scenario_id),
            "dispatch_rule": "spawn exactly one subagent with this prompt; record exactly one result",
        })
        if len(queued) >= limit:
            break
    return queued
