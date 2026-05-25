from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from typing import Any, cast

from .log import emit
from .models import Finding, FindingCandidate, FindingTriage, ScenarioResult, Severity
from .paths import root, run_path
from .results import (
    _finding_md,
    _finding_values,
    _slug,
    _source_path,
)
from .schemas import (
    validate_finding,
    validate_finding_candidate,
    validate_finding_triage,
)

ACCEPTING_DECISIONS = {"accepted", "downgraded"}


def _format_json(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True)


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def _load_candidate(path: Path, candidate_id: str) -> FindingCandidate:
    candidate_file = path / "finding-candidates" / f"{candidate_id}.json"
    if not candidate_file.exists():
        raise ValueError(f"Unknown finding candidate: {candidate_id}")
    candidate = _load_json(candidate_file)
    validate_finding_candidate(candidate)
    return candidate


def _load_scenario_result(path: Path, scenario_id: str) -> ScenarioResult:
    result_file = path / "scenarios" / "finished" / f"{scenario_id}.json"
    if not result_file.exists():
        raise ValueError(f"Missing scenario result for candidate {scenario_id}")
    return _load_json(result_file)


def triage_prompt_sha256(path: Path, candidate_id: str) -> str | None:
    prompt = path / "finding-triage" / "prompts" / f"{candidate_id}.md"
    if not prompt.exists():
        return None
    return sha256(prompt.read_bytes()).hexdigest()


def _run_source(path: Path) -> str:
    config = path / "run-config.yaml"
    if not config.exists():
        return "Run config is missing."
    lines = []
    for raw in config.read_text().splitlines():
        if (
            raw.startswith("target:")
            or raw.startswith("run_id:")
            or raw.strip().startswith("commit:")
        ):
            lines.append(raw)
    return "\n".join(lines) or "No run source summary available."


def _existing_finding_summaries(path: Path, candidate_id: str) -> list[dict[str, str]]:
    rows = []
    for finding in sorted((path / "findings").glob("*.md")):
        if finding.name.startswith(candidate_id.lower() + "-"):
            continue
        title = finding.read_text(errors="replace").splitlines()[0:1]
        rows.append({
            "path": str(finding.relative_to(path)),
            "title": title[0] if title else finding.stem,
        })
    return rows


def render_triage_prompt(target: str, run_id: str, candidate_id: str) -> Path:
    path = run_path(target, run_id)
    candidate = _load_candidate(path, candidate_id)
    scenario_result = _load_scenario_result(path, candidate["scenario_id"])
    template = (root() / "templates" / "finding-triage-prompt.md").read_text()
    values = {
        "candidate_id": candidate_id,
        "run_source": _run_source(path),
        "shared_protocol": (
            root() / "agents" / "shared" / "protocol.md"
        ).read_text(),
        "finding_triage_agent": (
            root() / "agents" / "orchestration" / "finding-triage.md"
        ).read_text(),
        "candidate_json": _format_json(candidate),
        "scenario_result_json": _format_json(scenario_result),
        "existing_findings_json": _format_json(
            _existing_finding_summaries(path, candidate_id)
        ),
        "result_template_json": (
            root() / "templates" / "finding-triage-result.json"
        ).read_text(),
    }
    for key, value in values.items():
        template = template.replace(f"<{key}>", value)
    out = path / "finding-triage" / "prompts" / f"{candidate_id}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(template)
    emit(
        path,
        "finding-triage",
        "prompt-rendered",
        f"Rendered triage prompt for {candidate_id}",
        evidence=[str(out)],
    )
    return out


def _clear_final_finding(path: Path, candidate_id: str) -> None:
    for item in (path / "findings").glob(f"{candidate_id.lower()}-*.md"):
        item.unlink()


