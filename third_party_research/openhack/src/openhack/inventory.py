from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .inventory_patterns import DETAILS, PATTERNS
from .models import InventoryRow


def signals(text: str) -> list[str]:
    low = text.lower()
    return [name for name, pats in PATTERNS.items() if any(p in low for p in pats)]


def hits(rel: str, text: str, kind: str) -> list[InventoryRow]:
    rows: list[InventoryRow] = []
    for no, line in enumerate(text.splitlines(), 1):
        low = line.lower()
        found = [p for p in DETAILS[kind] if p in low]
        if found:
            rows.append({
                "kind": kind[:-1],
                "path": rel,
                "line": no,
                "match": found[:5],
                "text": line.strip()[:240],
            })
    return rows


def write_jsonl(path: Path, name: str, rows: list[Any]) -> Path:
    for i, row in enumerate(rows, 1):
        row.setdefault("id", f"{name[0].upper()}{i:03d}")
    out = path / "recon-output" / f"{name.replace('_', '-')}.jsonl"
    out.write_text("".join(json.dumps(r, sort_keys=True) + "\n" for r in rows))
    return out
