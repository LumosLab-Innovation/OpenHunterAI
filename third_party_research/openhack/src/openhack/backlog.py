from __future__ import annotations

import json
from pathlib import Path

from .expert_scope import read_run_expert_scope
from .log import emit
from .models import CoverageDecision, CoverageGaps, CoveragePair, Scenario
from .paths import root, run_path
from .schemas import validate_scenario

REQUIRED = {
    "id",
    "recon_item_id",
    "expert",
    "target_path",
    "proof_question",
    "evidence_required",
    "security_invariant",
    "proof_obligations",
}
DECISIONS = {
    "scenario",
    "covered_by_scenario",
    "merged",
    "not_applicable",
    "needs_context",
    "out_of_scope",
}
DEFAULTS = {
    "priority": "normal",
    "routing_rationale": "Not supplied by scenario router.",
    "expected_finding_width": "unknown",
    "candidate_policy": "Promote only after source, sink, guard absence, and impact are evidenced.",
}


def _coverage_data(path: Path) -> CoverageGaps:
    coverage = path / "recon-output" / "coverage-gaps.json"
    if not coverage.exists():
        return {}
    return json.loads(coverage.read_text())


def _routing_units(path: Path) -> list[dict]:
    units = path / "recon-output" / "routing-units.jsonl"
    if not units.exists():
        return []
    return [
        json.loads(line)
        for line in units.read_text().splitlines()
        if line.strip()
    ]


def _scenario_paths(scenario: Scenario) -> set[str]:
    paths: set[str | None] = {scenario.get("target_path")}
    for value in (
        scenario.get("target_paths", []),
        scenario.get("related_paths", []),
        scenario.get("covered_paths", []),
    ):
        if isinstance(value, str):
            paths.add(value)
        else:
            paths.update(value)
    return {path for path in paths if path}


def _scenario_covers_path(scenarios: list[Scenario], target_path: str) -> bool:
    return any(target_path in _scenario_paths(scenario) for scenario in scenarios)


def _scenario_covers_pair(
    scenarios: list[Scenario], target_path: str, expert: str
) -> bool:
    return any(
        scenario["expert"] == expert
        and target_path in _scenario_paths(scenario)
        for scenario in scenarios
    )


def _decision_key(decision: CoverageDecision) -> tuple[str | None, str | None]:
    return (decision.get("path"), decision.get("expert"))


def _has_path_decision(decisions: dict, target_path: str) -> bool:
    return (
        (target_path, "*") in decisions
        or (target_path, None) in decisions
        or (target_path, "") in decisions
    )


def _has_pair_decision(decisions: dict, target_path: str, expert: str) -> bool:
    return (target_path, expert) in decisions


def _boundary_decision_key(
    decision: CoverageDecision,
) -> tuple[str | None, str | None, str | None]:
    return (decision.get("path"), decision.get("expert"), decision.get("boundary_id"))


def _has_boundary_decision(decisions: dict, requirement: CoveragePair) -> bool:
    boundary_id = requirement.get("boundary_id")
    if not boundary_id:
        return False
    return (requirement.get("path"), requirement.get("expert"), boundary_id) in decisions


def _unit_decision_key(
    decision: CoverageDecision,
) -> tuple[str | None, str | None]:
    return (decision.get("routing_unit_id"), decision.get("expert"))


def _has_unit_decision(decisions: dict, unit_id: str, expert: str) -> bool:
    return (unit_id, expert) in decisions


def _scenario_covers_unit(
    scenarios: list[Scenario], unit_id: str, expert: str
) -> bool:
    for scenario in scenarios:
        if scenario.get("expert") != expert:
            continue
        covered = scenario.get("covered_routing_unit_ids", [])
        if isinstance(covered, str):
            covered = [covered]
        if scenario.get("routing_unit_id") == unit_id or unit_id in covered:
            return True
    return False


