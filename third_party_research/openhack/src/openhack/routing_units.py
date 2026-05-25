from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping, cast

from .models import CoveragePair, Inventory, InventoryRow, ReconItem

STOPWORDS = {
    "and",
    "for",
    "from",
    "get",
    "http",
    "https",
    "into",
    "json",
    "line",
    "name",
    "path",
    "post",
    "request",
    "response",
    "route",
    "the",
    "type",
    "user",
    "value",
    "with",
}

KIND_TERMS: list[tuple[str, set[str]]] = [
    ("command_execution_sink", {"child_process", "command", "exec", "process", "shell", "spawn", "system"}),
    ("database_query_sink", {"aggregate", "db", "findone", "mongo", "nosql", "order", "query", "raw", "sequelize", "sql", "where"}),
    ("html_template_dom_sink", {"dom", "html", "iframe", "innerhtml", "markdown", "render", "script", "template", "xss"}),
    ("file_upload_download_storage", {"archive", "bucket", "directory", "download", "file", "filename", "media", "mime", "path", "storage", "upload", "zip"}),
    ("outbound_fetch_boundary", {"axios", "callback", "fetch", "httpclient", "metadata", "oembed", "preview", "proxy", "ssrf", "url", "webhook"}),
    ("identity_state_access_control", {"access", "admin", "auth", "authorization", "csrf", "identity", "login", "permission", "role", "session", "state", "token", "user_id", "userid"}),
    ("secret_debug_exposure", {"credential", "debug", "diagnostics", "env", "error", "exception", "key", "log", "password", "secret", "source", "token", "trace"}),
    ("parser_deserialization_integrity", {"deserialize", "entity", "parser", "schema", "serialized", "template", "unserialize", "xml", "xxe", "yaml"}),
    ("cryptographic_secret_token", {"bcrypt", "certificate", "crypto", "encryption", "hash", "hmac", "jwt", "nonce", "random", "signature"}),
    ("resource_consumption", {"bulk", "decompress", "limit", "memory", "queue", "regex", "resize", "resource", "timeout", "unbounded"}),
    ("supply_chain_manifest", {"dependency", "lockfile", "manifest", "package", "registry", "supply", "vendored"}),
]

EXPERT_KIND_HINTS: dict[str, set[str]] = {
    "authentication-failures": {"identity_state_access_control", "cryptographic_secret_token"},
    "broken-access-control": {"identity_state_access_control", "outbound_fetch_boundary"},
    "cryptographic-failures": {"cryptographic_secret_token", "secret_debug_exposure"},
    "injection": {
        "command_execution_sink",
        "database_query_sink",
        "html_template_dom_sink",
        "parser_deserialization_integrity",
    },
    "insecure-design": {"identity_state_access_control", "resource_consumption"},
    "memory-buffer-boundary-errors": {
        "file_upload_download_storage",
        "parser_deserialization_integrity",
        "resource_consumption",
    },
    "path-traversal-unrestricted-upload": {"file_upload_download_storage"},
    "security-misconfiguration": {
        "identity_state_access_control",
        "outbound_fetch_boundary",
        "secret_debug_exposure",
    },
    "sensitive-information-exposure": {
        "file_upload_download_storage",
        "secret_debug_exposure",
    },
    "software-data-integrity-failures": {"parser_deserialization_integrity"},
    "software-supply-chain-failures": {"supply_chain_manifest"},
    "unrestricted-resource-consumption": {
        "file_upload_download_storage",
        "parser_deserialization_integrity",
        "resource_consumption",
    },
}

EXPERT_DEFAULT_KIND = {
    "authentication-failures": "identity_state_access_control",
    "broken-access-control": "identity_state_access_control",
    "cryptographic-failures": "cryptographic_secret_token",
    "injection": "database_query_sink",
    "insecure-design": "identity_state_access_control",
    "memory-buffer-boundary-errors": "parser_deserialization_integrity",
    "path-traversal-unrestricted-upload": "file_upload_download_storage",
    "security-misconfiguration": "secret_debug_exposure",
    "sensitive-information-exposure": "secret_debug_exposure",
    "software-data-integrity-failures": "parser_deserialization_integrity",
    "software-supply-chain-failures": "supply_chain_manifest",
    "unrestricted-resource-consumption": "resource_consumption",
}

MAX_EVIDENCE_ROWS = 8
MAX_UNIT_KINDS_PER_PAIR = 3


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.split(r"[^a-z0-9_]+", text.lower())
        if len(token) >= 3 and token not in STOPWORDS
    }


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple) or isinstance(value, set):
        return list(value)
    return [value]


def _row_terms(row: Mapping[str, Any]) -> set[str]:
    terms = _tokens(str(row.get("path", "")))
    terms.update(_tokens(str(row.get("text", ""))))
    for key in (
        "match",
        "signals",
        "trust_signals",
        "expert_hints",
        "request_fields",
        "methods",
        "endpoint",
        "boundary_type",
        "kind",
    ):
        terms.update(_tokens(" ".join(str(item) for item in _as_list(row.get(key)))))
    return terms


