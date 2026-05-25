from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .backlog import coverage_errors
from .models import CoverageDecision, Scenario, ScenarioResult
from .paths import RUN_DIRS, TRIAGE_RUN_DIRS, root, run_path
from .results import MAX_BUNDLE_RESULTS, result_integrity_errors
from .schemas import (
    validate_finding_candidate,
    validate_finding_triage,
    validate_result,
    validate_scenario,
)
from .triage import ACCEPTING_DECISIONS, triage_prompt_sha256

BULK_EXACT_THRESHOLD = 20
BULK_TEMPLATE_THRESHOLD = 20
BULK_SHAPE_THRESHOLD = 100


def _loc(path: Path) -> int:
    return len(path.read_text().splitlines())


def _count_files(path: Path, pattern: str) -> int:
    return len(list(path.glob(pattern))) if path.exists() else 0


def _count_lines(path: Path) -> int:
    return len(path.read_text().splitlines()) if path.exists() else 0


def _parse_scalar(value: str) -> bool | int | str | None:
    value = value.strip().strip('"')
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    if value.lower() == "null":
        return None
    if value.isdigit():
        return int(value)
    return value


def _quality_gates(path: Path) -> dict[str, Any]:
    config = path / "run-config.yaml"
    if not config.exists():
        return {}
    gates: dict[str, Any] = {}
    in_section = False
    for raw in config.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        stripped = raw.strip()
        if indent == 0:
            key = stripped.split(":", 1)[0]
            in_section = key == "quality_gates"
            continue
        if in_section and ":" in stripped:
            key, value = stripped.split(":", 1)
            gates[key.strip()] = _parse_scalar(value)
    return gates


def _scenario_ids(path: Path) -> set[str]:
    ids: set[str] = set()
    for folder in ["scenarios/backlog", "scenarios/finished"]:
        ids.update(p.stem for p in (path / folder).glob("S*.json"))
    return ids


def _ids_in(folder: Path) -> set[str]:
    return {p.stem for p in folder.glob("S*.json")} if folder.exists() else set()


def _candidate_ids(path: Path) -> set[str]:
    return {
        p.stem
        for p in (path / "finding-candidates").glob("S*-F*.json")
    } if (path / "finding-candidates").exists() else set()


def _triage_ids(path: Path) -> set[str]:
    return {
        p.stem
        for p in (path / "finding-triage" / "decisions").glob("S*-F*.json")
    } if (path / "finding-triage" / "decisions").exists() else set()


def _read_scenarios(path: Path) -> list[Scenario]:
    return [
        json.loads(item.read_text())
        for item in sorted((path / "scenarios" / "backlog").glob("S*.json"))
    ]


def _coverage_decisions(path: Path) -> list[CoverageDecision]:
    coverage = path / "scenarios" / "coverage-decisions.json"
    if not coverage.exists():
        return []
    return json.loads(coverage.read_text()).get("coverage_decisions", [])


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip().lower()


def _template_text(value: Any) -> str:
    text = _normalize_text(value)
    text = re.sub(r"\bs[0-9]{3,}\b", "s###", text)
    text = re.sub(r"\bline [0-9]+\b", "line #", text)
    text = re.sub(r"(?:[a-z0-9_.-]+/)+[a-z0-9_.-]+", "<path>", text)
    text = re.sub(r"`[^`]+`", "`<value>`", text)
    text = re.sub(r"representative line:.*$", "representative line: <snippet>", text)
    return text


def _result_signature(result: ScenarioResult) -> tuple[Any, ...]:
    evidence_notes = [
        _normalize_text(item.get("note", ""))
        for item in result.get("evidence", [])
        if isinstance(item, dict)
    ]
    return (
        result.get("status"),
        result.get("expert"),
        _normalize_text(result.get("summary", "")),
        tuple(evidence_notes),
        len(result.get("findings", [])),
    )


def _result_template_signature(result: ScenarioResult) -> tuple[Any, ...]:
    evidence_notes = [
        _template_text(item.get("note", ""))
        for item in result.get("evidence", [])
        if isinstance(item, dict)
    ]
    return (
        result.get("status"),
        result.get("expert"),
        _template_text(result.get("summary", "")),
        tuple(evidence_notes),
        len(result.get("findings", [])),
    )


def _result_shape_signature(result: ScenarioResult) -> tuple[Any, ...]:
    evidence_roles = [
        _normalize_text(item.get("role", ""))
        for item in result.get("evidence", [])
        if isinstance(item, dict)
    ]
    return (
        result.get("status"),
        result.get("expert"),
        len(evidence_roles),
        tuple(evidence_roles),
        len(result.get("findings", [])),
    )


