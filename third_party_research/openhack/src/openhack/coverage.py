from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable, cast

from .expert_scope import all_expert_ids, read_run_expert_scope
from .models import (
    CoverageConfidence,
    CoveragePair,
    Expert,
    Inventory,
    InventoryPathEntry,
    InventoryRow,
    ReconItem,
    RequestBoundary,
)
from .registry import load_experts

STOPWORDS = {
    "and", "the", "from", "with", "into", "root", "cause", "route",
    "action", "input", "user", "data", "file", "http", "client",
    "url", "uri", "path", "id", "key", "name", "type", "value",
    "param", "params", "request", "response", "status", "config", "import",
    "get", "post", "json", "webhook",
}

LOW_VALUE_SUFFIXES = {
    ".css", ".gif", ".ico", ".jpeg", ".jpg", ".less", ".lock", ".md",
    ".neon", ".png", ".svg", ".ttf", ".woff", ".woff2",
}
MANIFESTS = {
    "composer.json", "composer.lock", "package.json", "package-lock.json",
    "pnpm-lock.yaml", "requirements.txt", "yarn.lock",
}
PRODUCTIVE_CLASSES = {"client", "config", "manifest", "runtime", "script", "template"}
REQUEST_BOUNDARY_KIND = "request_boundaries"
SUGGESTION_LIMIT = 500
MAX_REQUIREMENTS_PER_PATH = 4
MAX_REQUIREMENTS_PER_EXPERT = 50
EXPERT_PRIORITY = {
    expert: index for index, expert in enumerate([
        "broken-access-control",
        "authentication-failures",
        "injection",
        "memory-buffer-boundary-errors",
        "path-traversal-unrestricted-upload",
        "security-misconfiguration",
        "cryptographic-failures",
        "sensitive-information-exposure",
        "software-data-integrity-failures",
        "insecure-design",
        "unrestricted-resource-consumption",
        "software-supply-chain-failures",
    ])
}

EXPERT_STRONG_TERMS = {
    "broken-access-control": {
        "access", "acl", "admin", "assign", "attributes", "authorization",
        "bind", "fields", "fillable", "object", "owner", "permission",
        "projection", "role", "serializer", "tenant", "user_id", "userid",
        "callback", "crawler", "dns", "fetch", "httpclient", "image-url",
        "import-url", "internal", "metadata", "oembed", "preview", "proxy",
        "ssrf", "url-fetch", "webhook",
    },
    "security-misconfiguration": {
        "cache", "canonical", "console", "content-security-policy", "cors",
        "debug", "diagnostics", "forwarded", "frame", "headers", "healthcheck",
        "host", "install", "installer", "location", "phpinfo", "profiler",
        "jsonp", "postmessage", "redirect", "samesite", "setup",
        "x-forwarded-host", "x-frame-options",
    },
    "software-supply-chain-failures": {
        "dependency", "digest", "lockfile", "manifest", "package", "plugin",
        "registry", "supply", "vendored",
    },
    "cryptographic-failures": {
        "api", "bcrypt", "certificate", "encryption", "hash", "hmac", "jwt",
        "nonce", "password", "random", "secret", "session", "signature",
        "token",
    },
    "injection": {
        "__proto__", "command", "constructor", "dom", "elasticsearch", "eval",
        "execute", "exec", "filter", "html", "innerhtml", "ldap", "macro",
        "merge", "mongo", "opensearch", "order", "pollution", "popen",
        "prototype", "query", "raw", "render", "shell", "shell_exec", "sort",
        "sql", "system", "template", "twig", "where", "xpath", "xquery",
        "xss",
    },
    "memory-buffer-boundary-errors": {
        "allocator", "binary", "bounds", "buffer", "cgo", "ctypes", "ffi",
        "format", "free", "malloc", "memcpy", "memmove", "native",
        "out-of-bounds", "overflow", "pointer", "strcpy", "unsafe",
        "use-after-free",
    },
    "insecure-design": {
        "approval", "approve", "autocomplete", "balance", "brute", "captcha",
        "concurrent", "coupon", "enumeration", "idempotency", "lock", "otp",
        "queue", "race", "refund", "state", "throttle", "transaction",
        "transfer", "webhook", "workflow",
    },
    "authentication-failures": {
        "acs", "auth", "callback", "cookie", "csrf", "id_token", "jwks",
        "login", "mfa", "nonce", "oauth", "oidc", "otp", "password", "pkce",
        "relaystate", "remember", "reset", "saml", "session", "signin",
        "sso", "state", "token", "verify",
    },
    "software-data-integrity-failures": {
        "artifact", "deserialize", "dtd", "entity", "gadget", "integrity",
        "phar", "polymorphic", "queue", "safe-loader", "serialized",
        "signature", "simplexml", "unserialize", "webhook", "xml", "xxe",
    },
    "sensitive-information-exposure": {
        "api_key", "credential", "debug", "diagnostics", "env", "error",
        "exception", "log", "password", "pem", "pii", "private", "secret",
        "source-map", "stack", "token", "traceback",
    },
    "path-traversal-unrestricted-upload": {
        "archive", "attachment", "avatar", "bucket", "content-disposition",
        "content-type", "directory", "download", "extension",
        "file_get_contents", "filename", "filepath", "image", "media", "mime",
        "multipart", "readfile", "storage", "stored-file", "symlink", "unzip",
        "upload", "zip",
    },
    "unrestricted-resource-consumption": {
        "backpressure", "bulk", "complexity", "decompress", "export", "fan",
        "limit", "pagination", "queue", "regex", "resize", "timeout",
        "unbounded", "upload", "xml", "zip-bomb",
    },
}


