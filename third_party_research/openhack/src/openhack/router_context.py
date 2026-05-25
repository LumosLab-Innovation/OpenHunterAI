from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, cast

from .models import CoverageGaps, InventoryRow

MAX_ROWS_PER_KIND = 1200
MAX_ROWS_PER_PATH_KIND = 6
MAX_SAMPLE_ROWS_PER_KIND = 160
MAX_SAMPLE_ROWS_PER_PATH_KIND = 2
INVENTORY_FILES = {
    "routes": "routes.jsonl",
    "inputs": "inputs.jsonl",
    "sinks": "sinks.jsonl",
    "exposures": "exposures.jsonl",
    "request_boundaries": "request-boundaries.jsonl",
}


def read_jsonl(path: Path) -> list[Any]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def routing_paths(coverage_gaps: CoverageGaps) -> set[str]:
    paths: set[str] = set()
    for items in (
        coverage_gaps.get("routing_requirements", []),
        coverage_gaps.get("coverage_suggestions", []),
        coverage_gaps.get("boundary_requirements", []),
    ):
        for item in items:
            if item.get("path"):
                paths.add(item["path"])
    return paths


def _trim_rows(rows: list[InventoryRow], allowed_paths: set[str]) -> list[InventoryRow]:
    if not allowed_paths:
        return rows[:MAX_ROWS_PER_KIND]
    counts: dict[tuple[str, str], int] = {}
    trimmed: list[InventoryRow] = []
    for row in rows:
        path = row.get("path")
        if path not in allowed_paths:
            continue
        key = (path, row.get("kind"))
        counts[key] = counts.get(key, 0) + 1
        if counts[key] <= MAX_ROWS_PER_PATH_KIND:
            trimmed.append(row)
        if len(trimmed) >= MAX_ROWS_PER_KIND:
            break
    return trimmed


def _trim_sample_rows(
    rows: list[InventoryRow], allowed_paths: set[str]
) -> list[InventoryRow]:
    counts: dict[tuple[str, str], int] = {}
    trimmed: list[InventoryRow] = []
    for row in rows:
        path = row.get("path")
        if allowed_paths and path not in allowed_paths:
            continue
        key = (path, row.get("kind"))
        counts[key] = counts.get(key, 0) + 1
        if counts[key] <= MAX_SAMPLE_ROWS_PER_PATH_KIND:
            trimmed.append(row)
        if len(trimmed) >= MAX_SAMPLE_ROWS_PER_KIND:
            break
    return trimmed


def _compact_coverage_gaps(coverage_gaps: CoverageGaps) -> dict[str, Any]:
    requirements = coverage_gaps.get("routing_requirements", [])
    suggestions = coverage_gaps.get("coverage_suggestions", [])
    expert_counts = Counter(str(item.get("expert", "")) for item in requirements)
    suggestion_counts = Counter(str(item.get("expert", "")) for item in suggestions)
    return {
        "input_with_sink_or_exposure": coverage_gaps.get("input_with_sink_or_exposure", []),
        "request_boundaries": coverage_gaps.get("request_boundaries", []),
        "boundary_requirements": coverage_gaps.get("boundary_requirements", []),
        "expert_opportunities": [
            {
                "expert": item.get("expert"),
                "candidate_paths": item.get("candidate_paths"),
                "reason": item.get("reason"),
            }
            for item in coverage_gaps.get("expert_opportunities", [])
        ],
        "routing_requirements_summary": {
            "count": len(requirements),
            "paths": len({item.get("path") for item in requirements}),
            "by_expert": dict(sorted(expert_counts.items())),
        },
        "coverage_suggestions_summary": {
            "count": len(suggestions),
            "included_in_prompt": 0,
            "by_expert": dict(sorted(suggestion_counts.items())),
        },
        "triage_summary": coverage_gaps.get("triage_summary", {}),
        "note": (
            "Full routing_requirements and coverage_suggestions remain in "
            "recon-output/coverage-gaps.json; routing_units carry the prompt "
            "coverage contract."
        ),
    }


