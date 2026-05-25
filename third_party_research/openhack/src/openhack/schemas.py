from __future__ import annotations

import json
from typing import Any

from jsonschema import Draft202012Validator

from .models import Finding, FindingCandidate, FindingTriage, Scenario, ScenarioResult
from .paths import root


def _schema(name: str) -> dict[str, Any]:
    return json.loads((root() / "config" / name).read_text())


def _path(error: Any) -> str:
    if not error.path:
        return "$"
    return "$." + ".".join(str(part) for part in error.path)


def validate_with_schema(name: str, value: Any, label: str) -> None:
    validator = Draft202012Validator(_schema(name))
    errors = sorted(validator.iter_errors(value), key=lambda error: list(error.path))
    if not errors:
        return
    details = "\n".join(f"- {_path(error)}: {error.message}" for error in errors[:20])
    if len(errors) > 20:
        details += f"\n- ... {len(errors) - 20} more schema errors"
    raise ValueError(f"{label} does not match {name}:\n{details}")


def validate_scenario(scenario: Scenario) -> None:
    validate_with_schema("scenario-schema.json", scenario, f"scenario {scenario.get('id')}")


def validate_finding(finding: Finding) -> None:
    validate_with_schema("finding-schema.json", finding, f"finding {finding.get('title')}")


def validate_finding_candidate(candidate: FindingCandidate) -> None:
    validate_with_schema(
        "finding-candidate-schema.json",
        candidate,
        f"finding candidate {candidate.get('candidate_id')}",
    )


def validate_finding_triage(triage: FindingTriage) -> None:
    validate_with_schema(
        "finding-triage-schema.json",
        triage,
        f"finding triage {triage.get('candidate_id')}",
    )


def validate_result(result: ScenarioResult, scenario_id: str | None = None) -> None:
    label = f"result {scenario_id}" if scenario_id else "scenario result"
    validate_with_schema("scenario-result-schema.json", result, label)
