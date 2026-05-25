from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .inventory_patterns import SKIP


MAX_FILE_BYTES = 500000
SECURITY_KEYS = {
    "check_path",
    "login_path",
    "logout_path",
    "callback_path",
    "redirect_uri",
    "redirect_url",
    "acs",
    "assertion_consumer_service",
    "token_endpoint",
    "webhook",
}
ENDPOINT_TERMS = {
    "acs",
    "api",
    "auth",
    "callback",
    "check",
    "connect",
    "hook",
    "login",
    "logout",
    "oauth",
    "oidc",
    "saml",
    "sso",
    "token",
    "upload",
    "webhook",
}


def _runtime_file(path: Path) -> bool:
    parts = {part.lower() for part in path.parts}
    if parts & {"tests", "test", "__fixtures__", "fixtures"}:
        return False
    suffix = path.suffix.lower()
    return suffix in {".php", ".yaml", ".yml", ".xml", ".json", ".ini", ".dist"}


def _extract_path_literal(line: str) -> str | None:
    comment = re.search(r"//\s*['\"](?P<path>/[^'\"]+)['\"]", line)
    if comment:
        return comment.group("path")
    matches = re.findall(r"['\"](?P<path>/[^'\"]+)['\"]", line)
    if matches:
        return matches[-1]
    match = re.search(r":\s*(?P<path>/[^\s#,'\"\]\}]+)", line)
    if match:
        return match.group("path")
    return None


def _line_key(line: str) -> str:
    match = re.search(
        r"['\"](?P<key>[a-zA-Z0-9_.-]*(?:path|url|uri|acs|webhook|callback|endpoint)[a-zA-Z0-9_.-]*)['\"]\s*=>",
        line,
    )
    if match:
        return match.group("key").lower()
    match = re.search(
        r"^\s*(?P<key>[a-zA-Z0-9_.-]*(?:path|url|uri|acs|webhook|callback|endpoint)[a-zA-Z0-9_.-]*)\s*:",
        line,
    )
    if match:
        return match.group("key").lower()
    match = re.search(
        r"set\(\s*['\"](?P<key>[A-Z0-9_]*(?:PATH|URL|URI|ACS|WEBHOOK|CALLBACK|ENDPOINT)[A-Z0-9_]*)['\"]",
        line,
    )
    if match:
        return match.group("key").lower()
    return ""


def _context(lines: list[str], index: int, radius: int = 8) -> str:
    start = max(0, index - radius)
    end = min(len(lines), index + radius + 1)
    return "\n".join(lines[start:end])


def _context_methods(context: str, boundary_type: str) -> list[str]:
    methods = {
        method.upper()
        for method in re.findall(
            r"['\"](?:method|methods)['\"]\s*=>\s*['\"]([A-Za-z]+)['\"]",
            context,
        )
    }
    methods.update(
        method.upper()
        for method in re.findall(r"Request::METHOD_(GET|POST|PUT|PATCH|DELETE)", context)
    )
    in_yaml_methods = False
    for raw in context.splitlines():
        line = raw.strip()
        match = re.match(r"methods?\s*:\s*(?P<value>.*)", line, re.I)
        if match:
            in_yaml_methods = True
            methods.update(
                method.upper()
                for method in re.findall(
                    r"\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b",
                    match.group("value"),
                    re.I,
                )
            )
            continue
        if in_yaml_methods:
            item = re.match(
                r"-\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b",
                line,
                re.I,
            )
            if item:
                methods.add(item.group(1).upper())
                continue
            if line and not line.startswith("#"):
                in_yaml_methods = False
    if methods:
        return sorted(methods)
    if boundary_type in {"auth_check", "saml_acs", "oauth_token", "oidc_callback", "webhook"}:
        return ["POST"]
    if boundary_type in {"logout"}:
        return ["GET", "POST"]
    return ["ANY"]


def _boundary_type(key: str, endpoint: str, context: str) -> str:
    low = " ".join([key, endpoint, context]).lower()
    if "saml" in low or "assertion_consumer" in low or "acs" in low:
        if "check_path" in key or "login_check" in endpoint.lower() or "acs" in key:
            return "saml_acs"
        return "saml_auth"
    if "oidc" in low or "id_token" in low or "jwks" in low:
        return "oidc_callback"
    if "oauth" in low or "authorize" in low or "access_token" in low:
        return "oauth_callback" if "callback" in low or "authorize" in low else "oauth_token"
    if "webhook" in low or low.endswith("hook"):
        return "webhook"
    if "upload" in low or "multipart" in low:
        return "upload"
    if "logout" in low:
        return "logout"
    if "check_path" in key or "login_check" in endpoint:
        return "auth_check"
    if "login" in low or "signin" in low or "sso" in low:
        return "auth_start"
    if "callback" in low:
        return "callback"
    return "request_boundary"