def _matches(rows: list[InventoryRow]) -> set[str]:
    return {match for row in rows for match in row.get("match", [])}


def _tokens(text: str) -> set[str]:
    return {
        token for token in re.split(r"[^a-z0-9_]+", text.lower())
        if len(token) >= 3 and token not in STOPWORDS
    }


def _path_class(path: str) -> str:
    low = path.lower()
    parts = low.split("/")
    name = parts[-1]
    suffix = Path(low).suffix
    if low.startswith((".ddev/", ".devcontainer/")):
        return "dev"
    if any(part in {"tests", "test", "__fixtures__", "fixtures"} for part in parts):
        return "test"
    if "/assets/libraries/" in low:
        return "asset"
    if low.startswith(".github/") or "/.github/" in low:
        return "ci"
    if name in MANIFESTS:
        return "manifest"
    if suffix in {".md", ".rst", ".txt"} or low.startswith("docs/"):
        return "docs"
    if any(part in {"translations", "installfixtures"} for part in parts):
        return "fixture"
    if "/assets/js/" in low or suffix == ".js":
        return "client"
    if "/assets/" in low or suffix in LOW_VALUE_SUFFIXES:
        return "asset"
    if suffix == ".twig":
        return "template"
    if suffix in {".yml", ".yaml", ".json", ".xml", ".ini", ".dist"}:
        return "config"
    if suffix == ".sh" or low.startswith("bin/"):
        return "script"
    if suffix == ".php" or low.startswith(("app/bundles/", "plugins/", "app/config/")):
        return "runtime"
    return "other"


def _pair_terms(pair: CoveragePair) -> set[str]:
    terms = _tokens(pair["path"])
    terms.update(_tokens(" ".join(pair.get("signals", []))))
    terms.update(_tokens(" ".join(pair.get("matched_terms", []))))
    for evidence in pair.get("evidence", []):
        terms.update(_tokens(" ".join(evidence.get("match", []))))
        terms.update(_tokens(evidence.get("text", "")))
    return terms


def _source_or_sink(pair: CoveragePair) -> bool:
    if pair.get("boundary_mandatory"):
        return True
    return bool(pair.get("interesting"))


def _score_pair(pair: CoveragePair) -> tuple[CoverageConfidence, list[str], str]:
    if pair.get("boundary_mandatory"):
        return "high", pair.get("strong_terms", []), (
            "Externally reachable request boundary must be routed even when "
            "the concrete handler is framework, generated, or vendor-owned."
        )
    path_class = _path_class(pair["path"])
    expert = pair["expert"]
    terms = _pair_terms(pair)
    strong = sorted(EXPERT_STRONG_TERMS.get(expert, set()) & terms)
    if expert == "software-supply-chain-failures":
        if path_class == "manifest":
            return "high", ["dependency manifest or lockfile"], (
                "Dependency manifests are routed only to supply-chain review."
            )
    if path_class not in PRODUCTIVE_CLASSES:
        return "low", strong, f"{path_class} path is not a runtime attack surface."
    if not strong:
        return "low", [], "Only generic lexical overlap was found."
    if not _source_or_sink(pair):
        return "suggestion", strong, (
            "Runtime path has expert-specific terms, but no concrete source/sink "
            "boundary was identified."
        )
    return "high", strong, (
        "Runtime path has expert-specific source, sink, or trust-boundary evidence."
    )


