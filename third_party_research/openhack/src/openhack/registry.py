"""Agent registry built from YAML frontmatter in agents/**/*.md."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Literal, cast

import yaml  # type: ignore[import-untyped]

from .models import AgentRegistry, Expert, OrchestrationAgent, ReconAgent

from .paths import root

AgentKind = Literal["experts", "orchestration", "reconnaissance"]

_KIND_DIRS = {
    "experts": "experts",
    "orchestration": "orchestration",
    "reconnaissance": "reconnaissance",
}


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    block = text[4:end]
    rest = text[end + len("\n---"):].lstrip("\n")
    return yaml.safe_load(block) or {}, rest


def _agent_files(kind: AgentKind) -> list[Path]:
    return sorted((root() / "agents" / _KIND_DIRS[kind]).glob("*.md"))


def _agent_meta(path: Path) -> dict[str, Any]:
    meta, _ = _split_frontmatter(path.read_text())
    if "id" not in meta:
        meta["id"] = path.stem
    return meta


def _load_kind(kind: AgentKind) -> list[dict[str, Any]]:
    return [_agent_meta(path) for path in _agent_files(kind)]


def load_experts() -> list[Expert]:
    return cast(list[Expert], _load_kind("experts"))


def load_registry() -> AgentRegistry:
    return {
        "experts": load_experts(),
        "orchestration": cast(list[OrchestrationAgent], _load_kind("orchestration")),
        "reconnaissance": cast(list[ReconAgent], _load_kind("reconnaissance")),
    }


def expert_ids() -> list[str]:
    return [expert["id"] for expert in load_experts()]


def filter_registry(experts: Iterable[str]) -> AgentRegistry:
    selected = set(experts)
    registry = load_registry()
    registry["experts"] = [
        expert for expert in registry.get("experts", [])
        if expert.get("id") in selected
    ]
    return registry
