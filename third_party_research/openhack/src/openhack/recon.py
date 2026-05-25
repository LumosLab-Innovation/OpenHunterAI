from __future__ import annotations

from typing import Iterable, cast

from .expert_scope import require_run_expert_scope, set_run_expert_scope, scope_summary
from .coverage import write_coverage
from .inventory import hits, signals, write_jsonl
from .inventory_patterns import DETAILS, SKIP
from .log import emit
from .models import Inventory, InventoryRow, ReconItem
from .paths import run_path
from .request_boundaries import extract_request_boundaries
from .routing_units import write_routing_units
from .semgrep_recon import run_semgrep_recon


def run_recon(
    target: str,
    run_id: str,
    use_semgrep: bool = False,
    semgrep_configs: Iterable[str] | None = None,
    experts: Iterable[str] | None = None,
    all_agents: bool = False,
) -> list[ReconItem]:
    path = run_path(target, run_id)
    if experts or all_agents:
        selected_experts = set_run_expert_scope(path, experts, all_agents)
    else:
        selected_experts = require_run_expert_scope(path)
    rows: list[ReconItem] = []
    inventory: Inventory = {name: [] for name in DETAILS}
    for file in (path / "sourcecode").rglob("*"):
        if not file.is_file() or any(part in SKIP for part in file.parts):
            continue
        try:
            text = file.read_text(errors="ignore")[:500000]
        except OSError:
            continue
        rel = file.relative_to(path / "sourcecode").as_posix()
        for kind in DETAILS:
            inventory[kind].extend(hits(rel, text, kind))
        sigs = signals(text)
        if sigs:
            rows.append(cast(ReconItem, {
                "id": f"R{len(rows)+1:03d}",
                "type": sigs[0],
                "path": rel,
                "signals": sigs,
            }))
    boundaries = extract_request_boundaries(path / "sourcecode")
    inventory["request_boundaries"] = cast(list[InventoryRow], boundaries)
    for boundary in boundaries:
        recon_id = f"R{len(rows)+1:03d}"
        boundary["recon_item_id"] = recon_id
        rows.append(cast(ReconItem, {
            "id": recon_id,
            "type": "request-boundary",
            "path": boundary["path"],
            "signals": boundary.get("trust_signals", []),
            "boundary_id": boundary["id"],
            "endpoint": boundary.get("endpoint"),
            "methods": boundary.get("methods", []),
            "boundary_type": boundary.get("boundary_type"),
            "request_fields": boundary.get("request_fields", []),
        }))
    semgrep = None
    if use_semgrep:
        semgrep = run_semgrep_recon(path, semgrep_configs)
        rows.extend(semgrep["recon_items"])
        for kind, values in semgrep["inventory"].items():
            inventory[kind].extend(values)
    out = write_jsonl(path, "recon-items", rows)
    evidence = [str(out)] + [str(write_jsonl(path, k, v)) for k, v in inventory.items()]
    if semgrep:
        evidence.append(str(semgrep["raw"]))
    evidence.append(str(write_coverage(path, inventory, rows)))
    evidence.append(str(write_routing_units(path, inventory, rows)))
    summary = (
        f"Recorded {len(rows)} recon items, lightweight inventories, and routing units "
        f"for {scope_summary(selected_experts)}"
    )
    if semgrep:
        summary += f" with {len(semgrep['results'])} Semgrep hints"
    emit(path, "source-recon", "complete", summary, evidence=evidence)
    return rows
