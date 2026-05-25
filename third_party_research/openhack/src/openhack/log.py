from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def emit(
    run_path: Path,
    actor: str,
    status: str,
    summary: str,
    kind: str = "event",
    evidence: list[str] | None = None,
) -> dict[str, Any]:
    logs = run_path / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "actor": actor,
        "status": status,
        "summary": summary,
        "evidence": evidence or [],
    }
    with (logs / "events.jsonl").open("a") as fh:
        fh.write(json.dumps(event, sort_keys=True) + "\n")
    with (run_path / "trace.jsonl").open("a") as fh:
        fh.write(json.dumps(event, sort_keys=True) + "\n")
    return event