def _bulk_log_errors(path: Path) -> list[str]:
    errors: list[str] = []
    log = path / "logs" / "events.jsonl"
    if not log.exists():
        return errors
    for line in log.read_text().splitlines():
        try:
            event = json.loads(line)
        except Exception:
            continue
        if event.get("actor") != "result-recorder":
            continue
        match = re.search(r"Recorded bundled results for ([0-9]+) scenarios", event.get("summary", ""))
        if match and int(match.group(1)) > MAX_BUNDLE_RESULTS:
            errors.append(
                "bulk result recorder event exceeds bundle cap: "
                f"{match.group(1)} scenarios were recorded from one bundle"
            )
    return errors


def _bulk_result_errors(path: Path) -> list[str]:
    exact_groups: dict[tuple[Any, ...], list[str]] = defaultdict(list)
    template_groups: dict[tuple[Any, ...], list[str]] = defaultdict(list)
    shape_groups: dict[tuple[Any, ...], list[str]] = defaultdict(list)
    for result_file in sorted((path / "scenarios" / "finished").glob("S*.json")):
        try:
            result = json.loads(result_file.read_text())
        except Exception:
            continue
        exact_groups[_result_signature(result)].append(result_file.stem)
        template_groups[_result_template_signature(result)].append(result_file.stem)
        shape_groups[_result_shape_signature(result)].append(result_file.stem)
    errors: list[str] = []
    for scenario_ids in exact_groups.values():
        if len(scenario_ids) >= BULK_EXACT_THRESHOLD:
            sample = ", ".join(scenario_ids[:10])
            errors.append(
                "possible bulk or templated scenario results: "
                f"{len(scenario_ids)} finished results share the same status, "
                f"expert, summary, evidence notes, and finding count ({sample})"
            )
    for scenario_ids in template_groups.values():
        if len(scenario_ids) >= BULK_TEMPLATE_THRESHOLD:
            sample = ", ".join(scenario_ids[:10])
            errors.append(
                "possible templated scenario results: "
                f"{len(scenario_ids)} finished results share the same normalized "
                f"status, expert, summary shape, evidence-note shape, and finding "
                f"count ({sample})"
            )
    for scenario_ids in shape_groups.values():
        if len(scenario_ids) >= BULK_SHAPE_THRESHOLD:
            sample = ", ".join(scenario_ids[:10])
            errors.append(
                "possible bulk scenario results: "
                f"{len(scenario_ids)} finished results share the same status, "
                f"expert, evidence role shape, and finding count ({sample})"
            )
    errors.extend(_bulk_log_errors(path))
    return errors


def validate_repo() -> list[str]:
    base = root()
    errors: list[str] = []
    for name in ["config", "agents", "scripts", "src", "runs", "templates", "docs"]:
        if not (base / name).exists():
            errors.append(f"missing {name}/")
    if not (base / "pyproject.toml").exists():
        errors.append("missing pyproject.toml")
    for name in [
        "scenario-schema.json",
        "finding-schema.json",
        "finding-candidate-schema.json",
        "finding-triage-schema.json",
        "scenario-result-schema.json",
    ]:
        try:
            json.loads((base / "config" / name).read_text())
        except Exception as exc:
            errors.append(f"invalid schema file {name}: {exc}")
    if (base / "tools").exists():
        errors.append("top-level tools/ is not allowed")
    commands = list((base / "scripts" / "commands").glob("*.py"))
    if len(commands) > 20:
        errors.append(f"too many public python commands: {len(commands)}")
    for command in commands:
        if _loc(command) > 50:
            errors.append(f"wrapper over 50 LOC: {command}")
    return errors