def _triage_integrity_errors(
    path: Path, candidate_id: str, result: FindingTriage
) -> list[str]:
    errors = []
    expected_hash = triage_prompt_sha256(path, candidate_id)
    if not expected_hash:
        errors.append(f"rendered finding triage prompt is missing for {candidate_id}")
    elif result.get("triage_prompt_sha256") != expected_hash:
        errors.append(
            f"triage_prompt_sha256 mismatch for {candidate_id}: expected {expected_hash}"
        )
    for reviewed_file in result.get("reviewed_files", []):
        source = _source_path(path, reviewed_file)
        if not source or not source.exists() or not source.is_file():
            errors.append(f"reviewed file is not in source checkout: {reviewed_file}")
    if result.get("decision") in ACCEPTING_DECISIONS:
        if result.get("final_severity") == "not_applicable":
            errors.append("accepted or downgraded triage requires a final severity")
    else:
        if result.get("decision") == "duplicate" and not result.get("duplicate_of"):
            errors.append("duplicate triage requires duplicate_of")
    triage_agent_id = result.get("triage_agent_id")
    if triage_agent_id:
        for decision_file in (path / "finding-triage" / "decisions").glob("S*-F*.json"):
            if decision_file.stem == candidate_id:
                continue
            try:
                existing = _load_json(decision_file)
            except Exception:
                continue
            if existing.get("triage_agent_id") == triage_agent_id:
                errors.append(
                    f"triage_agent_id {triage_agent_id} already recorded for {decision_file.stem}"
                )
                break
    return errors


def _final_finding(
    candidate: FindingCandidate,
    scenario_result: ScenarioResult,
    triage_result: FindingTriage,
) -> Finding:
    finding = cast(Finding, dict(candidate["finding"]))
    finding.update(triage_result.get("finding") or {})
    # ``final_severity`` is FinalSeverity (includes ``not_applicable``) while
    # Finding.severity is Severity (includes ``unknown``). This branch only runs
    # for accepted/downgraded triage, where ``not_applicable`` is rejected
    # upstream by ``_triage_integrity_errors``.
    finding["severity"] = cast(Severity, triage_result["final_severity"])
    finding["severity_rationale"] = triage_result["severity_rationale"]
    finding["confidence"] = triage_result["confidence"]
    finding["triage_decision"] = triage_result["decision"]
    finding["triage_summary"] = triage_result["summary"]
    return _finding_values(candidate["scenario_id"], scenario_result, finding)


def record_triage(
    target: str, run_id: str, candidate_id: str, triage_json: Path
) -> list[str]:
    path = run_path(target, run_id)
    candidate = _load_candidate(path, candidate_id)
    scenario_result = _load_scenario_result(path, candidate["scenario_id"])
    result = cast(FindingTriage, dict(_load_json(triage_json)))
    supplied_candidate_id = result.get("candidate_id") or result.get("id")  # type: ignore[typeddict-item]
    if supplied_candidate_id and supplied_candidate_id != candidate_id:
        raise ValueError(
            f"Triage candidate_id mismatch for {candidate_id}: {supplied_candidate_id}"
        )
    result["candidate_id"] = candidate_id
    result.setdefault("review_mode", "per-finding-triage-agent")
    validate_finding_triage(result)
    integrity_errors = _triage_integrity_errors(path, candidate_id, result)
    if integrity_errors:
        detail = "\n".join(f"- {error}" for error in integrity_errors[:20])
        if len(integrity_errors) > 20:
            detail += f"\n- ... {len(integrity_errors) - 20} more integrity errors"
        raise ValueError(f"Finding triage failed integrity checks:\n{detail}")

    written = []
    _clear_final_finding(path, candidate_id)
    if result["decision"] in ACCEPTING_DECISIONS:
        finding = _final_finding(candidate, scenario_result, result)
        validate_finding(finding)
        result["finding"] = finding
        name = f"{candidate_id.lower()}-{_slug(finding.get('title', 'finding'))}.md"
        out = path / "findings" / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(_finding_md(candidate["scenario_id"], finding))
        written.append(str(out))

    decision = path / "finding-triage" / "decisions" / f"{candidate_id}.json"
    decision.parent.mkdir(parents=True, exist_ok=True)
    decision.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    written.insert(0, str(decision))
    emit(
        path,
        "finding-triage",
        result["decision"],
        f"Recorded triage for {candidate_id}",
        evidence=written,
    )
    return written
