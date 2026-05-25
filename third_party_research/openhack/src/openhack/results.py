from __future__ import annotations

import json
import re
from hashlib import sha256
from collections import Counter
from pathlib import Path
from typing import Any, cast

from .log import emit
from .models import (
    Evidence,
    Finding,
    FindingCandidate,
    ResultProofObligation,
    Scenario,
    ScenarioProofObligation,
    ScenarioResult,
    Severity,
)
from .paths import root, run_path
from .schemas import validate_finding, validate_finding_candidate, validate_result

MAX_BUNDLE_RESULTS = 10
PROOF_OBLIGATION_STATUSES = {
    "proven_safe",
    "proven_vulnerable",
    "not_applicable",
    "needs_context",
}
EVIDENCE_REQUIRED_STATUSES = {
    "proven_safe",
    "proven_vulnerable",
    "not_applicable",
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "finding"


def _normalize_whitespace(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _normalize_class_name(value: Any) -> str:
    return _normalize_whitespace(str(value).replace("-", " "))


def _format_value(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, indent=2, sort_keys=True)
    if value is None:
        return "Not specified."
    return str(value)


def _default_attack_chain(values: Finding) -> str:
    role = values.get("attacker_role") or "An attacker with the required access"
    if role == "Not specified.":
        role = "An attacker with the required access"
    role = role.rstrip(".")
    target = values.get("target_path", "the affected component")
    impact = values.get("impact", "the documented security impact")
    return "\n".join(
        [
            f"1. {role} reaches `{target}` through the scenario entrypoint.",
            "2. They provide input that reaches the vulnerable source described in the evidence.",
            "3. The application processes that input at the sink without the required guard.",
            f"4. The attacker obtains the impact described here: {impact}",
        ]
    )


def _default_example_attack(values: Finding) -> str:
    target = values.get("target_path", "the affected component")
    return (
        f"Example: in a controlled test environment, an attacker with the required role "
        f"submits a crafted value to `{target}`. The value follows the source-to-sink "
        "path in the evidence, bypasses the missing guard, and demonstrates the impact "
        "without targeting a real production system."
    )


def _finding_type(result: ScenarioResult, finding: Finding) -> str:
    vuln_type = result.get("primary_vulnerability_class")
    if vuln_type and vuln_type not in {
        "root-cause vulnerability class",
        "root-cause vulnerability family or subtype",
    }:
        return _normalize_class_name(vuln_type)
    vuln_type = result.get("expert") or "finding"
    return _normalize_class_name(vuln_type)


def _finding_location(finding: Finding) -> str:
    location = finding.get("location")
    if location and location != "Not specified.":
        return _normalize_whitespace(location)

    path: str | None = finding.get("target_path")
    if not path or path == "Not specified.":
        path = finding.get("affected_path")
    if not path or path == "Not specified.":
        path = "the affected component"
    path = _normalize_whitespace(path)

    details = []
    line = finding.get("line")
    if line not in (None, "", "Not specified."):
        details.append(f"line {line}")
    for key in ("parameter", "sink"):
        value = finding.get(key)
        if value not in (None, "", "Not specified."):
            details.append(_normalize_whitespace(value))
    if details:
        return f"{path} ({', '.join(details)})"
    return path


def _finding_title(
    result: ScenarioResult, finding: Finding, disambiguator: int | None = None
) -> str:
    severity = _slug(finding.get("severity", "unknown"))
    vuln_type = _finding_type(result, finding)
    location = _finding_location(finding)
    if disambiguator is not None:
        location = f"{location} ({disambiguator})"
    return f"{severity} - {vuln_type} - {location}"


def _finding_values(
    scenario_id: str,
    result: ScenarioResult,
    finding: Finding,
    disambiguator: int | None = None,
) -> Finding:
    # Defaults dict is missing required Finding keys here; they are filled in
    # by ``finding.update`` and the ``setdefault`` calls below. Cast so mypy
    # treats the incremental build as a Finding throughout.
    values: Finding = cast(Finding, {
        "scenario_id": scenario_id,
        "title": "Untitled finding",
        "severity": "unknown",
        "target_path": "Not specified.",
        "summary": "No technical summary provided.",
        "evidence": "No evidence provided.",
        "impact": "No impact provided.",
        "severity_rationale": "Severity has not been independently triaged.",
        "confidence": "medium",
        "attacker_role": "Attacker with access to the affected entrypoint.",
        "preconditions": "Affected route or feature is enabled and reachable by the attacker role.",
        "recommended_fix": (
            "Add the missing guard at the source-to-sink boundary described in the evidence, "
            "then cover the proof path with a regression test."
        ),
        "validation_notes": (
            "Validate in a controlled test environment by exercising the affected path through "
            "the attacker role. After the fix, repeat the same request and verify that it is "
            "rejected or constrained without breaking the intended valid workflow."
        ),
    })
    values.update(finding)
    if values.get("severity") not in (None, "", "Not specified."):
        values["severity"] = cast(Severity, str(values["severity"]).lower())
    if values.get("target_path") == "Not specified." and finding.get("affected_path"):
        values["target_path"] = finding["affected_path"]
    values["title"] = _finding_title(result, values, disambiguator=disambiguator)
    values.setdefault("non_technical_summary", values["summary"])
    values.setdefault("impact_analysis", values["impact"])
    values.setdefault(
        "attacker_use",
        "An attacker would use the vulnerable path described in the evidence to "
        "turn controlled input into the documented impact. Confirm the exact "
        "preconditions and exploitability in a controlled test environment.",
    )
    values.setdefault("attack_chain", _default_attack_chain(values))
    values.setdefault("example_attack", _default_example_attack(values))
    return values


def _finding_md(scenario_id: str, finding: Finding) -> str:
    text = (root() / "templates" / "finding.md").read_text()
    values = dict(finding)
    values["scenario_id"] = scenario_id
    for key, value in values.items():
        text = text.replace(f"<{key}>", _format_value(value))
    return text


def _candidate_id(scenario_id: str, ordinal: int) -> str:
    return f"{scenario_id}-F{ordinal:03d}"


def _candidate_values(
    scenario_id: str, result: ScenarioResult, finding: Finding, ordinal: int
) -> FindingCandidate:
    candidate_id = _candidate_id(scenario_id, ordinal)
    return {
        "candidate_id": candidate_id,
        "scenario_id": scenario_id,
        "source_result": f"scenarios/finished/{scenario_id}.json",
        "expert": result.get("expert", "expert"),
        "primary_vulnerability_class": result.get("primary_vulnerability_class", ""),
        "status": "pending_triage",
        "finding": finding,
    }


def _write_candidate(path: Path, candidate: FindingCandidate) -> Path:
    validate_finding_candidate(candidate)
    out = path / "finding-candidates" / f"{candidate['candidate_id']}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(candidate, indent=2, sort_keys=True) + "\n")
    return out


def _clear_scenario_candidates(path: Path, scenario_id: str) -> None:
    for candidate in (path / "finding-candidates").glob(f"{scenario_id}-F*.json"):
        candidate_id = candidate.stem
        candidate.unlink()
        for item in [
            path / "finding-triage" / "prompts" / f"{candidate_id}.md",
            path / "finding-triage" / "decisions" / f"{candidate_id}.json",
        ]:
            if item.exists():
                item.unlink()
        for finding in (path / "findings").glob(f"{candidate_id.lower()}-*.md"):
            finding.unlink()


def _load_scenario(path: Path, scenario_id: str) -> Scenario:
    scenario_file = path / "scenarios" / "backlog" / f"{scenario_id}.json"
    if not scenario_file.exists():
        raise ValueError(f"Cannot record result for unknown scenario: {scenario_id}")
    return json.loads(scenario_file.read_text())


def scenario_prompt_sha256(path: Path, scenario_id: str) -> str | None:
    prompt = path / "scenarios" / "backlog" / f"{scenario_id}.md"
    if not prompt.exists():
        return None
    return sha256(prompt.read_bytes()).hexdigest()


def _source_path(path: Path, value: str) -> Path | None:
    item = Path(value)
    if item.is_absolute():
        resolved = item.resolve()
    else:
        resolved = (path / "sourcecode" / item).resolve()
    try:
        resolved.relative_to((path / "sourcecode").resolve())
    except ValueError:
        return None
    return resolved


def _norm_line(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _snippet_matches(path: Path, evidence: Evidence) -> tuple[bool, str]:
    source = _source_path(path, evidence.get("path", ""))
    if not source or not source.exists() or not source.is_file():
        return False, "evidence path is not a source file in this run"
    try:
        line_no = int(evidence.get("line"))
    except (TypeError, ValueError):
        return False, "evidence line must be an integer"
    lines = source.read_text(errors="replace").splitlines()
    if line_no < 1 or line_no > len(lines):
        return False, f"evidence line {line_no} is outside file length {len(lines)}"
    snippet = _norm_line(evidence.get("snippet", ""))
    if not snippet:
        return False, "evidence snippet is empty"
    if snippet not in _norm_line(lines[line_no - 1]):
        return False, "evidence snippet does not match the cited source line"
    return True, ""


def _proof_obligation_ids(
    obligations: list[ScenarioProofObligation] | list[ResultProofObligation],
) -> list[str]:
    return [str(item.get("id", "")).strip() for item in obligations]


def _is_central_obligation(obligation: ScenarioProofObligation) -> bool:
    return bool(obligation.get("central", True))


def _proof_obligation_errors(
    path: Path,
    scenario: Scenario,
    result: ScenarioResult,
    reviewed_set: set[str],
) -> list[str]:
    scenario_obligations = scenario.get("proof_obligations") or []
    if not scenario_obligations:
        return []

    errors = []
    scenario_ids = _proof_obligation_ids(scenario_obligations)
    result_obligations = result.get("proof_obligations")
    if not result_obligations:
        return [
            "result missing proof_obligations for scenario with required proof obligations"
        ]
    result_ids = _proof_obligation_ids(result_obligations)
    missing = sorted(set(scenario_ids) - set(result_ids))
    extra = sorted(set(result_ids) - set(scenario_ids))
    duplicate_results = sorted(
        item for item in set(result_ids) if result_ids.count(item) > 1
    )
    if missing:
        errors.append(
            "result missing required proof obligations: " + ", ".join(missing)
        )
    if extra:
        errors.append(
            "result includes unknown proof obligations: " + ", ".join(extra)
        )
    if duplicate_results:
        errors.append(
            "result has duplicate proof obligation ids: "
            + ", ".join(duplicate_results)
        )

    result_by_id = {
        str(obligation.get("id", "")).strip(): obligation
        for obligation in result_obligations
    }
    central_ids = {
        str(obligation.get("id", "")).strip()
        for obligation in scenario_obligations
        if _is_central_obligation(obligation)
    }
    proven_vulnerable = []
    for obligation_id in scenario_ids:
        obligation = result_by_id.get(obligation_id)
        if not obligation:
            continue
        status = obligation.get("status")
        if status not in PROOF_OBLIGATION_STATUSES:
            errors.append(
                f"proof obligation {obligation_id} has invalid status: {status}"
            )
            continue
        if status == "proven_vulnerable":
            proven_vulnerable.append(obligation_id)
        summary = str(obligation.get("summary", "")).strip()
        if status == "needs_context" and len(summary) < 20:
            errors.append(
                f"proof obligation {obligation_id} needs a concrete missing-context summary"
            )
        evidence_items = obligation.get("evidence", [])
        if status in EVIDENCE_REQUIRED_STATUSES and not evidence_items:
            errors.append(
                f"proof obligation {obligation_id} with status {status} needs evidence"
            )
        for index, evidence in enumerate(evidence_items, start=1):
            evidence_path = evidence.get("path")
            if evidence_path not in reviewed_set:
                errors.append(
                    f"proof obligation {obligation_id} evidence item {index} "
                    f"path is not listed in reviewed_files: {evidence_path}"
                )
            matches, reason = _snippet_matches(path, evidence)
            if not matches:
                errors.append(
                    f"proof obligation {obligation_id} evidence item {index} "
                    f"invalid: {reason}"
                )

    unresolved_central = sorted(
        obligation_id
        for obligation_id in central_ids
        if (item := result_by_id.get(obligation_id))
        and item.get("status") == "needs_context"
    )
    if result.get("status") in {"verified", "rejected"} and unresolved_central:
        errors.append(
            "finished scenario result has unresolved central proof obligations: "
            + ", ".join(unresolved_central)
        )
    if result.get("status") == "verified" and not proven_vulnerable:
        errors.append(
            "verified scenario result must mark at least one proof obligation proven_vulnerable"
        )
    if result.get("status") == "rejected" and proven_vulnerable:
        errors.append(
            "rejected scenario result cannot include proven_vulnerable proof obligations: "
            + ", ".join(proven_vulnerable)
        )
    return errors


def result_integrity_errors(
    path: Path, scenario_id: str, result: ScenarioResult
) -> list[str]:
    errors: list[str] = []
    try:
        scenario = _load_scenario(path, scenario_id)
    except Exception as exc:
        scenario = cast(Scenario, {})
        errors.append(f"cannot load scenario for proof obligation checks: {exc}")
    if result.get("scenario_id") != scenario_id:
        errors.append(
            f"scenario_id mismatch: result has {result.get('scenario_id')} for {scenario_id}"
        )
    expected_hash = scenario_prompt_sha256(path, scenario_id)
    if not expected_hash:
        errors.append(f"rendered scenario prompt is missing for {scenario_id}")
    elif result.get("scenario_prompt_sha256") != expected_hash:
        errors.append(
            f"scenario_prompt_sha256 mismatch for {scenario_id}: "
            f"expected {expected_hash}"
        )

    reviewed = result.get("reviewed_files", [])
    reviewed_set = set(reviewed) if isinstance(reviewed, list) else set()
    for reviewed_file in reviewed:
        source = _source_path(path, reviewed_file)
        if not source or not source.exists() or not source.is_file():
            errors.append(f"reviewed file is not in source checkout: {reviewed_file}")

    matching_evidence = 0
    for index, evidence in enumerate(result.get("evidence", []), start=1):
        evidence_path = evidence.get("path")
        if evidence_path not in reviewed_set:
            errors.append(
                f"evidence item {index} path is not listed in reviewed_files: "
                f"{evidence_path}"
            )
        matches, reason = _snippet_matches(path, evidence)
        if matches:
            matching_evidence += 1
        else:
            errors.append(f"evidence item {index} invalid: {reason}")
    if not matching_evidence:
        errors.append("result must include at least one matching source-line evidence snippet")
    errors.extend(
        _proof_obligation_errors(path, scenario, result, reviewed_set)
    )

    subagent_id = result.get("subagent_id")
    if subagent_id:
        for result_file in (path / "scenarios" / "finished").glob("S*.json"):
            if result_file.stem == scenario_id:
                continue
            try:
                existing = json.loads(result_file.read_text())
            except Exception:
                continue
            if existing.get("subagent_id") == subagent_id:
                errors.append(
                    f"subagent_id {subagent_id} already recorded for {result_file.stem}"
                )
                break
    return errors


def _record(path: Path, scenario_id: str, result: ScenarioResult) -> list[str]:
    scenario = _load_scenario(path, scenario_id)
    result = cast(ScenarioResult, dict(result))
    supplied_scenario_id = result.get("scenario_id") or result.get("id")
    if supplied_scenario_id and supplied_scenario_id != scenario_id:
        raise ValueError(
            f"Result scenario_id mismatch for {scenario_id}: {supplied_scenario_id}"
        )
    result["scenario_id"] = scenario_id
    result.setdefault("expert", scenario["expert"])
    if result["expert"] != scenario["expert"]:
        raise ValueError(
            f"Result expert mismatch for {scenario_id}: "
            f"{result['expert']} != {scenario['expert']}"
        )
    if result.get("status") != "verified" and result.get("findings"):
        raise ValueError("Only verified scenario results may include findings")
    validate_result(result, scenario_id)
    integrity_errors = result_integrity_errors(path, scenario_id, result)
    if integrity_errors:
        detail = "\n".join(f"- {error}" for error in integrity_errors[:20])
        if len(integrity_errors) > 20:
            detail += f"\n- ... {len(integrity_errors) - 20} more integrity errors"
        raise ValueError(f"Scenario result failed integrity checks:\n{detail}")
    raw_findings = result.get("findings", []) if result.get("status") == "verified" else []
    if result.get("status") == "verified":
        title_keys = [_finding_title(result, finding) for finding in raw_findings]
        title_counts = Counter(title_keys)
        seen_titles: Counter[str] = Counter()
        result["findings"] = []
        for finding, title_key in zip(raw_findings, title_keys):
            seen_titles[title_key] += 1
            disambiguator = seen_titles[title_key] if title_counts[title_key] > 1 and seen_titles[title_key] > 1 else None
            normalized = _finding_values(scenario_id, result, finding, disambiguator=disambiguator)
            validate_finding(normalized)
            result["findings"].append(normalized)
    finished = path / "scenarios" / "finished" / f"{scenario_id}.json"
    finished.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    _clear_scenario_candidates(path, scenario_id)
    written = []
    rendered_findings = result.get("findings", []) if result.get("status") == "verified" else []
    for index, finding in enumerate(rendered_findings, start=1):
        out = _write_candidate(path, _candidate_values(scenario_id, result, finding, index))
        written.append(str(out))
    emit(path, result.get("expert", "expert"), result.get("status", "recorded"), f"Recorded {scenario_id} with {len(written)} finding candidates", evidence=written)
    return written


def record_result(
    target: str, run_id: str, scenario_id: str, result_file: Path
) -> list[str]:
    return _record(run_path(target, run_id), scenario_id, json.loads(result_file.read_text()))


def record_bundle(target: str, run_id: str, bundle_file: Path) -> list[str]:
    path = run_path(target, run_id)
    data = json.loads(bundle_file.read_text())
    entries = data.get("results", [])
    if len(entries) > MAX_BUNDLE_RESULTS:
        raise ValueError(
            "Bundled scenario result recording is capped at "
            f"{MAX_BUNDLE_RESULTS} results. Run each scenario through its own "
            "rendered prompt/subagent and record large backlogs one scenario at "
            "a time."
        )
    written: list[str] = []
    for entry in entries:
        raw: dict[str, Any] = dict(entry)
        scenario_id = raw.pop("scenario_id", None) or raw.pop("id", None)
        if not scenario_id:
            raise ValueError("Bundled result missing scenario_id")
        written.extend(_record(path, scenario_id, cast(ScenarioResult, raw)))
    emit(path, "result-recorder", "complete", f"Recorded bundled results for {len(entries)} scenarios", evidence=written)
    return written