def _compact_unit(unit: dict[str, Any]) -> dict[str, Any]:
    def short_match(value: Any) -> str:
        text = str(value)
        if "openhack." in text:
            return "openhack." + text.rsplit("openhack.", 1)[-1]
        return text[-80:]

    compact: dict[str, Any] = {
        "unit_id": unit.get("unit_id"),
        "coverage": unit.get("coverage"),
        "kind": unit.get("kind"),
        "path": unit.get("path"),
        "path_class": unit.get("path_class"),
        "required_experts": unit.get("required_experts", []),
        "suggested_experts": unit.get("suggested_experts", [])[:4],
        "recon_item_ids": unit.get("recon_item_ids", [])[:6],
        "signals": unit.get("signals", [])[:8],
        "matched_terms": unit.get("matched_terms", [])[:8],
        "raw_counts": unit.get("raw_counts", {}),
        "evidence": [
            {
                "kind": row.get("kind"),
                "line": row.get("line"),
                "match": [short_match(item) for item in row.get("match", [])[:4]],
                "text": str(row.get("text", ""))[:140],
            }
            for row in unit.get("evidence", [])[:3]
        ],
    }
    for key in ("boundary_id", "endpoint", "methods", "boundary_type", "request_fields"):
        if unit.get(key) not in (None, [], ""):
            compact[key] = unit.get(key)
    return compact


def _semgrep_summary(path: Path, allowed_paths: set[str]) -> dict[str, Any] | None:
    semgrep = path / "recon-output" / "semgrep-results.json"
    if not semgrep.exists():
        return None
    results = json.loads(semgrep.read_text()).get("results", [])
    filtered = [
        item for item in results
        if not allowed_paths or item.get("path") in allowed_paths
    ]
    by_check = Counter(str(item.get("check_id", "semgrep")) for item in filtered)
    by_path = Counter(str(item.get("path", "")) for item in filtered)
    return {
        "total_results": len(results),
        "prompt_path_results": len(filtered),
        "top_checks": [
            {"check_id": check_id, "count": count}
            for check_id, count in by_check.most_common(20)
        ],
        "top_paths": [
            {"path": item_path, "count": count}
            for item_path, count in by_path.most_common(20)
            if item_path
        ],
    }


def load_inventory(path: Path) -> dict[str, Any]:
    gaps = path / "recon-output" / "coverage-gaps.json"
    coverage_gaps: CoverageGaps = (
        cast(CoverageGaps, json.loads(gaps.read_text())) if gaps.exists() else {}
    )
    allowed_paths = routing_paths(coverage_gaps)
    data: dict[str, Any] = {}
    omitted: dict[str, int] = {}
    samples: dict[str, Any] = {}
    routing_units = read_jsonl(path / "recon-output" / "routing-units.jsonl")
    for name, filename in INVENTORY_FILES.items():
        rows = read_jsonl(path / "recon-output" / filename)
        if routing_units:
            samples[name] = (
                [
                    row for row in rows
                    if not allowed_paths or row.get("path") in allowed_paths
                ]
                if name == "request_boundaries"
                else _trim_sample_rows(rows, allowed_paths)
            )
        else:
            if name == "request_boundaries":
                data[name] = [
                    row for row in rows
                    if not allowed_paths or row.get("path") in allowed_paths
                ]
            else:
                data[name] = _trim_rows(rows, allowed_paths)
        kept = samples[name] if routing_units else data[name]
        omitted[name] = max(0, len(rows) - len(kept))
    if routing_units:
        data["routing_units"] = [_compact_unit(unit) for unit in routing_units]
        data["inventory_samples"] = samples
        data["coverage_gaps"] = _compact_coverage_gaps(coverage_gaps)
    else:
        data["coverage_gaps"] = coverage_gaps
    data["inventory_summary"] = {
        "prompt_paths": len(allowed_paths),
        "routing_units": len(routing_units),
        "row_limit_per_kind": (
            MAX_SAMPLE_ROWS_PER_KIND if routing_units else MAX_ROWS_PER_KIND
        ),
        "row_limit_per_path_kind": (
            MAX_SAMPLE_ROWS_PER_PATH_KIND if routing_units else MAX_ROWS_PER_PATH_KIND
        ),
        "omitted_rows_by_kind": omitted,
    }
    summary = _semgrep_summary(path, allowed_paths)
    if summary:
        data["semgrep_summary"] = summary
    semgrep = path / "recon-output" / "semgrep-results.json"
    if semgrep.exists() and not routing_units:
        data["semgrep_results"] = [
            {
                "check_id": item.get("check_id"),
                "path": item.get("path"),
                "line": item.get("start", {}).get("line"),
                "message": item.get("extra", {}).get("message"),
                "metadata": item.get("extra", {}).get("metadata", {}),
            }
            for item in json.loads(semgrep.read_text()).get("results", [])
            if not allowed_paths or item.get("path") in allowed_paths
        ]
    return data
