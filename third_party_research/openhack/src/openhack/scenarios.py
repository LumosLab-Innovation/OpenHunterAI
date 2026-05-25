from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from .expert_scope import filter_agent_registry, require_run_expert_scope
from .log import emit
from .paths import root, run_path
from .router_context import load_inventory, read_jsonl, routing_paths


MAX_RECON_ITEMS_PER_PATH = 3
MAX_RECON_ITEMS = 300


def _expert_routing_context(experts: Iterable[str]) -> str:
    selected = set(experts)
    parts = []
    for expert in sorted((root() / "agents" / "experts").glob("*.md")):
        if expert.stem not in selected:
            continue
        parts.append(f"### Expert: {expert.stem}\n\n{expert.read_text()}")
    return "\n\n".join(parts)


def _compact_recon_items(items: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    compact: list[dict] = []
    for item in items:
        item_path = item.get("path", "")
        counts[item_path] = counts.get(item_path, 0) + 1
        if counts[item_path] > MAX_RECON_ITEMS_PER_PATH:
            continue
        compact.append(item)
        if len(compact) >= MAX_RECON_ITEMS:
            break
    return compact


def prepare_scenario_router(target: str, run_id: str) -> Path:
    path = run_path(target, run_id)
    experts = require_run_expert_scope(path)
    inventory = load_inventory(path)
    paths = routing_paths(inventory.get("coverage_gaps", {}))
    items = [
        item for item in read_jsonl(path / "recon-output" / "recon-items.jsonl")
        if not paths or item.get("path") in paths
    ]
    routing_units = inventory.get("routing_units", [])
    if routing_units:
        items = _compact_recon_items(items)
    template = (root() / "templates" / "scenario-router-prompt.md").read_text()
    text = template.replace(
        "<routing_units_json>",
        json.dumps(routing_units, separators=(",", ":")),
    )
    text = text.replace("<recon_items_json>", json.dumps(items, separators=(",", ":")))
    text = text.replace(
        "<recon_inventory_json>",
        json.dumps(
            {
                key: value for key, value in inventory.items()
                if key not in {"routing_units", "inventory_samples"}
            },
            separators=(",", ":"),
        ),
    )
    text = text.replace(
        "<agent_registry_json>",
        json.dumps(filter_agent_registry(experts), separators=(",", ":")),
    )
    if not routing_units:
        text += "\n\n## All Expert Routing Context\n\n"
        text += _expert_routing_context(experts)
    text += "\n\n## Scenario Router Manifest\n\n"
    text += (root() / "agents" / "orchestration" / "scenario-router.md").read_text()
    out = path / "scenarios" / "scenario-router-prompt.md"
    out.write_text(text)
    detail = (
        f"Prepared agent prompt for {len(routing_units)} routing units"
        if routing_units
        else f"Prepared agent prompt for {len(items)} recon items"
    )
    emit(path, "scenario-router", "needs_agent", detail, evidence=[str(out)])
    return out


def render_prompt(target: str, run_id: str, scenario_id: str) -> Path:
    path = run_path(target, run_id)
    scenario = json.loads((path / "scenarios" / "backlog" / f"{scenario_id}.json").read_text())
    scenario["scenario_id"] = scenario["id"]
    scenario.setdefault("routing_unit_id", "legacy-no-routing-unit")
    scenario.setdefault(
        "security_invariant",
        "Legacy scenario without an explicit security invariant; use the proof question as the invariant.",
    )
    scenario.setdefault(
        "proof_obligations",
        [{
            "id": "legacy_main_question",
            "question": scenario.get("proof_question", "Answer the scenario proof question."),
            "evidence_required": scenario.get("evidence_required", "Cited source evidence is required."),
            "central": True,
        }],
    )
    text = (root() / "templates" / "scenario-prompt.md").read_text()
    for key, value in scenario.items():
        if isinstance(value, (dict, list)):
            rendered = json.dumps(value, indent=2, sort_keys=True)
        else:
            rendered = str(value)
        text = text.replace(f"<{key}>", rendered)
    expert = root() / "agents" / "experts" / f"{scenario['expert']}.md"
    text += f"\n\n## Expert Manifest\n\n{expert.read_text()}"
    out = path / "scenarios" / "backlog" / f"{scenario_id}.md"
    out.write_text(text)
    emit(path, "scenario-router", "prompted", f"Rendered prompt for {scenario_id}", evidence=[str(out)])
    return out