def validate_run(target: str | None = None, run_id: str | None = None) -> list[str]:
    errors = validate_repo()
    if target and run_id:
        path = run_path(target, run_id)
        for name in RUN_DIRS:
            if not (path / name).exists():
                errors.append(f"missing run dir: {name}")
        for name in ["run-config.yaml", "run-state.jsonl", "trace.jsonl"]:
            if not (path / name).exists():
                errors.append(f"missing run artifact: {name}")
        recon_items = _count_lines(path / "recon-output" / "recon-items.jsonl")
        backlog = _count_files(path / "scenarios" / "backlog", "S*.json")
        finished = _count_files(path / "scenarios" / "finished", "S*.json")
        rendered = _count_files(path / "scenarios" / "backlog", "S*.md")
        backlog_ids = _ids_in(path / "scenarios" / "backlog")
        finished_ids = _ids_in(path / "scenarios" / "finished")
        candidate_ids = _candidate_ids(path)
        triage_ids = _triage_ids(path)
        unknown_finished = sorted(finished_ids - backlog_ids)
        if unknown_finished:
            errors.append(
                "finished results without matching backlog scenarios: "
                + ", ".join(unknown_finished)
            )
        for scenario_file in sorted((path / "scenarios" / "backlog").glob("S*.json")):
            try:
                scenario = json.loads(scenario_file.read_text())
                validate_scenario(scenario)
                if scenario.get("id") != scenario_file.stem:
                    errors.append(
                        f"scenario id mismatch: {scenario_file} contains {scenario.get('id')}"
                    )
            except Exception as exc:
                errors.append(f"invalid scenario {scenario_file}: {exc}")
        for result_file in sorted((path / "scenarios" / "finished").glob("S*.json")):
            try:
                result = json.loads(result_file.read_text())
                validate_result(result, result_file.stem)
                for error in result_integrity_errors(path, result_file.stem, result):
                    errors.append(f"invalid result {result_file}: {error}")
            except Exception as exc:
                errors.append(f"invalid result {result_file}: {exc}")
        for candidate_file in sorted((path / "finding-candidates").glob("S*-F*.json")):
            try:
                candidate = json.loads(candidate_file.read_text())
                validate_finding_candidate(candidate)
                if candidate.get("candidate_id") != candidate_file.stem:
                    errors.append(
                        f"finding candidate id mismatch: {candidate_file} "
                        f"contains {candidate.get('candidate_id')}"
                    )
                if candidate.get("scenario_id") not in finished_ids:
                    errors.append(
                        f"finding candidate without finished scenario result: {candidate_file}"
                    )
            except Exception as exc:
                errors.append(f"invalid finding candidate {candidate_file}: {exc}")
        for triage_file in sorted((path / "finding-triage" / "decisions").glob("S*-F*.json")):
            try:
                triage = json.loads(triage_file.read_text())
                validate_finding_triage(triage)
                if triage.get("candidate_id") != triage_file.stem:
                    errors.append(
                        f"finding triage id mismatch: {triage_file} "
                        f"contains {triage.get('candidate_id')}"
                    )
                if triage_file.stem not in candidate_ids:
                    errors.append(f"finding triage without candidate: {triage_file}")
                expected_hash = triage_prompt_sha256(path, triage_file.stem)
                if not expected_hash:
                    errors.append(f"missing finding triage prompt: {triage_file.stem}")
                elif triage.get("triage_prompt_sha256") != expected_hash:
                    errors.append(
                        f"invalid finding triage {triage_file}: "
                        "triage_prompt_sha256 mismatch"
                    )
                if triage.get("decision") in ACCEPTING_DECISIONS:
                    matches = list((path / "findings").glob(f"{triage_file.stem.lower()}-*.md"))
                    if not matches:
                        errors.append(
                            f"accepted finding triage did not materialize a finding: {triage_file}"
                        )
            except Exception as exc:
                errors.append(f"invalid finding triage {triage_file}: {exc}")
        errors.extend(_bulk_result_errors(path))
        if recon_items and not backlog and not finished:
            errors.append("run stalled after recon: no scenarios recorded")
        gates = _quality_gates(path)
        if gates.get("require_finding_triage"):
            for name in TRIAGE_RUN_DIRS:
                if not (path / name).exists():
                    errors.append(f"missing run dir: {name}")
        scenario_count = len(_scenario_ids(path))
        min_scenarios = gates.get("min_scenarios")
        if recon_items and min_scenarios is not None and scenario_count < int(min_scenarios):
            errors.append(
                f"scenario backlog below quality gate: {scenario_count} recorded, "
                f"minimum {min_scenarios}"
            )
        if recon_items and gates.get("require_backlog_recorded"):
            index = path / "scenarios" / "index.jsonl"
            if not index.exists() or _count_lines(index) == 0:
                errors.append("quality gate failed: scenario backlog index not recorded")
        if gates.get("require_rendered_prompts") and backlog and rendered < backlog:
            errors.append(
                f"quality gate failed: only {rendered} rendered prompts for {backlog} backlog scenarios"
            )
        if gates.get("require_all_backlog_finished") and backlog and finished_ids != backlog_ids:
            missing = sorted(backlog_ids - finished_ids)
            extra = sorted(finished_ids - backlog_ids)
            detail = []
            if missing:
                detail.append(f"missing finished results: {', '.join(missing)}")
            if extra:
                detail.append(f"unexpected finished results: {', '.join(extra)}")
            errors.append(
                "quality gate failed: finished result set does not match backlog "
                f"({'; '.join(detail)})"
            )
        if gates.get("require_finding_triage") and candidate_ids != triage_ids:
            missing = sorted(candidate_ids - triage_ids)
            extra = sorted(triage_ids - candidate_ids)
            detail = []
            if missing:
                detail.append(f"missing triage decisions: {', '.join(missing)}")
            if extra:
                detail.append(f"unexpected triage decisions: {', '.join(extra)}")
            errors.append(
                "quality gate failed: finding candidate set does not match "
                f"triage decisions ({'; '.join(detail)})"
            )
        if backlog and gates.get("require_explicit_router_coverage", True):
            errors.extend(
                f"coverage gate failed: {error}"
                for error in coverage_errors(
                    path,
                    _read_scenarios(path),
                    _coverage_decisions(path),
                )
            )
    return errors