def _pair_terms(pair: CoveragePair) -> set[str]:
    terms = _tokens(pair["path"])
    for key in ("matched_terms", "signals", "strong_terms", "kinds", "endpoint"):
        terms.update(_tokens(" ".join(str(item) for item in _as_list(pair.get(key)))))
    for row in pair.get("evidence", []):
        terms.update(_row_terms(row))
    return terms


def _kind_for_terms(terms: set[str], fallback: str = "configuration_or_static_surface") -> str:
    for kind, kind_terms in KIND_TERMS:
        if terms & kind_terms:
            return kind
    return fallback


def _row_kind(row: InventoryRow) -> str:
    return _kind_for_terms(_row_terms(row))


def _path_rows(inventory: Inventory) -> dict[str, dict[str, list[InventoryRow]]]:
    rows_by_path: dict[str, dict[str, list[InventoryRow]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for kind, rows in inventory.items():
        for row in rows:
            rows_by_path[row["path"]][kind].append(row)
    return {path: dict(rows) for path, rows in rows_by_path.items()}


def _path_counts(rows_by_kind: dict[str, list[InventoryRow]]) -> dict[str, int]:
    return {kind: len(rows) for kind, rows in sorted(rows_by_kind.items())}


def _compact_row(row: Mapping[str, Any]) -> dict[str, Any]:
    compact = {
        "kind": row.get("kind"),
        "line": row.get("line"),
        "match": row.get("match", []),
        "text": str(row.get("text", ""))[:240],
    }
    for key in ("source", "endpoint", "methods", "boundary_type", "request_fields"):
        if row.get(key) not in (None, [], ""):
            compact[key] = row.get(key)
    return compact


def _dedupe_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    compacted: list[dict[str, Any]] = []
    for row in rows:
        compact = _compact_row(row)
        key = (
            compact.get("kind"),
            compact.get("line"),
            tuple(compact.get("match", [])),
            compact.get("text"),
        )
        if key in seen:
            continue
        seen.add(key)
        compacted.append(compact)
        if len(compacted) >= MAX_EVIDENCE_ROWS:
            break
    return compacted


def _candidate_kinds(
    pair: CoveragePair, rows_by_kind: dict[str, list[InventoryRow]]
) -> list[str]:
    if pair.get("boundary_mandatory") or pair.get("boundary_id"):
        return ["request_boundary"]

    expert = pair["expert"]
    relevant = EXPERT_KIND_HINTS.get(expert, set())
    path_kinds: list[str] = []
    seen: set[str] = set()
    for rows in rows_by_kind.values():
        for row in rows:
            kind = _row_kind(row)
            if kind in relevant and kind not in seen:
                seen.add(kind)
                path_kinds.append(kind)
    if path_kinds:
        return path_kinds[:MAX_UNIT_KINDS_PER_PAIR]

    pair_kind = _kind_for_terms(
        _pair_terms(pair),
        EXPERT_DEFAULT_KIND.get(expert, "configuration_or_static_surface"),
    )
    if pair_kind not in relevant:
        pair_kind = EXPERT_DEFAULT_KIND.get(expert, pair_kind)
    return [pair_kind]


def _matching_evidence(
    unit_kind: str,
    pair: CoveragePair,
    rows_by_kind: dict[str, list[InventoryRow]],
) -> list[dict[str, Any]]:
    rows: list[Mapping[str, Any]] = []
    rows.extend(pair.get("evidence", []))
    for kind in ("request_boundaries", "inputs", "sinks", "routes", "exposures"):
        for row in rows_by_kind.get(kind, []):
            if unit_kind == "request_boundary" or _row_kind(row) == unit_kind:
                rows.append(row)
    if len(rows) < MAX_EVIDENCE_ROWS:
        for kind in ("inputs", "sinks", "routes", "exposures"):
            rows.extend(rows_by_kind.get(kind, [])[:2])
    return _dedupe_rows(rows)


def _new_unit(
    path: str,
    kind: str,
    rows_by_kind: dict[str, list[InventoryRow]],
    pair: CoveragePair,
) -> dict[str, Any]:
    unit: dict[str, Any] = {
        "kind": kind,
        "path": path,
        "path_class": pair.get("path_class"),
        "coverage": "suggested",
        "required_experts": [],
        "suggested_experts": [],
        "candidate_experts": [],
        "recon_item_ids": [],
        "routing_requirement_keys": [],
        "signals": [],
        "matched_terms": [],
        "evidence": [],
        "raw_counts": _path_counts(rows_by_kind),
        "split_hint": (
            "Route one scenario per required expert. Split further when the "
            "evidence names distinct endpoints, parameters, roles, parser "
            "modes, storage paths, or deployment aliases."
        ),
    }
    for key in ("boundary_id", "endpoint", "methods", "boundary_type", "request_fields"):
        if pair.get(key) not in (None, [], ""):
            unit[key] = pair.get(key)
    return unit


def _add_unique(values: list[Any], items: Iterable[Any]) -> None:
    for item in items:
        if item not in values:
            values.append(item)


def build_routing_units(
    coverage_gaps: dict[str, Any],
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
) -> list[dict[str, Any]]:
    rows_by_path = _path_rows(inventory)
    recon_ids_by_path: dict[str, list[str]] = defaultdict(list)
    for item in recon_items or []:
        recon_ids_by_path[item["path"]].append(item["id"])

    units_by_key: dict[tuple[str, str, str | None], dict[str, Any]] = {}

    def add_pair(pair: CoveragePair, required: bool) -> None:
        path = pair["path"]
        path_rows = rows_by_path.get(path, {})
        for unit_kind in _candidate_kinds(pair, path_rows):
            boundary_id = pair.get("boundary_id") if unit_kind == "request_boundary" else None
            key = (path, unit_kind, boundary_id)
            unit = units_by_key.setdefault(
                key,
                _new_unit(path, unit_kind, path_rows, pair),
            )
            expert_list = "required_experts" if required else "suggested_experts"
            _add_unique(unit[expert_list], [pair["expert"]])
            _add_unique(unit["candidate_experts"], [pair["expert"]])
            _add_unique(unit["signals"], pair.get("signals", []))
            _add_unique(unit["matched_terms"], pair.get("matched_terms", []))
            if pair.get("recon_item_id"):
                _add_unique(unit["recon_item_ids"], [pair["recon_item_id"]])
            _add_unique(unit["recon_item_ids"], recon_ids_by_path.get(path, [])[:8])
            if required:
                unit["coverage"] = "mandatory"
                unit["routing_requirement_keys"].append({
                    "path": path,
                    "expert": pair["expert"],
                    "boundary_id": pair.get("boundary_id"),
                })
            unit["evidence"] = _dedupe_rows([
                *unit.get("evidence", []),
                *_matching_evidence(unit_kind, pair, path_rows),
            ])

    for pair in coverage_gaps.get("routing_requirements", []):
        add_pair(cast(CoveragePair, pair), required=True)
    for pair in coverage_gaps.get("coverage_suggestions", []):
        add_pair(cast(CoveragePair, pair), required=False)

    mandatory_paths = {
        item["path"] for item in coverage_gaps.get("input_with_sink_or_exposure", [])
    }
    for path in sorted(mandatory_paths):
        if any(key[0] == path for key in units_by_key):
            continue
        path_rows = rows_by_path.get(path, {})
        first_row = next((rows[0] for rows in path_rows.values() if rows), None)
        if not first_row:
            continue
        fallback = cast(CoveragePair, {
            "path": path,
            "expert": "*",
            "path_class": coverage_gaps.get("path_class"),
            "reason": "input_with_sink_or_exposure path needs path-level routing consideration",
            "matched_terms": [],
            "signals": [],
            "kinds": sorted(path_rows),
            "evidence": [first_row],
            "interesting": True,
        })
        unit_kind = _row_kind(first_row)
        unit = _new_unit(path, unit_kind, path_rows, fallback)
        unit["coverage"] = "mandatory_path"
        unit["evidence"] = _matching_evidence(unit_kind, fallback, path_rows)
        units_by_key[(path, unit_kind, None)] = unit

    units = sorted(
        units_by_key.values(),
        key=lambda unit: (
            0 if unit.get("coverage") == "mandatory" else 1,
            unit["path"],
            unit["kind"],
            ",".join(unit.get("required_experts", [])),
        ),
    )
    for index, unit in enumerate(units, 1):
        unit["unit_id"] = f"U{index:03d}"
        unit["required_experts"] = sorted(unit.get("required_experts", []))
        unit["suggested_experts"] = sorted(unit.get("suggested_experts", []))
        unit["candidate_experts"] = sorted(unit.get("candidate_experts", []))
        unit["signals"] = sorted(str(signal) for signal in unit.get("signals", []))
        unit["matched_terms"] = sorted(str(term) for term in unit.get("matched_terms", []))
        unit["recon_item_ids"] = sorted(str(item) for item in unit.get("recon_item_ids", []))
    return units


def write_routing_units(
    path: Path,
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
) -> Path:
    coverage_path = path / "recon-output" / "coverage-gaps.json"
    coverage_gaps = json.loads(coverage_path.read_text()) if coverage_path.exists() else {}
    units = build_routing_units(coverage_gaps, inventory, recon_items)
    out = path / "recon-output" / "routing-units.jsonl"
    out.write_text("".join(json.dumps(unit, sort_keys=True) + "\n" for unit in units))
    return out