def _experts(selected_experts: Iterable[str] | None = None) -> list[Expert]:
    experts = load_experts()
    if selected_experts is None:
        return experts
    selected = set(selected_experts)
    return [expert for expert in experts if expert["id"] in selected]


def _flatten_signals(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        signals = []
        for item in value.values():
            signals.extend(_flatten_signals(item))
        return signals
    return list(value)


def _routing_signals(expert: Expert) -> list[Any]:
    signals = _flatten_signals(expert.get("routing_signals", []))
    signals.extend(_flatten_signals(expert.get("routes_from", [])))
    return signals


def _expert_terms(expert: Expert) -> set[str]:
    values = [expert["id"], expert.get("category", ""), *_routing_signals(expert)]
    terms = set()
    for value in values:
        raw = value.lower()
        if len(raw) >= 3 and raw not in STOPWORDS:
            terms.add(raw)
        terms.update(_tokens(value))
    return {term for term in terms if term and term not in STOPWORDS}


def _path_index(
    inventory: Inventory, recon_items: list[ReconItem] | None
) -> dict[str, InventoryPathEntry]:
    by_path: dict[str, InventoryPathEntry] = {}

    def _empty() -> InventoryPathEntry:
        return {"kinds": set(), "rows": {}, "signals": set()}

    for kind, rows in inventory.items():
        for row in rows:
            entry = by_path.setdefault(row["path"], _empty())
            entry["kinds"].add(kind)
            entry["rows"].setdefault(kind, []).append(row)
    for item in recon_items or []:
        entry = by_path.setdefault(item["path"], _empty())
        entry["signals"].update(item.get("signals", []))
    return by_path


def _evidence(entry: InventoryPathEntry) -> list[dict[str, Any]]:
    rows = []
    for kind in [REQUEST_BOUNDARY_KIND, "inputs", "sinks", "routes", "exposures"]:
        rows.extend(entry["rows"].get(kind, [])[:2])
    return [
        {
            "kind": row.get("kind"),
            "line": row.get("line"),
            "match": row.get("match", []),
            "text": row.get("text", ""),
        }
        for row in rows[:4]
    ]


def _entry_terms(path: str, entry: InventoryPathEntry) -> set[str]:
    terms = _tokens(path)
    for signal in entry["signals"]:
        signal = str(signal).lower()
        if len(signal) >= 3 and signal not in STOPWORDS:
            terms.add(signal)
        terms.update(_tokens(signal))
    for rows in entry["rows"].values():
        for row in rows[:8]:
            for match in row.get("match", []):
                match = str(match).lower()
                if len(match) >= 3 and match not in STOPWORDS:
                    terms.add(match)
                terms.update(_tokens(match))
            terms.update(_tokens(row.get("text", "")))
            for key in [
                "endpoint",
                "boundary_type",
                "methods",
                "request_fields",
                "trust_signals",
                "expert_hints",
            ]:
                terms.update(_tokens(" ".join(str(item) for item in _flatten_signals(row.get(key, [])))))
    return terms


def _interesting(entry: InventoryPathEntry) -> bool:
    kinds = entry["kinds"]
    return REQUEST_BOUNDARY_KIND in kinds or (
        "inputs" in kinds and ("sinks" in kinds or "exposures" in kinds)
    )


def _public_pair(pair: CoveragePair) -> CoveragePair:
    item = cast(CoveragePair, dict(pair))
    item.pop("interesting", None)  # type: ignore[misc]
    return item


def _boundary_terms(row: RequestBoundary) -> set[str]:
    terms = _tokens(row.get("path", ""))
    for key in [
        "endpoint",
        "boundary_type",
        "methods",
        "request_fields",
        "trust_signals",
        "expert_hints",
        "match",
        "text",
    ]:
        terms.update(_tokens(" ".join(str(item) for item in _flatten_signals(row.get(key, [])))))
    return terms


def _boundary_candidate_pairs(
    inventory: Inventory, selected_experts: Iterable[str] | None = None
) -> list[CoveragePair]:
    pairs: list[CoveragePair] = []
    rows = cast(list[RequestBoundary], inventory.get(REQUEST_BOUNDARY_KIND, []))
    experts = _experts(selected_experts)
    for row in rows:
        hints = set(row.get("expert_hints", []) or [])
        boundary_terms = _boundary_terms(row)
        for expert in experts:
            expert_id = expert["id"]
            expert_terms = _expert_terms(expert)
            matched = sorted(expert_terms & boundary_terms)[:8]
            if hints:
                if expert_id not in hints:
                    continue
            elif not matched:
                continue
            strong = sorted(EXPERT_STRONG_TERMS.get(expert_id, set()) & boundary_terms)
            if not strong and expert_id in hints:
                strong = sorted(
                    set(row.get("trust_signals", []) or [])
                    | set(row.get("match", []) or [])
                )[:8]
            pairs.append(cast(CoveragePair, {
                "expert": expert_id,
                "path": row["path"],
                "reason": row.get("reason", "request boundary inventory"),
                "matched_terms": matched or sorted(boundary_terms)[:8],
                "signals": sorted(set(row.get("trust_signals", []))),
                "kinds": [REQUEST_BOUNDARY_KIND],
                "evidence": [{
                    "kind": row.get("kind", "request_boundary"),
                    "line": row.get("line"),
                    "match": row.get("match", []),
                    "text": row.get("text", ""),
                    "endpoint": row.get("endpoint"),
                    "methods": row.get("methods", []),
                    "boundary_type": row.get("boundary_type"),
                    "request_fields": row.get("request_fields", []),
                }],
                "interesting": True,
                "path_class": _path_class(row["path"]),
                "boundary_mandatory": True,
                "boundary_id": row.get("id"),
                "recon_item_id": row.get("recon_item_id"),
                "endpoint": row.get("endpoint"),
                "methods": row.get("methods", []),
                "boundary_type": row.get("boundary_type"),
                "request_fields": row.get("request_fields", []),
                "strong_terms": strong,
            }))
    return pairs


def _candidate_pairs(
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
    selected_experts: Iterable[str] | None = None,
) -> list[CoveragePair]:
    by_path = _path_index(inventory, recon_items)
    pairs = _boundary_candidate_pairs(inventory, selected_experts)
    for expert in _experts(selected_experts):
        terms = _expert_terms(expert)
        for path, entry in by_path.items():
            if entry["kinds"] == {REQUEST_BOUNDARY_KIND}:
                continue
            blob_terms = _entry_terms(path, entry)
            matched = sorted(terms & blob_terms)[:8]
            if not matched:
                continue
            pairs.append(cast(CoveragePair, {
                "expert": expert["id"],
                "path": path,
                "reason": "registry routing signals appear in recon evidence",
                "matched_terms": matched,
                "signals": sorted(entry["signals"]),
                "kinds": sorted(entry["kinds"]),
                "evidence": _evidence(entry),
                "interesting": _interesting(entry),
                "path_class": _path_class(path),
            }))
    return pairs


def _scored_public_pair(pair: CoveragePair) -> CoveragePair:
    item = _public_pair(pair)
    confidence, strong_terms, reason = _score_pair(pair)
    item["confidence"] = confidence
    item["strong_terms"] = strong_terms
    item["triage_reason"] = reason
    return item


def _requirement_sort_key(pair: CoveragePair) -> tuple[Any, ...]:
    _, strong_terms, _ = _score_pair(pair)
    return (
        0 if pair.get("boundary_mandatory") else 1,
        pair["path"],
        pair.get("endpoint", ""),
        EXPERT_PRIORITY.get(pair["expert"], 999),
        -len(strong_terms),
        pair["expert"],
    )


def coverage_opportunities(
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
    selected_experts: Iterable[str] | None = None,
) -> list[dict[str, Any]]:
    by_expert: dict[str, list[CoveragePair]] = {}
    for pair in _candidate_pairs(inventory, recon_items, selected_experts):
        confidence, _, _ = _score_pair(pair)
        if confidence in {"high", "suggestion"}:
            by_expert.setdefault(pair["expert"], []).append(pair)
    opportunities = []
    for expert_id, candidates in sorted(by_expert.items()):
        if candidates:
            examples = sorted(
                candidates,
                key=lambda row: (_score_pair(row)[0] != "high", row["path"]),
            )[:8]
            opportunities.append({
                "expert": expert_id,
                "reason": "triaged runtime evidence matches this expert",
                "candidate_paths": len(candidates),
                "examples": [_scored_public_pair(example) for example in examples],
            })
    return opportunities


def coverage_suggestions(
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
    required_keys: set[tuple[str, str]] | None = None,
    selected_experts: Iterable[str] | None = None,
) -> list[CoveragePair]:
    required_keys = required_keys or set()
    suggestions = []
    seen = set()
    for pair in _candidate_pairs(inventory, recon_items, selected_experts):
        confidence, _, _ = _score_pair(pair)
        key = (pair["path"], pair["expert"])
        if confidence != "suggestion" and not (
            confidence == "high" and key not in required_keys
        ):
            continue
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(_scored_public_pair(pair))
    return sorted(
        suggestions,
        key=lambda row: (row["path_class"], row["path"], row["expert"]),
    )[:SUGGESTION_LIMIT]


def routing_requirements(
    inventory: Inventory,
    recon_items: list[ReconItem] | None = None,
    selected_experts: Iterable[str] | None = None,
) -> list[CoveragePair]:
    requirements: list[CoveragePair] = []
    seen: set[tuple[str, str, str | None]] = set()
    counts: dict[str, int] = {}
    expert_counts: dict[str, int] = {}
    pairs = sorted(
        _candidate_pairs(inventory, recon_items, selected_experts),
        key=_requirement_sort_key,
    )
    for pair in pairs:
        confidence, strong_terms, reason = _score_pair(pair)
        if confidence != "high":
            continue
        key = (
            pair["path"],
            pair["expert"],
            pair.get("boundary_id") if pair.get("boundary_mandatory") else None,
        )
        if key in seen:
            continue
        if not pair.get("boundary_mandatory"):
            if counts.get(pair["path"], 0) >= MAX_REQUIREMENTS_PER_PATH:
                continue
            if expert_counts.get(pair["expert"], 0) >= MAX_REQUIREMENTS_PER_EXPERT:
                continue
        seen.add(key)
        if not pair.get("boundary_mandatory"):
            counts[pair["path"]] = counts.get(pair["path"], 0) + 1
            expert_counts[pair["expert"]] = expert_counts.get(pair["expert"], 0) + 1
        item = _public_pair(pair)
        item["confidence"] = confidence
        item["strong_terms"] = strong_terms
        item["triage_reason"] = reason
        item["requirement"] = (
            "Create a scenario for this path/expert pair or record an explicit "
            "coverage_decision explaining why it is not applicable."
        )
        requirements.append(item)
    return sorted(requirements, key=lambda row: (row["path"], row["expert"]))


def write_coverage(
    path: Path, inventory: Inventory, recon_items: list[ReconItem] | None = None
) -> Path:
    scope = read_run_expert_scope(path)
    selected_experts = scope["experts"] if scope else all_expert_ids()
    by_path: dict[str, set[str]] = {}
    for kind, rows in inventory.items():
        for row in rows:
            by_path.setdefault(row["path"], set()).add(kind)
    requirements = routing_requirements(inventory, recon_items, selected_experts)
    required_keys = {(item["path"], item["expert"]) for item in requirements}
    requirement_paths = {item["path"] for item in requirements}
    boundary_requirements = [
        item for item in requirements
        if item.get("boundary_id") or item.get("boundary_mandatory")
    ]
    suggestions = coverage_suggestions(
        inventory, recon_items, required_keys, selected_experts
    )
    gaps = [
        {
            "path": p,
            "path_class": _path_class(p),
            "reason": sorted(k),
        }
        for p, k in by_path.items()
        if p in requirement_paths
        if "inputs" in k and ("sinks" in k or "exposures" in k)
    ]
    out = path / "recon-output" / "coverage-gaps.json"
    out.write_text(json.dumps({
        "input_with_sink_or_exposure": gaps,
        "request_boundaries": inventory.get(REQUEST_BOUNDARY_KIND, []),
        "boundary_requirements": boundary_requirements,
        "expert_opportunities": coverage_opportunities(
            inventory, recon_items, selected_experts
        ),
        "routing_requirements": requirements,
        "coverage_suggestions": suggestions,
        "triage_summary": {
            "expert_scope": scope["mode"] if scope else "unconfigured-all",
            "selected_experts": selected_experts,
            "hard_requirement_paths": len(requirement_paths),
            "hard_routing_requirements": len(requirements),
            "hard_boundary_requirements": len(boundary_requirements),
            "request_boundaries": len(inventory.get(REQUEST_BOUNDARY_KIND, [])),
            "max_requirements_per_expert": MAX_REQUIREMENTS_PER_EXPERT,
            "max_requirements_per_path": MAX_REQUIREMENTS_PER_PATH,
            "suggestions_recorded": len(suggestions),
            "suggestion_limit": SUGGESTION_LIMIT,
        },
    }, indent=2, sort_keys=True) + "\n")
    return out