def _request_fields(boundary_type: str) -> list[str]:
    if boundary_type == "saml_acs":
        return ["SAMLResponse", "RelayState"]
    if boundary_type in {"oauth_callback", "oidc_callback"}:
        return ["code", "state", "id_token", "nonce"]
    if boundary_type == "oauth_token":
        return ["grant_type", "code", "refresh_token", "client_id", "client_secret"]
    if boundary_type == "webhook":
        return ["body", "signature", "timestamp"]
    if boundary_type == "auth_check":
        return ["username", "password", "csrf_token", "state"]
    return []


def _expert_hints(boundary_type: str) -> list[str]:
    if boundary_type in {
        "auth_check",
        "auth_start",
        "callback",
        "logout",
        "oauth_callback",
        "oauth_token",
        "oidc_callback",
        "saml_acs",
        "saml_auth",
    }:
        return ["authentication-failures"]
    if boundary_type in {"webhook"}:
        return [
            "authentication-failures",
            "broken-access-control",
            "software-data-integrity-failures",
        ]
    if boundary_type in {"upload"}:
        return ["path-traversal-unrestricted-upload", "broken-access-control"]
    return []


def _signals(boundary_type: str) -> list[str]:
    signals = {"route", "state"}
    if boundary_type in {
        "saml_acs",
        "saml_auth",
        "oauth_callback",
        "oauth_token",
        "oidc_callback",
        "auth_check",
        "auth_start",
        "logout",
    }:
        signals.update({"identity", "secret"})
    if boundary_type in {"saml_acs", "saml_auth", "oidc_callback"}:
        signals.add("parser")
    if boundary_type in {"webhook"}:
        signals.update({"parser", "secret"})
    if boundary_type in {"upload"}:
        signals.update({"file", "upload", "parser"})
    return sorted(signals)


def _match_terms(
    key: str, endpoint: str, boundary_type: str, fields: list[str]
) -> list[str]:
    values = [key, endpoint, boundary_type, *fields, *_signals(boundary_type)]
    terms: set[str] = set()
    for value in values:
        terms.update(
            token
            for token in re.split(r"[^a-zA-Z0-9_]+", value.lower())
            if len(token) >= 3
        )
    return sorted(terms)[:12]


def _source_rank(key: str, endpoint: str) -> int:
    if key == "check_path":
        return 0
    if key in SECURITY_KEYS:
        return 1
    if "check_path" in key or "login_check" in endpoint:
        return 2
    if "env" in key or key.isupper():
        return 3
    return 2


def _should_emit(key: str, endpoint: str, context: str) -> bool:
    if not key:
        return False
    low = " ".join([key, endpoint, context]).lower()
    if key in SECURITY_KEYS:
        return True
    if any(term in endpoint.lower() for term in ENDPOINT_TERMS):
        return True
    return any(
        term in low
        for term in {"saml", "oauth", "oidc", "sso", "webhook", "login_check"}
    )


def _row(
    rel: str,
    line_no: int,
    line: str,
    key: str,
    endpoint: str,
    context: str,
) -> dict[str, Any]:
    boundary_type = _boundary_type(key, endpoint, context)
    methods = _context_methods(context, boundary_type)
    fields = _request_fields(boundary_type)
    return {
        "kind": "request_boundary",
        "path": rel,
        "line": line_no,
        "match": _match_terms(key, endpoint, boundary_type, fields),
        "text": line.strip()[:240],
        "endpoint": endpoint,
        "methods": methods,
        "boundary_type": boundary_type,
        "trust_signals": _signals(boundary_type),
        "request_fields": fields,
        "expert_hints": _expert_hints(boundary_type),
        "coverage": "mandatory",
        "reason": (
            "Externally reachable request boundary from framework, security, "
            "bundle, environment, or generated route configuration."
        ),
        "_rank": _source_rank(key, endpoint),
    }


def extract_request_boundaries(source_root: Path | str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    source_root = Path(source_root)
    for file in sorted(source_root.rglob("*")):
        if not file.is_file():
            continue
        rel_path = file.relative_to(source_root)
        if any(part in SKIP for part in rel_path.parts):
            continue
        if not _runtime_file(rel_path):
            continue
        try:
            text = file.read_text(errors="ignore")[:MAX_FILE_BYTES]
        except OSError:
            continue
        lines = text.splitlines()
        rel = rel_path.as_posix()
        for index, line in enumerate(lines):
            endpoint = _extract_path_literal(line)
            if not endpoint:
                continue
            key = _line_key(line)
            context = _context(lines, index)
            if not _should_emit(key, endpoint, context):
                continue
            rows.append(_row(rel, index + 1, line, key, endpoint, context))

    by_boundary: dict[tuple[str, tuple[str, ...], str], dict[str, Any]] = {}
    for row in rows:
        boundary_key = (row["boundary_type"], tuple(row["methods"]), row["endpoint"])
        previous = by_boundary.get(boundary_key)
        if previous is None or row["_rank"] < previous["_rank"]:
            by_boundary[boundary_key] = row

    out: list[dict[str, Any]] = []
    for index, row in enumerate(
        sorted(
            by_boundary.values(),
            key=lambda item: (item["endpoint"], item["path"], item["line"]),
        ),
        1,
    ):
        row = dict(row)
        row.pop("_rank", None)
        row["id"] = f"B{index:03d}"
        out.append(row)
    return out
