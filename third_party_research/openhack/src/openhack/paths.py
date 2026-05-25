from __future__ import annotations

import os
from pathlib import Path

ROOT_MARKERS = ("agents/experts", "templates/scenario-prompt.md")

RUN_DIRS = [
    "sourcecode",
    "recon-output",
    "scenarios/backlog",
    "scenarios/finished",
    "findings",
    "logs",
]

TRIAGE_RUN_DIRS = [
    "finding-candidates",
    "finding-triage/prompts",
    "finding-triage/decisions",
]

ALL_RUN_DIRS = RUN_DIRS + TRIAGE_RUN_DIRS


def _has_root_markers(path: Path) -> bool:
    return all((path / marker).exists() for marker in ROOT_MARKERS)


def _walk_up(start: Path) -> Path | None:
    current = start.resolve()
    if current.is_file():
        current = current.parent
    for candidate in [current, *current.parents]:
        if _has_root_markers(candidate):
            return candidate
    return None


def root() -> Path:
    """Return the workspace root containing config, templates, agents, and runs."""
    configured = os.environ.get("OPENHACK_ROOT")
    if configured:
        path = Path(configured)
        if _has_root_markers(path):
            return path.resolve()
        raise RuntimeError(f"OPENHACK_ROOT is not a valid workspace root: {path}")
    for start in (Path.cwd(), Path(__file__).resolve()):
        found = _walk_up(start)
        if found:
            return found
    raise RuntimeError(
        "Could not find openhack workspace root. "
        "Run from the repository root or set up an editable install."
    )


def run_path(target: str, run_id: str) -> Path:
    return root() / "runs" / target / run_id


def ensure_run_dirs(target: str, run_id: str) -> Path:
    path = run_path(target, run_id)
    for name in ALL_RUN_DIRS:
        (path / name).mkdir(parents=True, exist_ok=True)
    return path