def _scenario_covers_boundary(
    scenarios: list[Scenario], requirement: CoveragePair
) -> bool:
    boundary_id = requirement.get("boundary_id")
    recon_item_id = requirement.get("recon_item_id")
    expert = requirement.get("expert")
    for scenario in scenarios:
        if scenario.get("expert") != expert:
            continue
        covered = scenario.get("covered_boundary_ids", [])
        if isinstance(covered, str):
            covered = [covered]
        if boundary_id and (
            scenario.get("boundary_id") == boundary_id
            or boundary_id in covered
        ):
            return True
        if recon_item_id and scenario.get("recon_item_id") == recon_item_id:
            return True
    return False


def _validate_decisions(
    coverage_decisions: list[CoverageDecision],
    scenarios: list[Scenario],
    experts: set[str],
) -> list[str]:
    scenario_ids = {scenario["id"] for scenario in scenarios}
    errors = []
    for decision in coverage_decisions:
        target_path = decision.get("path")
        expert = decision.get("expert")
        value = decision.get("decision")
        reason = str(decision.get("reason", "")).strip()
        ids = decision.get("scenario_ids", [])
        if isinstance(ids, str):
            ids = [ids]
        if not target_path:
            errors.append("coverage_decision missing path")
        if value not in DECISIONS:
            errors.append(
                f"coverage_decision for {target_path}/{expert} has invalid decision: {value}"
            )
        if expert not in (None, "", "*") and expert not in experts:
            errors.append(
                f"coverage_decision for {target_path} references unknown expert: {expert}"
            )
        if value in {"covered_by_scenario", "merged", "scenario"}:
            missing = [scenario_id for scenario_id in ids if scenario_id not in scenario_ids]
            if not ids:
                errors.append(
                    f"coverage_decision for {target_path}/{expert} must reference scenario_ids"
                )
            if missing:
                errors.append(
                    f"coverage_decision for {target_path}/{expert} references unknown "
                    f"scenarios: {missing}"
                )
        elif len(reason) < 20:
            errors.append(
                f"coverage_decision for {target_path}/{expert} needs a concrete reason"
            )
    return errors


def coverage_errors(
    path: Path,
    scenarios: list[Scenario],
    coverage_decisions: list[CoverageDecision],
) -> list[str]:
    coverage = _coverage_data(path)
    decisions = {_decision_key(decision): decision for decision in coverage_decisions}
    boundary_decisions = {
        _boundary_decision_key(decision): decision
        for decision in coverage_decisions
        if decision.get("boundary_id")
    }
    unit_decisions = {
        _unit_decision_key(decision): decision
        for decision in coverage_decisions
        if decision.get("routing_unit_id")
    }
    experts = {p.stem for p in (root() / "agents" / "experts").glob("*.md")}
    errors = _validate_decisions(coverage_decisions, scenarios, experts)

    for gap in coverage.get("input_with_sink_or_exposure", []):
        target_path = gap["path"]
        if (
            not _scenario_covers_path(scenarios, target_path)
            and not _has_path_decision(decisions, target_path)
        ):
            errors.append(
                "missing path coverage for "
                f"{target_path}: create at least one scenario or add a path-level "
                "coverage_decision"
            )

    for routing_req in coverage.get("routing_requirements", []):
        target_path = routing_req["path"]
        expert = routing_req["expert"]
        if (
            not _scenario_covers_pair(scenarios, target_path, expert)
            and not _has_pair_decision(decisions, target_path, expert)
        ):
            errors.append(
                "missing expert coverage for "
                f"{target_path} -> {expert}: create a scenario or add an "
                "expert-specific coverage_decision"
            )

    for boundary_req in coverage.get("boundary_requirements", []):
        target_path = boundary_req["path"]
        expert = boundary_req["expert"]
        boundary_id = boundary_req.get("boundary_id")
        endpoint = boundary_req.get("endpoint", boundary_id)
        if (
            not _scenario_covers_boundary(scenarios, boundary_req)
            and not _has_boundary_decision(boundary_decisions, boundary_req)
        ):
            errors.append(
                "missing request-boundary coverage for "
                f"{target_path} -> {expert} -> {endpoint}: create a scenario "
                "using this boundary_id/recon_item_id or add a boundary-specific "
                "coverage_decision"
            )
    for unit in _routing_units(path):
        unit_id = unit.get("unit_id")
        if not unit_id or unit.get("coverage") not in {"mandatory", "mandatory_path"}:
            continue
        required_experts = unit.get("required_experts", [])
        if not required_experts and unit.get("coverage") == "mandatory_path":
            if (
                not _scenario_covers_path(scenarios, unit["path"])
                and not _has_path_decision(decisions, unit["path"])
            ):
                errors.append(
                    "missing routing-unit path coverage for "
                    f"{unit_id} {unit['path']}: create at least one scenario "
                    "or add a path-level coverage_decision"
                )
            continue
        for expert in required_experts:
            if (
                not _scenario_covers_unit(scenarios, unit_id, expert)
                and not _has_unit_decision(unit_decisions, unit_id, expert)
            ):
                errors.append(
                    "missing routing-unit expert coverage for "
                    f"{unit_id} {unit['path']} -> {expert}: create a scenario "
                    "with routing_unit_id or add a unit-specific coverage_decision"
                )
    return errors


