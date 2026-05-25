from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterable

from .inventory_patterns import DETAILS, SKIP
from .paths import root

DEFAULT_CONFIG = "config/semgrep/openhack-recon.yml"


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _rel_path(result: dict[str, Any]) -> str:
    return str(result.get("path", "")).lstrip("./")


def _line(result: dict[str, Any]) -> int:
    return result.get("start", {}).get("line") or 1


def _metadata(result: dict[str, Any]) -> dict[str, Any]:
    return result.get("extra", {}).get("metadata", {})


def _text(result: dict[str, Any]) -> str:
    extra = result.get("extra", {})
    return (extra.get("lines") or extra.get("message") or "").strip()[:240]


def _rule_id(result: dict[str, Any]) -> str:
    return result.get("check_id", "semgrep")


def _signals(result: dict[str, Any]) -> list[str]:
    metadata = _metadata(result)
    values = ["semgrep", metadata.get("signal"), *_as_list(metadata.get("experts"))]
    return [str(value) for value in values if value]


def _inventory_kind(result: dict[str, Any]) -> str | None:
    kind = _metadata(result).get("inventory_kind")
    return kind if kind in DETAILS else None


def _inventory_row(result: dict[str, Any]) -> dict[str, Any] | None:
    kind = _inventory_kind(result)
    if not kind:
        return None
    return {
        "kind": kind[:-1],
        "path": _rel_path(result),
        "line": _line(result),
        "match": [_rule_id(result), *_signals(result)][:8],
        "text": _text(result),
        "source": "semgrep",
    }


def _recon_item(result: dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata(result)
    signal = metadata.get("signal") or _inventory_kind(result) or "semgrep"
    return {
        "type": signal,
        "path": _rel_path(result),
        "line": _line(result),
        "signals": _signals(result),
        "source": "semgrep",
        "rule_id": _rule_id(result),
        "message": result.get("extra", {}).get("message", ""),
    }


def _command(configs: Iterable[str | Path] | None) -> list[str]:
    semgrep = shutil.which("semgrep")
    if not semgrep:
        raise RuntimeError("semgrep is not installed or not on PATH")
    cmd = [semgrep, "--json", "--quiet", "--metrics=off"]
    for config in configs or [root() / DEFAULT_CONFIG]:
        cmd.extend(["--config", str(config)])
    for folder in sorted(SKIP):
        cmd.extend(["--exclude", folder])
    return cmd + ["."]


def run_semgrep_recon(
    run_path: Path, configs: Iterable[str | Path] | None = None
) -> dict[str, Any]:
    source = run_path / "sourcecode"
    result = subprocess.run(
        _command(configs),
        cwd=source,
        text=True,
        capture_output=True,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.strip() or "semgrep failed")
    data = json.loads(result.stdout or "{}")
    raw = run_path / "recon-output" / "semgrep-results.json"
    raw.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")

    inventory: dict[str, list[dict[str, Any]]] = {name: [] for name in DETAILS}
    recon_items: list[dict[str, Any]] = []
    for finding in data.get("results", []):
        if not _rel_path(finding):
            continue
        recon_items.append(_recon_item(finding))
        row = _inventory_row(finding)
        if row:
            kind = _inventory_kind(finding)
            assert kind is not None
            inventory[kind].append(row)
    return {
        "raw": raw,
        "results": data.get("results", []),
        "inventory": inventory,
        "recon_items": recon_items,
    }