def record_backlog(target: str, run_id: str, router_result: Path) -> list[Scenario]:
    path = run_path(target, run_id)
    data = json.loads(router_result.read_text())
    scenarios = data.get("scenarios", [])
    coverage_decisions = data.get("coverage_decisions", [])
    experts = {p.stem for p in (root() / "agents" / "experts").glob("*.md")}
    scope = read_run_expert_scope(path)
    selected_experts = set(scope["experts"]) if scope else experts
    seen = set()
    for scenario in scenarios:
        missing = REQUIRED - set(scenario)
        if missing:
            raise ValueError(f"Scenario {scenario.get('id')} missing: {sorted(missing)}")
        validate_scenario(scenario)
        if scenario["expert"] not in experts:
            raise ValueError(f"Unknown expert: {scenario['expert']}")
        obligation_ids = [
            obligation.get("id")
            for obligation in scenario.get("proof_obligations", [])
        ]
        if len(obligation_ids) != len(set(obligation_ids)):
            raise ValueError(
                f"Scenario {scenario['id']} has duplicate proof obligation ids"
            )
        if scenario["expert"] not in selected_experts:
            raise ValueError(
                f"Scenario {scenario['id']} uses unselected expert: "
                f"{scenario['expert']}"
            )
        if scenario["id"] in seen:
            raise ValueError(f"Duplicate scenario id: {scenario['id']}")
        seen.add(scenario["id"])
        for key, value in DEFAULTS.items():
            scenario.setdefault(key, value)
        scenario.setdefault("result_location", f"scenarios/finished/{scenario['id']}.json")

    errors = coverage_errors(path, scenarios, coverage_decisions)
    if errors:
        detail = "\n".join(f"- {error}" for error in errors[:25])
        if len(errors) > 25:
            detail += f"\n- ... {len(errors) - 25} more coverage errors"
        raise ValueError(f"Scenario backlog does not cover recon evidence:\n{detail}")

    coverage_out = path / "scenarios" / "coverage-decisions.json"
    coverage_out.write_text(json.dumps({
        "coverage_notes": data.get("coverage_notes", []),
        "coverage_decisions": coverage_decisions,
    }, indent=2, sort_keys=True) + "\n")
    for scenario in scenarios:
        out = path / "scenarios" / "backlog" / f"{scenario['id']}.json"
        out.write_text(json.dumps(scenario, indent=2, sort_keys=True) + "\n")
    index = path / "scenarios" / "index.jsonl"
    index.write_text("".join(json.dumps(s, sort_keys=True) + "\n" for s in scenarios))
    emit(
        path,
        "scenario-router",
        "complete",
        f"Recorded {len(scenarios)} agent-selected scenarios",
        evidence=[str(index), str(coverage_out)],
    )
    return scenarios
